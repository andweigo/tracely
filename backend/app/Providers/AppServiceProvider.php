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

        RateLimiter::for('auth-login', function (Request $request): Limit {
            $identifier = strtolower((string) $request->input('identifier', 'guest'));

            return Limit::perMinute(10)->by($request->ip().'|'.$identifier);
        });

        RateLimiter::for('auth-register', function (Request $request): Limit {
            return Limit::perMinute(6)->by((string) $request->ip());
        });

        RateLimiter::for('qr-verify', function (Request $request): Limit {
            return Limit::perMinute(30)->by((string) $request->ip());
        });

        RateLimiter::for('document-acknowledge', function (Request $request): Limit {
            $actorKey = (string) ($request->user()?->id ?? 'guest');

            return Limit::perMinute(10)->by($actorKey.'|'.$request->ip());
        });

        RateLimiter::for('qr-unlock-consume', function (Request $request): Limit {
            $actorKey = (string) ($request->user()?->id ?? 'guest');

            return Limit::perMinute(10)->by($actorKey.'|'.$request->ip());
        });

        RateLimiter::for('auth-password-reset', function (Request $request): Limit {
            $identifier = strtolower((string) $request->input('identifier', 'guest'));

            return Limit::perMinute(5)->by($request->ip().'|'.$identifier);
        });
    }
}
