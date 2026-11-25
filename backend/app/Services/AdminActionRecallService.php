<?php

namespace App\Services;

use App\Models\AdminActionHistory;
use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\Office;
use App\Models\RoutingTransaction;
use App\Models\SlaPolicy;
use App\Models\SystemSetting;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class AdminActionRecallService
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly RealtimeEventHub $realtime,
    ) {}

    /**
     * @param  array<string, mixed>|null  $beforeState
     * @param  array<string, mixed>|null  $afterState
     */
    public function record(
        User $admin,
        string $actionType,
        string $summary,
        ?array $beforeState = null,
        ?array $afterState = null,
        bool $reversible = true,
        ?string $targetType = null,
        ?string $targetId = null,
    ): ?AdminActionHistory {
        if (! Schema::hasTable('admin_action_histories')) {
            return null;
        }

        return AdminActionHistory::query()->create([
            'id' => 'act-'.Str::uuid()->toString(),
            'admin_user_id' => $admin->id,
            'admin_name' => $admin->full_name,
            'action_type' => $actionType,
            'summary' => Str::limit($summary, 255, ''),
            'target_type' => $targetType,
            'target_id' => $targetId,
            'reversible' => $reversible,
            'before_state' => $beforeState,
            'after_state' => $afterState,
        ]);
    }

    /**
     * Revert a previously recorded admin action using its stored snapshot.
     *
     * @return array{ok: bool, message: string}
     */
    public function recall(User $admin, AdminActionHistory $history): array
    {
        if (! $history->reversible) {
            return ['ok' => false, 'message' => 'This action cannot be recalled.'];
        }
        if ($history->recalled_at !== null) {
            return ['ok' => false, 'message' => 'This action was already recalled.'];
        }

        $before = is_array($history->before_state) ? $history->before_state : [];
        $after = is_array($history->after_state) ? $history->after_state : [];

        $revertedMessage = DB::transaction(function () use ($admin, $history, $before, $after): string {
            switch ($history->action_type) {
                case 'user.approve':
                case 'user.reject':
                case 'user.toggle_active':
                case 'user.update':
                case 'user.reset_password':
                case 'user.archive':
                    $userId = (string) ($before['user_id'] ?? $history->target_id ?? '');
                    $target = $userId !== '' ? User::query()->find($userId) : null;
                    if ($target && isset($before['attributes']) && is_array($before['attributes'])) {
                        $attrs = $before['attributes'];
                        foreach ($attrs as $col => $val) {
                            $target->{$col} = $val;
                        }
                        $target->save();
                    }
                    if (! empty($before['reassigned_docs']) && is_array($before['reassigned_docs'])) {
                        foreach ($before['reassigned_docs'] as $docSnap) {
                            if (! isset($docSnap['id'])) {
                                continue;
                            }
                            Document::query()->where('id', $docSnap['id'])->update([
                                'current_holder_id' => $docSnap['current_holder_id'] ?? null,
                                'current_office_id' => $docSnap['current_office_id'] ?? null,
                            ]);
                        }
                    }

                    return 'Recalled: '.$history->summary;

                case 'user.approve_all':
                case 'user.bulk_transfer':
                    foreach (($before['users'] ?? []) as $uSnap) {
                        if (! isset($uSnap['id'])) {
                            continue;
                        }
                        $u = User::query()->find($uSnap['id']);
                        if (! $u) {
                            continue;
                        }
                        foreach (($uSnap['attributes'] ?? []) as $col => $val) {
                            $u->{$col} = $val;
                        }
                        $u->save();
                    }

                    return 'Recalled: '.$history->summary;

                case 'user.provision':
                case 'admin.provision':
                    $newUserId = (string) ($after['user_id'] ?? $history->target_id ?? '');
                    if ($newUserId !== '') {
                        User::query()->where('id', $newUserId)->update([
                            'active' => false,
                            'approval_status' => 'rejected',
                        ]);
                    }

                    return 'Recalled newly created account (deactivated).';

                case 'user.reassign_custody':
                    foreach (($before['documents'] ?? []) as $docSnap) {
                        if (! isset($docSnap['id'])) {
                            continue;
                        }
                        Document::query()->where('id', $docSnap['id'])->update([
                            'current_holder_id' => $docSnap['current_holder_id'] ?? null,
                            'current_office_id' => $docSnap['current_office_id'] ?? null,
                        ]);
                    }

                    return 'Recalled custody reassignment for '.count($before['documents'] ?? []).' document(s).';

                case 'user.direct_notice':
                case 'document.notify_office':
                    $notifIds = is_array($after['notification_ids'] ?? null) ? $after['notification_ids'] : [];
                    if ($notifIds !== []) {
                        UserNotification::query()->whereIn('id', $notifIds)->delete();
                    }

                    return 'Recalled notification(s) sent to users.';

                case 'office.create':
                    $officeId = (string) ($after['office_id'] ?? $history->target_id ?? '');
                    if ($officeId !== '') {
                        $hasUsers = User::query()->where('office_id', $officeId)->exists();
                        $hasDocs = Document::query()
                            ->where('origin_office_id', $officeId)
                            ->orWhere('current_office_id', $officeId)
                            ->exists();
                        if (! $hasUsers && ! $hasDocs) {
                            Office::query()->where('id', $officeId)->delete();
                        }
                    }

                    return 'Recalled created office.';

                case 'office.update':
                    $officeId = (string) ($before['office_id'] ?? $history->target_id ?? '');
                    if ($officeId !== '' && is_array($before['attributes'] ?? null)) {
                        Office::query()->where('id', $officeId)->update($before['attributes']);
                    }

                    return 'Recalled office changes.';

                case 'office.merge':
                    if (is_array($before['office'] ?? null)) {
                        $off = $before['office'];
                        Office::query()->updateOrCreate(
                            ['id' => $off['id']],
                            ['code' => $off['code'], 'name' => $off['name']],
                        );
                    }
                    foreach (($before['user_ids'] ?? []) as $uid) {
                        User::query()->where('id', $uid)->update(['office_id' => $before['office']['id']]);
                    }
                    foreach (($before['doc_ids'] ?? []) as $did) {
                        Document::query()->where('id', $did)->update(['current_office_id' => $before['office']['id']]);
                    }

                    return 'Recalled office merge and restored staff & documents.';

                case 'category.create':
                    $catId = (string) ($after['category_id'] ?? $history->target_id ?? '');
                    if ($catId !== '' && ! Document::query()->where('category_id', $catId)->exists()) {
                        DocumentCategory::query()->where('id', $catId)->delete();
                    }

                    return 'Recalled created category.';

                case 'category.update':
                    $catId = (string) ($before['category_id'] ?? $history->target_id ?? '');
                    if ($catId !== '' && is_array($before['attributes'] ?? null)) {
                        DocumentCategory::query()->where('id', $catId)->update($before['attributes']);
                    }

                    return 'Recalled category update.';

                case 'category.delete':
                    if (is_array($before['category'] ?? null)) {
                        DocumentCategory::query()->updateOrCreate(
                            ['id' => $before['category']['id']],
                            $before['category'],
                        );
                        if (! empty($before['doc_ids']) && is_array($before['doc_ids'])) {
                            Document::query()
                                ->whereIn('id', $before['doc_ids'])
                                ->update(['category_id' => $before['category']['id']]);
                        }
                    }

                    return 'Restored deleted category.';

                case 'sla_policy.save':
                    $catId = (string) ($before['category_id'] ?? $history->target_id ?? '');
                    if (is_array($before['policy'] ?? null)) {
                        SlaPolicy::query()->updateOrCreate(
                            ['category_id' => $catId],
                            $before['policy'],
                        );
                    } elseif ($catId !== '') {
                        SlaPolicy::query()->where('category_id', $catId)->delete();
                    }

                    return 'Recalled SLA policy update.';

                case 'sla_policy.delete':
                    if (is_array($before['policy'] ?? null)) {
                        SlaPolicy::query()->updateOrCreate(
                            ['category_id' => $before['policy']['category_id']],
                            $before['policy'],
                        );
                    }

                    return 'Restored deleted SLA policy.';

                case 'document.recall':
                case 'document.complete':
                    if (is_array($before['document'] ?? null) && isset($before['document']['id'])) {
                        $d = $before['document'];
                        Document::query()->where('id', $d['id'])->update([
                            'lifecycle_status' => $d['lifecycle_status'],
                            'current_office_id' => $d['current_office_id'],
                            'current_holder_id' => $d['current_holder_id'],
                        ]);
                    }
                    if (is_array($before['transaction'] ?? null) && isset($before['transaction']['id'])) {
                        $t = $before['transaction'];
                        RoutingTransaction::query()->where('id', $t['id'])->update([
                            'receipt_status' => $t['receipt_status'],
                        ]);
                    }

                    return 'Recalled document override.';

                case 'system.settings':
                    if (is_array($before['settings'] ?? null)) {
                        SystemSetting::saveMany($before['settings'], $admin->id);
                    }

                    return 'Recalled system settings to previous values.';

                default:
                    return 'Marked action as recalled.';
            }
        });

        $history->update([
            'recalled_at' => now(),
            'recalled_by_user_id' => $admin->id,
            'recalled_by_name' => $admin->full_name,
        ]);

        $this->audit->record(
            $admin,
            'admin_action_recalled',
            $history->target_type === 'document' ? $history->target_id : null,
            null,
            $revertedMessage.' (Original: '.$history->summary.')',
            'Tracely Admin Portal',
        );

        $this->realtime->publish('directory_updated', [$admin->office_id], []);

        return ['ok' => true, 'message' => $revertedMessage];
    }
}
