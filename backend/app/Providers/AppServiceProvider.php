<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\View;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Schema::defaultStringLength(191);

        if (str_starts_with((string) config('app.url'), 'https://')) {
            URL::forceScheme('https');
        }

        View::addNamespace('admin', [
            base_path('../admin/views'),
        ]);

        // Global API burst & sustained protection
        RateLimiter::for('api-global', function (Request $request): Limit {
            if ($request->user()) {
                return Limit::perMinute(140)->by('user:'.$request->user()->id.'|'.$request->ip());
            }

            return Limit::perMinute(60)->by('ip:'.$request->ip());
        });

        // Composite login shield: per-account+IP AND per-IP cap to stop credential stuffing
        RateLimiter::for('auth-login', function (Request $request): array {
            $identifier = strtolower(trim((string) $request->input('identifier', 'guest')));
            $ip = (string) $request->ip();

            return [
                Limit::perMinute(10)->by($ip.'|'.$identifier),
                Limit::perMinute(25)->by('login-ip:'.$ip),
            ];
        });

        // Registration flood protection against mass bot signups
        RateLimiter::for('auth-register', function (Request $request): array {
            $ip = (string) $request->ip();

            return [
                Limit::perMinute(5)->by('reg-min:'.$ip),
                Limit::perHour(20)->by('reg-hr:'.$ip),
            ];
        });

        // Admin governance portal login protection
        RateLimiter::for('admin-login', function (Request $request): array {
            $identifier = strtolower(trim((string) $request->input('identifier', 'admin')));
            $ip = (string) $request->ip();

            return [
                Limit::perMinute(5)->by('admin-id:'.$ip.'|'.$identifier),
                Limit::perMinute(12)->by('admin-ip:'.$ip),
            ];
        });

        RateLimiter::for('qr-verify', function (Request $request): Limit {
            return Limit::perMinute(30)->by((string) $request->ip());
        });

        RateLimiter::for('document-acknowledge', function (Request $request): Limit {
            $actorKey = (string) ($request->user()?->id ?? 'guest');

            return Limit::perMinute(15)->by($actorKey.'|'.$request->ip());
        });

        RateLimiter::for('document-write', function (Request $request): Limit {
            $actorKey = (string) ($request->user()?->id ?? 'guest');

            return Limit::perMinute(35)->by('doc-write:'.$actorKey.'|'.$request->ip());
        });

        RateLimiter::for('qr-unlock-consume', function (Request $request): Limit {
            $actorKey = (string) ($request->user()?->id ?? 'guest');

            return Limit::perMinute(10)->by($actorKey.'|'.$request->ip());
        });

        RateLimiter::for('auth-password-reset', function (Request $request): array {
            $identifier = strtolower(trim((string) $request->input('identifier', 'guest')));
            $ip = (string) $request->ip();

            return [
                Limit::perMinute(5)->by($ip.'|'.$identifier),
                Limit::perMinute(12)->by('reset-ip:'.$ip),
            ];
        });

        RateLimiter::for('auth-registration-status', function (Request $request): Limit {
            return Limit::perMinute(30)->by((string) $request->ip());
        });

        RateLimiter::for('realtime-stream', function (Request $request): Limit {
            $actorKey = (string) ($request->user()?->id ?? 'guest');

            return Limit::perMinute(20)->by('sse:'.$actorKey.'|'.$request->ip());
        });

        RateLimiter::for('mobile-download-page', function (Request $request): Limit {
            return Limit::perMinute(45)->by('dl-page:'.$request->ip());
        });

        RateLimiter::for('mobile-download-apk', function (Request $request): Limit {
            return Limit::perMinute(12)->by('dl-apk:'.$request->ip());
        });
    }
}
