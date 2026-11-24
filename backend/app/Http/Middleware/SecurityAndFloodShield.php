<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

/**
 * Layer-7 DDoS & abuse shield:
 *  - Rejects oversized non-multipart API bodies early before JSON decoding
 *  - Enforces progressive temporary cooldown bans on IPs repeatedly tripping 429 rate limits
 *  - Attaches hardened browser & API security headers to every response
 */
class SecurityAndFloodShield
{
    private const MAX_NON_MULTIPART_BYTES = 2_097_152; // 2 MB

    private const STRIKE_WINDOW_SECONDS = 120;

    private const STRIKE_THRESHOLD = 25;

    private const BAN_SECONDS = 300;

    public function handle(Request $request, Closure $next): Response
    {
        // Health checks must never be blocked by flood shields
        if ($request->is('up') || $request->is('api/v1/health')) {
            return $this->applySecurityHeaders($request, $next($request));
        }

        // Reject abnormally large JSON / form payloads early (both Content-Length and chunked bodies)
        $contentLength = (int) $request->header('Content-Length', '0');
        $contentType = strtolower((string) $request->header('Content-Type', ''));
        $isMultipart = str_contains($contentType, 'multipart/form-data');

        if (! $isMultipart) {
            $bodyBytes = $contentLength > 0 ? $contentLength : strlen((string) $request->getContent());
            if ($bodyBytes > self::MAX_NON_MULTIPART_BYTES) {
                return $this->applySecurityHeaders($request, response()->json([
                    'code' => 'PAYLOAD_TOO_LARGE',
                    'message' => 'Request payload exceeds maximum allowed size.',
                ], 413));
            }
        }

        $shieldActive = ! app()->runningUnitTests() || (bool) config('app.enable_flood_shield_in_tests', false);
        $ip = (string) ($request->ip() ?: 'unknown');
        $ipHash = sha1($ip);
        $banKey = "tracely:ddos:ban:{$ipHash}";

        if ($shieldActive && Cache::has($banKey)) {
            $retryAfter = max(1, (int) Cache::get("{$banKey}:until", time() + 60) - time());

            if ($request->is('api/*') || $request->expectsJson()) {
                return $this->applySecurityHeaders($request, response()->json([
                    'code' => 'TEMPORARILY_BLOCKED',
                    'message' => 'Too many requests detected from your network. Please wait before trying again.',
                    'retry_after' => $retryAfter,
                ], 429, ['Retry-After' => (string) $retryAfter]));
            }

            return $this->applySecurityHeaders(
                $request,
                response('Too many requests. Please wait before trying again.', 429, ['Retry-After' => (string) $retryAfter]),
            );
        }

        /** @var Response $response */
        $response = $next($request);

        // Track repeated 429 rate-limit hits to fast-shed abusive bot floods from cache
        if ($shieldActive && $response->getStatusCode() === 429) {
            $strikeKey = "tracely:ddos:strikes:{$ipHash}";
            $strikes = (int) Cache::get($strikeKey, 0) + 1;
            Cache::put($strikeKey, $strikes, now()->addSeconds(self::STRIKE_WINDOW_SECONDS));

            if ($strikes >= self::STRIKE_THRESHOLD) {
                $until = time() + self::BAN_SECONDS;
                Cache::put($banKey, true, now()->addSeconds(self::BAN_SECONDS));
                Cache::put("{$banKey}:until", $until, now()->addSeconds(self::BAN_SECONDS));
                Cache::forget($strikeKey);
            }
        }

        return $this->applySecurityHeaders($request, $response);
    }

    private function applySecurityHeaders(Request $request, Response $response): Response
    {
        $response->headers->set('X-Content-Type-Options', 'nosniff', false);
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN', false);
        $response->headers->set('Referrer-Policy', 'strict-origin-when-cross-origin', false);
        $response->headers->set('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=()', false);

        if ($request->isSecure()) {
            $response->headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains', false);
        }

        return $response;
    }
}
