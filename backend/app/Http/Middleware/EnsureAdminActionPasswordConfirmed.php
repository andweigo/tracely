<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\AuditLogger;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Symfony\Component\HttpFoundation\Response;

/**
 * Enforces an administrator password failsafe on every mutating Admin Portal action.
 */
class EnsureAdminActionPasswordConfirmed
{
    private const SESSION_KEY = 'admin_portal_user_id';

    public function __construct(
        private readonly AuditLogger $audit,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (in_array(strtoupper($request->method()), ['GET', 'HEAD', 'OPTIONS'], true)) {
            return $next($request);
        }

        $userId = (string) $request->session()->get(self::SESSION_KEY, '');
        /** @var User|null $admin */
        $admin = $userId !== '' ? User::query()->find($userId) : null;

        if (! $admin) {
            return redirect()->route('admin.login');
        }

        $providedPassword = (string) $request->input('admin_password', '');
        if ($providedPassword === '' || ! Hash::check($providedPassword, (string) $admin->password)) {
            $this->audit->record(
                $admin,
                'admin_action_password_failed',
                null,
                null,
                'Admin password failsafe failed for '.$request->method().' '.$request->path(),
                'Tracely Admin Portal',
            );

            $returnSection = trim((string) $request->input('return_section', 'overview')) ?: 'overview';

            return redirect()
                ->route('admin.dashboard', ['section' => $returnSection])
                ->with('admin_error', 'Incorrect administrator password. Action was not executed.');
        }

        return $next($request);
    }
}
