<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\DevicePushToken;
use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\ExternalMilestone;
use App\Models\Office;
use App\Models\PushDeliveryLog;
use App\Models\RoutingTransaction;
use App\Models\SlaPolicy;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\AuditLogger;
use App\Services\RealtimeEventHub;
use App\Services\StalledDocumentAlertService;
use App\Services\StorageIntegrityService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\View\View;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminPortalController extends Controller
{
    private const SESSION_KEY = 'admin_portal_user_id';

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly RealtimeEventHub $realtime,
        private readonly StalledDocumentAlertService $stalledAlerts,
        private readonly StorageIntegrityService $integrity,
    ) {}

    public function showLogin(Request $request): View|RedirectResponse
    {
        $admin = $this->resolveAdminUser($request);
        if ($admin) {
            return redirect()->route('admin.dashboard');
        }

        return view('admin::login');
    }

    public function login(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'identifier' => ['required', 'string', 'max:120'],
            'password' => ['required', 'string', 'max:128'],
        ]);

        $identifier = trim($validated['identifier']);

        /** @var User|null $user */
        $user = User::query()
            ->with('office')
            ->whereRaw('LOWER(email) = ?', [strtolower($identifier)])
            ->orWhereRaw('UPPER(employee_id) = ?', [strtoupper($identifier)])
            ->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            return back()
                ->withInput($request->only('identifier'))
                ->withErrors([
                    'identifier' => 'Invalid Admin Employee ID / Work Email or password.',
                ]);
        }

        if ($user->approval_status === 'pending' || ! $user->active) {
            return back()
                ->withInput($request->only('identifier'))
                ->withErrors([
                    'identifier' => 'This account is currently inactive or awaiting approval.',
                ]);
        }

        if (! $this->isAuthorizedAdmin($user)) {
            return back()
                ->withInput($request->only('identifier'))
                ->withErrors([
                    'identifier' => 'Access denied: Only System Administrators, Records Officers, or Executive / HR Unit Heads are authorized to access the Admin Portal.',
                ]);
        }

        $request->session()->regenerate();
        $request->session()->put(self::SESSION_KEY, $user->id);

        $this->audit->record(
            $user,
            'admin_portal_login',
            null,
            null,
            "Signed in to standalone Web Admin Portal ({$request->ip()}).",
            'Tracely Admin Portal',
        );

        return redirect()
            ->route('admin.dashboard')
            ->with('admin_toast', "Signed in as {$user->full_name}.");
    }

    public function logout(Request $request): RedirectResponse
    {
        $admin = $this->resolveAdminUser($request);
        if ($admin) {
            $this->audit->record(
                $admin,
                'admin_portal_logout',
                null,
                null,
                'Signed out of standalone Web Admin Portal.',
                'Tracely Admin Portal',
            );
        }

        $request->session()->forget(self::SESSION_KEY);
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()
            ->route('admin.login')
            ->with('admin_toast', 'Signed out of Tracely Admin Portal.');
    }

    /**
     * Ultra-lightweight live-sync pulse endpoint for the standalone Admin Blade Portal.
     * Combines the global RealtimeEventHub cursor with a lightweight database state fingerprint
     * so changes from Web, Mobile, or another Admin session reflect automatically without F5.
     */
    public function livePulse(Request $request): JsonResponse
    {
        $admin = $this->resolveAdminUser($request);
        if (! $admin) {
            return response()->json(['authenticated' => false], 401);
        }

        $since = (int) $request->query('since', 0);
        $cursor = (int) Cache::get('doctrack:rt:global:cursor', 0);

        $pendingApprovals = User::query()->where('approval_status', 'pending')->count();
        $totalDocuments = Document::query()->count();

        $fingerprint = sha1((string) json_encode([
            $totalDocuments,
            (string) Document::query()->max('updated_at'),
            RoutingTransaction::query()->count(),
            (string) RoutingTransaction::query()->max('updated_at'),
            User::query()->count(),
            (string) User::query()->max('updated_at'),
            $pendingApprovals,
            DocumentCategory::query()->count(),
            (string) DocumentCategory::query()->max('updated_at'),
            Office::query()->count(),
            (string) Office::query()->max('updated_at'),
            UserNotification::query()->count(),
            AuditLog::query()->count(),
            PersonalAccessToken::query()->count(),
            Schema::hasTable('sla_policies') ? SlaPolicy::query()->count() : 0,
            Schema::hasTable('sla_policies') ? (string) SlaPolicy::query()->max('updated_at') : '',
            Schema::hasTable('device_push_tokens') ? DevicePushToken::query()->count() : 0,
        ]));

        return response()->json([
            'cursor' => $cursor,
            'changed' => $cursor > $since,
            'fingerprint' => $fingerprint,
            'pending_approvals' => $pendingApprovals,
            'total_documents' => $totalDocuments,
            'server_time' => now()->toIso8601String(),
        ]);
    }

    public function dashboard(Request $request): View|RedirectResponse
    {
        $admin = $this->resolveAdminUser($request);
        if (! $admin) {
            return redirect()->route('admin.login');
        }

        // Automatically sweep stalled ("tengga") documents on throttled interval (10m lock, 12h per-doc cooldown)
        $autoSweepSummary = $this->stalledAlerts->runThrottledAutoSweep($admin);

        $activeSection = (string) $request->query('section', 'overview');
        $validSections = [
            'overview',
            'approvals',
            'admins',
            'personnel',
            'offices',
            'tracking',
            'custody',
            'categories',
            'sla-policies',
            'sessions',
            'integrity',
            'diagnostics',
            'audit',
        ];
        if (! in_array($activeSection, $validSections, true)) {
            $activeSection = 'overview';
        }

        $selectedDocId = (string) $request->query('doc', '');

        $offices = Office::query()->orderBy('code')->get();
        $allUsers = User::query()->with(['office', 'delegate'])->orderBy('full_name')->get();
        $usersById = $allUsers->keyBy('id');

        $pendingUsers = $allUsers
            ->filter(fn (User $u) => ($u->approval_status ?? 'approved') === 'pending')
            ->values();

        // Strictly separate Admin accounts from regular User (Personnel) accounts
        $adminAccounts = $allUsers
            ->filter(fn (User $u) => ($u->approval_status ?? 'approved') !== 'pending' && $this->isAuthorizedAdmin($u))
            ->values();

        $rosterUsers = $allUsers
            ->filter(fn (User $u) => ($u->approval_status ?? 'approved') !== 'pending' && ! $this->isAuthorizedAdmin($u))
            ->values();

        $activeApprovedUsers = $allUsers
            ->filter(fn (User $u) => ($u->approval_status ?? 'approved') !== 'pending' && $u->active)
            ->values();

        $documents = Document::query()
            ->with([
                'category.slaPolicy.escalateToOffice',
                'originOffice',
                'currentOffice',
                'currentHolder',
                'transactions.fromOffice',
                'transactions.toOffice',
                'transactions.fromUser',
                'transactions.toUser',
                'versions',
            ])
            ->orderByDesc('updated_at')
            ->get();

        $categories = DocumentCategory::query()
            ->with(['slaPolicy.escalateToOffice'])
            ->orderBy('name')
            ->get();
        $docCountsByCategory = $documents->groupBy('category_id')->map->count();

        // Active (non-finalized) documents currently held by each user — powers Custody Reassignment
        $heldDocCountsByUser = $documents
            ->filter(fn (Document $d) => ! in_array($d->lifecycle_status, ['approved', 'archived'], true))
            ->groupBy('current_holder_id')
            ->map->count();

        $recentAlertsByDoc = UserNotification::query()
            ->where(function ($q): void {
                $q->where('title', 'like', 'Auto Stalled Document Alert%')
                    ->orWhere('title', 'like', 'Admin Follow-Up Alert%')
                    ->orWhere('title', 'like', 'SLA Escalation Alert%');
            })
            ->orderByDesc('received_at')
            ->get()
            ->groupBy('document_id')
            ->map(fn ($items) => $items->first());

        $auditLogs = AuditLog::query()
            ->orderByDesc('occurred_at')
            ->limit(400)
            ->get();

        $stalledThresholdHours = max(
            1,
            (int) env('DOCTRACK_STALLED_HOURS', StalledDocumentAlertService::DEFAULT_STALLED_HOURS),
        );

        // Compute Division Telemetry KPIs & enrich every document row with SLA policy, dwell, and dot-connected timeline
        $activePersonnel = $rosterUsers->filter(fn (User $u) => (bool) $u->active)->count();
        $deactivatedPersonnel = $rosterUsers->filter(fn (User $u) => ! $u->active)->count();
        $onLeavePersonnel = $rosterUsers
            ->filter(fn (User $u) => $u->active && $u->availability === 'on_leave')
            ->count();

        $pendingReceipts = 0;
        $slaRisks = 0;
        $stalledCount = 0;
        $recalledOrReturned = 0;
        $finalized = 0;
        $inReview = 0;

        $documentRows = $documents->map(function (Document $doc) use (
            &$pendingReceipts,
            &$slaRisks,
            &$stalledCount,
            &$recalledOrReturned,
            &$finalized,
            &$inReview,
            $recentAlertsByDoc,
        ) {
            /** @var RoutingTransaction|null $latest */
            $latest = $doc->transactions->sortBy('sent_at')->last();
            // Honor category SLA Policy thresholds automatically when null is passed
            $eval = $this->stalledAlerts->evaluate($doc, null);
            $slaState = $eval['slaState'];

            if ($eval['isInTransit']) {
                $pendingReceipts++;
            }
            if (in_array($slaState, ['at_risk', 'overdue'], true)) {
                $slaRisks++;
            }
            if ($eval['isStalled']) {
                $stalledCount++;
            }
            if (
                $doc->lifecycle_status === 'returned_for_revision' ||
                ($latest && in_array($latest->receipt_status, ['recalled', 'declined_misrouted'], true))
            ) {
                $recalledOrReturned++;
            }
            if (in_array($doc->lifecycle_status, ['approved', 'archived'], true)) {
                $finalized++;
            }
            if ($doc->lifecycle_status === 'in_review') {
                $inReview++;
            }

            /** @var UserNotification|null $lastAlert */
            $lastAlert = $recentAlertsByDoc->get($doc->id);

            return [
                'model' => $doc,
                'latest' => $latest,
                'slaState' => $slaState,
                'idleHours' => $eval['idleHours'],
                'idleLabel' => $eval['idleLabel'],
                'isStalled' => $eval['isStalled'],
                'shouldEscalate' => $eval['shouldEscalate'],
                'escalationOfficeCode' => $eval['escalationOfficeCode'],
                'stalledThresholdHours' => $eval['stalledThresholdHours'],
                'isInTransit' => $eval['isInTransit'],
                'targetOfficeCode' => $eval['targetOfficeCode'],
                'targetOfficeName' => $eval['targetOfficeName'],
                'targetHolderName' => $eval['targetHolderName'],
                'lastAlertAt' => $lastAlert?->received_at,
                'lastAlertAutomatic' => $lastAlert ? str_starts_with((string) $lastAlert->title, 'Auto Stalled') : false,
                'timelineEvents' => $this->buildTimelineEvents($doc),
            ];
        });

        // 2. Active Sanctum Device Sessions (Web + Mobile Tokens)
        $activeSessions = PersonalAccessToken::query()
            ->orderByDesc('last_used_at')
            ->orderByDesc('created_at')
            ->get()
            ->map(function (PersonalAccessToken $token) use ($usersById): array {
                /** @var User|null $owner */
                $owner = $usersById->get((string) $token->tokenable_id);
                $platform = strtolower((string) ($token->getAttribute('platform') ?? 'web'));
                $ipHint = (string) ($token->getAttribute('ip_hint') ?? '');

                return [
                    'id' => $token->id,
                    'name' => (string) $token->name,
                    'platform' => in_array($platform, ['android', 'ios', 'web'], true) ? $platform : 'web',
                    'ip_hint' => $ipHint !== '' ? $ipHint : '—',
                    'last_used_at' => $token->last_used_at,
                    'created_at' => $token->created_at,
                    'expires_at' => $token->expires_at,
                    'user_id' => (string) $token->tokenable_id,
                    'user_name' => $owner?->full_name ?? 'Unknown Account',
                    'user_email' => $owner?->email ?? '',
                    'employee_id' => $owner?->employee_id ?? '—',
                    'office_code' => $owner?->office?->code ?? 'HQ',
                    'is_admin' => $owner ? $this->isAuthorizedAdmin($owner) : false,
                ];
            })
            ->values();

        // 4. File Integrity & Storage Health Snapshot (SHA-256 + Disk Audit)
        $integrityAudit = Cache::get(StorageIntegrityService::CACHE_KEY);
        if (! is_array($integrityAudit)) {
            $integrityAudit = $this->integrity->runAudit(null, false);
        }

        // 5. Real-Time Delivery & Push Diagnostics
        $realtimeDiagnostics = $this->realtime->diagnosticsSnapshot();
        $pushTokens = DevicePushToken::query()
            ->with(['user.office'])
            ->orderByDesc('last_seen_at')
            ->orderByDesc('updated_at')
            ->get();
        $pushTokenUserIds = $pushTokens->pluck('user_id')->unique()->all();
        $usersWithoutPushToken = $activeApprovedUsers
            ->filter(fn (User $u) => ! in_array($u->id, $pushTokenUserIds, true))
            ->values();
        $pushLogs = Schema::hasTable('push_delivery_logs')
            ? PushDeliveryLog::query()
                ->with(['targetUser', 'targetOffice'])
                ->orderByDesc('occurred_at')
                ->limit(150)
                ->get()
            : collect();

        $configuredPoliciesCount = $categories->filter(fn (DocumentCategory $c) => $c->slaPolicy !== null && $c->slaPolicy->active)->count();

        $telemetry = [
            'activePersonnel' => $activePersonnel,
            'deactivatedPersonnel' => $deactivatedPersonnel,
            'onLeavePersonnel' => $onLeavePersonnel,
            'activeAdmins' => $adminAccounts->filter(fn (User $u) => (bool) $u->active)->count(),
            'totalAdmins' => $adminAccounts->count(),
            'pendingApprovals' => $pendingUsers->count(),
            'totalDocuments' => $documents->count(),
            'pendingReceipts' => $pendingReceipts,
            'slaRisks' => $slaRisks,
            'stalledCount' => $stalledCount,
            'recalledOrReturned' => $recalledOrReturned,
            'finalized' => $finalized,
            'inReview' => $inReview,
            'stalledThresholdHours' => $stalledThresholdHours,
            'configuredSlaPolicies' => $configuredPoliciesCount,
            'activeSessions' => $activeSessions->count(),
            'integrityIssues' => ($integrityAudit['summary']['missing_count'] ?? 0) + ($integrityAudit['summary']['mismatch_count'] ?? 0),
        ];

        // Compute Per-Office Load & SLA Matrix (counts active staff & admins assigned to each office)
        $officeMatrix = $offices->map(function (Office $office) use ($allUsers, $documentRows) {
            $staffCount = $allUsers
                ->filter(fn (User $u) => ($u->approval_status ?? 'approved') !== 'pending' && $u->active && $u->office_id === $office->id)
                ->count();

            $activeDocsCount = $documentRows
                ->filter(
                    fn (array $r) => $r['model']->current_office_id === $office->id &&
                        ! in_array($r['model']->lifecycle_status, ['approved', 'archived'], true),
                )
                ->count();

            $pendingCount = $documentRows
                ->filter(
                    fn (array $r) => $r['isInTransit'] &&
                        $r['latest']?->to_office_id === $office->id,
                )
                ->count();

            $slaCount = $documentRows
                ->filter(
                    fn (array $r) => $r['model']->current_office_id === $office->id &&
                        (in_array($r['slaState'], ['at_risk', 'overdue'], true) || $r['isStalled']),
                )
                ->count();

            $finalizedCount = $documentRows
                ->filter(
                    fn (array $r) => $r['model']->current_office_id === $office->id &&
                        in_array($r['model']->lifecycle_status, ['approved', 'archived'], true),
                )
                ->count();

            return [
                'office' => $office,
                'staffCount' => $staffCount,
                'activeDocsCount' => $activeDocsCount,
                'pendingCount' => $pendingCount,
                'slaCount' => $slaCount,
                'finalizedCount' => $finalizedCount,
            ];
        });

        // Attention queue: SLA risk OR stalled ("tengga") documents sorted by idle hours desc
        $attentionDocs = $documentRows
            ->filter(fn (array $r) => in_array($r['slaState'], ['at_risk', 'overdue'], true) || $r['isStalled'])
            ->sortByDesc('idleHours')
            ->values();

        if ($selectedDocId === '' && $documentRows->isNotEmpty()) {
            $selectedDocId = (string) $documentRows->first()['model']->id;
        }

        return view('admin::studio', [
            'admin' => $admin,
            'activeSection' => $activeSection,
            'selectedDocId' => $selectedDocId,
            'offices' => $offices,
            'pendingUsers' => $pendingUsers,
            'adminAccounts' => $adminAccounts,
            'rosterUsers' => $rosterUsers,
            'activeApprovedUsers' => $activeApprovedUsers,
            'heldDocCountsByUser' => $heldDocCountsByUser,
            'categories' => $categories,
            'docCountsByCategory' => $docCountsByCategory,
            'documentRows' => $documentRows,
            'attentionDocs' => $attentionDocs,
            'activeSessions' => $activeSessions,
            'integrityAudit' => $integrityAudit,
            'realtimeDiagnostics' => $realtimeDiagnostics,
            'pushTokens' => $pushTokens,
            'usersWithoutPushToken' => $usersWithoutPushToken,
            'pushLogs' => $pushLogs,
            'auditLogs' => $auditLogs,
            'telemetry' => $telemetry,
            'officeMatrix' => $officeMatrix,
            'autoSweepSummary' => $autoSweepSummary,
        ]);
    }

    public function approveUser(Request $request, string $id): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        /** @var User|null $target */
        $target = User::query()->with('office')->find($id);
        if (! $target) {
            return $this->backToSection('approvals', null, 'Pending account was not found.');
        }

        $target->update([
            'approval_status' => 'approved',
            'active' => true,
            'email_verified_at' => $target->email_verified_at ?? now(),
        ]);

        $this->audit->record(
            $admin,
            'account_approved',
            null,
            null,
            "Approved account registration for {$target->full_name} ({$target->employee_id}).",
            'Tracely Admin Portal',
        );

        $this->realtime->publish('directory_updated', [$admin->office_id, $target->office_id], [$target->id]);

        return $this->backToSection(
            (string) $request->input('return_section', 'approvals'),
            "Approved {$target->full_name} ({$target->employee_id}) — user can now sign in.",
        );
    }

    public function approveAllPending(Request $request): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $pending = User::query()->where('approval_status', 'pending')->get();
        $count = $pending->count();

        foreach ($pending as $user) {
            $user->update([
                'approval_status' => 'approved',
                'active' => true,
                'email_verified_at' => $user->email_verified_at ?? now(),
            ]);
            $this->audit->record(
                $admin,
                'account_approved',
                null,
                null,
                "Bulk-approved account registration for {$user->full_name} ({$user->employee_id}).",
                'Tracely Admin Portal',
            );
        }

        if ($count > 0) {
            $this->realtime->publish(
                'directory_updated',
                array_values(array_unique(array_merge([$admin->office_id], $pending->pluck('office_id')->all()))),
                $pending->pluck('id')->all(),
            );
        }

        return $this->backToSection('approvals', "Approved {$count} pending user account(s).");
    }

    public function rejectUser(Request $request, string $id): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:240'],
        ]);

        /** @var User|null $target */
        $target = User::query()->with('office')->find($id);
        if (! $target) {
            return $this->backToSection('approvals', null, 'Pending account was not found.');
        }

        if ($target->id === $admin->id) {
            return $this->backToSection('approvals', null, 'You cannot reject your own account.');
        }

        $target->update([
            'approval_status' => 'rejected',
            'active' => false,
        ]);
        $target->tokens()->delete();

        $reason = trim((string) ($validated['reason'] ?? ''));
        $this->audit->record(
            $admin,
            'account_rejected',
            null,
            null,
            "Rejected account registration for {$target->full_name} ({$target->employee_id})".($reason !== '' ? ": {$reason}" : '.'),
            'Tracely Admin Portal',
        );

        $this->realtime->publish('directory_updated', [$admin->office_id, $target->office_id], [$target->id]);

        return $this->backToSection('approvals', "Rejected registration request for {$target->full_name}.");
    }

    public function provisionUser(Request $request): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $validated = $request->validate([
            'full_name' => ['required', 'string', 'min:2', 'max:50'],
            'employee_id' => ['nullable', 'string', 'min:4', 'max:16', 'regex:/^[A-Za-z0-9-]+$/'],
            'email' => ['required', 'email', 'max:64'],
            'position' => ['required', 'string', 'min:2', 'max:120'],
            'office_id' => ['required', 'string', 'max:64'],
            'custom_office_code' => ['nullable', 'string', 'min:2', 'max:20', 'regex:/^[A-Za-z0-9_-]+$/'],
            'custom_office_name' => ['nullable', 'string', 'min:3', 'max:120'],
            'role' => ['required', 'in:staff,unit_head,records_officer,legal_officer,ict_admin'],
            'password' => ['required', 'string', 'min:8', 'max:32'],
        ]);

        $rawEmpId = trim((string) ($validated['employee_id'] ?? ''));
        $employeeId = $rawEmpId !== ''
            ? strtoupper($rawEmpId)
            : 'TRC-'.str_pad((string) (User::query()->count() + 1001), 4, '0', STR_PAD_LEFT);
        $email = strtolower(trim($validated['email']));

        if (User::query()->whereRaw('UPPER(employee_id) = ?', [$employeeId])->exists()) {
            return $this->backToSection('personnel', null, "Employee ID {$employeeId} is already registered.");
        }
        if (User::query()->whereRaw('LOWER(email) = ?', [$email])->exists()) {
            return $this->backToSection('personnel', null, "Email {$email} is already registered.");
        }

        $office = $this->resolveOrCreateAssignedOffice(
            $admin,
            $validated['office_id'],
            $validated['custom_office_code'] ?? null,
            $validated['custom_office_name'] ?? null,
        );
        if (! $office) {
            return $this->backToSection(
                'personnel',
                null,
                'Please select a valid office or provide a custom office name (at least 3 characters).',
            );
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
            $admin,
            'account_provisioned',
            null,
            null,
            "Provisioned verified account for {$created->full_name} ({$created->employee_id}) in {$office->code} as {$created->role}.",
            'Tracely Admin Portal',
        );

        $this->realtime->publish('directory_updated', [$admin->office_id, $office->id], [$created->id]);

        $returnSection = (string) $request->input('return_section', 'personnel');
        if (! in_array($returnSection, ['personnel', 'admins', 'overview'], true)) {
            $returnSection = 'personnel';
        }

        return $this->backToSection(
            $returnSection,
            "Provisioned & activated {$created->full_name} ({$created->employee_id}) in {$office->code} ({$office->name}).",
        );
    }

    public function provisionAdmin(Request $request): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $validated = $request->validate([
            'full_name' => ['required', 'string', 'min:2', 'max:50'],
            'employee_id' => ['nullable', 'string', 'min:4', 'max:16', 'regex:/^[A-Za-z0-9-]+$/'],
            'email' => ['required', 'email', 'max:64'],
            'position' => ['required', 'string', 'min:2', 'max:120'],
            'office_id' => ['required', 'string', 'max:64'],
            'custom_office_code' => ['nullable', 'string', 'min:2', 'max:20', 'regex:/^[A-Za-z0-9_-]+$/'],
            'custom_office_name' => ['nullable', 'string', 'min:3', 'max:120'],
            'role' => ['required', 'in:ict_admin,records_officer'],
            'password' => ['required', 'string', 'min:8', 'max:32'],
        ]);

        $rawEmpId = trim((string) ($validated['employee_id'] ?? ''));
        $employeeId = $rawEmpId !== ''
            ? strtoupper($rawEmpId)
            : 'ADM-'.str_pad((string) (User::query()->count() + 101), 4, '0', STR_PAD_LEFT);
        $email = strtolower(trim($validated['email']));

        if (User::query()->whereRaw('UPPER(employee_id) = ?', [$employeeId])->exists()) {
            return $this->backToSection('admins', null, "Employee ID {$employeeId} is already registered.");
        }
        if (User::query()->whereRaw('LOWER(email) = ?', [$email])->exists()) {
            return $this->backToSection('admins', null, "Email {$email} is already registered.");
        }

        $office = $this->resolveOrCreateAssignedOffice(
            $admin,
            $validated['office_id'],
            $validated['custom_office_code'] ?? null,
            $validated['custom_office_name'] ?? null,
        );
        if (! $office) {
            return $this->backToSection(
                'admins',
                null,
                'Please select a valid office or provide a custom office name (at least 3 characters).',
            );
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
            $admin,
            'admin_account_provisioned',
            null,
            null,
            "Provisioned Admin account for {$created->full_name} ({$created->employee_id}) in {$office->code} as {$created->role}.",
            'Tracely Admin Portal',
        );

        $this->realtime->publish('directory_updated', [$admin->office_id, $office->id], [$created->id]);

        return $this->backToSection(
            'admins',
            "Added administrator {$created->full_name} ({$created->employee_id}) with ".($created->role === 'ict_admin' ? 'ICT Admin' : 'Records Admin').' access.',
        );
    }

    public function updateUser(Request $request, string $id): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $validated = $request->validate([
            'role' => ['required', 'in:staff,unit_head,records_officer,legal_officer,ict_admin'],
            'office_id' => ['required', 'string', 'max:64'],
            'custom_office_code' => ['nullable', 'string', 'min:2', 'max:20', 'regex:/^[A-Za-z0-9_-]+$/'],
            'custom_office_name' => ['nullable', 'string', 'min:3', 'max:120'],
            'position' => ['required', 'string', 'min:2', 'max:120'],
            'availability' => ['required', 'in:available,on_leave,official_business'],
            'availability_until' => ['nullable', 'date'],
            'delegate_id' => ['nullable', 'string', 'max:64'],
            'return_section' => ['nullable', 'string', 'max:32'],
        ]);

        /** @var User|null $target */
        $target = User::query()->with('office')->find($id);
        $fallbackSection = (string) ($validated['return_section'] ?? 'personnel');
        if (! in_array($fallbackSection, ['personnel', 'admins'], true)) {
            $fallbackSection = 'personnel';
        }
        if (! $target) {
            return $this->backToSection($fallbackSection, null, 'Account was not found.');
        }

        $office = $this->resolveOrCreateAssignedOffice(
            $admin,
            $validated['office_id'],
            $validated['custom_office_code'] ?? null,
            $validated['custom_office_name'] ?? null,
        );
        if (! $office) {
            return $this->backToSection(
                $fallbackSection,
                null,
                'Please select a valid office or provide a custom office name (at least 3 characters).',
            );
        }

        $delegateId = trim((string) ($validated['delegate_id'] ?? ''));
        if ($delegateId === '' || $delegateId === $target->id) {
            $delegateId = null;
        } else {
            $delegateExists = User::query()->where('id', $delegateId)->where('active', true)->exists();
            if (! $delegateExists) {
                return $this->backToSection($fallbackSection, null, 'Selected leave delegate is not an active user.');
            }
        }

        $availUntil = ! empty($validated['availability_until'])
            ? Carbon::parse((string) $validated['availability_until'])->endOfDay()
            : null;

        $target->update([
            'role' => $validated['role'],
            'office_id' => $office->id,
            'position' => trim($validated['position']),
            'availability' => $validated['availability'],
            'availability_until' => $validated['availability'] === 'available' ? null : $availUntil,
            'delegate_id' => $delegateId,
        ]);
        $target->load(['office', 'delegate']);

        $delegateSummary = $target->delegate ? ", delegate={$target->delegate->full_name}" : ', delegate=none';
        $this->audit->record(
            $admin,
            'account_updated_by_admin',
            null,
            null,
            "Updated {$target->full_name} ({$target->employee_id}): role={$target->role}, office={$office->code}, availability={$target->availability}{$delegateSummary}.",
            'Tracely Admin Portal',
        );

        $this->realtime->publish('directory_updated', [$admin->office_id, $office->id], [$target->id]);

        $destSection = $this->isAuthorizedAdmin($target) ? 'admins' : 'personnel';

        return $this->backToSection($destSection, "Updated assignment for {$target->full_name} ({$office->code}).");
    }

    public function resetUserPassword(Request $request, string $id): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $validated = $request->validate([
            'new_password' => ['required', 'string', 'min:8', 'max:32'],
            'return_section' => ['nullable', 'string', 'max:32'],
        ]);

        /** @var User|null $target */
        $target = User::query()->with('office')->find($id);
        $fallbackSection = (string) ($validated['return_section'] ?? 'personnel');
        if (! in_array($fallbackSection, ['personnel', 'admins'], true)) {
            $fallbackSection = 'personnel';
        }
        if (! $target) {
            return $this->backToSection($fallbackSection, null, 'Account was not found.');
        }

        $target->update([
            'password' => $validated['new_password'],
        ]);
        $target->tokens()->delete();

        $this->audit->record(
            $admin,
            'account_password_reset',
            null,
            null,
            "Reset password and revoked existing device sessions for {$target->full_name} ({$target->employee_id}).",
            'Tracely Admin Portal',
        );

        $this->realtime->publish('session_revoked', [$target->office_id], [$target->id]);

        $destSection = $request->filled('return_section')
            ? $fallbackSection
            : ($this->isAuthorizedAdmin($target) ? 'admins' : 'personnel');

        return $this->backToSection(
            $destSection,
            "Password reset for {$target->full_name} ({$target->employee_id}) — existing device tokens revoked.",
        );
    }

    public function toggleUserActive(Request $request, string $id): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $fallbackSection = (string) $request->input('return_section', 'personnel');
        if (! in_array($fallbackSection, ['personnel', 'admins'], true)) {
            $fallbackSection = 'personnel';
        }

        /** @var User|null $target */
        $target = User::query()->with('office')->find($id);
        if (! $target) {
            return $this->backToSection($fallbackSection, null, 'Account was not found.');
        }

        $destSection = $request->filled('return_section')
            ? $fallbackSection
            : ($this->isAuthorizedAdmin($target) ? 'admins' : 'personnel');

        if ($target->id === $admin->id) {
            return $this->backToSection($destSection, null, 'You cannot deactivate your own active admin account.');
        }

        $nextActive = ! $target->active;
        $target->update(['active' => $nextActive]);
        if (! $nextActive) {
            $target->tokens()->delete();
        }

        $this->audit->record(
            $admin,
            $nextActive ? 'account_reactivated' : 'account_deactivated',
            null,
            null,
            ($nextActive ? 'Reactivated' : 'Deactivated')." account for {$target->full_name} ({$target->employee_id}).",
            'Tracely Admin Portal',
        );

        $this->realtime->publish('directory_updated', [$admin->office_id, $target->office_id], [$target->id]);

        return $this->backToSection(
            $destSection,
            ($nextActive ? 'Reactivated ' : 'Deactivated ').$target->full_name.'.',
        );
    }

    /**
     * Bulk-reassign all active documents held by an unavailable/resigned/retired officer
     * to a designated replacement officer while preserving the immutable routing_transactions chain.
     */
    public function reassignUserCustody(Request $request, string $id): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $validated = $request->validate([
            'target_user_id' => ['required', 'string', 'max:64'],
            'reason' => ['required', 'string', 'min:3', 'max:240'],
            'return_section' => ['nullable', 'string', 'max:32'],
        ]);

        $returnSection = (string) ($validated['return_section'] ?? 'personnel');
        if (! in_array($returnSection, ['personnel', 'admins', 'custody'], true)) {
            $returnSection = 'personnel';
        }

        /** @var User|null $source */
        $source = User::query()->with('office')->find($id);
        /** @var User|null $target */
        $target = User::query()->with('office')->find($validated['target_user_id']);

        if (! $source) {
            return $this->backToSection($returnSection, null, 'Source employee account was not found.');
        }
        if (! $target || ! $target->active || ($target->approval_status ?? 'approved') !== 'approved') {
            return $this->backToSection($returnSection, null, 'Replacement custodian must be an active, approved custodian.');
        }
        if ($source->id === $target->id) {
            return $this->backToSection($returnSection, null, 'Replacement custodian must be a different user.');
        }

        $heldDocs = Document::query()
            ->with(['transactions', 'currentOffice'])
            ->where('current_holder_id', $source->id)
            ->whereNotIn('lifecycle_status', ['approved', 'archived'])
            ->get();

        if ($heldDocs->isEmpty()) {
            return $this->backToSection(
                $returnSection,
                null,
                "{$source->full_name} currently holds no active documents to reassign.",
            );
        }

        $reason = trim($validated['reason']);
        $now = now();
        $movedCodes = [];

        DB::transaction(function () use ($admin, $source, $target, $heldDocs, $reason, $now, &$movedCodes): void {
            foreach ($heldDocs as $doc) {
                $fromOfficeId = $doc->current_office_id;
                $sameOffice = $fromOfficeId === $target->office_id;

                /** @var RoutingTransaction|null $latest */
                $latest = $doc->transactions->sortBy('sent_at')->last();
                if ($latest && $latest->receipt_status === 'pending' && $latest->to_user_id === $source->id) {
                    $latest->update([
                        'receipt_status' => 'acknowledged',
                        'acknowledged_at' => $now,
                        'acknowledged_by_name' => "{$admin->full_name} (Admin Reassignment Override)",
                        'remarks' => trim(($latest->remarks ? $latest->remarks.' · ' : '')."Admin reassigned custody to {$target->full_name}"),
                    ]);
                }

                RoutingTransaction::query()->create([
                    'id' => 'tx-'.Str::uuid()->toString(),
                    'document_id' => $doc->id,
                    'from_user_id' => $source->id,
                    'from_office_id' => $fromOfficeId,
                    'to_user_id' => $target->id,
                    'to_office_id' => $target->office_id,
                    'routing_scope' => $sameOffice ? 'internal_office' : 'inter_office',
                    'receipt_status' => 'acknowledged',
                    'remarks' => "Admin Custody Reassignment: {$reason}",
                    'is_internal_only' => $sameOffice,
                    'sent_at' => $now,
                    'acknowledged_at' => $now,
                    'acknowledged_by_name' => "{$admin->full_name} (Admin Override)",
                ]);

                $doc->update([
                    'current_office_id' => $target->office_id,
                    'current_holder_id' => $target->id,
                    'lifecycle_status' => 'in_review',
                ]);

                $doc->participants()->syncWithoutDetaching([$target->id]);

                ExternalMilestone::query()->create([
                    'id' => 'ms-'.Str::uuid()->toString(),
                    'document_id' => $doc->id,
                    'stage_label' => "Custody Reassigned to {$target->office?->code} ({$target->full_name})",
                    'office_name' => (string) ($target->office?->name ?? 'Assigned Office'),
                    'occurred_at' => $now,
                ]);

                $lockPreview = "Admin reassigned {$doc->tracking_code} to your desk in {$target->office?->code}.";
                UserNotification::query()->create([
                    'id' => 'notif-'.Str::uuid()->toString(),
                    'target_user_id' => $target->id,
                    'target_office_id' => $target->office_id,
                    'document_id' => $doc->id,
                    'title' => "Custody Reassigned · {$doc->tracking_code}",
                    'content' => "{$doc->title} was reassigned from {$source->full_name} to your desk by Admin ({$reason}).",
                    'lock_screen_preview' => $lockPreview,
                    'authenticated_detail' => "{$doc->tracking_code} · Reassigned from {$source->full_name} ({$reason})",
                    'received_at' => $now,
                    'read' => false,
                ]);

                $this->audit->record(
                    $admin,
                    'admin_custody_reassigned',
                    $doc->id,
                    $doc->tracking_code,
                    "Reassigned {$doc->tracking_code} from {$source->full_name} to {$target->full_name} ({$target->office?->code}): {$reason}",
                    'Tracely Admin Portal',
                );

                $this->realtime->publish(
                    'custody_reassigned',
                    [$fromOfficeId, $target->office_id],
                    [$source->id, $target->id],
                    $doc->id,
                    $lockPreview,
                );

                $movedCodes[] = $doc->tracking_code;
            }
        });

        $count = count($movedCodes);

        return $this->backToSection(
            $returnSection,
            "Reassigned {$count} active document(s) from {$source->full_name} to {$target->full_name} ({$target->office?->code}): ".implode(', ', array_slice($movedCodes, 0, 4)).($count > 4 ? '…' : ''),
        );
    }

    /**
     * Force sign-out all active Sanctum Web & Mobile device tokens for a user (remote kill-switch).
     */
    public function revokeUserSessions(Request $request, string $id): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $returnSection = (string) $request->input('return_section', 'sessions');
        if (! in_array($returnSection, ['sessions', 'personnel', 'admins'], true)) {
            $returnSection = 'sessions';
        }

        /** @var User|null $target */
        $target = User::query()->with('office')->find($id);
        if (! $target) {
            return $this->backToSection($returnSection, null, 'Account was not found.');
        }

        $revokedCount = (int) $target->tokens()->delete();

        $this->audit->record(
            $admin,
            'user_sessions_force_signed_out',
            null,
            null,
            "Force signed out {$revokedCount} active device session(s) for {$target->full_name} ({$target->employee_id}).",
            'Tracely Admin Portal',
        );

        $this->realtime->publish('session_revoked', [$target->office_id], [$target->id]);

        return $this->backToSection(
            $returnSection,
            "Signed out {$revokedCount} active device session(s) for {$target->full_name}.",
        );
    }

    public function createOffice(Request $request): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $validated = $request->validate([
            'code' => ['required', 'string', 'min:2', 'max:20', 'regex:/^[A-Za-z0-9_-]+$/'],
            'name' => ['required', 'string', 'min:3', 'max:120'],
        ]);

        $code = strtoupper(trim($validated['code']));
        $name = trim($validated['name']);

        if (Office::query()->whereRaw('UPPER(code) = ?', [$code])->exists()) {
            return $this->backToSection('offices', null, "An office with code {$code} already exists.");
        }

        $slug = strtolower((string) preg_replace('/[^a-zA-Z0-9]+/', '-', $code));
        $office = Office::query()->create([
            'id' => 'off-'.($slug ?: Str::lower(Str::random(6))).'-'.Str::lower(Str::random(4)),
            'code' => $code,
            'name' => $name,
            'is_custom' => true,
        ]);

        $this->audit->record(
            $admin,
            'office_created',
            null,
            null,
            "Registered office {$office->code} ({$office->name}).",
            'Tracely Admin Portal',
        );

        $this->realtime->publish('office_updated', [$admin->office_id, $office->id]);

        return $this->backToSection('offices', "Registered office {$office->code} — {$office->name}.");
    }

    public function updateOffice(Request $request, string $id): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $validated = $request->validate([
            'code' => ['required', 'string', 'min:2', 'max:20', 'regex:/^[A-Za-z0-9_-]+$/'],
            'name' => ['required', 'string', 'min:3', 'max:120'],
        ]);

        /** @var Office|null $office */
        $office = Office::query()->find($id);
        if (! $office) {
            return $this->backToSection('offices', null, 'Office was not found.');
        }

        $code = strtoupper(trim($validated['code']));
        $duplicate = Office::query()
            ->where('id', '!=', $office->id)
            ->whereRaw('UPPER(code) = ?', [$code])
            ->exists();
        if ($duplicate) {
            return $this->backToSection('offices', null, "Another office already uses code {$code}.");
        }

        $office->update([
            'code' => $code,
            'name' => trim($validated['name']),
        ]);

        $this->audit->record(
            $admin,
            'office_updated',
            null,
            null,
            "Updated office details for {$office->code} ({$office->name}).",
            'Tracely Admin Portal',
        );

        $this->realtime->publish('office_updated', [$admin->office_id, $office->id]);

        return $this->backToSection('offices', "Updated office {$office->code}.");
    }

    public function createCategory(Request $request): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $validated = $request->validate([
            'code' => ['nullable', 'string', 'max:16'],
            'name' => ['required', 'string', 'min:2', 'max:120'],
        ]);

        $name = trim($validated['name']);
        $code = strtoupper(trim((string) ($validated['code'] ?? '')));
        if ($code === '') {
            $code = strtoupper(substr((string) preg_replace('/[^A-Za-z0-9]+/', '', $name), 0, 8)) ?: 'CAT';
        }

        if (DocumentCategory::query()->whereRaw('LOWER(name) = ?', [strtolower($name)])->exists()) {
            return $this->backToSection('categories', null, "Category \"{$name}\" already exists.");
        }

        $cat = DocumentCategory::query()->create([
            'id' => 'cat-'.Str::uuid()->toString(),
            'name' => $name,
            'code' => $code,
            'declared_by_office_code' => $admin->office?->code ?? 'ICT',
            'declared_by_office_name' => $admin->office?->name ?? 'ICT Unit',
            'is_global' => true,
            'usage_count' => 0,
        ]);

        $this->audit->record(
            $admin,
            'category_declared',
            null,
            null,
            "Declared global category \"{$cat->name}\" ({$cat->code}).",
            'Tracely Admin Portal',
        );

        $this->realtime->publish('category_declared', [$admin->office_id], [$admin->id]);

        return $this->backToSection('categories', "Added global category {$cat->code} — {$cat->name}.");
    }

    public function updateCategory(Request $request, string $id): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $validated = $request->validate([
            'code' => ['required', 'string', 'min:2', 'max:16'],
            'name' => ['required', 'string', 'min:2', 'max:120'],
        ]);

        /** @var DocumentCategory|null $category */
        $category = DocumentCategory::query()->find($id);
        if (! $category) {
            return $this->backToSection('categories', null, 'Document category was not found.');
        }

        $category->update([
            'code' => strtoupper(trim($validated['code'])),
            'name' => trim($validated['name']),
        ]);

        $this->audit->record(
            $admin,
            'category_declared',
            null,
            null,
            "Updated global category \"{$category->name}\" ({$category->code}).",
            'Tracely Admin Portal',
        );

        $this->realtime->publish('category_declared', [$admin->office_id], [$admin->id]);

        return $this->backToSection('categories', "Updated category {$category->code} — {$category->name}.");
    }

    public function deleteCategory(Request $request, string $id): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $validated = $request->validate([
            'replacement_category_id' => ['nullable', 'string', 'max:64'],
        ]);

        /** @var DocumentCategory|null $category */
        $category = DocumentCategory::query()->find($id);
        if (! $category) {
            return $this->backToSection('categories', null, 'Document category was not found.');
        }

        $usedCount = Document::query()->where('category_id', $category->id)->count();
        $name = $category->name;
        $code = $category->code;
        $reassignedTo = null;

        DB::transaction(function () use ($admin, $category, $usedCount, $validated, &$reassignedTo): void {
            if ($usedCount > 0) {
                $replacementId = trim((string) ($validated['replacement_category_id'] ?? ''));

                /** @var DocumentCategory|null $replacement */
                $replacement = null;
                if ($replacementId !== '' && $replacementId !== $category->id) {
                    $replacement = DocumentCategory::query()->find($replacementId);
                }

                if (! $replacement) {
                    $replacement = DocumentCategory::query()
                        ->where('id', '!=', $category->id)
                        ->orderBy('name')
                        ->first();
                }

                if (! $replacement) {
                    $replacement = DocumentCategory::query()->create([
                        'id' => 'cat-'.Str::uuid()->toString(),
                        'name' => 'General Document',
                        'code' => 'GEN',
                        'declared_by_office_code' => $admin->office?->code ?? 'ICT',
                        'declared_by_office_name' => $admin->office?->name ?? 'ICT Unit',
                        'is_global' => true,
                        'usage_count' => 0,
                    ]);
                }

                Document::query()
                    ->where('category_id', $category->id)
                    ->update(['category_id' => $replacement->id]);

                $replacement->increment('usage_count', $usedCount);
                $reassignedTo = $replacement;
            }

            $category->delete();
        });

        $summary = $usedCount > 0 && $reassignedTo
            ? "Deleted global category \"{$name}\" ({$code}) and reassigned {$usedCount} document(s) to \"{$reassignedTo->name}\" ({$reassignedTo->code})."
            : "Deleted global category \"{$name}\" ({$code}).";

        $this->audit->record(
            $admin,
            'category_deleted',
            null,
            null,
            $summary,
            'Tracely Admin Portal',
        );

        $this->realtime->publish('category_declared', [$admin->office_id], [$admin->id]);

        $toast = $usedCount > 0 && $reassignedTo
            ? "Deleted category {$code} — {$name} and reassigned {$usedCount} document(s) to {$reassignedTo->code}."
            : "Deleted category {$code} — {$name}.";

        return $this->backToSection('categories', $toast);
    }

    public function notifyOffice(Request $request, string $id): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $validated = $request->validate([
            'message' => ['nullable', 'string', 'max:280'],
            'return_section' => ['nullable', 'string', 'max:32'],
        ]);

        /** @var Document|null $doc */
        $doc = Document::query()
            ->with(['currentOffice', 'currentHolder', 'transactions.toOffice'])
            ->find($id);

        $returnSection = (string) ($validated['return_section'] ?? 'overview');
        if (! $doc) {
            return $this->backToSection($returnSection, null, 'Document was not found.');
        }

        $sent = $this->stalledAlerts->notifyOfficeForDocument(
            $doc,
            $admin,
            $validated['message'] ?? null,
            false,
        );

        return $this->backToSection(
            $returnSection,
            "Follow-up alert sent to {$sent['targetOfficeCode']} ({$sent['targetOfficeName']}) for {$doc->tracking_code}.",
        );
    }

    public function saveSlaPolicy(Request $request): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $validated = $request->validate([
            'category_id' => ['required', 'string', 'exists:document_categories,id'],
            'target_hours' => ['required', 'integer', 'min:1', 'max:720'],
            'stalled_alert_hours' => ['required', 'integer', 'min:1', 'max:720'],
            'escalation_hours' => ['required', 'integer', 'min:1', 'max:720'],
            'escalate_to_office_id' => ['nullable', 'string', 'exists:offices,id'],
            'active' => ['nullable', 'boolean'],
        ]);

        /** @var DocumentCategory $category */
        $category = DocumentCategory::query()->findOrFail($validated['category_id']);
        $escalateOfficeId = ! empty($validated['escalate_to_office_id']) ? (string) $validated['escalate_to_office_id'] : null;
        $isActive = $request->has('active') ? (bool) $request->boolean('active') : true;

        $existing = SlaPolicy::query()->where('category_id', $category->id)->first();
        $policy = SlaPolicy::query()->updateOrCreate(
            ['category_id' => $category->id],
            [
                'id' => $existing?->id ?? ('sla-'.Str::uuid()->toString()),
                'target_hours' => (int) $validated['target_hours'],
                'stalled_alert_hours' => (int) $validated['stalled_alert_hours'],
                'escalation_hours' => (int) $validated['escalation_hours'],
                'escalate_to_office_id' => $escalateOfficeId,
                'active' => $isActive,
            ],
        );
        $policy->load('escalateToOffice');

        $escLabel = $policy->escalateToOffice ? "escalate→{$policy->escalateToOffice->code} @ {$policy->escalation_hours}h" : 'no escalation';
        $this->audit->record(
            $admin,
            'sla_policy_saved',
            null,
            null,
            "Saved SLA policy for {$category->code} ({$category->name}): target={$policy->target_hours}h, stalled={$policy->stalled_alert_hours}h, {$escLabel}.",
            'Tracely Admin Portal',
        );

        $this->realtime->publish('sla_policy_updated', [$admin->office_id], [$admin->id]);

        return $this->backToSection(
            'sla-policies',
            "Saved SLA policy for {$category->code} ({$policy->target_hours}h target, {$policy->stalled_alert_hours}h alert).",
        );
    }

    public function deleteSlaPolicy(Request $request, string $id): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        /** @var SlaPolicy|null $policy */
        $policy = SlaPolicy::query()->with('category')->find($id);
        if (! $policy) {
            return $this->backToSection('sla-policies', null, 'SLA policy was not found.');
        }

        $catCode = $policy->category?->code ?? 'Category';
        $policy->delete();

        $this->audit->record(
            $admin,
            'sla_policy_deleted',
            null,
            null,
            "Reset SLA policy for {$catCode} back to division default thresholds.",
            'Tracely Admin Portal',
        );

        $this->realtime->publish('sla_policy_updated', [$admin->office_id], [$admin->id]);

        return $this->backToSection('sla-policies', "Reset {$catCode} back to default division SLA rules.");
    }

    public function runStalledSweep(Request $request): RedirectResponse
    {
        $admin = $this->requireAdmin($request);
        $returnSection = (string) $request->input('return_section', 'overview');

        $result = $this->stalledAlerts->sweepAndNotify(null, $admin);

        if ($result['alerts_sent'] > 0 || $result['escalations_sent'] > 0) {
            $parts = [];
            if ($result['alerts_sent'] > 0) {
                $parts[] = "{$result['alerts_sent']} office alert(s) (".implode(', ', $result['alerted_codes']).')';
            }
            if ($result['escalations_sent'] > 0) {
                $parts[] = "{$result['escalations_sent']} SLA escalation(s) (".implode(', ', $result['escalated_codes']).')';
            }

            return $this->backToSection(
                $returnSection,
                'SLA sweep complete: dispatched '.implode(' and ', $parts).'.',
            );
        }

        return $this->backToSection(
            $returnSection,
            "Sweep complete: checked {$result['checked']} active document(s) — {$result['stalled_count']} stalled (all already notified within the 12h cooldown).",
        );
    }

    /**
     * Revoke a single active Sanctum device token (Remote Kill-Switch).
     */
    public function revokeSession(Request $request, string $tokenId): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        /** @var PersonalAccessToken|null $token */
        $token = PersonalAccessToken::query()->find($tokenId);
        if (! $token) {
            return $this->backToSection('sessions', null, 'Device session was already revoked or expired.');
        }

        /** @var User|null $owner */
        $owner = User::query()->with('office')->find((string) $token->tokenable_id);
        $deviceName = (string) $token->name;
        $token->delete();

        $this->audit->record(
            $admin,
            'device_session_revoked',
            null,
            null,
            "Revoked Sanctum session \"{$deviceName}\" for ".($owner ? "{$owner->full_name} ({$owner->employee_id})" : "user {$token->tokenable_id}").'.',
            'Tracely Admin Portal',
        );

        if ($owner) {
            $this->realtime->publish('session_revoked', [$owner->office_id], [$owner->id]);
        }

        return $this->backToSection(
            'sessions',
            "Revoked device session \"{$deviceName}\"".($owner ? " for {$owner->full_name}." : '.'),
        );
    }

    /**
     * Emergency kill-switch: revoke all active Sanctum sessions for non-admin accounts.
     */
    public function revokeAllStaffSessions(Request $request): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $allUsers = User::query()->with('office')->get();
        $staffIds = $allUsers
            ->filter(fn (User $u) => ! $this->isAuthorizedAdmin($u))
            ->pluck('id')
            ->all();

        $revokedCount = PersonalAccessToken::query()
            ->whereIn('tokenable_id', $staffIds)
            ->delete();

        $this->audit->record(
            $admin,
            'emergency_sessions_revoked',
            null,
            null,
            "Executed division-wide kill-switch: revoked {$revokedCount} active staff Web & Mobile Sanctum session(s).",
            'Tracely Admin Portal',
        );

        $this->realtime->publish('session_revoked', [], $staffIds);

        return $this->backToSection(
            'sessions',
            "Kill-switch complete: signed out {$revokedCount} active staff device session(s).",
        );
    }

    /**
     * Execute an on-demand SHA-256 checksum & disk health audit across stored document versions and proof photos.
     */
    public function runIntegrityAudit(Request $request): RedirectResponse
    {
        $admin = $this->requireAdmin($request);
        $snapshot = $this->integrity->runAudit($admin, true);
        $sum = $snapshot['summary'];
        $issues = $sum['missing_count'] + $sum['mismatch_count'];

        if ($issues > 0) {
            return $this->backToSection(
                'integrity',
                null,
                "SHA-256 audit completed: {$sum['verified_count']}/{$sum['total_artifacts']} verified — flagged {$sum['missing_count']} missing and {$sum['mismatch_count']} checksum mismatch(es).",
            );
        }

        return $this->backToSection(
            'integrity',
            "SHA-256 integrity verified: all {$sum['verified_count']} artifact(s) ({$sum['total_size_label']}) match their stored checksums.",
        );
    }

    /**
     * Dispatch a test diagnostic notification + Realtime Pulse/FCM push to verify device delivery.
     */
    public function sendDiagnosticPush(Request $request): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $validated = $request->validate([
            'target_user_id' => ['required', 'string', 'exists:users,id'],
        ]);

        /** @var User $target */
        $target = User::query()->with('office')->findOrFail($validated['target_user_id']);
        $tokenCount = DevicePushToken::query()->where('user_id', $target->id)->count();
        $sampleDoc = Document::query()->first();

        $lockPreview = "Tracely diagnostic ping from Admin ({$admin->full_name}) at ".now()->format('h:i A').'.';
        if ($sampleDoc) {
            UserNotification::query()->create([
                'id' => 'notif-'.Str::uuid()->toString(),
                'target_user_id' => $target->id,
                'target_office_id' => $target->office_id,
                'document_id' => $sampleDoc->id,
                'title' => 'Diagnostic Push Test · ICT Admin',
                'content' => "Connectivity test dispatched to {$target->full_name} ({$target->office?->code}). Registered push devices: {$tokenCount}.",
                'lock_screen_preview' => $lockPreview,
                'authenticated_detail' => "ICT Diagnostic Ping · {$lockPreview}",
                'received_at' => now(),
                'read' => false,
            ]);
        }

        $cursor = $this->realtime->publish(
            'diagnostic_ping',
            [$target->office_id],
            [$target->id],
            $sampleDoc?->id,
            $lockPreview,
        );

        $this->audit->record(
            $admin,
            'diagnostic_push_sent',
            null,
            null,
            "Dispatched diagnostic realtime/push ping to {$target->full_name} ({$target->office?->code}; {$tokenCount} push token(s); cursor {$cursor}).",
            'Tracely Admin Portal',
        );

        $fcmHint = $this->realtime->fcmConfigured()
            ? ($tokenCount > 0 ? "FCM push sent to {$tokenCount} device(s)." : 'No registered phone push tokens found — delivered via SSE/Pulse only.')
            : 'Delivered via Realtime Pulse/SSE (FCM_SERVER_KEY not configured on server).';

        return $this->backToSection(
            'diagnostics',
            "Diagnostic ping dispatched to {$target->full_name} ({$target->office?->code}). {$fcmHint}",
        );
    }

    /**
     * Remove a stale or broken device push token.
     */
    public function deletePushToken(Request $request, string $id): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        /** @var DevicePushToken|null $token */
        $token = DevicePushToken::query()->with('user')->find($id);
        if (! $token) {
            return $this->backToSection('diagnostics', null, 'Device push token was not found.');
        }

        $ownerName = $token->user?->full_name ?? $token->user_id;
        $label = $token->device_label;
        $token->delete();

        $this->audit->record(
            $admin,
            'push_token_pruned',
            null,
            null,
            "Pruned registered push token \"{$label}\" for {$ownerName}.",
            'Tracely Admin Portal',
        );

        return $this->backToSection('diagnostics', "Removed push token \"{$label}\" for {$ownerName}.");
    }

    /**
     * Render the Printable Executive Division SLA & Bottleneck Report (A4 ManCom Summary).
     */
    public function executiveSlaReport(Request $request): View|RedirectResponse
    {
        $admin = $this->resolveAdminUser($request);
        if (! $admin) {
            return redirect()->route('admin.login');
        }

        $monthParam = trim((string) $request->query('month', now()->format('Y-m')));
        $periodStart = null;
        $periodEnd = null;
        $periodLabel = 'Cumulative Division Record (All Time)';

        if ($monthParam !== 'all' && preg_match('/^\d{4}-\d{2}$/', $monthParam)) {
            $periodStart = Carbon::createFromFormat('Y-m', $monthParam)->startOfMonth();
            $periodEnd = $periodStart->copy()->endOfMonth();
            $periodLabel = $periodStart->format('F Y');
        } else {
            $monthParam = 'all';
        }

        $monthOptions = [
            ['value' => 'all', 'label' => 'All Time (Cumulative)'],
        ];
        for ($i = 0; $i < 6; $i++) {
            $m = now()->copy()->startOfMonth()->subMonths($i);
            $monthOptions[] = [
                'value' => $m->format('Y-m'),
                'label' => $m->format('F Y'),
            ];
        }

        $docQuery = Document::query()
            ->with([
                'category.slaPolicy.escalateToOffice',
                'originOffice',
                'currentOffice',
                'currentHolder',
                'transactions.fromOffice',
                'transactions.toOffice',
            ])
            ->orderByDesc('created_at');

        if ($periodStart && $periodEnd) {
            $docQuery->whereBetween('created_at', [$periodStart, $periodEnd]);
        }

        $documents = $docQuery->get();
        $offices = Office::query()->orderBy('code')->get();
        $categories = DocumentCategory::query()->with(['slaPolicy.escalateToOffice'])->orderBy('name')->get();

        $totalDocs = $documents->count();
        $finalizedDocs = 0;
        $onTimeDocs = 0;
        $stalledDocs = 0;
        $overdueDocs = 0;
        $totalDwellHours = 0;

        $enrichedDocs = $documents->map(function (Document $doc) use (
            &$finalizedDocs,
            &$onTimeDocs,
            &$stalledDocs,
            &$overdueDocs,
            &$totalDwellHours,
        ): array {
            $eval = $this->stalledAlerts->evaluate($doc, null);
            $isFinalized = in_array($doc->lifecycle_status, ['approved', 'archived'], true);
            $isOnTime = $isFinalized
                ? ($doc->sla_due_at ? $doc->updated_at->lessThanOrEqualTo($doc->sla_due_at) : true)
                : ($eval['slaState'] !== 'overdue' && ! $eval['isStalled']);

            $turnaroundHours = $isFinalized && $doc->created_at && $doc->updated_at
                ? (int) max(0, $doc->created_at->diffInHours($doc->updated_at))
                : $eval['idleHours'];

            $totalDwellHours += $turnaroundHours;

            if ($isFinalized) {
                $finalizedDocs++;
            }
            if ($isOnTime) {
                $onTimeDocs++;
            }
            if ($eval['isStalled']) {
                $stalledDocs++;
            }
            if ($eval['slaState'] === 'overdue') {
                $overdueDocs++;
            }

            return [
                'model' => $doc,
                'eval' => $eval,
                'isFinalized' => $isFinalized,
                'isOnTime' => $isOnTime,
                'dwellHours' => $turnaroundHours,
            ];
        });

        $onTimeRate = $totalDocs > 0 ? round(($onTimeDocs / $totalDocs) * 100, 1) : 100.0;
        $avgDwellHours = $totalDocs > 0 ? round($totalDwellHours / $totalDocs, 1) : 0.0;

        $officeStats = $offices->map(function (Office $office) use ($enrichedDocs): array {
            $officeDocs = $enrichedDocs->filter(
                fn (array $r) => $r['model']->current_office_id === $office->id || $r['model']->origin_office_id === $office->id,
            );
            $held = $enrichedDocs->filter(
                fn (array $r) => $r['model']->current_office_id === $office->id && ! $r['isFinalized'],
            );
            $pending = $enrichedDocs->filter(
                fn (array $r) => $r['eval']['isInTransit'] && $r['eval']['targetOfficeId'] === $office->id,
            );
            $done = $enrichedDocs->filter(
                fn (array $r) => $r['model']->current_office_id === $office->id && $r['isFinalized'],
            );
            $delayed = $held->filter(fn (array $r) => $r['eval']['isStalled'] || $r['eval']['slaState'] === 'overdue');
            $avgOfficeDwell = $officeDocs->count() > 0
                ? round($officeDocs->avg('dwellHours'), 1)
                : 0.0;

            return [
                'office' => $office,
                'handledCount' => $officeDocs->count(),
                'finalizedCount' => $done->count(),
                'activeBacklog' => $held->count(),
                'pendingReceipt' => $pending->count(),
                'delayedCount' => $delayed->count(),
                'avgDwellHours' => $avgOfficeDwell,
            ];
        })->sortByDesc('delayedCount')->values();

        $categoryStats = $categories->map(function (DocumentCategory $cat) use ($enrichedDocs): array {
            $catDocs = $enrichedDocs->filter(fn (array $r) => $r['model']->category_id === $cat->id);
            $delayed = $catDocs->filter(fn (array $r) => $r['eval']['isStalled'] || $r['eval']['slaState'] === 'overdue');
            $onTime = $catDocs->filter(fn (array $r) => $r['isOnTime']);
            $count = $catDocs->count();

            return [
                'category' => $cat,
                'policy' => $cat->slaPolicy,
                'totalDocs' => $count,
                'delayedCount' => $delayed->count(),
                'avgDwellHours' => $count > 0 ? round($catDocs->avg('dwellHours'), 1) : 0.0,
                'onTimeRate' => $count > 0 ? round(($onTime->count() / $count) * 100, 1) : 100.0,
            ];
        })->sortByDesc('delayedCount')->values();

        $bottlenecks = $enrichedDocs
            ->filter(fn (array $r) => ! $r['isFinalized'] && ($r['eval']['isStalled'] || in_array($r['eval']['slaState'], ['overdue', 'at_risk'], true)))
            ->sortByDesc(fn (array $r) => $r['eval']['idleHours'])
            ->take(15)
            ->values();

        return view('admin::executive-report', [
            'admin' => $admin,
            'monthParam' => $monthParam,
            'periodLabel' => $periodLabel,
            'monthOptions' => $monthOptions,
            'generatedAt' => now(),
            'summary' => [
                'totalDocs' => $totalDocs,
                'finalizedDocs' => $finalizedDocs,
                'activeDocs' => $totalDocs - $finalizedDocs,
                'stalledDocs' => $stalledDocs,
                'overdueDocs' => $overdueDocs,
                'onTimeRate' => $onTimeRate,
                'avgDwellHours' => $avgDwellHours,
            ],
            'officeStats' => $officeStats,
            'categoryStats' => $categoryStats,
            'bottlenecks' => $bottlenecks,
        ]);
    }

    public function forceRecallDocument(Request $request, string $id): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        /** @var Document|null $doc */
        $doc = Document::query()->with(['transactions', 'originOffice'])->find($id);
        if (! $doc) {
            return $this->backToSection('custody', null, 'Document was not found.');
        }

        /** @var RoutingTransaction|null $latest */
        $latest = $doc->transactions->sortBy('sent_at')->last();
        if (! $latest || $latest->receipt_status !== 'pending') {
            return $this->backToSection('custody', null, 'Only in-transit documents awaiting receipt can be recalled.');
        }

        $latest->update([
            'receipt_status' => 'recalled',
            'remarks' => trim(($latest->remarks ? $latest->remarks.' · ' : '').'Recalled by Tracely Admin Portal'),
        ]);

        $doc->update([
            'current_office_id' => $latest->from_office_id,
            'current_holder_id' => $latest->from_user_id,
            'lifecycle_status' => 'in_review',
        ]);

        $this->audit->record(
            $admin,
            'transfer_recalled',
            $doc->id,
            $doc->tracking_code,
            "Admin recalled pending transfer of {$doc->tracking_code} back to originating office.",
            'Tracely Admin Portal',
        );

        $this->realtime->publish(
            'document_recalled',
            [$latest->from_office_id, $latest->to_office_id],
            [$latest->from_user_id, $latest->to_user_id],
            $doc->id,
        );

        return $this->backToSection('custody', "Recalled {$doc->tracking_code} back to originating custody.");
    }

    public function completeDocument(Request $request, string $id): RedirectResponse
    {
        $admin = $this->requireAdmin($request);

        $validated = $request->validate([
            'status' => ['required', 'in:approved,archived'],
        ]);

        /** @var Document|null $doc */
        $doc = Document::query()->find($id);
        if (! $doc) {
            return $this->backToSection('custody', null, 'Document was not found.');
        }

        $doc->update([
            'lifecycle_status' => $validated['status'],
        ]);

        $this->audit->record(
            $admin,
            'document_completed',
            $doc->id,
            $doc->tracking_code,
            "Admin marked {$doc->tracking_code} as ".strtoupper($validated['status']).'.',
            'Tracely Admin Portal',
        );

        $this->realtime->publish(
            'document_completed',
            [$doc->origin_office_id, $doc->current_office_id],
            [$doc->origin_user_id, $doc->current_holder_id],
            $doc->id,
        );

        return $this->backToSection(
            'custody',
            "Marked {$doc->tracking_code} as ".strtoupper($validated['status']).'.',
        );
    }

    public function exportDocumentsCsv(Request $request): StreamedResponse|RedirectResponse
    {
        $admin = $this->resolveAdminUser($request);
        if (! $admin) {
            return redirect()->route('admin.login');
        }

        $documents = Document::query()
            ->with(['category', 'originOffice', 'currentOffice', 'currentHolder', 'transactions'])
            ->orderByDesc('updated_at')
            ->get();

        $filename = 'tracely-admin-custody-'.now()->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($documents): void {
            $out = fopen('php://output', 'w');
            if (! $out) {
                return;
            }
            fputcsv($out, [
                'Tracking Code',
                'Title',
                'Category',
                'Copy Format',
                'Confidentiality Tier',
                'Origin Office',
                'Current Office',
                'Current Holder',
                'Lifecycle Status',
                'SLA State',
                'Idle Duration',
                'SLA Due At',
                'Created At',
            ]);

            foreach ($documents as $doc) {
                $eval = $this->stalledAlerts->evaluate($doc);
                fputcsv($out, [
                    $doc->tracking_code,
                    $doc->title,
                    $doc->category?->name ?? 'Uncategorized',
                    $doc->copy_format,
                    $doc->confidentiality_tier,
                    $doc->originOffice?->code ?? '',
                    $doc->currentOffice?->code ?? '',
                    $doc->currentHolder?->full_name ?? '',
                    $doc->lifecycle_status,
                    $eval['slaState'],
                    $eval['idleLabel'],
                    optional($doc->sla_due_at)->toIso8601String(),
                    optional($doc->created_at)->toIso8601String(),
                ]);
            }
            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function exportAuditLogsCsv(Request $request): StreamedResponse|RedirectResponse
    {
        $admin = $this->resolveAdminUser($request);
        if (! $admin) {
            return redirect()->route('admin.login');
        }

        $logs = AuditLog::query()->orderByDesc('occurred_at')->limit(1000)->get();
        $filename = 'tracely-admin-audit-'.now()->format('Y-m-d').'.csv';

        return response()->streamDownload(function () use ($logs): void {
            $out = fopen('php://output', 'w');
            if (! $out) {
                return;
            }
            fputcsv($out, [
                'Timestamp',
                'Action',
                'Actor Name',
                'Office Code',
                'Tracking Code',
                'Summary',
                'Device / Client',
            ]);

            foreach ($logs as $log) {
                fputcsv($out, [
                    optional($log->occurred_at)->toIso8601String(),
                    $log->action,
                    $log->actor_name,
                    $log->actor_office_code,
                    $log->tracking_code ?? '',
                    $log->summary,
                    $log->device_label,
                ]);
            }
            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function resolveOrCreateAssignedOffice(
        User $admin,
        string $officeId,
        ?string $customCode,
        ?string $customName,
    ): ?Office {
        if ($officeId !== '__custom__') {
            return Office::query()->find($officeId);
        }

        $name = trim((string) ($customName ?? ''));
        if (mb_strlen($name) < 3) {
            return null;
        }

        $rawCode = strtoupper(trim((string) ($customCode ?? '')));
        if ($rawCode === '') {
            $words = preg_split('/\s+/', preg_replace('/[^A-Za-z0-9\s]+/', '', $name) ?: '') ?: [];
            $initials = '';
            foreach ($words as $w) {
                if ($w !== '') {
                    $initials .= strtoupper(substr($w, 0, 1));
                }
            }
            $rawCode = strlen($initials) >= 2
                ? substr($initials, 0, 10)
                : strtoupper(substr(preg_replace('/[^A-Za-z0-9]+/', '', $name) ?: 'CUST', 0, 8));
        }

        $existing = Office::query()->whereRaw('UPPER(code) = ?', [$rawCode])->first();
        if ($existing) {
            return $existing;
        }

        $slug = strtolower((string) preg_replace('/[^a-zA-Z0-9]+/', '-', $rawCode));
        $office = Office::query()->create([
            'id' => 'off-'.($slug ?: Str::lower(Str::random(6))).'-'.Str::lower(Str::random(4)),
            'code' => $rawCode,
            'name' => $name,
            'is_custom' => true,
        ]);

        $this->audit->record(
            $admin,
            'office_created',
            null,
            null,
            "Created custom office {$office->code} ({$office->name}) during personnel assignment.",
            'Tracely Admin Portal',
        );

        return $office;
    }

    /**
     * Build mobile-parity dot-connected timeline events for any document.
     *
     * @return array<int, array{
     *   label: string,
     *   officeCode: string,
     *   officeName: string,
     *   actorName: string,
     *   remarks: string,
     *   occurredAt: string,
     *   dateLabel: string,
     *   timeLabel: string,
     *   state: string,
     *   dwellLabel: string
     * }>
     */
    private function buildTimelineEvents(Document $doc): array
    {
        $events = [];

        $originAt = $doc->created_at ?? now();
        $firstTx = $doc->transactions->sortBy('sent_at')->first();
        $events[] = [
            'label' => 'Document Originated & Registered',
            'officeCode' => (string) ($doc->originOffice?->code ?? 'HQ'),
            'officeName' => (string) ($doc->originOffice?->name ?? 'Origin Office'),
            'actorName' => (string) ($firstTx?->fromUser?->full_name ?? ($doc->currentHolder?->full_name ?? 'Originating Desk')),
            'remarks' => $doc->physical_reference ? "Physical ref: {$doc->physical_reference}" : 'Tracking code issued',
            'occurredAt' => $originAt->toIso8601String(),
            'dateLabel' => $originAt->format('M d'),
            'timeLabel' => $originAt->format('h:i A'),
            'state' => 'done',
            'dwellLabel' => '',
        ];

        $sortedTx = $doc->transactions->sortBy('sent_at')->values();
        $txCount = $sortedTx->count();

        foreach ($sortedTx as $idx => $tx) {
            /** @var RoutingTransaction $tx */
            $isLast = $idx === $txCount - 1;
            $toCode = (string) ($tx->toOffice?->code ?? 'HQ');
            $toName = (string) ($tx->toOffice?->name ?? 'Target Office');
            $fromCode = (string) ($tx->fromOffice?->code ?? 'HQ');
            $fromActorName = (string) ($tx->fromUser?->full_name ?? 'Originating Officer');
            $toActorName = (string) ($tx->toUser?->full_name ?? '');
            $isInternal = $tx->routing_scope === 'internal_office' || $tx->from_office_id === $tx->to_office_id;

            $sentAt = $tx->sent_at ?? $originAt;

            if ($tx->receipt_status === 'acknowledged') {
                $recvAt = $tx->acknowledged_at ?? $sentAt;
                $nextTx = $sortedTx->get($idx + 1);
                $endAt = $nextTx?->sent_at ?? (in_array($doc->lifecycle_status, ['approved', 'archived'], true) ? $doc->updated_at : now());
                $dwellHours = (int) max(0, $recvAt->diffInHours($endAt ?? now()));

                $events[] = [
                    'label' => $isInternal
                        ? "Internal Desk Handoff · {$toCode}"
                        : "Received by {$toCode} (from {$fromCode})",
                    'officeCode' => $toCode,
                    'officeName' => $toName,
                    'actorName' => (string) ($tx->acknowledged_by_name ?: ($toActorName ?: 'Receiving Officer')),
                    'remarks' => (string) ($tx->remarks ?: 'Custody acknowledged'),
                    'occurredAt' => $recvAt->toIso8601String(),
                    'dateLabel' => $recvAt->format('M d'),
                    'timeLabel' => $recvAt->format('h:i A'),
                    'state' => $isLast && ! in_array($doc->lifecycle_status, ['approved', 'archived'], true) ? 'active' : 'done',
                    'dwellLabel' => $dwellHours > 0 ? $this->formatShortDuration($dwellHours) : '<1h',
                ];
            } elseif ($tx->receipt_status === 'pending') {
                $waitHours = (int) max(0, $sentAt->diffInHours(now()));
                $events[] = [
                    'label' => "In Transit → Awaiting Receipt at {$toCode}",
                    'officeCode' => $toCode,
                    'officeName' => $toName,
                    'actorName' => "Sent by {$fromActorName}".($toActorName !== '' ? " → {$toActorName}" : ''),
                    'remarks' => (string) ($tx->remarks ?: 'Pending QR or desk acknowledgment'),
                    'occurredAt' => $sentAt->toIso8601String(),
                    'dateLabel' => $sentAt->format('M d'),
                    'timeLabel' => $sentAt->format('h:i A'),
                    'state' => 'pending',
                    'dwellLabel' => $waitHours > 0 ? $this->formatShortDuration($waitHours).' waiting' : 'Just sent',
                ];
            } elseif ($tx->receipt_status === 'recalled') {
                $events[] = [
                    'label' => "Transfer Recalled back to {$fromCode}",
                    'officeCode' => $fromCode,
                    'officeName' => (string) ($tx->fromOffice?->name ?? 'Originating Office'),
                    'actorName' => $fromActorName,
                    'remarks' => (string) ($tx->remarks ?: 'Sender recalled pending dispatch'),
                    'occurredAt' => $sentAt->toIso8601String(),
                    'dateLabel' => $sentAt->format('M d'),
                    'timeLabel' => $sentAt->format('h:i A'),
                    'state' => 'exception',
                    'dwellLabel' => '',
                ];
            } elseif ($tx->receipt_status === 'declined_misrouted') {
                $events[] = [
                    'label' => "Declined as Misrouted by {$toCode}",
                    'officeCode' => $toCode,
                    'officeName' => $toName,
                    'actorName' => $toActorName !== '' ? $toActorName : 'Receiving Desk',
                    'remarks' => (string) ($tx->remarks ?: 'Returned to sender'),
                    'occurredAt' => $sentAt->toIso8601String(),
                    'dateLabel' => $sentAt->format('M d'),
                    'timeLabel' => $sentAt->format('h:i A'),
                    'state' => 'exception',
                    'dwellLabel' => '',
                ];
            } elseif ($tx->receipt_status === 'returned_for_revision') {
                $retAt = $tx->acknowledged_at ?? $sentAt;
                $events[] = [
                    'label' => "Returned for Revision by {$toCode}",
                    'officeCode' => $toCode,
                    'officeName' => $toName,
                    'actorName' => (string) ($tx->acknowledged_by_name ?: ($toActorName !== '' ? $toActorName : 'Reviewing Desk')),
                    'remarks' => (string) ($tx->remarks ?: 'Revision requested'),
                    'occurredAt' => $retAt->toIso8601String(),
                    'dateLabel' => $retAt->format('M d'),
                    'timeLabel' => $retAt->format('h:i A'),
                    'state' => 'exception',
                    'dwellLabel' => '',
                ];
            }
        }

        if (in_array($doc->lifecycle_status, ['approved', 'archived'], true)) {
            $doneAt = $doc->updated_at ?? now();
            $events[] = [
                'label' => $doc->lifecycle_status === 'approved'
                    ? 'Finalized · Approved'
                    : 'Finalized · Archived',
                'officeCode' => (string) ($doc->currentOffice?->code ?? 'HQ'),
                'officeName' => (string) ($doc->currentOffice?->name ?? 'Finalizing Office'),
                'actorName' => (string) ($doc->currentHolder?->full_name ?? 'Authorized Custodian'),
                'remarks' => 'Custody cycle completed',
                'occurredAt' => $doneAt->toIso8601String(),
                'dateLabel' => $doneAt->format('M d'),
                'timeLabel' => $doneAt->format('h:i A'),
                'state' => 'completed',
                'dwellLabel' => '',
            ];
        }

        return $events;
    }

    private function formatShortDuration(int $hours): string
    {
        if ($hours < 24) {
            return "{$hours}h";
        }
        $days = intdiv($hours, 24);
        $rem = $hours % 24;

        return $rem > 0 ? "{$days}d {$rem}h" : "{$days}d";
    }

    private function resolveAdminUser(Request $request): ?User
    {
        $userId = $request->session()->get(self::SESSION_KEY);
        if (! is_string($userId) || $userId === '') {
            return null;
        }

        /** @var User|null $user */
        $user = User::query()->with('office')->find($userId);
        if (! $user || ! $user->active || ! $this->isAuthorizedAdmin($user)) {
            $request->session()->forget(self::SESSION_KEY);

            return null;
        }

        return $user;
    }

    private function requireAdmin(Request $request): User
    {
        $admin = $this->resolveAdminUser($request);
        if (! $admin) {
            abort(Response::HTTP_FORBIDDEN, 'Admin authentication required.');
        }

        return $admin;
    }

    private function isAuthorizedAdmin(User $user): bool
    {
        if (in_array($user->role, ['ict_admin', 'records_officer'], true)) {
            return true;
        }

        $officeCode = strtoupper((string) ($user->office?->code ?? ''));

        return $user->role === 'unit_head' && in_array($officeCode, ['HR', 'EXEC', 'ADMIN', 'OSDS', 'ICT'], true);
    }

    private function backToSection(string $section, ?string $toast = null, ?string $error = null): RedirectResponse
    {
        $redirect = redirect()->route('admin.dashboard', ['section' => $section]);
        if ($toast) {
            $redirect->with('admin_toast', $toast);
        }
        if ($error) {
            $redirect->with('admin_error', $error);
        }

        return $redirect;
    }
}
