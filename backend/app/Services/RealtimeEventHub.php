<?php

namespace App\Services;

use App\Models\DevicePushToken;
use App\Models\PushDeliveryLog;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Coordinates lightweight real-time event pulses (for SSE + fast non-blocking client sync),
 * privacy-safe FCM push dispatch when credentials are configured, and Push/Realtime diagnostics.
 */
class RealtimeEventHub
{
    private const GLOBAL_KEY = 'doctrack:rt:global';

    /**
     * @param  array<int, string>  $officeIds
     * @param  array<int, string>  $userIds
     */
    public function publish(
        string $eventType,
        array $officeIds = [],
        array $userIds = [],
        ?string $documentId = null,
        ?string $lockScreenPreview = null,
    ): int {
        $nextCursor = (int) round(microtime(true) * 1000);
        $currentGlobal = (int) Cache::get(self::GLOBAL_KEY.':cursor', 0);
        if ($nextCursor <= $currentGlobal) {
            $nextCursor = $currentGlobal + 1;
        }

        $payload = [
            'cursor' => $nextCursor,
            'event' => $eventType,
            'document_id' => $documentId,
            'occurred_at' => now()->toIso8601String(),
        ];

        Cache::put(self::GLOBAL_KEY.':cursor', $nextCursor, now()->addHours(12));
        Cache::put(self::GLOBAL_KEY.':event', $payload, now()->addHours(12));

        $cleanOfficeIds = array_values(array_unique(array_filter($officeIds)));
        foreach ($cleanOfficeIds as $officeId) {
            Cache::put("doctrack:rt:office:{$officeId}:cursor", $nextCursor, now()->addHours(12));
            Cache::put("doctrack:rt:office:{$officeId}:event", $payload, now()->addHours(12));
        }

        $cleanUserIds = array_values(array_unique(array_filter($userIds)));
        foreach ($cleanUserIds as $userId) {
            Cache::put("doctrack:rt:user:{$userId}:cursor", $nextCursor, now()->addHours(12));
            Cache::put("doctrack:rt:user:{$userId}:event", $payload, now()->addHours(12));
        }

        if ($cleanUserIds !== [] && $lockScreenPreview !== null) {
            $this->dispatchPrivacySafePush(
                $cleanUserIds,
                $cleanOfficeIds[0] ?? null,
                $lockScreenPreview,
                $documentId,
                $eventType,
            );
        }

        return $nextCursor;
    }

    /**
     * @return array{cursor: int, event: ?array<string, mixed>}
     */
    public function stateFor(User $actor): array
    {
        $userCursor = (int) Cache::get("doctrack:rt:user:{$actor->id}:cursor", 0);
        $officeCursor = (int) Cache::get("doctrack:rt:office:{$actor->office_id}:cursor", 0);
        $globalCursor = (int) Cache::get(self::GLOBAL_KEY.':cursor', 0);

        $cursor = max($userCursor, $officeCursor, $globalCursor);
        $event = null;

        if ($userCursor === $cursor && $userCursor > 0) {
            $event = Cache::get("doctrack:rt:user:{$actor->id}:event");
        } elseif ($officeCursor === $cursor && $officeCursor > 0) {
            $event = Cache::get("doctrack:rt:office:{$actor->office_id}:event");
        } elseif ($globalCursor > 0) {
            $event = Cache::get(self::GLOBAL_KEY.':event');
        }

        return [
            'cursor' => $cursor,
            'event' => is_array($event) ? $event : null,
        ];
    }

    public function fcmConfigured(): bool
    {
        return $this->loadFcmV1ServiceAccount() !== null;
    }

