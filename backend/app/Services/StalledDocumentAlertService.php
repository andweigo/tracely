<?php

namespace App\Services;

use App\Models\Document;
use App\Models\Office;
use App\Models\RoutingTransaction;
use App\Models\User;
use App\Models\UserNotification;
use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class StalledDocumentAlertService
{
    public const DEFAULT_STALLED_HOURS = 24;

    public const COOLDOWN_HOURS = 12;

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly RealtimeEventHub $realtime,
    ) {}

    /**
     * Evaluate SLA state, per-category SLA policy thresholds, escalation triggers,
     * and idle ("tengga") duration for a document.
     *
     * @return array{
     *   slaState: string,
     *   idleHours: int,
     *   idleLabel: string,
     *   isStalled: bool,
     *   shouldEscalate: bool,
     *   stalledThresholdHours: int,
     *   escalationHours: int|null,
     *   escalationOfficeId: string|null,
     *   escalationOfficeCode: string|null,
     *   escalationOfficeName: string|null,
     *   lastActivityAt: CarbonInterface,
     *   targetOfficeId: string,
     *   targetOfficeCode: string,
     *   targetOfficeName: string,
     *   targetHolderId: string|null,
     *   targetHolderName: string|null,
     *   isInTransit: bool
     * }
     */
    public function evaluate(Document $doc, ?int $thresholdHours = null): array
    {
        $doc->loadMissing([
            'category.slaPolicy.escalateToOffice',
            'currentOffice',
            'currentHolder',
            'transactions.toOffice',
            'transactions.fromOffice',
            'transactions.toUser',
            'transactions.fromUser',
        ]);

        $policy = $doc->category?->slaPolicy;
        $hasActivePolicy = $policy !== null && $policy->active;

        $defaultThreshold = (int) env('DOCTRACK_STALLED_HOURS', self::DEFAULT_STALLED_HOURS);
        $threshold = max(
            1,
            $thresholdHours ?? ($hasActivePolicy ? (int) $policy->stalled_alert_hours : $defaultThreshold),
        );

        /** @var RoutingTransaction|null $latest */
        $latest = $doc->transactions->sortBy('sent_at')->last();
        $isInTransit = $latest !== null && $latest->receipt_status === 'pending';

        $lastActivityAt = $latest?->acknowledged_at
            ?? $latest?->sent_at
            ?? $doc->updated_at
            ?? $doc->created_at
            ?? now();

        $idleHours = (int) max(0, $lastActivityAt->diffInHours(now()));
        $slaState = $this->computeSlaState($doc);

        $isFinalized = in_array($doc->lifecycle_status, ['approved', 'archived'], true);
        $isStalled = ! $isFinalized && ($idleHours >= $threshold || $slaState === 'overdue');

        $escalationOffice = $hasActivePolicy ? $policy->escalateToOffice : null;
        $escalationHours = $hasActivePolicy && $policy->escalation_hours > 0 ? (int) $policy->escalation_hours : null;
        $shouldEscalate = ! $isFinalized
            && $escalationOffice !== null
            && $escalationHours !== null
            && $idleHours >= $escalationHours;

        $targetOffice = $isInTransit && $latest?->toOffice ? $latest->toOffice : $doc->currentOffice;
        $targetOfficeId = (string) ($targetOffice?->id ?? $doc->current_office_id);
        $targetOfficeCode = (string) ($targetOffice?->code ?? 'HQ');
        $targetOfficeName = (string) ($targetOffice?->name ?? 'Assigned Office');

        $targetHolderId = $isInTransit && $latest?->to_user_id ? $latest->to_user_id : $doc->current_holder_id;
        $targetHolderName = $isInTransit && $latest?->toUser?->full_name
            ? $latest->toUser->full_name
            : ($doc->currentHolder?->full_name ?? null);

        return [
            'slaState' => $slaState,
            'idleHours' => $idleHours,
            'idleLabel' => $this->formatIdleLabel($idleHours),
            'isStalled' => $isStalled,
            'shouldEscalate' => $shouldEscalate,
            'stalledThresholdHours' => $threshold,
            'escalationHours' => $escalationHours,
            'escalationOfficeId' => $escalationOffice?->id,
            'escalationOfficeCode' => $escalationOffice?->code,
            'escalationOfficeName' => $escalationOffice?->name,
            'lastActivityAt' => $lastActivityAt,
            'targetOfficeId' => $targetOfficeId,
            'targetOfficeCode' => $targetOfficeCode,
            'targetOfficeName' => $targetOfficeName,
            'targetHolderId' => $targetHolderId,
            'targetHolderName' => $targetHolderName,
            'isInTransit' => $isInTransit,
        ];
    }

    /**
     * Send a manual or automatic follow-up alert notification to the office holding / receiving the document.
     *
     * @return array{notification: UserNotification, targetOfficeCode: string, targetOfficeName: string}
     */
    public function notifyOfficeForDocument(
        Document $doc,
        ?User $actor = null,
        ?string $customMessage = null,
        bool $isAutomatic = false,
    ): array {
        $eval = $this->evaluate($doc);

        $targetUser = null;
        if ($eval['targetHolderId']) {
            $targetUser = User::query()->where('id', $eval['targetHolderId'])->where('active', true)->first();
        }
        if (! $targetUser) {
            $targetUser = User::query()
                ->where('office_id', $eval['targetOfficeId'])
                ->where('active', true)
                ->orderByRaw("CASE WHEN role = 'unit_head' THEN 0 ELSE 1 END")
                ->first();
        }

        $officeStaffIds = User::query()
            ->where('office_id', $eval['targetOfficeId'])
            ->where('active', true)
            ->pluck('id')
            ->all();

        $actionHint = $eval['isInTransit']
            ? 'awaiting receipt confirmation'
            : 'pending action at your office desk';

        $trimmedCustom = trim((string) ($customMessage ?? ''));
        $prefix = $isAutomatic ? 'Auto Stalled Document Alert' : 'Admin Follow-Up Alert';
        $shouldMask = $eval['isInTransit'] || $doc->confidentiality_tier === 'confidential';
        $displayCode = $shouldMask ? $this->maskTrackingCode($doc->tracking_code) : $doc->tracking_code;
        $title = "{$prefix} · {$displayCode}";

        $safeSubject = $shouldMask
            ? ($doc->confidentiality_tier === 'confidential'
                ? 'a sealed confidential document'
                : 'a sealed incoming transfer')
            : "Document \"{$doc->title}\" ({$doc->tracking_code})";

        $body = $trimmedCustom !== ''
            ? $trimmedCustom
            : ucfirst($safeSubject)." has been {$actionHint} in {$eval['targetOfficeName']} for {$eval['idleLabel']}. Please acknowledge or process promptly.";

        // RA 10173 privacy-safe lock screen preview (never exposes confidential or sealed titles)
        $lockPreview = $isAutomatic
            ? "Automatic SLA reminder for {$eval['targetOfficeCode']}: a tracked document has been idle for {$eval['idleLabel']}."
            : "Follow-up alert from Tracely Admin for {$eval['targetOfficeCode']} regarding a pending document.";

        $notification = UserNotification::query()->create([
            'id' => 'notif-'.Str::uuid()->toString(),
            'target_user_id' => $targetUser?->id ?? ($officeStaffIds[0] ?? ($actor?->id ?? 'usr-records-1')),
            'target_office_id' => $eval['targetOfficeId'],
            'document_id' => $doc->id,
            'title' => $title,
            'content' => $body,
            'lock_screen_preview' => $lockPreview,
            'authenticated_detail' => "{$displayCode} · {$body}",
            'received_at' => now(),
            'read' => false,
        ]);

        $this->realtime->publish(
            'notification_created',
            [$eval['targetOfficeId']],
            $officeStaffIds,
            $doc->id,
            $lockPreview,
        );

        $auditActor = $actor ?? $this->resolveSystemAuditActor();
        if ($auditActor) {
            $this->audit->record(
                $auditActor,
                $isAutomatic ? 'auto_stalled_alert_sent' : 'admin_office_alert_sent',
                $doc->id,
                $doc->tracking_code,
                ($isAutomatic ? 'Auto-alerted ' : 'Admin alerted ')."{$eval['targetOfficeCode']} ({$eval['targetOfficeName']}) for {$doc->tracking_code} ({$eval['idleLabel']} idle)".($trimmedCustom !== '' ? ": {$trimmedCustom}" : '.'),
                $isAutomatic ? 'Tracely SLA Watchdog' : 'Tracely Admin Portal',
            );
        }

        return [
            'notification' => $notification,
            'targetOfficeCode' => $eval['targetOfficeCode'],
            'targetOfficeName' => $eval['targetOfficeName'],
        ];
    }

    /**
     * Send an SLA Escalation Alert to the configured escalation office (e.g., Executive Office)
     * when a document exceeds its category's escalation_hours threshold.
     *
     * @return array{notification: UserNotification, escalationOfficeCode: string, escalationOfficeName: string}|null
     */
    public function escalateDocumentToOffice(
        Document $doc,
        Office $escalationOffice,
        ?User $actor = null,
    ): ?array {
        $eval = $this->evaluate($doc);

        $escUsers = User::query()
            ->where('office_id', $escalationOffice->id)
            ->where('active', true)
            ->orderByRaw("CASE WHEN role = 'unit_head' THEN 0 ELSE 1 END")
            ->get();

        $primaryTarget = $escUsers->first();
        $staffIds = $escUsers->pluck('id')->all();

        $shouldMask = $eval['isInTransit'] || $doc->confidentiality_tier === 'confidential';
        $displayCode = $shouldMask ? $this->maskTrackingCode($doc->tracking_code) : $doc->tracking_code;
        $safeSubject = $shouldMask
            ? ($doc->confidentiality_tier === 'confidential'
                ? 'a confidential document'
                : 'a sealed incoming transfer')
            : "\"{$doc->title}\" ({$doc->tracking_code})";

        $title = "SLA Escalation Alert · {$displayCode}";
        $body = "Escalated per {$doc->category?->code} SLA policy: {$safeSubject} has remained idle at {$eval['targetOfficeCode']} ({$eval['targetOfficeName']}) for {$eval['idleLabel']}.";
        $lockPreview = "SLA escalation notice for {$escalationOffice->code}: a delayed document at {$eval['targetOfficeCode']} requires attention.";

        $notification = UserNotification::query()->create([
            'id' => 'notif-'.Str::uuid()->toString(),
            'target_user_id' => $primaryTarget?->id ?? ($actor?->id ?? 'usr-osds-1'),
            'target_office_id' => $escalationOffice->id,
            'document_id' => $doc->id,
            'title' => $title,
            'content' => $body,
            'lock_screen_preview' => $lockPreview,
            'authenticated_detail' => "{$displayCode} · {$body}",
            'received_at' => now(),
            'read' => false,
        ]);

        $this->realtime->publish(
            'sla_escalated',
            [$escalationOffice->id],
            $staffIds,
            $doc->id,
            $lockPreview,
        );

        $auditActor = $actor ?? $this->resolveSystemAuditActor();
        if ($auditActor) {
            $this->audit->record(
                $auditActor,
                'sla_escalation_sent',
                $doc->id,
                $doc->tracking_code,
                "Escalated {$doc->tracking_code} (idle {$eval['idleLabel']} at {$eval['targetOfficeCode']}) to {$escalationOffice->code} ({$escalationOffice->name}).",
                'Tracely SLA Policy Engine',
            );
        }

        return [
            'notification' => $notification,
            'escalationOfficeCode' => $escalationOffice->code,
            'escalationOfficeName' => $escalationOffice->name,
        ];
    }

    /**
     * Automatically detect stalled ("tengga") documents and notify their holding/receiving offices
     * PLUS automatically escalate chronic breaches per category SlaPolicy while enforcing 12h cooldown.
     *
     * @return array{checked: int, stalled_count: int, alerts_sent: int, escalations_sent: int, alerted_codes: array<int, string>, escalated_codes: array<int, string>}
     */
    public function sweepAndNotify(?int $thresholdHours = null, ?User $triggeredBy = null): array
    {
        $documents = Document::query()
            ->with([
                'category.slaPolicy.escalateToOffice',
                'currentOffice',
                'currentHolder',
                'transactions.toOffice',
                'transactions.fromOffice',
            ])
            ->whereNotIn('lifecycle_status', ['approved', 'archived'])
            ->get();

        $stalledCount = 0;
        $alertsSent = 0;
        $escalationsSent = 0;
        $alertedCodes = [];
        $escalatedCodes = [];
        $cooldownCutoff = Carbon::now()->subHours(self::COOLDOWN_HOURS);

        foreach ($documents as $doc) {
            $eval = $this->evaluate($doc, $thresholdHours);
            if ($eval['isStalled']) {
                $stalledCount++;

                $recentlyAlerted = UserNotification::query()
                    ->where('document_id', $doc->id)
                    ->where('target_office_id', $eval['targetOfficeId'])
                    ->where('received_at', '>=', $cooldownCutoff)
                    ->where(function ($q): void {
                        $q->where('title', 'like', 'Auto Stalled Document Alert%')
                            ->orWhere('title', 'like', 'Admin Follow-Up Alert%');
                    })
                    ->exists();

                if (! $recentlyAlerted) {
                    $this->notifyOfficeForDocument($doc, $triggeredBy, null, true);
                    $alertsSent++;
                    $alertedCodes[] = $doc->tracking_code;
                }
            }

            if ($eval['shouldEscalate'] && $eval['escalationOfficeId']) {
                $recentlyEscalated = UserNotification::query()
                    ->where('document_id', $doc->id)
                    ->where('target_office_id', $eval['escalationOfficeId'])
                    ->where('received_at', '>=', $cooldownCutoff)
                    ->where('title', 'like', 'SLA Escalation Alert%')
                    ->exists();

                if (! $recentlyEscalated) {
                    /** @var Office|null $escOffice */
                    $escOffice = $doc->category?->slaPolicy?->escalateToOffice
                        ?? Office::query()->find($eval['escalationOfficeId']);
                    if ($escOffice) {
                        $this->escalateDocumentToOffice($doc, $escOffice, $triggeredBy);
                        $escalationsSent++;
                        $escalatedCodes[] = $doc->tracking_code;
                    }
                }
            }
        }

        return [
            'checked' => $documents->count(),
            'stalled_count' => $stalledCount,
            'alerts_sent' => $alertsSent,
            'escalations_sent' => $escalationsSent,
            'alerted_codes' => $alertedCodes,
            'escalated_codes' => $escalatedCodes,
        ];
    }

    /**
     * Lightweight throttled automatic sweep invoked on admin workspace loads
     * so stalled alerts & escalations fire automatically even without an external cron daemon.
     */
    public function runThrottledAutoSweep(?User $actor = null): ?array
    {
        if (! Cache::add('doctrack:stalled_auto_sweep_lock', true, now()->addMinutes(10))) {
            return null;
        }

        return $this->sweepAndNotify(null, $actor);
    }

    public function computeSlaState(Document $doc): string
    {
        if (in_array($doc->lifecycle_status, ['approved', 'archived'], true)) {
            return 'on_track';
        }
        if (! $doc->sla_due_at) {
            return 'on_track';
        }
        $now = now();
        if ($doc->sla_due_at->lessThan($now)) {
            return 'overdue';
        }
        if ($doc->sla_due_at->lessThanOrEqualTo($now->copy()->addHours(12))) {
            return 'at_risk';
        }

        return 'on_track';
    }

    private function formatIdleLabel(int $hours): string
    {
        if ($hours < 1) {
            return '<1h';
        }
        if ($hours < 24) {
            return "{$hours}h";
        }
        $days = intdiv($hours, 24);
        $rem = $hours % 24;

        return $rem > 0 ? "{$days}d {$rem}h" : "{$days}d";
    }

    private function maskTrackingCode(string $code): string
    {
        $clean = trim($code);
        if ($clean === '') {
            return 'TRC-••••••';
        }
        $lastDash = strrpos($clean, '-');
        if ($lastDash !== false && $lastDash > 0) {
            return substr($clean, 0, $lastDash + 1).'••••••';
        }

        return substr($clean, 0, 4).'••••';
    }

    private function resolveSystemAuditActor(): ?User
    {
        return User::query()
            ->with('office')
            ->where('role', 'ict_admin')
            ->where('active', true)
            ->first()
            ?? User::query()->with('office')->where('active', true)->first();
    }
}
