<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DevicePushToken;
use App\Models\User;
use App\Services\RealtimeEventHub;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class RealtimeController extends Controller
{
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
     * Uses bounded duration so PHP workers recycle cleanly without hanging.
     */
    public function stream(Request $request): StreamedResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $since = (int) $request->query('since', 0);
        $maxSeconds = max(1, min(20, (int) $request->query('max_seconds', 10)));

        return response()->stream(function () use ($actor, $since, $maxSeconds): void {
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
