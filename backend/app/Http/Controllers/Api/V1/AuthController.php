<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiDomainException;
use App\Http\Controllers\Controller;
use App\Models\Office;
use App\Models\PasswordResetCode;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\RealtimeEventHub;
use App\Support\DtoSerializer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly RealtimeEventHub $realtime,
    ) {}
    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'identifier' => ['required', 'string', 'max:64'],
            'password' => ['required', 'string', 'max:64'],
            'device_name' => ['nullable', 'string', 'max:120'],
            'platform' => ['nullable', 'in:android,ios,web'],
        ]);

        $identifier = trim($validated['identifier']);
        $upper = strtoupper($identifier);
        $lower = strtolower($identifier);

        /** @var User|null $user */
        $user = User::query()
            ->with('office')
            ->whereRaw('UPPER(employee_id) = ?', [$upper])
            ->orWhereRaw('LOWER(email) = ?', [$lower])
            ->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw new ApiDomainException(
                'INVALID_CREDENTIALS',
                'Invalid Employee ID/email or password.',
                401,
            );
        }

        if ($user->approval_status !== 'approved') {
            $isRejected = $user->approval_status === 'rejected';

            return response()->json([
                'code' => $isRejected ? 'ACCOUNT_REJECTED' : 'ACCOUNT_PENDING_APPROVAL',
                'approval_status' => $isRejected ? 'rejected' : 'pending',
                'message' => $isRejected
                    ? 'Your account registration was not approved. Please contact your system administrator.'
                    : 'Your account registration is still awaiting administrator approval.',
                'status_token' => $this->issueRegistrationStatusToken($user),
                'submitted' => $this->serializePendingSubmission($user),
            ], 403);
        }

        if (! $user->active) {
            throw new ApiDomainException(
                'ACCOUNT_INACTIVE',
                'This account is deactivated. Contact your system administrator.',
                403,
            );
        }

        $deviceName = trim((string) ($validated['device_name'] ?? 'Tracely Client'));
        $platform = $validated['platform'] ?? $this->inferPlatform($deviceName);
        $expiresAt = now()->addDays(7);

        $newToken = $user->createToken($deviceName, ['*'], $expiresAt);
        $newToken->accessToken->forceFill([
            'platform' => $platform,
            'ip_hint' => $request->ip() ?: 'Workspace Network',
            'last_used_at' => now(),
        ])->save();

        return response()->json([
            'token' => $newToken->plainTextToken,
            'bearer_token' => $newToken->plainTextToken,
            'expires_at' => $expiresAt->toIso8601String(),
            'user' => DtoSerializer::personnel($user),
        ]);
    }

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'full_name' => ['required', 'string', 'min:2', 'max:50'],
            'employee_id' => ['required', 'string', 'min:4', 'max:16', 'regex:/^[A-Za-z0-9-]+$/'],
            'email' => ['required', 'email', 'max:64'],
            'position' => ['required', 'string', 'min:2', 'max:50'],
            'office_code' => ['required', 'string', 'min:2', 'max:12', 'regex:/^[A-Za-z0-9_-]+$/'],
            'custom_office_name' => ['nullable', 'string', 'min:3', 'max:50'],
            'password' => ['required', 'string', 'min:8', 'max:32'],
            'device_name' => ['nullable', 'string', 'max:120'],
        ]);

        $this->assertStrongPassword($validated['password']);

        $employeeId = strtoupper(trim($validated['employee_id']));
        if (\App\Models\SystemSetting::getBool('registration_paused', false)) {
            throw new ApiDomainException(
                'REGISTRATION_PAUSED',
                'New account registration is currently paused by your administrator.',
                403,
            );
        }

        $email = strtolower(trim($validated['email']));
        $officeCode = strtoupper(trim($validated['office_code']));

        if (User::query()->whereRaw('UPPER(employee_id) = ?', [$employeeId])->exists()) {
            throw new ApiDomainException('DUPLICATE_EMPLOYEE_ID', 'Employee ID is already registered.');
        }
        if (User::query()->whereRaw('LOWER(email) = ?', [$email])->exists()) {
            throw new ApiDomainException('DUPLICATE_EMAIL', 'Email address is already registered.');
        }

        $office = Office::query()->whereRaw('UPPER(code) = ?', [$officeCode])->first();
        if (! $office) {
            $customName = trim((string) ($validated['custom_office_name'] ?? ''));
            if ($customName === '') {
                throw new ApiDomainException('INVALID_OFFICE', 'Selected office was not found.');
            }
            $office = Office::query()->create([
                'id' => 'off-'.Str::slug($officeCode).'-'.Str::lower(Str::random(4)),
                'code' => $officeCode,
                'name' => $customName,
                'is_custom' => true,
            ]);
        }

        $createdUser = User::query()->create([
            'id' => 'usr-'.Str::uuid()->toString(),
            'employee_id' => $employeeId,
            'full_name' => trim($validated['full_name']),
            'email' => $email,
            'position' => trim($validated['position']),
            'office_id' => $office->id,
            'role' => 'staff',
            'availability' => 'available',
            'active' => false,
            'approval_status' => 'pending',
            'password' => $validated['password'],
        ]);
        $createdUser->setRelation('office', $office);

        $this->realtime->publish('account_registered', [$office->id]);

        return response()->json([
            'pending_approval' => true,
            'approval_status' => 'pending',
            'status_token' => $this->issueRegistrationStatusToken($createdUser),
            'message' => 'Registration submitted for administrator verification.',
            'submitted' => $this->serializePendingSubmission($createdUser),
        ], 201);
    }

    public function registrationStatus(string $token): JsonResponse
    {
        $userId = $this->parseRegistrationStatusToken($token);
        if (! $userId) {
            return response()->json([
                'code' => 'INVALID_STATUS_TOKEN',
                'message' => 'This registration status link is invalid or has expired.',
            ], 404);
        }

        /** @var User|null $user */
        $user = User::query()->with('office')->find($userId);
        if (! $user) {
            return response()->json([
                'status' => 'rejected',
                'can_sign_in' => false,
                'message' => 'This registration record is no longer active. Contact your administrator or register again.',
                'submitted' => null,
            ]);
        }

        if ($user->approval_status === 'approved' && $user->active) {
            return response()->json([
                'status' => 'approved',
                'can_sign_in' => true,
                'message' => 'Your account has been verified and approved. You can now sign in to Tracely.',
                'submitted' => $this->serializePendingSubmission($user),
            ]);
        }

        if ($user->approval_status === 'rejected') {
            return response()->json([
                'status' => 'rejected',
                'can_sign_in' => false,
                'message' => 'Your account registration was not approved by an administrator. Contact ICT or HR for assistance.',
                'submitted' => $this->serializePendingSubmission($user),
            ]);
        }

        return response()->json([
            'status' => 'pending',
            'can_sign_in' => false,
            'message' => 'Your registration is awaiting administrator verification.',
            'submitted' => $this->serializePendingSubmission($user),
        ]);
    }

    private function issueRegistrationStatusToken(User $user): string
    {
        $payload = json_encode([
            'uid' => $user->id,
            'exp' => now()->addDays(14)->timestamp,
        ], JSON_THROW_ON_ERROR);

        $encoded = rtrim(strtr(base64_encode($payload), '+/', '-_'), '=');
        $sig = hash_hmac('sha256', $encoded, (string) config('app.key'));

        return $encoded.'.'.$sig;
    }

    private function parseRegistrationStatusToken(string $token): ?string
    {
        $parts = explode('.', trim($token), 2);
        if (count($parts) !== 2) {
            return null;
        }

        [$encoded, $providedSig] = $parts;
        if ($encoded === '' || ! preg_match('/^[0-9a-f]{64}$/i', $providedSig)) {
            return null;
        }

        $expectedSig = hash_hmac('sha256', $encoded, (string) config('app.key'));
        if (! hash_equals($expectedSig, strtolower($providedSig))) {
            return null;
        }

        $padded = strtr($encoded, '-_', '+/');
        $mod = strlen($padded) % 4;
        if ($mod !== 0) {
            $padded .= str_repeat('=', 4 - $mod);
        }

        $raw = base64_decode($padded, true);
        if ($raw === false) {
            return null;
        }

        $decoded = json_decode($raw, true);
        if (! is_array($decoded) || ! is_string($decoded['uid'] ?? null) || ! is_int($decoded['exp'] ?? null)) {
            return null;
        }

        if ($decoded['exp'] < now()->timestamp) {
            return null;
        }

        return $decoded['uid'];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializePendingSubmission(User $user): array
    {
        return [
            'full_name' => $user->full_name,
            'employee_id' => $user->employee_id,
            'email' => $user->email,
            'position' => $user->position,
            'office_code' => $user->office?->code ?? '',
            'office_name' => $user->office?->name ?? '',
            'submitted_at' => $user->created_at?->toIso8601String() ?? now()->toIso8601String(),
        ];
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'data' => DtoSerializer::personnel($request->user()),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'full_name' => ['sometimes', 'string', 'min:2', 'max:50', "regex:/^[A-Za-zÀ-ÖØ-öø-ÿ .,'-]+$/u"],
            'email' => ['sometimes', 'email', 'max:64'],
            'position' => ['sometimes', 'string', 'min:2', 'max:80'],
            'contact_number' => ['nullable', 'string', 'max:32', 'regex:/^[0-9+\-\s().]*$/'],
            'desk_note' => ['nullable', 'string', 'max:160'],
            'avatar_color' => ['nullable', 'in:#5736E4,#0D3472,#0F766E,#047857,#4338CA,#B45309,#BE123C'],
        ]);

        $updates = [];

        if (array_key_exists('full_name', $validated)) {
            $updates['full_name'] = trim($validated['full_name']);
        }
        // Account email is immutable via self-service profile updates
        if (array_key_exists('position', $validated)) {
            $updates['position'] = trim($validated['position']);
        }
        if (array_key_exists('contact_number', $validated)) {
            $contact = trim((string) ($validated['contact_number'] ?? ''));
            $updates['contact_number'] = $contact !== '' ? $contact : null;
        }
        if (array_key_exists('desk_note', $validated)) {
            $deskNote = trim((string) ($validated['desk_note'] ?? ''));
            $updates['desk_note'] = $deskNote !== '' ? $deskNote : null;
        }
        if (array_key_exists('avatar_color', $validated) && $validated['avatar_color']) {
            $updates['avatar_color'] = $validated['avatar_color'];
        }

        if ($updates !== []) {
            $user->update($updates);
            $this->audit->record(
                $user,
                'profile_updated',
                null,
                null,
                "Updated personal user profile details for {$user->full_name} ({$user->employee_id}).",
            );
            $this->realtime->publish('directory_updated', [$user->office_id], [$user->id]);
        }

        return response()->json([
            'data' => DtoSerializer::personnel($user->fresh('office')),
            'message' => 'User profile updated successfully.',
        ]);
    }

    public function updatePreferences(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $validated = $request->validate([
            'default_copy_format' => ['sometimes', 'in:digital,hard_copy'],
            'default_routing_scope' => ['sometimes', 'in:inter_office,internal_office'],
            'default_remarks' => ['nullable', 'string', 'max:120'],
            'default_landing_screen' => ['sometimes', 'in:inbox,scanner,sent,track'],
            'compact_density' => ['sometimes', 'boolean'],
            'desktop_notifications' => ['sometimes', 'boolean'],
            'notification_sound' => ['sometimes', 'boolean'],
            'hide_lock_screen_titles' => ['sometimes', 'boolean'],
        ]);

        $merged = DtoSerializer::userPreferences(array_merge(
            is_array($user->preferences) ? $user->preferences : [],
            $validated,
        ));

        $user->update(['preferences' => $merged]);
        $this->realtime->publish('preferences_updated', [$user->office_id], [$user->id]);

        return response()->json([
            'data' => DtoSerializer::personnel($user->fresh('office')),
            'preferences' => $merged,
            'message' => 'User preferences saved.',
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(['message' => 'Signed out and device session revoked.']);
    }

    public function sessions(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $currentToken = $user->currentAccessToken();
        $currentId = $currentToken instanceof PersonalAccessToken ? $currentToken->id : null;

        $tokens = $user->tokens()->orderByDesc('last_used_at')->get();

        return response()->json([
            'data' => $tokens->map(
                fn (PersonalAccessToken $t) => DtoSerializer::activeSession($t, $currentId),
            )->values()->all(),
        ]);
    }

    public function revokeOthers(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $currentToken = $user->currentAccessToken();
        $query = $user->tokens();
        if ($currentToken instanceof PersonalAccessToken) {
            $query->where('id', '!=', $currentToken->id);
        }

        $revokedCount = $query->delete();

        return response()->json(['revoked_count' => $revokedCount]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $newPasswordInput = $request->input('new_password', $request->input('password'));
        $request->merge(['resolved_new_password' => $newPasswordInput]);

        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'resolved_new_password' => ['required', 'string', 'min:8', 'max:32'],
        ]);

        /** @var User $user */
        $user = $request->user();
        if (! Hash::check($validated['current_password'], $user->password)) {
            throw new ApiDomainException('INVALID_CURRENT_PASSWORD', 'Current password is incorrect.');
        }

        $newPassword = $validated['resolved_new_password'];
        if ($newPassword === $validated['current_password']) {
            throw new ApiDomainException('REUSED_PASSWORD', 'New password must differ from your current password.');
        }

        $this->assertStrongPassword($newPassword);

        $user->update([
            'password' => $newPassword,
            'must_change_password' => false,
        ]);

        return response()->json([
            'message' => 'Password updated successfully.',
            'user' => DtoSerializer::personnel($user->fresh('office')),
        ]);
    }

    public function requestPasswordReset(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'identifier' => ['required', 'string', 'max:64'],
        ]);

        $identifier = trim($validated['identifier']);
        $upper = strtoupper($identifier);
        $lower = strtolower($identifier);

        $user = User::query()
            ->whereRaw('UPPER(employee_id) = ?', [$upper])
            ->orWhereRaw('LOWER(email) = ?', [$lower])
            ->first();

        $devCode = null;

        if ($user && $user->active && ($user->approval_status ?? 'approved') === 'approved') {
            PasswordResetCode::query()
                ->where('user_id', $user->id)
                ->whereNull('used_at')
                ->delete();

            $alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
            $raw6 = '';
            for ($i = 0; $i < 6; $i++) {
                $raw6 .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
            $formatted = substr($raw6, 0, 3).'-'.substr($raw6, 3);

            PasswordResetCode::query()->create([
                'id' => 'prc-'.Str::uuid()->toString(),
                'user_id' => $user->id,
                'code_hash' => Hash::make($raw6),
                'expires_at' => now()->addMinutes(15),
            ]);

            $this->audit->record(
                $user,
                'password_reset_requested',
                null,
                null,
                "Password reset code issued for {$user->full_name} ({$user->employee_id}).",
            );

            if (app()->environment(['local', 'testing'])) {
                $devCode = $formatted;
            }
        }

        $payload = [
            'message' => 'If an active Tracely account matches that Employee ID or email, a 15-minute reset code has been issued.',
            'expires_in_minutes' => 15,
        ];
        if ($devCode !== null) {
            $payload['dev_reset_code'] = $devCode;
        }

        return response()->json($payload);
    }

    public function confirmPasswordReset(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'identifier' => ['required', 'string', 'max:64'],
            'reset_code' => ['required', 'string', 'min:6', 'max:16'],
            'new_password' => ['required', 'string', 'min:8', 'max:32'],
        ]);

        $identifier = trim($validated['identifier']);
        $upper = strtoupper($identifier);
        $lower = strtolower($identifier);
        $cleanCode = strtoupper(str_replace('-', '', trim($validated['reset_code'])));

        $user = User::query()
            ->whereRaw('UPPER(employee_id) = ?', [$upper])
            ->orWhereRaw('LOWER(email) = ?', [$lower])
            ->first();

        if (! $user || ! $user->active || ($user->approval_status ?? 'approved') !== 'approved') {
            throw new ApiDomainException('INVALID_RESET_CODE', 'Invalid or expired reset code.', 422);
        }

        /** @var PasswordResetCode|null $record */
        $record = PasswordResetCode::query()
            ->where('user_id', $user->id)
            ->whereNull('used_at')
            ->orderByDesc('created_at')
            ->first();

        if (! $record || $record->expires_at->isPast() || ! Hash::check($cleanCode, $record->code_hash)) {
            throw new ApiDomainException('INVALID_RESET_CODE', 'Invalid or expired reset code.', 422);
        }

        $this->assertStrongPassword($validated['new_password']);

        $record->update(['used_at' => now()]);
        $user->update([
            'password' => $validated['new_password'],
            'must_change_password' => false,
        ]);
        $user->tokens()->delete();

        $this->audit->record(
            $user,
            'password_reset_completed',
            null,
            null,
            "Self-service password reset completed for {$user->full_name} ({$user->employee_id}); active sessions revoked.",
        );

        return response()->json([
            'message' => 'Password reset successful. Sign in with your new password.',
        ]);
    }

    public function updateAvailability(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'availability' => ['required', 'in:available,on_leave,official_business'],
            'delegate_id' => ['nullable', 'string', 'max:64'],
            'availability_until' => ['nullable', 'date'],
        ]);

        /** @var User $user */
        $user = $request->user();
        $delegateId = $validated['delegate_id'] ?? null;

        if ($delegateId !== null) {
            if ($delegateId === $user->id) {
                throw new ApiDomainException('INVALID_DELEGATE', 'You cannot assign yourself as your own delegate.');
            }
            $exists = User::query()
                ->where('id', $delegateId)
                ->where('active', true)
                ->where('approval_status', 'approved')
                ->exists();
            if (! $exists) {
                throw new ApiDomainException('DELEGATE_NOT_FOUND', 'Selected delegate personnel was not found.');
            }
        }

        $user->update([
            'availability' => $validated['availability'],
            'delegate_id' => $delegateId,
            'availability_until' => $validated['availability_until'] ?? null,
        ]);
        $this->realtime->publish('availability_updated', [$user->office_id], [$user->id]);

        return response()->json([
            'data' => DtoSerializer::personnel($user->fresh('office')),
        ]);
    }

    public function pendingUsers(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $this->assertCanManageApprovals($actor);

        $pending = User::query()
            ->with('office')
            ->where('approval_status', 'pending')
            ->orderByDesc('created_at')
            ->get();

        return response()->json([
            'data' => $pending->map(fn (User $u) => DtoSerializer::personnel($u))->values()->all(),
        ]);
    }

    public function approveUser(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $this->assertCanManageApprovals($actor);

        /** @var User|null $target */
        $target = User::query()->with('office')->find($id);
        if (! $target) {
            throw new ApiDomainException('USER_NOT_FOUND', 'Pending account was not found.', 404);
        }

        if ($target->approval_status === 'approved' && $target->active) {
            return response()->json([
                'data' => DtoSerializer::personnel($target),
                'message' => 'Account is already approved.',
            ]);
        }

        $target->update([
            'approval_status' => 'approved',
            'active' => true,
            'email_verified_at' => $target->email_verified_at ?? now(),
        ]);

        $this->audit->record(
            $actor,
            'account_approved',
            null,
            null,
            "Approved account registration for {$target->full_name} ({$target->employee_id}).",
        );

        $this->realtime->publish('directory_updated', [$actor->office_id, $target->office_id], [$target->id]);

        return response()->json([
            'data' => DtoSerializer::personnel($target->fresh('office')),
            'message' => "{$target->full_name} has been approved and can now sign in.",
        ]);
    }

    public function rejectUser(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $this->assertCanManageApprovals($actor);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:240'],
        ]);

        /** @var User|null $target */
        $target = User::query()->with('office')->find($id);
        if (! $target) {
            throw new ApiDomainException('USER_NOT_FOUND', 'Pending account was not found.', 404);
        }

        if ($target->id === $actor->id) {
            throw new ApiDomainException('INVALID_ACTION', 'You cannot reject your own account.');
        }

        $target->update([
            'approval_status' => 'rejected',
            'active' => false,
        ]);
        $target->tokens()->delete();

        $reason = trim((string) ($validated['reason'] ?? ''));
        $this->audit->record(
            $actor,
            'account_rejected',
            null,
            null,
            "Rejected account registration for {$target->full_name} ({$target->employee_id})".($reason !== '' ? ": {$reason}" : '.'),
        );

        $this->realtime->publish('directory_updated', [$actor->office_id, $target->office_id], [$target->id]);

        return response()->json([
            'data' => DtoSerializer::personnel($target->fresh('office')),
            'message' => "Registration for {$target->full_name} was rejected.",
        ]);
    }

    public function adminUsers(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $this->assertCanManageApprovals($actor);

        $users = User::query()
            ->with('office')
            ->orderBy('full_name')
            ->get();

        return response()->json([
            'data' => $users->map(fn (User $u) => DtoSerializer::personnel($u))->values()->all(),
        ]);
    }

    public function adminCreateUser(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $this->assertCanManageApprovals($actor);

        $validated = $request->validate([
            'full_name' => ['required', 'string', 'min:2', 'max:50'],
            'employee_id' => ['nullable', 'string', 'min:4', 'max:16', 'regex:/^[A-Za-z0-9-]+$/'],
            'email' => ['required', 'email', 'max:64'],
            'position' => ['required', 'string', 'min:2', 'max:120'],
            'office_id' => ['required', 'string', 'max:64'],
            'role' => ['required', 'in:staff,unit_head,records_officer,legal_officer,ict_admin'],
            'password' => ['required', 'string', 'min:8', 'max:32'],
        ]);

        $this->assertStrongPassword($validated['password']);

        $rawEmpId = trim((string) ($validated['employee_id'] ?? ''));
        $employeeId = $rawEmpId !== ''
            ? strtoupper($rawEmpId)
            : 'TRC-'.str_pad((string) (User::query()->count() + 1001), 4, '0', STR_PAD_LEFT);
        $email = strtolower(trim($validated['email']));

        if (User::query()->whereRaw('UPPER(employee_id) = ?', [$employeeId])->exists()) {
            throw new ApiDomainException('DUPLICATE_EMPLOYEE_ID', 'Employee ID is already registered.');
        }
        if (User::query()->whereRaw('LOWER(email) = ?', [$email])->exists()) {
            throw new ApiDomainException('DUPLICATE_EMAIL', 'Email address is already registered.');
        }
        $office = Office::query()->find($validated['office_id']);
        if (! $office) {
            throw new ApiDomainException('INVALID_OFFICE', 'Target office was not found.', 422);
        }

        $created = User::query()->create([
            'id' => 'usr-'.Str::uuid()->toString(),
            'employee_id' => $employeeId,
            'full_name' => trim($validated['full_name']),
            'email' => $email,
            'position' => trim($validated['position']),
            'office_id' => $office->id,
            'role' => $validated['role'],
            'availability' => 'available',
            'active' => true,
            'approval_status' => 'approved',
            'email_verified_at' => now(),
            'password' => $validated['password'],
        ]);

        $this->audit->record(
            $actor,
            'account_provisioned',
            null,
            null,
            "Provisioned verified account for {$created->full_name} ({$created->employee_id}) in {$office->code} as {$created->role}.",
        );

        $this->realtime->publish('directory_updated', [$actor->office_id, $office->id], [$created->id]);

        return response()->json([
            'data' => DtoSerializer::personnel($created->fresh('office')),
            'message' => "Provisioned {$created->full_name} ({$created->employee_id}) in {$office->code}.",
        ], 201);
    }

    public function adminUpdateUser(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $this->assertCanManageApprovals($actor);

        $validated = $request->validate([
            'full_name' => ['sometimes', 'string', 'min:2', 'max:50'],
            'email' => ['sometimes', 'email', 'max:64'],
            'role' => ['sometimes', 'in:staff,unit_head,records_officer,legal_officer,ict_admin'],
            'office_id' => ['sometimes', 'string', 'max:64'],
            'position' => ['sometimes', 'string', 'min:2', 'max:120'],
            'availability' => ['sometimes', 'in:available,on_leave,official_business'],
            'active' => ['sometimes', 'boolean'],
            'new_password' => ['sometimes', 'string', 'min:8', 'max:32'],
        ]);

        /** @var User|null $target */
        $target = User::query()->with('office')->find($id);
        if (! $target) {
            throw new ApiDomainException('USER_NOT_FOUND', 'Personnel account was not found.', 404);
        }

        if (array_key_exists('active', $validated) && ! $validated['active'] && $target->id === $actor->id) {
            throw new ApiDomainException('SELF_DEACTIVATE_BLOCKED', 'You cannot deactivate your own active admin account.');
        }

        $updates = [];
        if (isset($validated['full_name'])) {
            $updates['full_name'] = trim($validated['full_name']);
        }
        if (isset($validated['email'])) {
            $email = strtolower(trim($validated['email']));
            $dup = User::query()
                ->whereRaw('LOWER(email) = ?', [$email])
                ->where('id', '!=', $target->id)
                ->exists();
            if ($dup) {
                throw new ApiDomainException('DUPLICATE_EMAIL', 'Email address is already in use by another account.', 422);
            }
            $updates['email'] = $email;
        }
        if (isset($validated['role'])) {
            $updates['role'] = $validated['role'];
        }
        if (isset($validated['position'])) {
            $updates['position'] = trim($validated['position']);
        }
        if (isset($validated['availability'])) {
            $updates['availability'] = $validated['availability'];
        }
        if (isset($validated['office_id'])) {
            $officeExists = Office::query()->where('id', $validated['office_id'])->exists();
            if (! $officeExists) {
                throw new ApiDomainException('INVALID_OFFICE', 'Target office was not found.', 422);
            }
            $updates['office_id'] = $validated['office_id'];
        }
        if (isset($validated['new_password'])) {
            $this->assertStrongPassword($validated['new_password']);
            $updates['password'] = $validated['new_password'];
            $updates['must_change_password'] = true;
        }

        $revokedTokens = 0;
        if (array_key_exists('active', $validated)) {
            $updates['active'] = (bool) $validated['active'];
            if ($updates['active']) {
                $updates['approval_status'] = 'approved';
            }
        }

        if ($updates !== []) {
            $target->update($updates);
        }

        if ((array_key_exists('active', $validated) && ! $validated['active']) || isset($validated['new_password'])) {
            $revokedTokens = $target->tokens()->delete();
        }

        $summary = array_key_exists('active', $validated) && ! $validated['active']
            ? "Deactivated {$target->full_name} ({$target->employee_id}) and revoked {$revokedTokens} active token(s)."
            : (isset($validated['new_password'])
                ? "Reset password for {$target->full_name} ({$target->employee_id}) and revoked {$revokedTokens} active token(s)."
                : "Updated profile/assignment for {$target->full_name} ({$target->employee_id}).");

        $this->audit->record(
            $actor,
            array_key_exists('active', $validated) && ! $validated['active']
                ? 'account_deactivated'
                : (isset($validated['new_password']) ? 'account_password_reset' : 'account_updated'),
            null,
            null,
            $summary,
        );

        $this->realtime->publish('directory_updated', [$actor->office_id, $target->office_id], [$target->id]);

        return response()->json([
            'data' => DtoSerializer::personnel($target->fresh('office')),
            'revoked_tokens' => $revokedTokens,
            'message' => $summary,
        ]);
    }

    public function adminCreateOffice(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $this->assertCanManageApprovals($actor);

        $validated = $request->validate([
            'code' => ['required', 'string', 'min:2', 'max:20', 'regex:/^[A-Za-z0-9\-_]+$/'],
            'name' => ['required', 'string', 'min:3', 'max:120'],
            'is_custom' => ['nullable', 'boolean'],
        ]);

        $code = strtoupper(trim($validated['code']));
        $name = trim($validated['name']);

        if (Office::query()->whereRaw('UPPER(code) = ?', [$code])->exists()) {
            throw new ApiDomainException('DUPLICATE_OFFICE_CODE', "Office code {$code} already exists.");
        }

        $office = Office::query()->create([
            'id' => 'off-'.Str::slug($code).'-'.Str::lower(Str::random(4)),
            'code' => $code,
            'name' => $name,
            'is_custom' => (bool) ($validated['is_custom'] ?? false),
        ]);

        $this->audit->record(
            $actor,
            'office_created',
            null,
            null,
            "Created office {$office->code} ({$office->name}).",
        );

        $this->realtime->publish('directory_updated', [$actor->office_id, $office->id]);

        return response()->json(['data' => DtoSerializer::office($office)], 201);
    }

    public function adminUpdateOffice(Request $request, string $id): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $this->assertCanManageApprovals($actor);

        $validated = $request->validate([
            'code' => ['sometimes', 'string', 'min:2', 'max:20', 'regex:/^[A-Za-z0-9\-_]+$/'],
            'name' => ['sometimes', 'string', 'min:3', 'max:120'],
        ]);

        /** @var Office|null $office */
        $office = Office::query()->find($id);
        if (! $office) {
            throw new ApiDomainException('OFFICE_NOT_FOUND', 'Office was not found.', 404);
        }

        $updates = [];
        if (isset($validated['code'])) {
            $newCode = strtoupper(trim($validated['code']));
            $dup = Office::query()
                ->whereRaw('UPPER(code) = ?', [$newCode])
                ->where('id', '!=', $office->id)
                ->exists();
            if ($dup) {
                throw new ApiDomainException('DUPLICATE_OFFICE_CODE', "Office code {$newCode} already exists.");
            }
            $updates['code'] = $newCode;
        }
        if (isset($validated['name'])) {
            $updates['name'] = trim($validated['name']);
        }

        if ($updates !== []) {
            $office->update($updates);
        }

        $this->audit->record(
            $actor,
            'office_updated',
            null,
            null,
            "Updated office {$office->code} ({$office->name}).",
        );

        $this->realtime->publish('directory_updated', [$actor->office_id, $office->id]);

        return response()->json(['data' => DtoSerializer::office($office->fresh())]);
    }

    private function assertCanManageApprovals(User $actor): void
    {
        if (in_array($actor->role, ['ict_admin', 'records_officer'], true)) {
            return;
        }
        $actor->loadMissing('office');
        $officeCode = strtoupper((string) ($actor->office?->code ?? ''));
        if ($actor->role === 'unit_head' && in_array($officeCode, ['HR', 'EXEC', 'ADMIN', 'OSDS', 'ICT'], true)) {
            return;
        }

        throw new ApiDomainException(
            'FORBIDDEN_APPROVAL_ROLE',
            'Only System Admins, Records Officers, or Executive/HR Unit Heads can review account approvals.',
            403,
        );
    }

    private function assertStrongPassword(string $password): void
    {
        if (
            strlen($password) < 8
            || strlen($password) > 32
            || ! preg_match('/[A-Z]/', $password)
            || ! preg_match('/[a-z]/', $password)
            || ! preg_match('/[0-9]/', $password)
            || ! preg_match('/[^A-Za-z0-9\s]/', $password)
            || trim($password) !== $password
        ) {
            throw new ApiDomainException(
                'WEAK_PASSWORD',
                'Password must be 8–32 chars with uppercase, lowercase, number, and symbol.',
            );
        }

        $lower = strtolower($password);
        foreach (['password', '123456', 'qwerty', 'admin123', 'letmein', 'tracely123'] as $weak) {
            if (str_contains($lower, $weak)) {
                throw new ApiDomainException(
                    'WEAK_PASSWORD',
                    'Password contains a commonly guessed phrase.',
                );
            }
        }
    }

    private function inferPlatform(string $deviceName): string
    {
        $lower = strtolower($deviceName);
        if (str_contains($lower, 'android')) {
            return 'android';
        }
        if (str_contains($lower, 'ios') || str_contains($lower, 'iphone') || str_contains($lower, 'ipad')) {
            return 'ios';
        }

        return 'web';
    }
}
