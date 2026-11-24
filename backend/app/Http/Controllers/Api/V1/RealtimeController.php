<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DevicePushToken;
use App\Models\User;
use App\Services\RealtimeEventHub;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RealtimeController extends Controller
{
    private const MAX_STREAMS_PER_USER = 2;

    private const MAX_GLOBAL_STREAMS = 24;

    public function __construct(
        private readonly RealtimeEventHub $hub,
    ) {}

    /**
     * Ultra-lightweight non-blocking live pulse endpoint (~5ms) safe for single-threaded dev
     * servers and multi-worker production servers alike.
     */
    public function pulse(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $since = (int) $request->query('since', 0);
        $state = $this->hub->stateFor($actor);

        $registeredDevices = DevicePushToken::query()
            ->where('user_id', $actor->id)
            ->count();

        return response()->json([
            'cursor' => $state['cursor'],
            'changed' => $state['cursor'] > $since,
            'latest_event' => $state['event'],
            'transport' => 'live_pulse',
            'fcm_configured' => $this->hub->fcmConfigured(),
            'registered_push_devices' => $registeredDevices,
            'server_time' => now()->toIso8601String(),
        ]);
    }

    /**
     * Server-Sent Events (SSE) stream for production Nginx/Apache/Octane deployments.
     * Enforces per-user and global active stream caps so SSE connections cannot exhaust PHP workers.
     */
    public function stream(Request $request): StreamedResponse|JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $since = (int) $request->query('since', 0);
        $maxSeconds = max(1, min(15, (int) $request->query('max_seconds', 10)));

        $userStreamKey = "tracely:sse:user:{$actor->id}";
        $globalStreamKey = 'tracely:sse:global';

        $currentUserStreams = (int) Cache::get($userStreamKey, 0);
        $currentGlobalStreams = (int) Cache::get($globalStreamKey, 0);

        if ($currentUserStreams >= self::MAX_STREAMS_PER_USER || $currentGlobalStreams >= self::MAX_GLOBAL_STREAMS) {
            return response()->json([
                'code' => 'STREAM_CAPACITY_REACHED',
                'message' => 'Realtime stream capacity reached. Falling back to live pulse.',
                'fallback_transport' => 'live_pulse',
            ], 429, ['Retry-After' => '5']);
        }

        $ttl = now()->addSeconds($maxSeconds + 10);
        Cache::put($userStreamKey, $currentUserStreams + 1, $ttl);
        Cache::put($globalStreamKey, $currentGlobalStreams + 1, $ttl);

        return response()->stream(function () use ($actor, $since, $maxSeconds, $userStreamKey, $globalStreamKey): void {
            try {
                echo "retry: 2000\n\n";
                $lastCursor = $since;
                $deadline = microtime(true) + $maxSeconds;

                while (microtime(true) < $deadline) {
                    $state = $this->hub->stateFor($actor);
                    if ($state['cursor'] > $lastCursor) {
                        $lastCursor = $state['cursor'];
                        $json = json_encode($state['event'] ?? ['cursor' => $lastCursor, 'event' => 'sync']);
                        echo "event: workspace_update\n";
                        echo "id: {$lastCursor}\n";
                        echo "data: {$json}\n\n";
                        if (function_exists('ob_flush')) {
                            @ob_flush();
                        }
                        flush();
                        break;
                    }
                    if (connection_aborted()) {
                        break;
                    }
                    usleep(500_000);
                }

                echo "event: heartbeat\n";
                echo 'data: '.json_encode(['cursor' => $lastCursor, 'server_time' => now()->toIso8601String()])."\n\n";
                if (function_exists('ob_flush')) {
                    @ob_flush();
                }
                flush();
            } finally {
                $nextUser = max(0, (int) Cache::get($userStreamKey, 1) - 1);
                $nextGlobal = max(0, (int) Cache::get($globalStreamKey, 1) - 1);
                if ($nextUser === 0) {
                    Cache::forget($userStreamKey);
                } else {
                    Cache::put($userStreamKey, $nextUser, now()->addSeconds(30));
                }
                if ($nextGlobal === 0) {
                    Cache::forget($globalStreamKey);
                } else {
                    Cache::put($globalStreamKey, $nextGlobal, now()->addSeconds(30));
                }
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'X-Accel-Buffering' => 'no',
        ]);
    }

    public function registerPushToken(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'min:12', 'max:512'],
            'platform' => ['nullable', 'in:android,ios,web'],
            'device_label' => ['nullable', 'string', 'max:120'],
        ]);

        /** @var User $actor */
        $actor = $request->user();
        $existing = DevicePushToken::query()->where('token', $validated['token'])->first();

        if ($existing) {
            $existing->update([
                'user_id' => $actor->id,
                'platform' => $validated['platform'] ?? $existing->platform,
                'device_label' => trim((string) ($validated['device_label'] ?? $existing->device_label)) ?: 'Tracely Device',
                'last_seen_at' => now(),
            ]);
            $record = $existing;
        } else {
            $record = DevicePushToken::query()->create([
                'id' => 'dpt-'.Str::uuid()->toString(),
                'user_id' => $actor->id,
                'platform' => $validated['platform'] ?? 'android',
                'token' => $validated['token'],
                'device_label' => trim((string) ($validated['device_label'] ?? '')) ?: 'Tracely Device',
                'last_seen_at' => now(),
            ]);
        }

        return response()->json([
            'data' => [
                'id' => $record->id,
                'platform' => $record->platform,
                'device_label' => $record->device_label,
                'fcm_configured' => $this->hub->fcmConfigured(),
            ],
        ], 201);
    }

    public function unregisterPushToken(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:512'],
        ]);

        /** @var User $actor */
        $actor = $request->user();
        DevicePushToken::query()
            ->where('user_id', $actor->id)
            ->where('token', $validated['token'])
            ->delete();

        return response()->json(['removed' => true]);
    }
}