    /**
     * Snapshot of Realtime Pulse / SSE cursor, FCM readiness, token health, and queue backlogs.
     *
     * @return array{
     *   global_cursor: int,
     *   last_event: ?array<string, mixed>,
     *   fcm_configured: bool,
     *   total_tokens: int,
     *   android_tokens: int,
     *   ios_tokens: int,
     *   web_tokens: int,
     *   stale_tokens: int,
     *   unread_notifications: int,
     *   failed_pushes_7d: int,
     *   sent_pushes_7d: int,
     *   pending_queue_jobs: int,
     *   failed_queue_jobs: int
     * }
     */
    public function diagnosticsSnapshot(): array
    {
        $globalCursor = (int) Cache::get(self::GLOBAL_KEY.':cursor', 0);
        $lastEvent = Cache::get(self::GLOBAL_KEY.':event');

        $tokens = DevicePushToken::query()->get();
        $staleCutoff = now()->subDays(30);
        $staleCount = $tokens->filter(
            fn (DevicePushToken $t) => $t->last_seen_at !== null && $t->last_seen_at->lessThan($staleCutoff),
        )->count();

        $failed7d = 0;
        $sent7d = 0;
        if (Schema::hasTable('push_delivery_logs')) {
            $since = now()->subDays(7);
            $failed7d = PushDeliveryLog::query()
                ->where('occurred_at', '>=', $since)
                ->where('status', 'failed')
                ->count();
            $sent7d = PushDeliveryLog::query()
                ->where('occurred_at', '>=', $since)
                ->where('status', 'sent')
                ->count();
        }

        $pendingJobs = Schema::hasTable('jobs') ? (int) DB::table('jobs')->count() : 0;
        $failedJobs = Schema::hasTable('failed_jobs') ? (int) DB::table('failed_jobs')->count() : 0;

        return [
            'global_cursor' => $globalCursor,
            'last_event' => is_array($lastEvent) ? $lastEvent : null,
            'fcm_configured' => $this->fcmConfigured(),
            'total_tokens' => $tokens->count(),
            'android_tokens' => $tokens->where('platform', 'android')->count(),
            'ios_tokens' => $tokens->where('platform', 'ios')->count(),
            'web_tokens' => $tokens->where('platform', 'web')->count(),
            'stale_tokens' => $staleCount,
            'unread_notifications' => UserNotification::query()->where('read', false)->count(),
            'failed_pushes_7d' => $failed7d,
            'sent_pushes_7d' => $sent7d,
            'pending_queue_jobs' => $pendingJobs,
            'failed_queue_jobs' => $failedJobs,
        ];
    }

    /**
     * Dispatches RA 10173 privacy-safe push notifications (zero titles/PII on lock screen)
     * to registered devices and logs delivery telemetry for Admin Diagnostics.
     *
     * @param  array<int, string>  $userIds
     */
    private function dispatchPrivacySafePush(
        array $userIds,
        ?string $officeId,
        string $lockScreenPreview,
        ?string $documentId,
        string $eventType,
    ): void {
        $primaryUserId = $userIds[0] ?? null;
        $tokens = DevicePushToken::query()
            ->whereIn('user_id', $userIds)
            ->pluck('token')
            ->filter()
            ->values()
            ->all();

        $serviceAccount = $this->loadFcmV1ServiceAccount();

        if ($tokens === []) {
            $this->recordPushLog($eventType, $documentId, $primaryUserId, $officeId, 0, 'no_tokens', null, 'No registered push tokens for target user(s).');

            return;
        }

        if ($serviceAccount === null) {
            $this->recordPushLog($eventType, $documentId, $primaryUserId, $officeId, count($tokens), 'skipped_unconfigured', null, 'FCM HTTP v1 service account not configured — delivered via Realtime Pulse/SSE.');

            return;
        }

        $accessToken = $this->resolveFcmV1AccessToken($serviceAccount);
        if ($accessToken === null) {
            $this->recordPushLog($eventType, $documentId, $primaryUserId, $officeId, count($tokens), 'failed', null, 'Failed to obtain FCM HTTP v1 OAuth2 access token.');

            return;
        }

        $projectId = $serviceAccount['project_id'];
        $endpoint = "https://fcm.googleapis.com/v1/projects/{$projectId}/messages:send";
        $sentCount = 0;
        $lastStatus = null;
        $lastError = null;

        foreach ($tokens as $deviceToken) {
            try {
                $response = Http::timeout(4)
                    ->withToken($accessToken)
                    ->acceptJson()
                    ->post($endpoint, [
                        'message' => [
                            'token' => $deviceToken,
                            'notification' => [
                                'title' => 'Tracely Custody Alert',
                                'body' => $lockScreenPreview,
                            ],
                            'data' => [
                                'event' => $eventType,
                                'document_id' => $documentId ?? '',
                            ],
                            'android' => [
                                'priority' => 'HIGH',
                            ],
                        ],
                    ]);

                $lastStatus = $response->status();
                if ($response->successful()) {
                    $sentCount++;
                } else {
                    $lastError = Str::limit($response->body(), 240);
                }
            } catch (\Throwable $e) {
                $lastError = Str::limit($e->getMessage(), 240);
            }
        }

        if ($sentCount > 0) {
            $this->recordPushLog($eventType, $documentId, $primaryUserId, $officeId, $sentCount, 'sent', $lastStatus ?? 200, $lastError);
        } else {
            $this->recordPushLog($eventType, $documentId, $primaryUserId, $officeId, count($tokens), 'failed', $lastStatus, $lastError ?? 'FCM HTTP v1 dispatch failed.');
        }
    }

