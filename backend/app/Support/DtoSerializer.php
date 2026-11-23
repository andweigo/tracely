<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\DocumentComment;
use App\Models\DocumentVersion;
use App\Models\ExternalMilestone;
use App\Models\Office;
use App\Models\RoutingTemplate;
use App\Models\RoutingTransaction;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\AccessPolicyService;
use Laravel\Sanctum\PersonalAccessToken;

class DtoSerializer
{
    public static function office(?Office $office): ?array
    {
        if (! $office) {
            return null;
        }

        return [
            'id' => $office->id,
            'code' => $office->code,
            'name' => $office->name,
            'isCustom' => (bool) $office->is_custom,
        ];
    }

    public static function userPreferences(?array $raw): array
    {
        $prefs = is_array($raw) ? $raw : [];

        return [
            'default_copy_format' => in_array($prefs['default_copy_format'] ?? null, ['digital', 'hard_copy'], true)
                ? $prefs['default_copy_format']
                : 'digital',
            'default_routing_scope' => in_array($prefs['default_routing_scope'] ?? null, ['inter_office', 'internal_office'], true)
                ? $prefs['default_routing_scope']
                : 'inter_office',
            'default_remarks' => is_string($prefs['default_remarks'] ?? null)
                ? mb_substr(trim($prefs['default_remarks']), 0, 120)
                : '',
            'default_landing_screen' => in_array($prefs['default_landing_screen'] ?? null, ['inbox', 'scanner', 'sent', 'track'], true)
                ? $prefs['default_landing_screen']
                : 'inbox',
            'compact_density' => (bool) ($prefs['compact_density'] ?? false),
            'desktop_notifications' => array_key_exists('desktop_notifications', $prefs)
                ? (bool) $prefs['desktop_notifications']
                : true,
            'notification_sound' => array_key_exists('notification_sound', $prefs)
                ? (bool) $prefs['notification_sound']
                : true,
            'hide_lock_screen_titles' => array_key_exists('hide_lock_screen_titles', $prefs)
                ? (bool) $prefs['hide_lock_screen_titles']
                : true,
        ];
    }

