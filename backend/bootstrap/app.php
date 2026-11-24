<?php

use App\Exceptions\ApiDomainException;
use App\Http\Middleware\SecurityAndFloodShield;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Trust Railway / CDN reverse proxies by default so rate-limiters isolate real client IPs
        $middleware->trustProxies(at: env('TRUSTED_PROXIES', '*'));
        $middleware->append(SecurityAndFloodShield::class);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(function (Request $request, Throwable $e): bool {
            return $request->is('api/*') || $request->expectsJson();
        });

        $exceptions->render(function (ApiDomainException $e, Request $request) {
            return response()->json([
                'code' => $e->errorCode,
                'message' => $e->getMessage(),
            ], $e->status);
        });

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            $retryAfter = (int) ($e->getHeaders()['Retry-After'] ?? 60);

            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json([
                    'code' => 'RATE_LIMITED',
                    'message' => 'Too many requests. Please wait a moment and try again.',
                    'retry_after' => max(1, $retryAfter),
                ], 429, $e->getHeaders());
            }

            return response(
                'Too many requests. Please wait a moment and try again.',
                429,
                $e->getHeaders(),
            );
        });
    })->create();
