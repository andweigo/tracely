<?php

namespace App\Http\Controllers\Api\V1;

use App\Exceptions\ApiDomainException;
use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\Office;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\AccessPolicyService;
use App\Services\AuditLogger;
use App\Services\RealtimeEventHub;
use App\Support\DtoSerializer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class DirectoryController extends Controller
{
    public function offices(): JsonResponse
    {
        $offices = Office::query()->orderBy('name')->get();

        return response()->json([
            'data' => $offices->map(fn (Office $o) => DtoSerializer::office($o))->values()->all(),
        ]);
    }

    public function personnel(): JsonResponse
    {
        $users = User::query()
            ->with('office')
            ->where('active', true)
            ->where('approval_status', 'approved')
            ->orderBy('full_name')
            ->get();

        return response()->json([
            'data' => $users->map(fn (User $u) => DtoSerializer::personnel($u))->values()->all(),
        ]);
    }

    public function categories(): JsonResponse
    {
        $cats = DocumentCategory::query()->orderByDesc('usage_count')->orderBy('name')->get();

        return response()->json([
            'data' => $cats->map(fn (DocumentCategory $c) => DtoSerializer::category($c))->values()->all(),
        ]);
    }

    public function declareCategory(Request $request, AuditLogger $audit, RealtimeEventHub $realtime): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'code' => ['nullable', 'string', 'max:32'],
        ]);

        /** @var User $actor */
        $actor = $request->user()->loadMissing('office');
        $cleanName = preg_replace('/\s+/', ' ', trim($validated['name']));
        $code = strtoupper(trim((string) ($validated['code'] ?? '')));
        if ($code === '') {
            $code = strtoupper(Str::slug($cleanName, '-'));
            $code = substr($code, 0, 12) ?: 'CUSTOM-CAT';
        }

        $duplicate = DocumentCategory::query()
            ->whereRaw('LOWER(name) = ?', [strtolower($cleanName)])
            ->orWhereRaw('UPPER(code) = ?', [$code])
            ->first();

        if ($duplicate) {
            throw new ApiDomainException(
                'DUPLICATE_CATEGORY',
                "Category \"{$duplicate->name}\" already exists globally (declared by {$duplicate->declared_by_office_code}).",
            );
        }

        $category = DocumentCategory::query()->create([
            'id' => 'cat-'.Str::uuid()->toString(),
            'name' => $cleanName,
            'code' => $code,
            'declared_by_office_code' => $actor->office->code,
            'declared_by_office_name' => $actor->office->name,
            'usage_count' => 0,
            'is_verified_global' => true,
        ]);

        $audit->record(
            $actor,
            'category_declared',
            null,
            null,
            "Declared global category \"{$category->name}\" ({$category->code})",
            $actor->currentAccessToken()?->name ?? 'Tracely Client',
        );

        $realtime->publish('category_declared', [$actor->office_id], [$actor->id]);

        return response()->json([
            'data' => DtoSerializer::category($category),
        ], 201);
    }

    public function adminUpdateCategory(
        string $id,
        Request $request,
        AuditLogger $audit,
        RealtimeEventHub $realtime,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user()->loadMissing('office');
        $this->assertAdminOrRecords($actor);

        $validated = $request->validate([
            'name' => ['sometimes', 'string', 'min:2', 'max:120'],
            'code' => ['sometimes', 'string', 'min:2', 'max:32'],
        ]);

        $category = DocumentCategory::query()->find($id);
        if (! $category) {
            throw new ApiDomainException('CATEGORY_NOT_FOUND', 'Document category was not found.', 404);
        }

        $updates = [];
        if (isset($validated['name'])) {
            $cleanName = preg_replace('/\s+/', ' ', trim($validated['name']));
            $dup = DocumentCategory::query()
                ->whereRaw('LOWER(name) = ?', [strtolower($cleanName)])
                ->where('id', '!=', $category->id)
                ->exists();
            if ($dup) {
                throw new ApiDomainException('DUPLICATE_CATEGORY', "Category \"{$cleanName}\" already exists.");
            }
            $updates['name'] = $cleanName;
        }
        if (isset($validated['code'])) {
            $cleanCode = strtoupper(trim($validated['code']));
            $dupCode = DocumentCategory::query()
                ->whereRaw('UPPER(code) = ?', [$cleanCode])
                ->where('id', '!=', $category->id)
                ->exists();
            if ($dupCode) {
                throw new ApiDomainException('DUPLICATE_CATEGORY', "Category code \"{$cleanCode}\" already exists.");
            }
            $updates['code'] = $cleanCode;
        }

        if ($updates !== []) {
            $category->update($updates);
        }

        $audit->record(
            $actor,
            'category_updated',
            null,
            null,
            "Updated global category \"{$category->name}\" ({$category->code})",
            $actor->currentAccessToken()?->name ?? 'Tracely Client',
        );
        $realtime->publish('category_declared', [$actor->office_id], [$actor->id]);

        return response()->json([
            'data' => DtoSerializer::category($category->fresh()),
        ]);
    }

    public function adminDeleteCategory(
        string $id,
        Request $request,
        AuditLogger $audit,
        RealtimeEventHub $realtime,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user()->loadMissing('office');
        $this->assertAdminOrRecords($actor);

        $category = DocumentCategory::query()->find($id);
        if (! $category) {
            throw new ApiDomainException('CATEGORY_NOT_FOUND', 'Document category was not found.', 404);
        }

        $inUse = Document::query()->where('category_id', $category->id)->exists();
        if ($inUse) {
            throw new ApiDomainException(
                'CATEGORY_IN_USE',
                'Cannot delete a category that is already assigned to tracked documents. Rename it instead.',
                422,
            );
        }

        $name = $category->name;
        $code = $category->code;
        $category->delete();

        $audit->record(
            $actor,
            'category_deleted',
            null,
            null,
            "Removed unused global category \"{$name}\" ({$code})",
            $actor->currentAccessToken()?->name ?? 'Tracely Client',
        );
        $realtime->publish('category_declared', [$actor->office_id], [$actor->id]);

        return response()->json(['ok' => true, 'deleted_id' => $id]);
    }

    private function assertAdminOrRecords(User $actor): void
    {
        if (in_array($actor->role, ['ict_admin', 'records_officer'], true)) {
            return;
        }
        $officeCode = strtoupper((string) ($actor->office?->code ?? ''));
        if ($actor->role === 'unit_head' && in_array($officeCode, ['HR', 'EXEC', 'ADMIN', 'OSDS', 'ICT'], true)) {
            return;
        }

        throw new ApiDomainException(
            'FORBIDDEN_APPROVAL_ROLE',
            'Only System Admins, Records Officers, or Executive/HR Unit Heads can manage system configuration.',
            403,
        );
    }

    public function notifications(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $items = UserNotification::query()
            ->where(function ($query) use ($actor): void {
                $query->where('target_user_id', $actor->id)
                    ->orWhere('target_office_id', $actor->office_id);
            })
            ->orderByDesc('received_at')
            ->limit(100)
            ->get();

        return response()->json([
            'data' => $items->map(fn (UserNotification $n) => DtoSerializer::notification($n))->values()->all(),
            'unread_count' => $items->where('read', false)->count(),
        ]);
    }

    public function markNotificationRead(string $id, Request $request, RealtimeEventHub $realtime): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $notification = UserNotification::query()
            ->where('id', $id)
            ->where(function ($query) use ($actor): void {
                $query->where('target_user_id', $actor->id)
                    ->orWhere('target_office_id', $actor->office_id);
            })
            ->firstOrFail();

        if (! $notification->read) {
            $notification->update(['read' => true]);
            $realtime->publish('notifications_read', [$actor->office_id], [$actor->id]);
        }

        $unreadCount = UserNotification::query()
            ->where(function ($query) use ($actor): void {
                $query->where('target_user_id', $actor->id)
                    ->orWhere('target_office_id', $actor->office_id);
            })
            ->where('read', false)
            ->count();

        return response()->json([
            'ok' => true,
            'unread_count' => $unreadCount,
        ]);
    }

    public function markAllNotificationsRead(Request $request, RealtimeEventHub $realtime): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        UserNotification::query()
            ->where(function ($query) use ($actor): void {
                $query->where('target_user_id', $actor->id)
                    ->orWhere('target_office_id', $actor->office_id);
            })
            ->update(['read' => true]);

        $realtime->publish('notifications_read', [$actor->office_id], [$actor->id]);

        return response()->json([
            'ok' => true,
            'unread_count' => 0,
        ]);
    }

    public function auditLogs(Request $request, AccessPolicyService $policy): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $logs = AuditLog::query()->orderByDesc('occurred_at')->limit(200)->get();

        $docIds = $logs->pluck('document_id')->filter()->unique()->values()->all();
        $docsById = Document::query()
            ->with(['participants', 'transactions'])
            ->whereIn('id', $docIds)
            ->get()
            ->keyBy('id');

        $visible = $logs->filter(function (AuditLog $log) use ($actor, $docsById, $policy): bool {
            if ($log->actor_id === $actor->id || $actor->role === 'ict_admin') {
                return true;
            }
            if (! $log->document_id) {
                return true;
            }
            $doc = $docsById->get($log->document_id);

            return $doc !== null && $policy->authorizeFullCustody($actor, $doc)['allowed'];
        });

        return response()->json([
            'data' => $visible->map(fn (AuditLog $log) => DtoSerializer::auditLog($log))->values()->all(),
        ]);
    }

    public function documentAuditLogs(
        string $id,
        Request $request,
        AccessPolicyService $policy,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();
        $doc = Document::query()->with(['participants', 'transactions'])->findOrFail($id);
        $policy->enforceFullCustody($actor, $doc);

        $logs = AuditLog::query()
            ->where('document_id', $doc->id)
            ->orderByDesc('occurred_at')
            ->get();

        return response()->json([
            'data' => $logs->map(fn (AuditLog $log) => DtoSerializer::auditLog($log))->values()->all(),
        ]);
    }
}