    /**
     * @return array{project_id: string, client_email: string, private_key: string, token_uri: string}|null
     */
    private function loadFcmV1ServiceAccount(): ?array
    {
        $rawJson = trim((string) env('FCM_SERVICE_ACCOUNT_JSON', ''));
        if ($rawJson === '') {
            $path = trim((string) env('FCM_SERVICE_ACCOUNT_PATH', ''));
            if ($path !== '' && is_file($path)) {
                $rawJson = trim((string) @file_get_contents($path));
            }
        }

        if ($rawJson === '') {
            return null;
        }

        $decoded = json_decode($rawJson, true);
        if (! is_array($decoded)) {
            return null;
        }

        $projectId = trim((string) (env('FCM_PROJECT_ID') ?: ($decoded['project_id'] ?? '')));
        $clientEmail = trim((string) ($decoded['client_email'] ?? ''));
        $privateKey = (string) ($decoded['private_key'] ?? '');
        $tokenUri = trim((string) ($decoded['token_uri'] ?? 'https://oauth2.googleapis.com/token'));

        if ($projectId === '' || $clientEmail === '' || $privateKey === '') {
            return null;
        }

        return [
            'project_id' => $projectId,
            'client_email' => $clientEmail,
            'private_key' => $privateKey,
            'token_uri' => $tokenUri,
        ];
    }

    /**
     * @param  array{project_id: string, client_email: string, private_key: string, token_uri: string}  $sa
     */
    private function resolveFcmV1AccessToken(array $sa): ?string
    {
        $cacheKey = 'tracely:fcm_v1:token:'.sha1($sa['project_id'].'|'.$sa['client_email']);
        $cached = Cache::get($cacheKey);
        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        if (! function_exists('openssl_sign')) {
            return null;
        }

        $now = time();
        $header = $this->base64UrlEncode((string) json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $claimSet = $this->base64UrlEncode((string) json_encode([
            'iss' => $sa['client_email'],
            'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
            'aud' => $sa['token_uri'],
            'iat' => $now,
            'exp' => $now + 3600,
        ]));

        $signature = '';
        $signingInput = "{$header}.{$claimSet}";
        if (! @openssl_sign($signingInput, $signature, $sa['private_key'], OPENSSL_ALGO_SHA256)) {
            return null;
        }

        $jwt = $signingInput.'.'.$this->base64UrlEncode($signature);

        try {
            $response = Http::timeout(5)
                ->asForm()
                ->post($sa['token_uri'], [
                    'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    'assertion' => $jwt,
                ]);

            if (! $response->successful()) {
                return null;
            }

            $token = $response->json('access_token');
            $expiresIn = max(120, (int) $response->json('expires_in', 3600) - 300);

            if (is_string($token) && $token !== '') {
                Cache::put($cacheKey, $token, now()->addSeconds($expiresIn));

                return $token;
            }
        } catch (\Throwable) {
            return null;
        }

        return null;
    }

    private function base64UrlEncode(string $raw): string
    {
        return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
    }

    private function recordPushLog(
        string $eventType,
        ?string $documentId,
        ?string $targetUserId,
        ?string $targetOfficeId,
        int $tokensTargeted,
        string $status,
        ?int $httpStatus,
        ?string $errorMessage,
    ): void {
        if (! Schema::hasTable('push_delivery_logs')) {
            return;
        }

        try {
            PushDeliveryLog::query()->create([
                'id' => 'plog-'.Str::uuid()->toString(),
                'event_type' => Str::limit($eventType, 48, ''),
                'document_id' => $documentId,
                'target_user_id' => $targetUserId,
                'target_office_id' => $targetOfficeId,
                'tokens_targeted' => $tokensTargeted,
                'status' => $status,
                'http_status' => $httpStatus,
                'error_message' => $errorMessage ? Str::limit($errorMessage, 250, '') : null,
                'occurred_at' => now(),
            ]);
        } catch (\Throwable) {
            // Never disrupt primary workflow if logging fails
        }
    }
}