    public static function personnel(User $user): array
    {
        $user->loadMissing('office');

        return [
            'id' => $user->id,
            'employee_id' => $user->employee_id,
            'full_name' => $user->full_name,
            'position' => $user->position,
            'contact_number' => $user->contact_number,
            'desk_note' => $user->desk_note,
            'avatar_color' => $user->avatar_color ?: '#0D3472',
            'preferences' => self::userPreferences($user->preferences),
            'office' => self::office($user->office),
            'role' => $user->role,
            'email' => $user->email,
            'availability' => $user->availability,
            'availability_until' => $user->availability_until?->toIso8601String(),
            'delegate_id' => $user->delegate_id,
            'active' => (bool) $user->active,
            'approval_status' => $user->approval_status ?? 'approved',
            'must_change_password' => (bool) ($user->must_change_password ?? false),
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }

    public static function routingTemplate(RoutingTemplate $template): array
    {
        $template->loadMissing(['office', 'creator', 'category']);

        return [
            'id' => $template->id,
            'name' => $template->name,
            'description' => $template->description,
            'category_id' => $template->category_id,
            'category_name' => $template->category?->name,
            'office_id' => $template->office_id,
            'office_code' => $template->office?->code ?? 'UNIT',
            'office_name' => $template->office?->name ?? 'Office Unit',
            'created_by_user_id' => $template->created_by_user_id,
            'created_by_name' => $template->creator?->full_name ?? 'Tracely User',
            'is_global' => (bool) $template->is_global,
            'steps' => is_array($template->steps_json) ? $template->steps_json : [],
            'created_at' => $template->created_at?->toIso8601String(),
        ];
    }

    public static function comment(DocumentComment $comment): array
    {
        return [
            'id' => $comment->id,
            'document_id' => $comment->document_id,
            'author_id' => $comment->author_id,
            'author_name' => $comment->author_name,
            'author_office_id' => $comment->author_office_id,
            'author_office_code' => $comment->author_office_code,
            'author_position' => $comment->author_position,
            'visibility' => $comment->visibility,
            'body' => $comment->body,
            'created_at' => $comment->created_at?->toIso8601String() ?? now()->toIso8601String(),
        ];
    }

    public static function activeSession(PersonalAccessToken $token, int|string|null $currentTokenId): array
    {
        return [
            'id' => (string) $token->id,
            'device_name' => $token->name,
            'platform' => in_array($token->platform, ['android', 'ios', 'web'], true) ? $token->platform : 'web',
            'last_active_at' => ($token->last_used_at ?? $token->created_at ?? now())->toIso8601String(),
            'is_current_device' => $currentTokenId !== null && (string) $token->id === (string) $currentTokenId,
            'ip_hint' => $token->ip_hint ?? 'Workspace Network',
        ];
    }

    public static function category(DocumentCategory $category): array
    {
        return [
            'id' => $category->id,
            'name' => $category->name,
            'code' => $category->code,
            'declared_by_office_code' => $category->declared_by_office_code,
            'declared_by_office_name' => $category->declared_by_office_name,
            'usage_count' => (int) $category->usage_count,
            'is_verified_global' => (bool) $category->is_verified_global,
            'created_at' => $category->created_at?->toIso8601String(),
        ];
    }

    public static function auditLog(AuditLog $log): array
    {
        return [
            'id' => $log->id,
            'actor_id' => $log->actor_id,
            'actor_name' => $log->actor_name,
            'actor_office_code' => $log->actor_office_code,
            'action' => $log->action,
            'document_id' => $log->document_id,
            'tracking_code' => $log->tracking_code,
            'summary' => $log->summary,
            'device_label' => $log->device_label,
            'occurred_at' => $log->occurred_at?->toIso8601String(),
        ];
    }

    public static function notification(UserNotification $n): array
    {
        $title = trim((string) ($n->title ?? '')) !== ''
            ? (string) $n->title
            : 'Document Custody Alert';
        $content = trim((string) ($n->content ?? '')) !== ''
            ? (string) $n->content
            : $n->authenticated_detail;

        return [
            'id' => $n->id,
            'target_user_id' => $n->target_user_id,
            'target_office_id' => $n->target_office_id,
            'document_id' => $n->document_id,
            'title' => $title,
            'content' => $content,
            'lock_screen_preview' => $n->lock_screen_preview,
            'authenticated_detail' => $n->authenticated_detail,
            'received_at' => $n->received_at->toIso8601String(),
            'read' => (bool) $n->read,
        ];
    }

    public static function version(DocumentVersion $version): array
    {
        $version->loadMissing('uploadedBy');

        return [
            'id' => $version->id,
            'version_number' => (int) $version->version_number,
            'file_name' => $version->file_name,
            'mime_type' => $version->mime_type,
            'size_bytes' => (int) $version->size_bytes,
            'sha256_checksum' => $version->sha256_checksum,
            'uploaded_by_id' => $version->uploaded_by_id,
            'uploaded_by_name' => $version->uploadedBy?->full_name ?? 'Team Member',
            'uploaded_at' => $version->uploaded_at->toIso8601String(),
            'revision_note' => $version->revision_note ?? '',
            'storage_key' => $version->storage_key,
        ];
    }

    public static function maskTrackingCode(string $trackingCode): string
    {
        $clean = trim($trackingCode);
        if ($clean === '') {
            return 'TRC-••••••';
        }
        $lastDash = strrpos($clean, '-');
        if ($lastDash !== false && $lastDash > 0) {
            return substr($clean, 0, $lastDash + 1).'••••••';
        }

        return substr($clean, 0, min(4, strlen($clean))).'••••';
    }

    public static function document(
        Document $doc,
        ?User $actor = null,
        ?AccessPolicyService $policy = null,
        bool $revealAfterScan = false,
    ): array {
        $doc->loadMissing([
            'category',
            'originOffice',
            'originUser',
            'currentOffice',
            'currentHolder',
            'submittedSchool',
            'participants',
            'versions.uploadedBy',
            'transactions.fromUser',
            'transactions.toUser',
            'transactions.fromOffice',
            'transactions.toOffice',
            'externalMilestones',
        ]);

        $explicitParticipants = $doc->participants->pluck('id')->all();
        if ($explicitParticipants === []) {
            $explicitParticipants = array_values(array_unique([$doc->origin_user_id, $doc->current_holder_id]));
        }

        $isSealed = $actor !== null && $policy !== null && $policy->isSealedForActor($actor, $doc);
        $attachmentCount = $doc->versions->count();

        if ($isSealed) {
            $latestTx = $doc->latestTransaction();
            $sealedTransactions = $latestTx ? [[
                'id' => $latestTx->id,
                'document_id' => $latestTx->document_id,
                'from_user_id' => $latestTx->from_user_id,
                'from_user_name' => $latestTx->fromUser?->full_name ?? 'Sender',
                'from_office' => self::office($latestTx->fromOffice),
                'to_user_id' => $latestTx->to_user_id,
                'to_user_name' => $latestTx->toUser?->full_name ?? 'Recipient',
                'to_office' => self::office($latestTx->toOffice),
                'routing_scope' => $latestTx->routing_scope,
                'receipt_status' => $latestTx->receipt_status,
                'remarks' => 'Scan the routing QR code to unlock remarks and attached document files.',
                'is_internal_only' => (bool) $latestTx->is_internal_only,
                'sent_at' => $latestTx->sent_at->toIso8601String(),
                'acknowledged_at' => null,
                'acknowledged_by_name' => null,
                'proof_photo' => null,
            ]] : [];

            return [
                'id' => $doc->id,
                'is_sealed' => true,
                'attachment_count' => $attachmentCount,
                'tracking_code' => $revealAfterScan
                    ? $doc->tracking_code
                    : self::maskTrackingCode($doc->tracking_code),
                'qr_token' => '',
                'title' => $revealAfterScan ? $doc->title : 'Sealed Incoming Document',
                'category_id' => $doc->category_id,
                'category_name' => $revealAfterScan
                    ? ($doc->category?->name ?? 'General')
                    : 'Scan QR to Reveal',
                'confidentiality_tier' => $doc->confidentiality_tier,
                'lifecycle_status' => $doc->lifecycle_status,
                'copy_format' => $doc->copy_format,
                'physical_reference' => null,
                'physical_page_count' => null,
                'has_digital_file' => $doc->hasDigitalFile(),
                'physical_summary' => null,
                'sla_state' => $doc->slaState(),
                'sla_due_at' => $doc->sla_due_at->toIso8601String(),
                'origin_office' => self::office($doc->originOffice),
                'origin_user_id' => $doc->origin_user_id,
                'origin_user_name' => $doc->originUser?->full_name ?? 'Origin User',
                'current_office' => self::office($doc->currentOffice),
                'current_holder_id' => $doc->current_holder_id,
                'current_holder_name' => $doc->currentHolder?->full_name ?? 'Current Custodian',
                'explicit_participant_ids' => $explicitParticipants,
                'submitted_school' => null,
                'versions' => [],
                'transactions' => $sealedTransactions,
                'external_milestones' => [],
                'created_at' => $doc->created_at?->toIso8601String(),
            ];
        }

        return [
            'id' => $doc->id,
            'is_sealed' => false,
            'attachment_count' => $attachmentCount,
            'tracking_code' => $doc->tracking_code,
            'qr_token' => $doc->qr_token,
            'title' => $doc->title,
            'category_id' => $doc->category_id,
            'category_name' => $doc->category?->name ?? 'General',
            'confidentiality_tier' => $doc->confidentiality_tier,
            'lifecycle_status' => $doc->lifecycle_status,
            'copy_format' => $doc->copy_format,
            'physical_reference' => $doc->physical_reference,
            'physical_page_count' => $doc->physical_page_count,
            'has_digital_file' => $doc->hasDigitalFile(),
            'physical_summary' => $doc->physicalSummary(),
            'sla_state' => $doc->slaState(),
            'sla_due_at' => $doc->sla_due_at->toIso8601String(),
            'origin_office' => self::office($doc->originOffice),
            'origin_user_id' => $doc->origin_user_id,
            'origin_user_name' => $doc->originUser?->full_name ?? 'Origin User',
            'current_office' => self::office($doc->currentOffice),
            'current_holder_id' => $doc->current_holder_id,
            'current_holder_name' => $doc->currentHolder?->full_name ?? 'Current Custodian',
            'explicit_participant_ids' => $explicitParticipants,
            'submitted_school' => $doc->submittedSchool ? [
                'id' => $doc->submittedSchool->id,
                'deped_school_id' => $doc->submittedSchool->deped_school_id,
                'name' => $doc->submittedSchool->name,
                'district' => $doc->submittedSchool->district,
                'municipality' => $doc->submittedSchool->municipality,
            ] : null,
            'versions' => $doc->versions->map(fn (DocumentVersion $v) => self::version($v))->values()->all(),
            'transactions' => $doc->transactions->map(fn (RoutingTransaction $tx) => [
                'id' => $tx->id,
                'document_id' => $tx->document_id,
                'from_user_id' => $tx->from_user_id,
                'from_user_name' => $tx->fromUser?->full_name ?? 'Sender',
                'from_office' => self::office($tx->fromOffice),
                'to_user_id' => $tx->to_user_id,
                'to_user_name' => $tx->toUser?->full_name ?? 'Recipient',
                'to_office' => self::office($tx->toOffice),
                'routing_scope' => $tx->routing_scope,
                'receipt_status' => $tx->receipt_status,
                'remarks' => $tx->remarks ?? '',
                'is_internal_only' => (bool) $tx->is_internal_only,
                'sent_at' => $tx->sent_at->toIso8601String(),
                'acknowledged_at' => $tx->acknowledged_at?->toIso8601String(),
                'acknowledged_by_name' => $tx->acknowledged_by_name,
                'proof_photo' => $tx->proof_photo_file_name ? [
                    'file_name' => $tx->proof_photo_file_name,
                    'compressed_bytes' => (int) ($tx->proof_photo_compressed_bytes ?? 0),
                    'sha256_checksum' => $tx->proof_photo_sha256 ?? '',
                    'exif_stripped' => (bool) $tx->proof_photo_exif_stripped,
                    'captured_at' => ($tx->proof_photo_captured_at ?? $tx->acknowledged_at ?? $tx->sent_at)->toIso8601String(),
                ] : null,
            ])->values()->all(),
            'external_milestones' => $doc->externalMilestones->map(fn (ExternalMilestone $ms) => [
                'id' => $ms->id,
                'stage_label' => $ms->stage_label,
                'office_name' => $ms->office_name,
                'occurred_at' => $ms->occurred_at->toIso8601String(),
            ])->values()->all(),
            'created_at' => $doc->created_at?->toIso8601String(),
        ];
    }

    public static function trackingSnapshot(
        User $actor,
        Document $doc,
        AccessPolicyService $policy,
    ): ?array {
        $doc->loadMissing([
            'category',
            'originOffice',
            'currentOffice',
            'currentHolder',
            'participants',
            'versions',
            'transactions.fromOffice',
            'transactions.toOffice',
            'externalMilestones',
        ]);

        $decision = $policy->resolveTrackingVisibility($actor, $doc);
        if ($decision['visibility'] === 'denied') {
            return null;
        }

        $full = $decision['visibility'] === 'full_custody';
        $isSealed = $policy->isSealedForActor($actor, $doc);
        $latest = $doc->latestTransaction();
        $isPending = $latest !== null && $latest->receipt_status === 'pending';

        $lastAck = $doc->transactions->reverse()->first(
            fn (RoutingTransaction $tx): bool => $tx->receipt_status === 'acknowledged' && $tx->acknowledged_at !== null,
        );

        $receivedAt = $isPending
            ? null
            : (($latest?->acknowledged_at ?? $lastAck?->acknowledged_at ?? $doc->created_at)?->toIso8601String());

        $lastUpdatedAt = ($latest?->acknowledged_at ?? $latest?->sent_at ?? $doc->created_at ?? now())->toIso8601String();

        $isInternalOfficeStage = $doc->transactions->isEmpty()
            || $latest?->routing_scope === 'internal_office'
            || ($latest !== null && $latest->from_office_id === $latest->to_office_id);

        $sentByActorOffice = $doc->origin_office_id === $actor->office_id
            || $doc->transactions->contains(fn (RoutingTransaction $tx): bool => $tx->from_office_id === $actor->office_id);

        $tierPrefix = $doc->confidentiality_tier === 'restricted' ? 'Restricted' : 'Tracked';
        $milestones = $isSealed
            ? []
            : $doc->externalMilestones->map(fn (ExternalMilestone $ms) => [
                'id' => $ms->id,
                'stage_label' => $ms->stage_label,
                'office_name' => $ms->office_name,
                'occurred_at' => $ms->occurred_at->toIso8601String(),
            ])->values()->all();

        $timelineEvents = ($full && ! $isSealed)
            ? self::buildFullTimeline($doc)
            : self::buildMaskedTimeline($milestones, $isPending);

        $canExposeDetails = $full && ! $isSealed;

        return [
            'visibility' => $decision['visibility'],
            'is_sealed' => $isSealed,
            'document_id' => $doc->id,
            'tracking_code' => $isSealed ? self::maskTrackingCode($doc->tracking_code) : $doc->tracking_code,
            'display_title' => $isSealed
                ? 'Sealed Incoming Document'
                : ($canExposeDetails
                    ? $doc->title
                    : "{$tierPrefix} Document ({$doc->originOffice->code})"),
            'category_name' => $isSealed
                ? 'Scan routing QR to reveal'
                : ($canExposeDetails
                    ? ($doc->category?->name ?? 'General')
                    : 'Details masked under custody policy'),
            'confidentiality_tier' => $doc->confidentiality_tier,
            'lifecycle_status' => $doc->lifecycle_status,
            'copy_format' => $doc->copy_format,
            'physical_reference' => $canExposeDetails ? $doc->physical_reference : null,
            'physical_page_count' => $canExposeDetails ? $doc->physical_page_count : null,
            'has_digital_file' => $doc->hasDigitalFile(),
            'physical_summary' => $canExposeDetails ? $doc->physicalSummary() : null,
            'sla_state' => $doc->slaState(),
            'sla_due_at' => $doc->sla_due_at->toIso8601String(),
            'origin_office' => self::office($doc->originOffice),
            'current_office' => self::office($doc->currentOffice),
            'origin_timestamp' => $doc->created_at?->toIso8601String(),
            'received_at' => $receivedAt,
            'last_updated_at' => $lastUpdatedAt,
            'is_internal_office_stage' => $isInternalOfficeStage,
            'current_holder_name' => $canExposeDetails ? ($doc->currentHolder?->full_name) : null,
            'can_open_full_record' => $canExposeDetails,
            'sent_by_actor_office' => $sentByActorOffice,
            'pending_for_actor_office' => $full && ($latest?->canBeAcknowledgedBy($actor) ?? false),
            'latest_receipt_status' => $latest?->receipt_status,
            'external_milestones' => $milestones,
            'timeline_events' => $timelineEvents,
        ];
    }

    private static function buildFullTimeline(Document $doc): array
    {
        $events = [
            [
                'id' => "reg-{$doc->id}",
                'label' => "Registered at {$doc->originOffice->code}",
                'office_name' => $doc->originOffice->name,
                'occurred_at' => ($doc->created_at ?? now())->toIso8601String(),
                'state' => $doc->transactions->isEmpty() ? 'active' : 'completed',
                'is_internal' => false,
            ],
        ];

        $total = $doc->transactions->count();
        foreach ($doc->transactions->values() as $idx => $tx) {
            $isLast = $idx === ($total - 1);
            $isInternal = $tx->routing_scope === 'internal_office' || $tx->from_office_id === $tx->to_office_id;
            $toCode = $tx->toOffice?->code ?? 'HQ';
            $toName = $tx->toOffice?->name ?? 'Workspace Office';

            $events[] = [
                'id' => "send-{$tx->id}",
                'label' => $isInternal ? "Internal Desk · {$toCode}" : "Forwarded to {$toCode}",
                'office_name' => $toName,
                'occurred_at' => $tx->sent_at->toIso8601String(),
                'state' => ($isLast && $tx->receipt_status === 'pending') ? 'pending' : 'completed',
                'is_internal' => $isInternal,
            ];

            if ($tx->acknowledged_at && $tx->receipt_status === 'acknowledged') {
                $events[] = [
                    'id' => "ack-{$tx->id}",
                    'label' => $isInternal ? "Received Internally ({$toCode})" : "Received by {$toCode}",
                    'office_name' => $toName,
                    'occurred_at' => $tx->acknowledged_at->toIso8601String(),
                    'state' => $isLast ? 'active' : 'completed',
                    'is_internal' => $isInternal,
                ];
            }
        }

        return $events;
    }

    private static function buildMaskedTimeline(array $milestones, bool $isPending): array
    {
        $total = count($milestones);
        $events = [];
        foreach ($milestones as $idx => $ms) {
            $isLast = $idx === ($total - 1);
            $events[] = [
                'id' => $ms['id'],
                'label' => $ms['stage_label'],
                'office_name' => $ms['office_name'],
                'occurred_at' => $ms['occurred_at'],
                'state' => $isLast ? ($isPending ? 'pending' : 'active') : 'completed',
                'is_internal' => false,
            ];
        }

        return $events;
    }
}
