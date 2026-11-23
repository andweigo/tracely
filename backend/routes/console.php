<?php

use App\Models\DesktopPairing;
use App\Models\DocumentUnlockChallenge;
use App\Models\PasswordResetCode;
use App\Models\User;
use App\Services\StalledDocumentAlertService;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

$approveHandler = function (string $identifier): int {
    $clean = trim($identifier);
    $user = User::query()
        ->whereRaw('UPPER(employee_id) = ?', [strtoupper($clean)])
        ->orWhereRaw('LOWER(email) = ?', [strtolower($clean)])
        ->first();

    if (! $user) {
        $this->error("User '{$clean}' not found.");

        return self::FAILURE;
    }

    $user->update([
        'active' => true,
        'approval_status' => 'approved',
    ]);

    $this->info("Approved account {$user->employee_id} ({$user->email}).");

    return self::SUCCESS;
};

Artisan::command('tracely:approve {identifier}', $approveHandler)
    ->purpose('Approve a self-registered Tracely user account');
Artisan::command('doctrack:approve {identifier}', $approveHandler)
    ->purpose('Legacy alias for tracely:approve');

$stalledHandler = function (StalledDocumentAlertService $alerts): int {
    $rawHours = $this->option('hours');
    $hours = is_numeric($rawHours) && (int) $rawHours > 0 ? (int) $rawHours : null;
    $result = $alerts->sweepAndNotify($hours);
    $this->info(
        "Checked {$result['checked']} active document(s): {$result['stalled_count']} stalled, {$result['alerts_sent']} office alert(s), {$result['escalations_sent']} SLA escalation(s) dispatched."
    );

    return self::SUCCESS;
};

Artisan::command('tracely:alert-stalled-documents {--hours=}', $stalledHandler)
    ->purpose('Automatically alert offices and escalate stalled documents per SLA policy');
Artisan::command('doctrack:alert-stalled-documents {--hours=}', $stalledHandler)
    ->purpose('Legacy alias for tracely:alert-stalled-documents');

Artisan::command('tracely:prune-ephemeral', function (): int {
    $cutoff = now()->subDay();

    $deletedChallenges = DocumentUnlockChallenge::query()
        ->where('expires_at', '<', $cutoff)
        ->orWhere(function ($q) use ($cutoff): void {
            $q->whereNotNull('consumed_at')->where('consumed_at', '<', $cutoff);
        })
        ->delete();

    $deletedPairings = DesktopPairing::query()
        ->where('expires_at', '<', $cutoff)
        ->delete();

    $deletedResets = PasswordResetCode::query()
        ->where('expires_at', '<', $cutoff)
        ->orWhere(function ($q) use ($cutoff): void {
            $q->whereNotNull('used_at')->where('used_at', '<', $cutoff);
        })
        ->delete();

    $this->info(
        "Pruned {$deletedChallenges} unlock challenge(s), {$deletedPairings} desktop pairing(s), and {$deletedResets} password reset code(s)."
    );

    return self::SUCCESS;
})->purpose('Prune expired Tracely unlock challenges, desktop pairings, and password reset codes');

Schedule::command('tracely:alert-stalled-documents')->hourly();
Schedule::command('tracely:prune-ephemeral')->daily();
