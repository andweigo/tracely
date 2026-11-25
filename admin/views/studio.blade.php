@extends('admin::layouts.app')

@section('title', 'Tracely Admin · Governance Portal')

@section('body')
@php
  $userRoleOptions = [
    'staff' => 'User · Staff',
    'unit_head' => 'User · Office Head',
    'legal_officer' => 'User · Legal Officer',
  ];

  $adminRoleOptions = [
    'ict_admin' => 'Admin · ICT / System Admin',
    'records_officer' => 'Admin · Records Admin',
  ];

  $roleOptions = [
    'staff' => 'Staff',
    'unit_head' => 'Office Head',
    'records_officer' => 'Records Admin',
    'legal_officer' => 'Legal Officer',
    'ict_admin' => 'ICT Admin',
  ];

  $availabilityOptions = [
    'available' => 'Available',
    'official_business' => 'Official Business',
    'on_leave' => 'On Leave',
  ];

  $sectionMeta = [
    'overview' => [
      'title' => 'Overview',
      'sub' => 'Office workload, deadlines, and follow-ups',
    ],
    'approvals' => [
      'title' => 'Account Approvals',
      'sub' => 'Approve new staff registrations',
    ],
    'admins' => [
      'title' => 'Administrators',
      'sub' => 'Manage admin portal accounts',
    ],
    'personnel' => [
      'title' => 'Personnel',
      'sub' => 'Manage staff accounts and offices',
    ],
    'offices' => [
      'title' => 'Offices & Units',
      'sub' => 'Manage offices and departments',
    ],
    'tracking' => [
      'title' => 'Document Tracking',
      'sub' => 'View document handoff timelines',
    ],
    'custody' => [
      'title' => 'Custody & SLA',
      'sub' => 'Follow up on delayed or stalled documents',
    ],
    'categories' => [
      'title' => 'Document Categories',
      'sub' => 'Shared categories across all offices',
    ],
    'sla-policies' => [
      'title' => 'SLA & Escalation',
      'sub' => 'Deadlines and reminder rules by category',
    ],
    'sessions' => [
      'title' => 'Active Sessions',
      'sub' => 'Signed-in web and mobile devices',
    ],
    'integrity' => [
      'title' => 'File Integrity',
      'sub' => 'Verify uploaded files and storage',
    ],
    'diagnostics' => [
      'title' => 'Push & Realtime',
      'sub' => 'Live sync status and push notifications',
    ],
    'audit' => [
      'title' => 'Audit Log',
      'sub' => 'Account and document activity history',
    ],
  ];

  $currentMeta = $sectionMeta[$activeSection] ?? $sectionMeta['overview'];

  $makeInitials = function (string $name): string {
    $parts = preg_split('/\s+/', trim($name)) ?: [];
    if (count($parts) === 0) return 'TR';
    if (count($parts) === 1) return strtoupper(substr($parts[0], 0, 2));
    return strtoupper(substr($parts[0], 0, 1).substr($parts[count($parts) - 1], 0, 1));
  };

  $trackingPayload = $documentRows->mapWithKeys(function (array $row): array {
    /** @var \App\Models\Document $doc */
    $doc = $row['model'];
    return [
      $doc->id => [
        'id' => $doc->id,
        'trackingCode' => $doc->tracking_code,
        'title' => $doc->title,
        'categoryName' => $doc->category?->name ?? 'Uncategorized',
        'copyFormat' => ucfirst(str_replace('_', ' ', $doc->copy_format)),
        'confidentiality' => ucfirst(str_replace('_', ' ', $doc->confidentiality_tier)),
        'lifecycleStatus' => $doc->lifecycle_status,
        'lifecycleLabel' => ucfirst(str_replace('_', ' ', $doc->lifecycle_status)),
        'originCode' => $doc->originOffice?->code ?? 'HQ',
        'originName' => $doc->originOffice?->name ?? 'Origin Office',
        'originDate' => optional($doc->created_at)->format('M d, Y · h:i A') ?? '',
        'currentCode' => $doc->currentOffice?->code ?? 'HQ',
        'currentName' => $doc->currentOffice?->name ?? 'Current Office',
        'currentHolder' => $doc->currentHolder?->full_name ?? 'Office Desk',
        'slaState' => $row['slaState'],
        'idleHours' => $row['idleHours'],
        'idleLabel' => $row['idleLabel'],
        'isStalled' => $row['isStalled'],
        'isInTransit' => $row['isInTransit'],
        'targetOfficeCode' => $row['targetOfficeCode'],
        'targetOfficeName' => $row['targetOfficeName'],
        'lastAlertLabel' => $row['lastAlertAt'] ? $row['lastAlertAt']->diffForHumans() : null,
        'notifyAction' => route('admin.documents.notify-office', $doc->id),
        'timeline' => $row['timelineEvents'],
      ],
    ];
  });
@endphp

<div class="admin-shell" data-testid="admin-blade-studio">
  <div class="admin-sidebar-scrim" id="sidebar-scrim"></div>

  <!-- Left Navigation Sidebar (Mirrors Tracely WebShell) -->
  <aside class="admin-sidebar" id="admin-sidebar" aria-label="Admin navigation">
    <a href="{{ route('admin.dashboard') }}" class="sidebar-brand">
      <img
        src="{{ asset('images/tracely-logo.png') }}"
        alt="Tracely logo"
        class="brand-logo-img"
        width="38"
        height="38"
      />
      <div style="min-width: 0;">
        <p class="sidebar-brand-title">Tracely</p>
        <p class="sidebar-brand-sub">Admin Portal</p>
      </div>
    </a>

    <nav class="sidebar-nav">
      <span class="sidebar-section-label">Governance</span>

      <button
        type="button"
        class="nav-item {{ $activeSection === 'overview' ? 'nav-item-active' : '' }}"
        data-section-target="overview"
      >
        <span class="nav-item-left">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>
          </svg>
          <span>Overview</span>
        </span>
      </button>

      <button
        type="button"
        class="nav-item {{ $activeSection === 'approvals' ? 'nav-item-active' : '' }}"
        data-section-target="approvals"
      >
        <span class="nav-item-left">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>
          </svg>
          <span>Approvals</span>
        </span>
        @if ($telemetry['pendingApprovals'] > 0)
          <span class="nav-badge nav-badge-amber">{{ $telemetry['pendingApprovals'] }}</span>
        @endif
      </button>

      <a href="{{ route('admin.reports.executive-sla') }}" class="nav-item">
        <span class="nav-item-left">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><line x1="10" x2="8" y1="9" y2="9"/>
          </svg>
          <span>Executive Report</span>
        </span>
      </a>

      <span class="sidebar-section-label">Directory</span>

      <button
        type="button"
        class="nav-item {{ $activeSection === 'admins' ? 'nav-item-active' : '' }}"
        data-section-target="admins"
      >
        <span class="nav-item-left">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>
          </svg>
          <span>Administrators</span>
        </span>
      </button>

      <button
        type="button"
        class="nav-item {{ $activeSection === 'personnel' ? 'nav-item-active' : '' }}"
        data-section-target="personnel"
      >
        <span class="nav-item-left">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <span>Personnel</span>
        </span>
      </button>

      <button
        type="button"
        class="nav-item {{ $activeSection === 'offices' ? 'nav-item-active' : '' }}"
        data-section-target="offices"
      >
        <span class="nav-item-left">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
          </svg>
          <span>Offices</span>
        </span>
      </button>

      <span class="sidebar-section-label">Operations</span>

      <button
        type="button"
        class="nav-item {{ $activeSection === 'tracking' ? 'nav-item-active' : '' }}"
        data-section-target="tracking"
      >
        <span class="nav-item-left">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>
          </svg>
          <span>Document Tracking</span>
        </span>
      </button>

      <button
        type="button"
        class="nav-item {{ $activeSection === 'custody' ? 'nav-item-active' : '' }}"
        data-section-target="custody"
      >
        <span class="nav-item-left">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>
          </svg>
          <span>Custody &amp; SLA</span>
        </span>
        @if ($attentionDocs->count() > 0)
          <span class="nav-badge nav-badge-rose">{{ $attentionDocs->count() }}</span>
        @endif
      </button>

      <button
        type="button"
        class="nav-item {{ $activeSection === 'categories' ? 'nav-item-active' : '' }}"
        data-section-target="categories"
      >
        <span class="nav-item-left">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/>
          </svg>
          <span>Categories</span>
        </span>
      </button>

      <button
        type="button"
        class="nav-item {{ $activeSection === 'sla-policies' ? 'nav-item-active' : '' }}"
        data-section-target="sla-policies"
      >
        <span class="nav-item-left">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          <span>SLA &amp; Escalation</span>
        </span>
      </button>

      <span class="sidebar-section-label">Security &amp; Health</span>

      <button
        type="button"
        class="nav-item {{ $activeSection === 'sessions' ? 'nav-item-active' : '' }}"
        data-section-target="sessions"
      >
        <span class="nav-item-left">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>
          </svg>
          <span>Device Sessions</span>
        </span>
      </button>

      <button
        type="button"
        class="nav-item {{ $activeSection === 'integrity' ? 'nav-item-active' : '' }}"
        data-section-target="integrity"
      >
        <span class="nav-item-left">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>
          </svg>
          <span>File Integrity</span>
        </span>
        @if ($telemetry['integrityIssues'] > 0)
          <span class="nav-badge nav-badge-rose">{{ $telemetry['integrityIssues'] }}</span>
        @endif
      </button>

      <button
        type="button"
        class="nav-item {{ $activeSection === 'diagnostics' ? 'nav-item-active' : '' }}"
        data-section-target="diagnostics"
      >
        <span class="nav-item-left">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>
          </svg>
          <span>Push &amp; Realtime</span>
        </span>
      </button>

      <button
        type="button"
        class="nav-item {{ $activeSection === 'audit' ? 'nav-item-active' : '' }}"
        data-section-target="audit"
      >
        <span class="nav-item-left">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>
          </svg>
          <span>Audit Log</span>
        </span>
      </button>
    </nav>

    <div class="sidebar-footer">
      <div class="sidebar-actor-card">
        <span class="avatar-circle" style="background: {{ $admin->avatar_color ?: '#0D3472' }};">
          {{ $makeInitials($admin->full_name) }}
        </span>
        <div style="min-width: 0; flex: 1;">
          <div class="sidebar-actor-name">{{ $admin->full_name }}</div>
          <div class="sidebar-actor-meta">
            {{ $admin->office?->code ?? 'HQ' }} · {{ $roleOptions[$admin->role] ?? $admin->role }}
          </div>
        </div>
      </div>

      <form method="POST" action="{{ route('admin.logout') }}" style="margin: 0;">
        @csrf
        <button type="submit" class="nav-item" style="color: var(--rose-text);">
          <span class="nav-item-left">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>
            </svg>
            <span>Sign Out</span>
          </span>
        </button>
      </form>
    </div>
  </aside>

  <!-- Main Workspace Area -->
  <div class="admin-main">
    <header class="admin-topbar">
      <div class="topbar-left">
        <button type="button" class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Open navigation">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/>
          </svg>
        </button>
        <div style="min-width: 0;">
          <h1 class="topbar-title" id="topbar-title">{{ $currentMeta['title'] }}</h1>
          <p class="topbar-sub" id="topbar-sub">{{ $currentMeta['sub'] }}</p>
        </div>
      </div>

      <div class="topbar-right">
        <span class="status-indicator" id="admin-live-sync-pill" data-testid="admin-live-sync-pill" title="Updates automatically">
          <span class="status-dot" id="admin-live-sync-dot"></span>
          <span id="admin-live-sync-label">Live Sync</span>
        </span>
        <a href="{{ route('admin.reports.executive-sla') }}" class="btn btn-secondary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>
          </svg>
          <span>Report</span>
        </a>
        <button type="button" class="btn btn-secondary" data-open-modal="modal-provision-admin">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v8"/><path d="M8 12h8"/>
          </svg>
          <span>Add Admin</span>
        </button>
        <button type="button" class="btn btn-primary" data-open-modal="modal-provision-user">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <path d="M5 12h14"/><path d="M12 5v14"/>
          </svg>
          <span>Add User</span>
        </button>
      </div>
    </header>

    <main class="admin-content">
      <!-- =====================================================================
           SECTION 1: OVERVIEW
           ===================================================================== -->
      <section
        id="panel-overview"
        data-section-panel="overview"
        style="display: {{ $activeSection === 'overview' ? 'flex' : 'none' }}; flex-direction: column; gap: 20px;"
      >
        <!-- Unified 4-Column Metric Strip -->
        <div class="kpi-strip">
          <div class="kpi-cell">
            <div class="kpi-cell-top">
              <span class="kpi-label">Active Staff</span>
            </div>
            <div class="kpi-value">{{ $telemetry['activePersonnel'] }}</div>
            <div class="kpi-meta">
              {{ $offices->count() }} offices · {{ $telemetry['activeAdmins'] }} admins · {{ $telemetry['onLeavePersonnel'] }} on leave
            </div>
            <div style="display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-top: auto; padding-top: 6px;">
              <button type="button" class="kpi-action" style="margin-top: 0; padding-top: 0;" data-section-jump="personnel">
                Manage users
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
              </button>
              <button type="button" class="kpi-action" style="margin-top: 0; padding-top: 0;" data-section-jump="admins">
                Admins
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
              </button>
            </div>
          </div>

          <div class="kpi-cell">
            <div class="kpi-cell-top">
              <span class="kpi-label">Pending Approvals</span>
              @if ($telemetry['pendingApprovals'] > 0)
                <span class="pill pill-amber">Action needed</span>
              @endif
            </div>
            <div class="kpi-value">{{ $telemetry['pendingApprovals'] }}</div>
            <div class="kpi-meta">Waiting for verification</div>
            <button type="button" class="kpi-action" data-section-jump="approvals">
              Review queue
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
            </button>
          </div>

          <div class="kpi-cell">
            <div class="kpi-cell-top">
              <span class="kpi-label">Tracked Documents</span>
            </div>
            <div class="kpi-value">{{ $telemetry['totalDocuments'] }}</div>
            <div class="kpi-meta">
              {{ $telemetry['pendingReceipts'] }} in transit · {{ $telemetry['inReview'] }} in review · {{ $telemetry['finalized'] }} done
            </div>
            <button type="button" class="kpi-action" data-section-jump="tracking">
              Open tracking
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
            </button>
          </div>

          <div class="kpi-cell">
            <div class="kpi-cell-top">
              <span class="kpi-label">Stalled / Overdue</span>
              @if ($attentionDocs->count() > 0)
                <span class="pill pill-rose">{{ $telemetry['stalledCount'] }} idle</span>
              @endif
            </div>
            <div class="kpi-value">{{ $attentionDocs->count() }}</div>
            <div class="kpi-meta">
              {{ $telemetry['slaRisks'] }} SLA risk · {{ $telemetry['stalledCount'] }} idle ≥{{ $telemetry['stalledThresholdHours'] }}h
            </div>
            <button type="button" class="kpi-action" data-section-jump="custody">
              Inspect &amp; alert
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>
            </button>
          </div>
        </div>

        <!-- Asymmetric Split Grid: Office Load Matrix + Needs Attention (with Manual & Auto Alerting) -->
        <div class="split-grid">
          <div class="surface-card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Office Load</h2>
                <p class="card-subtitle">Staff, active files, and pending receipts by office</p>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" data-section-jump="offices">
                Manage Offices
              </button>
            </div>

            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th>Office / Division Name</th>
                    <th class="num-col">Staff</th>
                    <th class="num-col">Active</th>
                    <th class="num-col">Pending</th>
                    <th>SLA Health</th>
                  </tr>
                </thead>
                <tbody id="overview-office-tbody">
                  @foreach ($officeMatrix as $row)
                    <tr class="overview-office-row">
                      <td><span class="code-tag">{{ $row['office']->code }}</span></td>
                      <td style="font-weight: 600;">{{ $row['office']->name }}</td>
                      <td class="num-col">{{ $row['staffCount'] }}</td>
                      <td class="num-col">{{ $row['activeDocsCount'] }}</td>
                      <td class="num-col">
                        @if ($row['pendingCount'] > 0)
                          <span class="pill pill-amber">{{ $row['pendingCount'] }}</span>
                        @else
                          <span style="color: var(--text-muted);">0</span>
                        @endif
                      </td>
                      <td>
                        @if ($row['slaCount'] > 0)
                          <span class="pill pill-rose">{{ $row['slaCount'] }} attention</span>
                        @else
                          <span style="color: var(--text-muted); font-size: 12.5px;">On track</span>
                        @endif
                      </td>
                    </tr>
                  @endforeach
                </tbody>
              </table>
            </div>
            <div class="pagination-bar" id="pager-overview"></div>
          </div>

          <div class="surface-card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Needs Attention</h2>
                <p class="card-subtitle">
                  Pending approvals and files idle {{ $telemetry['stalledThresholdHours'] }}h+
                </p>
              </div>
              <form method="POST" action="{{ route('admin.alerts.sweep') }}" style="margin: 0;">
                @csrf
                <input type="hidden" name="return_section" value="overview" />
                <button type="submit" class="btn btn-secondary btn-sm" title="Check all active documents and automatically alert offices with stalled items">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>
                  </svg>
                  <span>Auto-Alert Stalled</span>
                </button>
              </form>
            </div>

            @if ($pendingUsers->isEmpty() && $attentionDocs->isEmpty())
              <div class="empty-state">
                <div class="empty-icon" style="color: var(--emerald); background: var(--emerald-soft); border-color: var(--emerald-border);">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </div>
                <p class="empty-title">All queues clear</p>
                <p class="empty-desc">
                  No pending approvals or stalled documents right now.
                </p>
              </div>
            @else
              <div id="attention-list">
                @foreach ($pendingUsers as $candidate)
                  <div class="list-row attention-item">
                    <div style="min-width: 0;">
                      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <span style="font-size: 13.5px; font-weight: 600;">{{ $candidate->full_name }}</span>
                        <span class="pill pill-amber">Registration</span>
                      </div>
                      <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                        <span class="mono">{{ $candidate->employee_id }}</span> · {{ $candidate->office?->code ?? 'HQ' }} · {{ $candidate->position }}
                      </div>
                    </div>
                    <form method="POST" action="{{ route('admin.users.approve', $candidate->id) }}" style="margin: 0; flex-shrink: 0;">
                      @csrf
                      <input type="hidden" name="return_section" value="overview" />
                      <button type="submit" class="btn btn-primary btn-sm">Approve</button>
                    </form>
                  </div>
                @endforeach

                @foreach ($attentionDocs as $row)
                  @php $doc = $row['model']; @endphp
                  <div class="list-row attention-item">
                    <div style="min-width: 0; flex: 1;">
                      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                        <span class="mono" style="font-size: 12px; font-weight: 700; color: var(--navy);">{{ $doc->tracking_code }}</span>
                        @if ($row['isStalled'])
                          <span class="pill pill-rose">Idle {{ $row['idleLabel'] }}</span>
                        @elseif ($row['slaState'] === 'overdue')
                          <span class="pill pill-rose">Overdue</span>
                        @else
                          <span class="pill pill-amber">Due soon</span>
                        @endif
                        @if ($row['lastAlertAt'])
                          <span class="pill pill-slate" style="font-size: 10.5px;">
                            {{ $row['lastAlertAutomatic'] ? 'Auto-alerted' : 'Alerted' }} {{ $row['lastAlertAt']->diffForHumans() }}
                          </span>
                        @endif
                      </div>
                      <div style="font-size: 13px; font-weight: 600; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        {{ $doc->title }}
                      </div>
                      <div style="font-size: 12px; color: var(--text-muted); margin-top: 1px;">
                        {{ $row['isInTransit'] ? 'Awaiting receipt at' : 'Held at' }}
                        <strong>{{ $row['targetOfficeCode'] }}</strong> ({{ $row['targetOfficeName'] }})
                      </div>
                    </div>

                    <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                      <button
                        type="button"
                        class="btn btn-amber-soft btn-sm"
                        data-alert-office
                        data-action="{{ route('admin.documents.notify-office', $doc->id) }}"
                        data-code="{{ $doc->tracking_code }}"
                        data-title="{{ $doc->title }}"
                        data-office="{{ $row['targetOfficeCode'] }} — {{ $row['targetOfficeName'] }}"
                        data-idle="{{ $row['idleLabel'] }}"
                        data-return-section="overview"
                      >
                        Alert Office
                      </button>
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        data-open-tracking="{{ $doc->id }}"
                      >
                        Timeline
                      </button>
                    </div>
                  </div>
                @endforeach
              </div>
            @endif
            <div class="pagination-bar" id="pager-attention"></div>
          </div>
        </div>
      </section>

      <!-- =====================================================================
           SECTION 2: APPROVALS
           ===================================================================== -->
      <section
        id="panel-approvals"
        data-section-panel="approvals"
        class="surface-card"
        style="display: {{ $activeSection === 'approvals' ? 'block' : 'none' }};"
      >
        <div class="card-header">
          <div>
            <h2 class="card-title">Pending Registration Requests ({{ $pendingUsers->count() }})</h2>
            <p class="card-subtitle">Review and approve new staff registrations</p>
          </div>

          @if ($pendingUsers->count() > 1)
            <form method="POST" action="{{ route('admin.users.approve-all') }}" style="margin: 0;">
              @csrf
              <button type="submit" class="btn btn-primary btn-sm">
                Approve All ({{ $pendingUsers->count() }})
              </button>
            </form>
          @endif
        </div>

        <div class="card-toolbar">
          <div class="search-field">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              id="approvals-search-input"
              class="input"
              placeholder="Search applicant name, ID, email, or office..."
            />
          </div>
        </div>

        @if ($pendingUsers->isEmpty())
          <div class="empty-state">
            <div class="empty-icon" style="color: var(--emerald); background: var(--emerald-soft); border-color: var(--emerald-border);">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <p class="empty-title">No pending registrations</p>
            <p class="empty-desc">
              New staff registrations will appear here for approval.
            </p>
          </div>
        @else
          <div class="table-scroll">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Employee ID</th>
                  <th>Requested Office</th>
                  <th>Position</th>
                  <th style="text-align: right;">Decision</th>
                </tr>
              </thead>
              <tbody>
                @foreach ($pendingUsers as $candidate)
                  <tr
                    class="approval-row"
                    data-search="{{ strtolower($candidate->full_name.' '.$candidate->employee_id.' '.$candidate->email.' '.$candidate->position.' '.($candidate->office?->code ?? '')) }}"
                  >
                    <td>
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <span class="avatar-circle" style="background: var(--navy-mid);">{{ $makeInitials($candidate->full_name) }}</span>
                        <div>
                          <div style="font-weight: 600;">{{ $candidate->full_name }}</div>
                          <div style="font-size: 12px; color: var(--text-muted);">{{ $candidate->email }}</div>
                        </div>
                      </div>
                    </td>
                    <td><span class="code-tag">{{ $candidate->employee_id }}</span></td>
                    <td>
                      <span class="pill pill-navy">{{ $candidate->office?->code ?? 'HQ' }}</span>
                      <span style="font-size: 12px; color: var(--text-secondary); margin-left: 4px;">{{ $candidate->office?->name ?? '' }}</span>
                    </td>
                    <td>{{ $candidate->position }}</td>
                    <td style="text-align: right;">
                      <div style="display: inline-flex; gap: 6px; align-items: center;">
                        <form method="POST" action="{{ route('admin.users.approve', $candidate->id) }}" style="margin: 0;">
                          @csrf
                          <button type="submit" class="btn btn-primary btn-sm">Approve</button>
                        </form>
                        <button
                          type="button"
                          class="btn btn-danger btn-sm"
                          data-reject-user
                          data-action="{{ route('admin.users.reject', $candidate->id) }}"
                          data-name="{{ $candidate->full_name }}"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                @endforeach
              </tbody>
            </table>
          </div>
        @endif
        <div class="pagination-bar" id="pager-approvals"></div>
      </section>

      <!-- =====================================================================
           SECTION 2B: ADMINISTRATORS (Strictly Separated from Personnel Users)
           ===================================================================== -->
      <section
        id="panel-admins"
        data-section-panel="admins"
        class="surface-card"
        style="display: {{ $activeSection === 'admins' ? 'block' : 'none' }};"
      >
        <div class="card-header">
          <div>
            <h2 class="card-title">System Administrators ({{ $adminAccounts->count() }})</h2>
            <p class="card-subtitle">Admin Portal accounts</p>
          </div>
          <button type="button" class="btn btn-primary btn-sm" data-open-modal="modal-provision-admin">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <path d="M5 12h14"/><path d="M12 5v14"/>
            </svg>
            <span>Add Administrator</span>
          </button>
        </div>

        <div class="card-toolbar">
          <div class="search-field">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              id="admins-search-input"
              class="input"
              placeholder="Search administrator name, ID, email, or office..."
            />
          </div>

          <div class="filter-pills" id="admins-status-filters">
            <button type="button" class="filter-pill filter-pill-active" data-admin-status-filter="all">All</button>
            <button type="button" class="filter-pill" data-admin-status-filter="active">Active</button>
            <button type="button" class="filter-pill" data-admin-status-filter="inactive">Deactivated</button>
          </div>
        </div>

        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Administrator</th>
                <th>Employee ID</th>
                <th>Office &amp; Position</th>
                <th>Account Role</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody id="admins-tbody">
              @foreach ($adminAccounts as $adm)
                @php
                  $isSelf = $adm->id === $admin->id;
                  $availLabel = $availabilityOptions[$adm->availability] ?? 'Available';
                  $subRoleLabel = $adm->role === 'ict_admin'
                    ? 'ICT Admin'
                    : ($adm->role === 'records_officer' ? 'Records Admin' : (($adm->office?->code ?? 'HQ').' Unit Head'));
                @endphp
                <tr
                  class="admin-row"
                  data-search="{{ strtolower($adm->full_name.' '.$adm->employee_id.' '.$adm->email.' '.$adm->position.' '.($adm->office?->code ?? '').' '.$adm->role) }}"
                  data-status="{{ $adm->active ? 'active' : 'inactive' }}"
                >
                  <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <span class="avatar-circle" style="background: {{ $adm->avatar_color ?: '#0D3472' }};">
                        {{ $makeInitials($adm->full_name) }}
                      </span>
                      <div>
                        <div style="font-weight: 600;">
                          {{ $adm->full_name }}
                          @if ($isSelf)
                            <span class="pill pill-slate" style="margin-left: 4px; font-size: 10px;">You</span>
                          @endif
                        </div>
                        <div style="font-size: 12px; color: var(--text-muted);">{{ $adm->email }}</div>
                      </div>
                    </div>
                  </td>
                  <td><span class="code-tag">{{ $adm->employee_id }}</span></td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span class="pill pill-navy">{{ $adm->office?->code ?? 'HQ' }}</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 3px;">{{ $adm->position }}</div>
                  </td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                      <span class="pill pill-navy">Admin</span>
                      <span style="font-size: 12px; color: var(--text-secondary);">{{ $subRoleLabel }}</span>
                    </div>
                  </td>
                  <td>
                    <div style="display: flex; flex-direction: column; gap: 3px; align-items: flex-start;">
                      <span class="pill {{ $adm->active ? 'pill-emerald' : 'pill-rose' }}">
                        {{ $adm->active ? 'Active' : 'Deactivated' }}
                      </span>
                      <span style="font-size: 11.5px; color: var(--text-muted);">
                        <span class="avail-dot avail-{{ $adm->availability }}"></span>{{ $availLabel }}
                      </span>
                    </div>
                  </td>
                  <td style="text-align: right; white-space: nowrap;">
                    <div style="display: inline-flex; align-items: center; gap: 6px;">
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        data-edit-user
                        data-action="{{ route('admin.users.update', $adm->id) }}"
                        data-user-id="{{ $adm->id }}"
                        data-name="{{ $adm->full_name }}"
                        data-position="{{ $adm->position }}"
                        data-office="{{ $adm->office_id }}"
                        data-role="{{ $adm->role }}"
                        data-availability="{{ $adm->availability }}"
                        data-availability-until="{{ optional($adm->availability_until)->format('Y-m-d') ?? '' }}"
                        data-delegate="{{ $adm->delegate_id ?? '' }}"
                        data-return-section="admins"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        data-reset-password
                        data-action="{{ route('admin.users.reset-password', $adm->id) }}"
                        data-name="{{ $adm->full_name }}"
                        data-return-section="admins"
                      >
                        Reset Password
                      </button>

                      @if (! $isSelf)
                        <form method="POST" action="{{ route('admin.users.toggle-active', $adm->id) }}" style="margin: 0;">
                          @csrf
                          <input type="hidden" name="return_section" value="admins" />
                          <button type="submit" class="btn {{ $adm->active ? 'btn-danger' : 'btn-primary' }} btn-sm">
                            {{ $adm->active ? 'Deactivate' : 'Reactivate' }}
                          </button>
                        </form>
                      @endif
                    </div>
                  </td>
                </tr>
              @endforeach
            </tbody>
          </table>
        </div>
        <div class="pagination-bar" id="pager-admins"></div>
      </section>

      <!-- =====================================================================
           SECTION 3: PERSONNEL ROSTER — USERS ONLY (Admins Excluded)
           ===================================================================== -->
      <section
        id="panel-personnel"
        data-section-panel="personnel"
        class="surface-card"
        style="display: {{ $activeSection === 'personnel' ? 'block' : 'none' }};"
      >
        <div class="card-header">
          <div>
            <h2 class="card-title">Team Directory — Users ({{ $rosterUsers->count() }})</h2>
            <p class="card-subtitle">Staff accounts across offices</p>
          </div>
          <button type="button" class="btn btn-primary btn-sm" data-open-modal="modal-provision-user">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <path d="M5 12h14"/><path d="M12 5v14"/>
            </svg>
            <span>Add User</span>
          </button>
        </div>

        <div class="card-toolbar">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex: 1;">
            <div class="search-field">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
              <input
                type="text"
                id="personnel-search-input"
                class="input"
                placeholder="Search name, employee ID, email, or position..."
              />
            </div>

            <select id="personnel-office-filter" class="select" style="height: 36px; font-size: 13px; border-color: var(--border);">
              <option value="all">All Offices</option>
              @foreach ($offices as $off)
                <option value="{{ $off->id }}">{{ $off->code }} — {{ $off->name }}</option>
              @endforeach
            </select>
          </div>

          <div class="filter-pills" id="personnel-status-filters">
            <button type="button" class="filter-pill filter-pill-active" data-status-filter="all">All</button>
            <button type="button" class="filter-pill" data-status-filter="active">Active</button>
            <button type="button" class="filter-pill" data-status-filter="inactive">Deactivated</button>
          </div>
        </div>

        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Personnel</th>
                <th>Employee ID</th>
                <th>Office &amp; Position</th>
                <th>Account Role</th>
                <th>Availability, Delegate &amp; Custody</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody id="personnel-tbody">
              @foreach ($rosterUsers as $person)
                @php
                  $availLabel = $availabilityOptions[$person->availability] ?? 'Available';
                  $heldCount = (int) ($heldDocCountsByUser[$person->id] ?? 0);
                @endphp
                <tr
                  class="personnel-row"
                  data-search="{{ strtolower($person->full_name.' '.$person->employee_id.' '.$person->email.' '.$person->position.' '.($person->office?->code ?? '').' '.$person->role) }}"
                  data-office="{{ $person->office_id }}"
                  data-status="{{ $person->active ? 'active' : 'inactive' }}"
                >
                  <td>
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <span class="avatar-circle" style="background: {{ $person->avatar_color ?: '#0D3472' }};">
                        {{ $makeInitials($person->full_name) }}
                      </span>
                      <div>
                        <div style="font-weight: 600;">{{ $person->full_name }}</div>
                        <div style="font-size: 12px; color: var(--text-muted);">{{ $person->email }}</div>
                      </div>
                    </div>
                  </td>
                  <td><span class="code-tag">{{ $person->employee_id }}</span></td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 6px;">
                      <span class="pill pill-navy">{{ $person->office?->code ?? 'HQ' }}</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 3px;">{{ $person->position }}</div>
                  </td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                      <span class="pill pill-slate">User</span>
                      <span style="font-size: 12px; color: var(--text-secondary);">{{ $roleOptions[$person->role] ?? $person->role }}</span>
                    </div>
                  </td>
                  <td>
                    <div style="display: flex; flex-direction: column; gap: 3px; align-items: flex-start;">
                      <div style="display: flex; align-items: center; gap: 5px; flex-wrap: wrap;">
                        <span class="pill {{ $person->active ? 'pill-emerald' : 'pill-rose' }}">
                          {{ $person->active ? 'Active' : 'Deactivated' }}
                        </span>
                        @if ($heldCount > 0)
                          <span class="pill pill-amber" style="font-size: 10.5px;">{{ $heldCount }} held doc{{ $heldCount === 1 ? '' : 's' }}</span>
                        @endif
                      </div>
                      <span style="font-size: 11.5px; color: var(--text-muted);">
                        <span class="avail-dot avail-{{ $person->availability }}"></span>{{ $availLabel }}
                        @if ($person->delegate)
                          · Delegate: <strong>{{ $person->delegate->full_name }}</strong>
                        @endif
                      </span>
                    </div>
                  </td>
                  <td style="text-align: right; white-space: nowrap;">
                    <div style="display: inline-flex; align-items: center; gap: 6px;">
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        data-edit-user
                        data-action="{{ route('admin.users.update', $person->id) }}"
                        data-user-id="{{ $person->id }}"
                        data-name="{{ $person->full_name }}"
                        data-position="{{ $person->position }}"
                        data-office="{{ $person->office_id }}"
                        data-role="{{ $person->role }}"
                        data-availability="{{ $person->availability }}"
                        data-availability-until="{{ optional($person->availability_until)->format('Y-m-d') ?? '' }}"
                        data-delegate="{{ $person->delegate_id ?? '' }}"
                        data-return-section="personnel"
                      >
                        Edit / Delegate
                      </button>

                      @if ($heldCount > 0)
                        <button
                          type="button"
                          class="btn btn-amber-soft btn-sm"
                          data-reassign-custody
                          data-action="{{ route('admin.users.reassign-custody', $person->id) }}"
                          data-source-id="{{ $person->id }}"
                          data-source-name="{{ $person->full_name }}"
                          data-source-office="{{ $person->office?->code ?? 'HQ' }}"
                          data-held-count="{{ $heldCount }}"
                        >
                          Reassign ({{ $heldCount }})
                        </button>
                      @endif

                      <button
                        type="button"
                        class="btn btn-ghost btn-sm"
                        data-reset-password
                        data-action="{{ route('admin.users.reset-password', $person->id) }}"
                        data-name="{{ $person->full_name }}"
                        data-return-section="personnel"
                      >
                        Reset Password
                      </button>

                      <form method="POST" action="{{ route('admin.users.toggle-active', $person->id) }}" style="margin: 0;">
                        @csrf
                        <input type="hidden" name="return_section" value="personnel" />
                        <button type="submit" class="btn {{ $person->active ? 'btn-danger' : 'btn-primary' }} btn-sm">
                          {{ $person->active ? 'Deactivate' : 'Reactivate' }}
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              @endforeach
            </tbody>
          </table>
        </div>
        <div class="pagination-bar" id="pager-personnel"></div>
      </section>

      <!-- =====================================================================
           SECTION 4: DIVISION OFFICES
           ===================================================================== -->
      <section
        id="panel-offices"
        data-section-panel="offices"
        class="surface-card"
        style="display: {{ $activeSection === 'offices' ? 'block' : 'none' }};"
      >
        <div class="card-header">
          <div>
            <h2 class="card-title">Offices & Units &amp; Units ({{ $offices->count() }})</h2>
            <p class="card-subtitle">Offices available across Web and Mobile</p>
          </div>
          <button type="button" class="btn btn-primary btn-sm" data-open-office-create>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <path d="M5 12h14"/><path d="M12 5v14"/>
            </svg>
            <span>Add Office</span>
          </button>
        </div>

        <div class="card-toolbar">
          <div class="search-field">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              id="office-search-input"
              class="input"
              placeholder="Filter offices by code or name..."
            />
          </div>
        </div>

        <div class="card-body">
          <div class="office-grid">
            @foreach ($officeMatrix as $row)
              @php $off = $row['office']; @endphp
              <div
                class="office-card office-item"
                data-search="{{ strtolower($off->code.' '.$off->name) }}"
              >
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <span class="code-tag">{{ $off->code }}</span>
                    @if ($off->is_custom)
                      <span class="pill pill-slate" style="font-size: 10.5px;">Custom</span>
                    @endif
                  </div>
                  <button
                    type="button"
                    class="btn btn-ghost btn-sm"
                    data-edit-office
                    data-action="{{ route('admin.offices.update', $off->id) }}"
                    data-code="{{ $off->code }}"
                    data-name="{{ $off->name }}"
                  >
                    Edit
                  </button>
                </div>

                <div style="font-size: 14.5px; font-weight: 700; color: var(--text-primary); line-height: 1.35;">
                  {{ $off->name }}
                </div>

                <div class="office-metrics">
                  <div>
                    <span class="office-metric-val">{{ $row['staffCount'] }}</span>
                    <span class="office-metric-label">Staff</span>
                  </div>
                  <div>
                    <span class="office-metric-val">{{ $row['activeDocsCount'] }}</span>
                    <span class="office-metric-label">Active Docs</span>
                  </div>
                  <div>
                    <span class="office-metric-val" style="{{ $row['pendingCount'] > 0 ? 'color: var(--amber-text);' : '' }}">
                      {{ $row['pendingCount'] }}
                    </span>
                    <span class="office-metric-label">Pending</span>
                  </div>
                </div>
              </div>
            @endforeach
          </div>
        </div>
        <div class="pagination-bar" id="pager-offices"></div>
      </section>

      <!-- =====================================================================
           SECTION 5: FULL DOCUMENT TRACKING (Mobile-Style Connected-Dot Timeline)
           ===================================================================== -->
      <section
        id="panel-tracking"
        data-section-panel="tracking"
        class="tracking-workspace"
        style="display: {{ $activeSection === 'tracking' ? 'grid' : 'none' }};"
      >
        <!-- Left Document Selector Index -->
        <div class="surface-card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Tracked Documents ({{ $documentRows->count() }})</h2>
              <p class="card-subtitle">Select any document to display its live custody timeline</p>
            </div>
          </div>

          <div class="card-toolbar" style="flex-direction: column; align-items: stretch; gap: 8px;">
            <div class="search-field" style="max-width: none;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
              <input
                type="text"
                id="tracking-search-input"
                class="input"
                placeholder="Search tracking code, title, or office..."
              />
            </div>

            <div class="filter-pills" id="tracking-filters">
              <button type="button" class="filter-pill filter-pill-active" data-tracking-filter="all">All</button>
              <button type="button" class="filter-pill" data-tracking-filter="in_transit">In Transit</button>
              <button type="button" class="filter-pill" data-tracking-filter="stalled">Stalled</button>
              <button type="button" class="filter-pill" data-tracking-filter="finalized">Finalized</button>
            </div>
          </div>

          <div id="tracking-doc-list">
            @foreach ($documentRows as $row)
              @php
                $doc = $row['model'];
                $isFinalized = in_array($doc->lifecycle_status, ['approved', 'archived'], true);
              @endphp
              <button
                type="button"
                class="track-list-item tracking-row {{ $selectedDocId === $doc->id ? 'track-list-item-active' : '' }}"
                data-select-track-doc="{{ $doc->id }}"
                data-search="{{ strtolower($doc->tracking_code.' '.$doc->title.' '.($doc->originOffice?->code ?? '').' '.($doc->currentOffice?->code ?? '').' '.($doc->currentOffice?->name ?? '')) }}"
                data-in-transit="{{ $row['isInTransit'] ? '1' : '0' }}"
                data-stalled="{{ $row['isStalled'] ? '1' : '0' }}"
                data-finalized="{{ $isFinalized ? '1' : '0' }}"
              >
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; width: 100%;">
                  <span class="mono" style="font-size: 12px; font-weight: 700; color: var(--navy);">{{ $doc->tracking_code }}</span>
                  @if ($row['isStalled'])
                    <span class="pill pill-rose" style="font-size: 10.5px;">Idle {{ $row['idleLabel'] }}</span>
                  @elseif ($row['isInTransit'])
                    <span class="pill pill-amber" style="font-size: 10.5px;">In transit</span>
                  @elseif ($isFinalized)
                    <span class="pill pill-emerald" style="font-size: 10.5px;">Finalized</span>
                  @else
                    <span class="pill pill-slate" style="font-size: 10.5px;">Active</span>
                  @endif
                </div>
                <div style="font-size: 13px; font-weight: 600; color: var(--text-primary); line-height: 1.35;">
                  {{ $doc->title }}
                </div>
                <div style="font-size: 11.5px; color: var(--text-muted);">
                  {{ $doc->originOffice?->code ?? 'HQ' }} → <strong>{{ $doc->currentOffice?->code ?? 'HQ' }}</strong>
                  · {{ count($row['timelineEvents']) }} checkpoint{{ count($row['timelineEvents']) === 1 ? '' : 's' }}
                </div>
              </button>
            @endforeach
          </div>
          <div class="pagination-bar" id="pager-tracking"></div>
        </div>

        <!-- Right Presentable Connected-Dot Timeline Panel (Mobile-Parity Design) -->
        <div class="surface-card" id="tracking-detail-stage" data-testid="admin-tracking-timeline-stage">
          <div class="card-header">
            <div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span class="mono" id="td-code" style="font-size: 13.5px; font-weight: 700; color: var(--navy);">—</span>
                <span class="pill pill-slate" id="td-format">—</span>
                <span class="pill pill-navy" id="td-status">—</span>
                <span class="pill pill-rose" id="td-stalled-pill" style="display: none;"></span>
              </div>
              <h2 class="card-title" id="td-title" style="margin-top: 6px; font-size: 17px;">Select a document to view timeline</h2>
              <p class="card-subtitle" id="td-meta">—</p>
            </div>

            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <button type="button" class="btn btn-amber-soft btn-sm" id="td-alert-btn" style="display: none;">
                Alert Office
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.print()">
                Print Timeline
              </button>
            </div>
          </div>

          <div class="card-body" style="display: flex; flex-direction: column; gap: 20px;">
            <!-- Mobile-style Horizontal Progress Rail -->
            <div class="track-rail-box" id="td-rail-box">
              <div class="track-endpoints">
                <div>
                  <div class="track-ep-meta" id="td-origin-date">—</div>
                  <div class="track-ep-code" id="td-origin-code">—</div>
                  <div style="font-size: 11.5px; color: var(--text-secondary);" id="td-origin-name">—</div>
                </div>
                <div style="text-align: right;">
                  <div class="track-ep-meta" id="td-current-status-note">—</div>
                  <div class="track-ep-code" id="td-current-code">—</div>
                  <div style="font-size: 11.5px; color: var(--text-secondary);" id="td-current-name">—</div>
                </div>
              </div>

              <div class="track-rail-track">
                <div class="track-rail-bg"></div>
                <div class="track-rail-fill track-rail-fill-transit" id="td-rail-fill"></div>
                <div class="track-rail-dot"></div>
                <div class="track-rail-node" id="td-rail-node">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                </div>
                <div class="track-rail-dot track-rail-dot-dest" id="td-rail-dest-dot"></div>
              </div>

              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; font-size: 12.5px; color: var(--text-secondary);">
                <span id="td-holder-line">—</span>
                <span id="td-last-alert-line" style="font-size: 11.5px; color: var(--text-muted);"></span>
              </div>
            </div>

            <!-- Mobile-style Vertical Connected-Dot Timeline -->
            <div>
              <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 10px;">
                Custody Journey Checkpoints
              </div>
              <div class="tl-list" id="td-timeline-list"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- =====================================================================
           SECTION 6: CUSTODY & SLA MONITOR (Dedicated — Separated from Categories)
           ===================================================================== -->
      <section
        id="panel-custody"
        data-section-panel="custody"
        class="surface-card"
        style="display: {{ $activeSection === 'custody' ? 'block' : 'none' }};"
      >
        <div class="card-header">
          <div>
            <h2 class="card-title">Division Custody &amp; SLA Monitor ({{ $documentRows->count() }})</h2>
            <p class="card-subtitle">Track active files, alert offices, or update status</p>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <form method="POST" action="{{ route('admin.alerts.sweep') }}" style="margin: 0;">
              @csrf
              <input type="hidden" name="return_section" value="custody" />
              <button type="submit" class="btn btn-amber-soft btn-sm">
                Run Stalled Auto-Alert
              </button>
            </form>
            <a href="{{ route('admin.export.documents') }}" class="btn btn-secondary btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
              </svg>
              <span>Export CSV</span>
            </a>
          </div>
        </div>

        <div class="card-toolbar">
          <div class="search-field">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              id="custody-search-input"
              class="input"
              placeholder="Search tracking code, title, category, or office..."
            />
          </div>

          <div class="filter-pills" id="custody-filters">
            <button type="button" class="filter-pill filter-pill-active" data-custody-filter="all">All</button>
            <button type="button" class="filter-pill" data-custody-filter="stalled">Stalled (Tengga)</button>
            <button type="button" class="filter-pill" data-custody-filter="sla_risk">SLA Risk</button>
            <button type="button" class="filter-pill" data-custody-filter="in_transit">In Transit</button>
            <button type="button" class="filter-pill" data-custody-filter="finalized">Finalized</button>
          </div>
        </div>

        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Route &amp; Current Desk</th>
                <th>Status, SLA &amp; Idle Time</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              @foreach ($documentRows as $row)
                @php
                  $doc = $row['model'];
                  $sla = $row['slaState'];
                  $isInTransit = $row['isInTransit'];
                  $isFinalized = in_array($doc->lifecycle_status, ['approved', 'archived'], true);
                  $isSlaRisk = in_array($sla, ['at_risk', 'overdue'], true);
                @endphp
                <tr
                  class="custody-row"
                  data-search="{{ strtolower($doc->tracking_code.' '.$doc->title.' '.($doc->category?->name ?? '').' '.($doc->currentOffice?->code ?? '').' '.($doc->originOffice?->code ?? '')) }}"
                  data-stalled="{{ $row['isStalled'] ? '1' : '0' }}"
                  data-sla-risk="{{ $isSlaRisk ? '1' : '0' }}"
                  data-in-transit="{{ $isInTransit ? '1' : '0' }}"
                  data-finalized="{{ $isFinalized ? '1' : '0' }}"
                >
                  <td>
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                      <span class="mono" style="font-size: 12px; font-weight: 700; color: var(--navy);">{{ $doc->tracking_code }}</span>
                      <span class="pill pill-slate" style="font-size: 10.5px;">{{ ucfirst(str_replace('_', ' ', $doc->copy_format)) }}</span>
                    </div>
                    <div style="font-weight: 600; margin-top: 3px;">{{ $doc->title }}</div>
                    <div style="font-size: 11.5px; color: var(--text-muted);">{{ $doc->category?->name ?? 'Uncategorized' }}</div>
                  </td>
                  <td style="white-space: nowrap;">
                    <span class="code-tag">{{ $doc->originOffice?->code ?? 'HQ' }}</span>
                    <span style="color: var(--text-muted); margin: 0 4px;">→</span>
                    <span class="pill pill-navy">{{ $doc->currentOffice?->code ?? 'HQ' }}</span>
                    <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px;">
                      {{ $doc->currentHolder?->full_name ?? 'Office Desk' }}
                    </div>
                  </td>
                  <td>
                    <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
                      <span class="pill {{ $isFinalized ? 'pill-emerald' : ($isInTransit ? 'pill-amber' : 'pill-slate') }}">
                        {{ ucfirst(str_replace('_', ' ', $doc->lifecycle_status)) }}
                      </span>
                      <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                        <span class="pill {{ $isSlaRisk ? 'pill-rose' : 'pill-emerald' }}" style="font-size: 10.5px;">
                          SLA: {{ $sla === 'on_track' ? 'On track' : ucfirst(str_replace('_', ' ', $sla)) }}
                        </span>
                        @if (! $isFinalized)
                          <span class="pill {{ $row['isStalled'] ? 'pill-rose' : 'pill-slate' }}" style="font-size: 10.5px;">
                            Idle {{ $row['idleLabel'] }}
                          </span>
                        @endif
                      </div>
                    </div>
                  </td>
                  <td style="text-align: right; white-space: nowrap;">
                    <div style="display: inline-flex; gap: 6px; align-items: center;">
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        data-open-tracking="{{ $doc->id }}"
                      >
                        Timeline
                      </button>

                      @if (! $isFinalized)
                        <button
                          type="button"
                          class="btn btn-amber-soft btn-sm"
                          data-alert-office
                          data-action="{{ route('admin.documents.notify-office', $doc->id) }}"
                          data-code="{{ $doc->tracking_code }}"
                          data-title="{{ $doc->title }}"
                          data-office="{{ $row['targetOfficeCode'] }} — {{ $row['targetOfficeName'] }}"
                          data-idle="{{ $row['idleLabel'] }}"
                          data-return-section="custody"
                        >
                          Alert Office
                        </button>
                      @endif

                      @if ($isInTransit)
                        <form method="POST" action="{{ route('admin.documents.recall', $doc->id) }}" style="margin: 0;">
                          @csrf
                          <button type="submit" class="btn btn-danger btn-sm">Recall</button>
                        </form>
                      @endif

                      @if (! $isFinalized)
                        <form method="POST" action="{{ route('admin.documents.complete', $doc->id) }}" style="margin: 0;">
                          @csrf
                          <input type="hidden" name="status" value="approved" />
                          <button type="submit" class="btn btn-ghost btn-sm">Approve</button>
                        </form>
                      @endif
                    </div>
                  </td>
                </tr>
              @endforeach
            </tbody>
          </table>
        </div>
        <div class="pagination-bar" id="pager-custody"></div>
      </section>

      <!-- =====================================================================
           SECTION 7: DOCUMENT CATEGORIES (Dedicated — Separated from Custody)
           ===================================================================== -->
      <section
        id="panel-categories"
        data-section-panel="categories"
        class="surface-card"
        style="display: {{ $activeSection === 'categories' ? 'block' : 'none' }};"
      >
        <div class="card-header">
          <div>
            <h2 class="card-title">Global Document Categories ({{ $categories->count() }})</h2>
            <p class="card-subtitle">Shared categories across all offices</p>
          </div>
          <button type="button" class="btn btn-primary btn-sm" data-open-category-create>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <path d="M5 12h14"/><path d="M12 5v14"/>
            </svg>
            <span>Add Category</span>
          </button>
        </div>

        <div class="card-toolbar">
          <div class="search-field">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              id="categories-search-input"
              class="input"
              placeholder="Search category code, name, or declaring office..."
            />
          </div>
        </div>

        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Category Name</th>
                <th>Declared By</th>
                <th class="num-col">Documents Tagged</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              @foreach ($categories as $cat)
                @php $usedCount = (int) ($docCountsByCategory[$cat->id] ?? 0); @endphp
                <tr
                  class="category-row"
                  data-search="{{ strtolower($cat->code.' '.$cat->name.' '.$cat->declared_by_office_code) }}"
                >
                  <td><span class="code-tag">{{ $cat->code }}</span></td>
                  <td style="font-weight: 600;">{{ $cat->name }}</td>
                  <td><span class="pill pill-slate">{{ $cat->declared_by_office_code }}</span></td>
                  <td class="num-col">{{ $usedCount }}</td>
                  <td style="text-align: right; white-space: nowrap;">
                    <div style="display: inline-flex; gap: 6px; align-items: center;">
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        data-edit-category
                        data-action="{{ route('admin.categories.update', $cat->id) }}"
                        data-code="{{ $cat->code }}"
                        data-name="{{ $cat->name }}"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        data-delete-category
                        data-action="{{ route('admin.categories.delete', $cat->id) }}"
                        data-id="{{ $cat->id }}"
                        data-code="{{ $cat->code }}"
                        data-name="{{ $cat->name }}"
                        data-used-count="{{ $usedCount }}"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              @endforeach
            </tbody>
          </table>
        </div>
        <div class="pagination-bar" id="pager-categories"></div>
      </section>

      <!-- =====================================================================
           SECTION 7B: PER-CATEGORY SLA POLICY & ESCALATION RULES ENGINE
           ===================================================================== -->
      <section
        id="panel-sla-policies"
        data-section-panel="sla-policies"
        class="surface-card"
        style="display: {{ $activeSection === 'sla-policies' ? 'block' : 'none' }};"
      >
        <div class="card-header">
          <div>
            <h2 class="card-title">Per-Category SLA &amp; Escalation Rules ({{ $telemetry['configuredSlaPolicies'] }}/{{ $categories->count() }} configured)</h2>
            <p class="card-subtitle">Deadlines and reminder rules per category</p>
          </div>
          <form method="POST" action="{{ route('admin.alerts.sweep') }}" style="margin: 0;">
            @csrf
            <input type="hidden" name="return_section" value="sla-policies" />
            <button type="submit" class="btn btn-amber-soft btn-sm">
              Run SLA &amp; Escalation Sweep
            </button>
          </form>
        </div>

        <div class="card-toolbar">
          <div class="search-field">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              id="sla-search-input"
              class="input"
              placeholder="Search category code, name, or escalation office..."
            />
          </div>
        </div>

        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th class="num-col">Target SLA</th>
                <th class="num-col">Stalled Alert</th>
                <th>Auto-Escalation Rule</th>
                <th>Status</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody id="sla-policies-tbody">
              @foreach ($categories as $cat)
                @php
                  $pol = $cat->slaPolicy;
                  $hasPol = $pol !== null;
                  $escOffice = $pol?->escalateToOffice;
                @endphp
                <tr
                  class="sla-policy-row"
                  data-search="{{ strtolower($cat->code.' '.$cat->name.' '.($escOffice?->code ?? '').' '.($escOffice?->name ?? '')) }}"
                >
                  <td>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span class="code-tag">{{ $cat->code }}</span>
                      <span style="font-weight: 600;">{{ $cat->name }}</span>
                    </div>
                  </td>
                  <td class="num-col mono" style="font-weight: 700;">
                    {{ $hasPol ? $pol->target_hours.'h' : '48h (default)' }}
                  </td>
                  <td class="num-col mono">
                    {{ $hasPol ? $pol->stalled_alert_hours.'h' : $telemetry['stalledThresholdHours'].'h (default)' }}
                  </td>
                  <td>
                    @if ($hasPol && $escOffice)
                      <span class="pill pill-navy">{{ $escOffice->code }}</span>
                      <span style="font-size: 12px; color: var(--text-secondary); margin-left: 4px;">after {{ $pol->escalation_hours }}h idle</span>
                    @else
                      <span style="font-size: 12px; color: var(--text-muted);">No auto-escalation</span>
                    @endif
                  </td>
                  <td>
                    @if ($hasPol && $pol->active)
                      <span class="pill pill-emerald">Custom Active</span>
                    @elseif ($hasPol)
                      <span class="pill pill-slate">Paused</span>
                    @else
                      <span class="pill pill-slate">Division Default</span>
                    @endif
                  </td>
                  <td style="text-align: right; white-space: nowrap;">
                    <div style="display: inline-flex; align-items: center; gap: 6px;">
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        data-edit-sla-policy
                        data-category-id="{{ $cat->id }}"
                        data-category-label="{{ $cat->code }} — {{ $cat->name }}"
                        data-target-hours="{{ $hasPol ? $pol->target_hours : 48 }}"
                        data-stalled-hours="{{ $hasPol ? $pol->stalled_alert_hours : 24 }}"
                        data-escalation-hours="{{ $hasPol ? $pol->escalation_hours : 48 }}"
                        data-escalate-office-id="{{ $pol?->escalate_to_office_id ?? '' }}"
                        data-active="{{ $hasPol ? ($pol->active ? '1' : '0') : '1' }}"
                      >
                        Configure
                      </button>

                      @if ($hasPol)
                        <form method="POST" action="{{ route('admin.sla-policies.delete', $pol->id) }}" style="margin: 0;">
                          @csrf
                          @method('DELETE')
                          <button type="submit" class="btn btn-ghost btn-sm">Reset Default</button>
                        </form>
                      @endif
                    </div>
                  </td>
                </tr>
              @endforeach
            </tbody>
          </table>
        </div>
        <div class="pagination-bar" id="pager-sla-policies"></div>
      </section>

      <!-- =====================================================================
           SECTION 7C: ACTIVE SANCTUM DEVICE SESSIONS & REMOTE KILL-SWITCH CENTER
           ===================================================================== -->
      <section
        id="panel-sessions"
        data-section-panel="sessions"
        style="display: {{ $activeSection === 'sessions' ? 'flex' : 'none' }}; flex-direction: column; gap: 20px;"
      >
        @php
          $webSessionCount = $activeSessions->where('platform', 'web')->count();
          $mobileSessionCount = $activeSessions->whereIn('platform', ['android', 'ios'])->count();
          $uniqueSessionUsers = $activeSessions->pluck('user_id')->unique()->count();
        @endphp

        <div class="kpi-strip">
          <div class="kpi-cell">
            <div class="kpi-cell-top">
              <span class="kpi-label">Active Device Tokens</span>
              <span class="pill pill-navy">Sanctum</span>
            </div>
            <div class="kpi-value">{{ $activeSessions->count() }}</div>
            <div class="kpi-meta">Live API sessions across Web and Android clients</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-cell-top">
              <span class="kpi-label">Web Workstations</span>
              <span class="pill pill-slate">Desktop</span>
            </div>
            <div class="kpi-value">{{ $webSessionCount }}</div>
            <div class="kpi-meta">Signed-in browser and mobile sessions</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-cell-top">
              <span class="kpi-label">Mobile Devices</span>
              <span class="pill pill-emerald">Android / iOS</span>
            </div>
            <div class="kpi-value">{{ $mobileSessionCount }}</div>
            <div class="kpi-meta">Field &amp; desk handheld scanner sessions</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-cell-top">
              <span class="kpi-label">Signed-In Accounts</span>
              <span class="pill pill-slate">Encrypted Audit</span>
            </div>
            <div class="kpi-value">{{ $uniqueSessionUsers }}</div>
            <div class="kpi-meta">Unique personnel with at least one active token</div>
          </div>
        </div>

        <div class="surface-card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Live Sanctum Device Sessions ({{ $activeSessions->count() }})</h2>
              <p class="card-subtitle">Sign out lost or inactive devices remotely</p>
            </div>
            <button type="button" class="btn btn-danger btn-sm" data-open-modal="modal-killswitch-sessions">
              Force Sign-Out All Staff
            </button>
          </div>

          <div class="card-toolbar">
            <div class="search-field">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
              <input
                type="text"
                id="sessions-search-input"
                class="input"
                placeholder="Search user, employee ID, office, device name, or IP..."
              />
            </div>

            <div class="filter-pills" id="sessions-platform-filters">
              <button type="button" class="filter-pill filter-pill-active" data-session-platform="all">All</button>
              <button type="button" class="filter-pill" data-session-platform="web">Web</button>
              <button type="button" class="filter-pill" data-session-platform="android">Android</button>
              <button type="button" class="filter-pill" data-session-platform="ios">iOS</button>
            </div>
          </div>

          @if ($activeSessions->isEmpty())
            <div class="empty-state">
              <p class="empty-title">No active Sanctum API sessions</p>
              <p class="empty-desc">Active web and Android sign-ins appear here.</p>
            </div>
          @else
            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Office</th>
                    <th>Device &amp; Platform</th>
                    <th>IP Hint</th>
                    <th>Last Used / Issued</th>
                    <th style="text-align: right;">Kill-Switch</th>
                  </tr>
                </thead>
                <tbody id="sessions-tbody">
                  @foreach ($activeSessions as $sess)
                    <tr
                      class="session-row"
                      data-search="{{ strtolower($sess['user_name'].' '.$sess['employee_id'].' '.$sess['user_email'].' '.$sess['office_code'].' '.$sess['name'].' '.$sess['ip_hint']) }}"
                      data-platform="{{ $sess['platform'] }}"
                    >
                      <td>
                        <div style="font-weight: 600;">
                          {{ $sess['user_name'] }}
                          @if ($sess['is_admin'])
                            <span class="pill pill-navy" style="font-size: 10px; margin-left: 4px;">Admin</span>
                          @endif
                        </div>
                        <div class="mono" style="font-size: 11.5px; color: var(--text-muted);">{{ $sess['employee_id'] }}</div>
                      </td>
                      <td><span class="code-tag">{{ $sess['office_code'] }}</span></td>
                      <td>
                        <div style="font-weight: 600;">{{ $sess['name'] }}</div>
                        <span class="pill {{ $sess['platform'] === 'web' ? 'pill-slate' : 'pill-emerald' }}" style="font-size: 10.5px; margin-top: 2px;">
                          {{ strtoupper($sess['platform']) }}
                        </span>
                      </td>
                      <td class="mono" style="font-size: 12px; color: var(--text-secondary);">{{ $sess['ip_hint'] }}</td>
                      <td style="font-size: 12px; color: var(--text-secondary); white-space: nowrap;">
                        <div>{{ $sess['last_used_at'] ? $sess['last_used_at']->diffForHumans() : 'Never used' }}</div>
                        <div class="mono" style="font-size: 11px; color: var(--text-muted);">
                          Issued {{ optional($sess['created_at'])->format('M d, H:i') }}
                        </div>
                      </td>
                      <td style="text-align: right; white-space: nowrap;">
                        <div style="display: inline-flex; align-items: center; gap: 6px;">
                          <form method="POST" action="{{ route('admin.sessions.revoke', $sess['id']) }}" style="margin: 0;">
                            @csrf
                            @method('DELETE')
                            <button type="submit" class="btn btn-danger btn-sm">Revoke Device</button>
                          </form>
                          <form method="POST" action="{{ route('admin.users.revoke-sessions', $sess['user_id']) }}" style="margin: 0;">
                            @csrf
                            <input type="hidden" name="return_section" value="sessions" />
                            <button type="submit" class="btn btn-ghost btn-sm">Sign Out All</button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  @endforeach
                </tbody>
              </table>
            </div>
          @endif
          <div class="pagination-bar" id="pager-sessions"></div>
        </div>
      </section>

      <!-- =====================================================================
           SECTION 7D: FILE INTEGRITY & STORAGE HEALTH VERIFIER (SHA-256)
           ===================================================================== -->
      <section
        id="panel-integrity"
        data-section-panel="integrity"
        style="display: {{ $activeSection === 'integrity' ? 'flex' : 'none' }}; flex-direction: column; gap: 20px;"
      >
        @php $intSum = $integrityAudit['summary']; @endphp
        <div class="kpi-strip">
          <div class="kpi-cell">
            <div class="kpi-cell-top">
              <span class="kpi-label">Audited Artifacts</span>
              <span class="pill pill-slate">Vault</span>
            </div>
            <div class="kpi-value">{{ $intSum['total_artifacts'] }}</div>
            <div class="kpi-meta">Document versions &amp; custody proof photos</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-cell-top">
              <span class="kpi-label">SHA-256 Verified</span>
              <span class="pill pill-emerald">{{ number_format($intSum['health_rate'], 1) }}%</span>
            </div>
            <div class="kpi-value">{{ $intSum['verified_count'] }}</div>
            <div class="kpi-meta">Exact cryptographic checksum match on disk</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-cell-top">
              <span class="kpi-label">Flagged Anomalies</span>
              @if (($intSum['missing_count'] + $intSum['mismatch_count']) > 0)
                <span class="pill pill-rose">Attention</span>
              @else
                <span class="pill pill-emerald">Clean</span>
              @endif
            </div>
            <div class="kpi-value">{{ $intSum['missing_count'] + $intSum['mismatch_count'] }}</div>
            <div class="kpi-meta">{{ $intSum['missing_count'] }} missing · {{ $intSum['mismatch_count'] }} tampered</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-cell-top">
              <span class="kpi-label">Disk Storage Used</span>
              <span class="pill pill-navy">Local Vault</span>
            </div>
            <div class="kpi-value">{{ $intSum['total_size_label'] }}</div>
            <div class="kpi-meta mono">Last verified {{ $integrityAudit['audited_at'] }}</div>
          </div>
        </div>

        <div class="split-grid">
          <div class="surface-card">
            <div class="card-header">
              <div>
                <h2 class="card-title">SHA-256 Integrity Ledger</h2>
                <p class="card-subtitle">File verification status for uploaded documents</p>
              </div>
              <form method="POST" action="{{ route('admin.integrity.verify') }}" style="margin: 0;">
                @csrf
                <button type="submit" class="btn btn-primary btn-sm">
                  Run SHA-256 Verification
                </button>
              </form>
            </div>

            <div class="card-toolbar">
              <div class="search-field">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
                <input
                  type="text"
                  id="integrity-search-input"
                  class="input"
                  placeholder="Search tracking code, filename, office, or hash..."
                />
              </div>
              <div class="filter-pills" id="integrity-status-filters">
                <button type="button" class="filter-pill filter-pill-active" data-integrity-status="all">All</button>
                <button type="button" class="filter-pill" data-integrity-status="verified">Verified</button>
                <button type="button" class="filter-pill" data-integrity-status="missing">Missing</button>
                <button type="button" class="filter-pill" data-integrity-status="checksum_mismatch">Mismatch</button>
              </div>
            </div>

            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Document / Artifact</th>
                    <th>Office</th>
                    <th class="num-col">Size</th>
                    <th>SHA-256 Digest</th>
                    <th>Verification</th>
                  </tr>
                </thead>
                <tbody id="integrity-tbody">
                  @foreach ($integrityAudit['artifacts'] as $art)
                    <tr
                      class="integrity-row"
                      data-search="{{ strtolower($art['tracking_code'].' '.$art['file_name'].' '.$art['office_code'].' '.$art['expected_sha256'].' '.$art['artifact_type']) }}"
                      data-status="{{ $art['status'] }}"
                    >
                      <td>
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                          <span class="mono" style="font-size: 11.5px; font-weight: 700; color: var(--navy);">{{ $art['tracking_code'] }}</span>
                          <span class="pill pill-slate" style="font-size: 10px;">{{ $art['artifact_type'] }}</span>
                        </div>
                        <div style="font-size: 12.5px; font-weight: 600; margin-top: 2px;">{{ $art['file_name'] }}</div>
                      </td>
                      <td><span class="code-tag">{{ $art['office_code'] }}</span></td>
                      <td class="num-col mono" style="font-size: 12px;">{{ $art['size_label'] }}</td>
                      <td class="mono" style="font-size: 11px; color: var(--text-muted);" title="{{ $art['expected_sha256'] }}">
                        {{ $art['expected_sha256'] ? substr($art['expected_sha256'], 0, 14).'…' : '—' }}
                      </td>
                      <td>
                        @if ($art['status'] === 'verified')
                          <span class="pill pill-emerald">Verified</span>
                        @elseif ($art['status'] === 'missing')
                          <span class="pill pill-rose">Missing on Disk</span>
                        @else
                          <span class="pill pill-rose">SHA-256 Mismatch</span>
                        @endif
                      </td>
                    </tr>
                  @endforeach
                </tbody>
              </table>
            </div>
            <div class="pagination-bar" id="pager-integrity"></div>
          </div>

          <div class="surface-card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Disk Usage per Office</h2>
                <p class="card-subtitle">Storage usage by office</p>
              </div>
            </div>
            <div class="table-scroll">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th class="num-col">Files</th>
                    <th class="num-col">Storage</th>
                    <th>Health</th>
                  </tr>
                </thead>
                <tbody>
                  @foreach ($integrityAudit['office_usage'] as $ou)
                    <tr class="office-storage-row">
                      <td>
                        <span class="code-tag">{{ $ou['office_code'] }}</span>
                        <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">{{ $ou['office_name'] }}</div>
                      </td>
                      <td class="num-col">{{ $ou['file_count'] }}</td>
                      <td class="num-col mono" style="font-weight: 600;">{{ $ou['size_label'] }}</td>
                      <td>
                        @if ($ou['issue_count'] > 0)
                          <span class="pill pill-rose">{{ $ou['issue_count'] }} issue</span>
                        @else
                          <span class="pill pill-emerald">Intact</span>
                        @endif
                      </td>
                    </tr>
                  @endforeach
                </tbody>
              </table>
            </div>
            <div class="pagination-bar" id="pager-office-storage"></div>
          </div>
        </div>
      </section>

      <!-- =====================================================================
           SECTION 7E: REAL-TIME DELIVERY & PUSH DIAGNOSTICS (SSE / PULSE / FCM)
           ===================================================================== -->
      <section
        id="panel-diagnostics"
        data-section-panel="diagnostics"
        style="display: {{ $activeSection === 'diagnostics' ? 'flex' : 'none' }}; flex-direction: column; gap: 20px;"
      >
        <div class="kpi-strip">
          <div class="kpi-cell">
            <div class="kpi-cell-top">
              <span class="kpi-label">Realtime Pulse / SSE</span>
              <span class="pill pill-emerald">Online</span>
            </div>
            <div class="kpi-value mono" style="font-size: 19px; padding-top: 4px;">
              {{ $realtimeDiagnostics['global_cursor'] ?: 'Idle' }}
            </div>
            <div class="kpi-meta">
              Last event: {{ $realtimeDiagnostics['last_event']['event'] ?? 'None yet' }}
            </div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-cell-top">
              <span class="kpi-label">FCM Push Gateway</span>
              @if ($realtimeDiagnostics['fcm_configured'])
                <span class="pill pill-emerald">Configured</span>
              @else
                <span class="pill pill-amber">SSE Fallback</span>
              @endif
            </div>
            <div class="kpi-value">{{ $realtimeDiagnostics['sent_pushes_7d'] }}</div>
            <div class="kpi-meta">Sent (7d) · {{ $realtimeDiagnostics['failed_pushes_7d'] }} failed</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-cell-top">
              <span class="kpi-label">Registered Push Tokens</span>
              <span class="pill pill-navy">{{ $realtimeDiagnostics['android_tokens'] }} Android</span>
            </div>
            <div class="kpi-value">{{ $realtimeDiagnostics['total_tokens'] }}</div>
            <div class="kpi-meta">{{ $realtimeDiagnostics['stale_tokens'] }} stale (&gt;30d) · {{ $usersWithoutPushToken->count() }} staff unregistered</div>
          </div>
          <div class="kpi-cell">
            <div class="kpi-cell-top">
              <span class="kpi-label">Unread &amp; Queue Health</span>
              @if ($realtimeDiagnostics['failed_queue_jobs'] > 0)
                <span class="pill pill-rose">{{ $realtimeDiagnostics['failed_queue_jobs'] }} failed jobs</span>
              @else
                <span class="pill pill-emerald">Healthy</span>
              @endif
            </div>
            <div class="kpi-value">{{ $realtimeDiagnostics['unread_notifications'] }}</div>
            <div class="kpi-meta">Unread alerts · {{ $realtimeDiagnostics['pending_queue_jobs'] }} queued job(s)</div>
          </div>
        </div>

        <!-- Diagnostic Test Ping Card -->
        <div class="surface-card">
          <div class="card-header">
            <div>
              <h2 class="card-title">Send Diagnostic Realtime &amp; Push Ping</h2>
              <p class="card-subtitle">Send a test alert to any user</p>
            </div>
            <form method="POST" action="{{ route('admin.diagnostics.test-push') }}" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0;">
              @csrf
              <select name="target_user_id" class="select" style="height: 36px; font-size: 13px; min-width: 240px;" required>
                @foreach ($activeApprovedUsers as $u)
                  <option value="{{ $u->id }}">{{ $u->office?->code ?? 'HQ' }} · {{ $u->full_name }} ({{ $u->employee_id }})</option>
                @endforeach
              </select>
              <button type="submit" class="btn btn-primary btn-sm">Send Diagnostic Ping</button>
            </form>
          </div>
        </div>

        <div class="split-grid">
          <div class="surface-card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Registered Device Push Tokens ({{ $pushTokens->count() }})</h2>
                <p class="card-subtitle">Check whether staff phones are registered for push notifications</p>
              </div>
            </div>

            <div class="card-toolbar">
              <div class="search-field">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
                <input
                  type="text"
                  id="tokens-search-input"
                  class="input"
                  placeholder="Search user, office, platform, or device label..."
                />
              </div>
            </div>

            @if ($pushTokens->isEmpty())
              <div class="empty-state">
                <p class="empty-title">No mobile push tokens registered yet</p>
                <p class="empty-desc">
                  {{ $usersWithoutPushToken->count() }} active team members currently rely on Web / Mobile SSE realtime polling.
                  Once they open the Android app and grant notification permission, their token appears here.
                </p>
              </div>
            @else
              <div class="table-scroll">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Personnel &amp; Office</th>
                      <th>Device &amp; Platform</th>
                      <th>Last Seen</th>
                      <th style="text-align: right;">Action</th>
                    </tr>
                  </thead>
                  <tbody id="push-tokens-tbody">
                    @foreach ($pushTokens as $pt)
                      @php
                        $isStale = $pt->last_seen_at && $pt->last_seen_at->lessThan(now()->subDays(30));
                      @endphp
                      <tr
                        class="push-token-row"
                        data-search="{{ strtolower(($pt->user?->full_name ?? '').' '.($pt->user?->office?->code ?? '').' '.$pt->platform.' '.$pt->device_label) }}"
                      >
                        <td>
                          <div style="font-weight: 600;">{{ $pt->user?->full_name ?? $pt->user_id }}</div>
                          <span class="code-tag" style="margin-top: 2px;">{{ $pt->user?->office?->code ?? 'HQ' }}</span>
                        </td>
                        <td>
                          <div style="font-weight: 600;">{{ $pt->device_label }}</div>
                          <span class="pill {{ $isStale ? 'pill-amber' : 'pill-emerald' }}" style="font-size: 10px; margin-top: 2px;">
                            {{ strtoupper($pt->platform) }} · {{ $isStale ? 'Stale' : 'Active' }}
                          </span>
                        </td>
                        <td style="font-size: 12px; color: var(--text-muted); white-space: nowrap;">
                          {{ $pt->last_seen_at ? $pt->last_seen_at->diffForHumans() : 'Never' }}
                        </td>
                        <td style="text-align: right;">
                          <form method="POST" action="{{ route('admin.diagnostics.delete-token', $pt->id) }}" style="margin: 0;">
                            @csrf
                            @method('DELETE')
                            <button type="submit" class="btn btn-danger btn-sm">Prune</button>
                          </form>
                        </td>
                      </tr>
                    @endforeach
                  </tbody>
                </table>
              </div>
            @endif
            <div class="pagination-bar" id="pager-push-tokens"></div>
          </div>

          <div class="surface-card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Recent Push &amp; Pulse Delivery Log</h2>
                <p class="card-subtitle">Recent push and live-sync deliveries</p>
              </div>
            </div>

            @if ($pushLogs->isEmpty())
              <div class="empty-state">
                <p class="empty-title">No push dispatch attempts logged yet</p>
                <p class="empty-desc">Send a test ping or route a document to see delivery logs here.</p>
              </div>
            @else
              <div class="table-scroll">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Event &amp; Target</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    @foreach ($pushLogs as $pl)
                      <tr class="push-log-row">
                        <td class="mono" style="font-size: 11.5px; color: var(--text-muted); white-space: nowrap;">
                          {{ optional($pl->occurred_at)->format('M d H:i') }}
                        </td>
                        <td>
                          <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <span class="code-tag">{{ $pl->event_type }}</span>
                            @if ($pl->targetOffice)
                              <span class="pill pill-navy" style="font-size: 10px;">{{ $pl->targetOffice->code }}</span>
                            @endif
                          </div>
                          <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
                            {{ $pl->targetUser?->full_name ?? 'Office Staff' }}
                            @if ($pl->error_message)
                              · {{ $pl->error_message }}
                            @endif
                          </div>
                        </td>
                        <td>
                          @if ($pl->status === 'sent')
                            <span class="pill pill-emerald">Sent ({{ $pl->tokens_targeted }})</span>
                          @elseif ($pl->status === 'failed')
                            <span class="pill pill-rose">Failed</span>
                          @elseif ($pl->status === 'no_tokens')
                            <span class="pill pill-amber">No Token</span>
                          @else
                            <span class="pill pill-slate">SSE Only</span>
                          @endif
                        </td>
                      </tr>
                    @endforeach
                  </tbody>
                </table>
              </div>
            @endif
            <div class="pagination-bar" id="pager-push-logs"></div>
          </div>
        </div>
      </section>

      <!-- =====================================================================
           SECTION 8: AUDIT LEDGER
           ===================================================================== -->
      <section
        id="panel-audit"
        data-section-panel="audit"
        class="surface-card"
        style="display: {{ $activeSection === 'audit' ? 'block' : 'none' }};"
      >
        <div class="card-header">
          <div>
            <h2 class="card-title">Division Audit Ledger ({{ $auditLogs->count() }})</h2>
            <p class="card-subtitle">History of account, alert, and document actions</p>
          </div>
          <a href="{{ route('admin.export.audit-logs') }}" class="btn btn-secondary btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
            </svg>
            <span>Export Audit CSV</span>
          </a>
        </div>

        <div class="card-toolbar">
          <div class="search-field">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              type="text"
              id="audit-search-input"
              class="input"
              placeholder="Search event, actor, office, tracking code, or summary..."
            />
          </div>

          <div class="filter-pills" id="audit-filters">
            <button type="button" class="filter-pill filter-pill-active" data-audit-filter="all">All Events</button>
            <button type="button" class="filter-pill" data-audit-filter="auth">Accounts &amp; Offices</button>
            <button type="button" class="filter-pill" data-audit-filter="routing">Custody &amp; Routing</button>
            <button type="button" class="filter-pill" data-audit-filter="alerts">Alerts &amp; SLA</button>
            <button type="button" class="filter-pill" data-audit-filter="security">Security &amp; QR</button>
          </div>
        </div>

        <div class="table-scroll">
          <table class="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Event</th>
                <th>Actor</th>
                <th>Office</th>
                <th>Tracking Code</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              @foreach ($auditLogs as $log)
                @php
                  $actLower = strtolower($log->action);
                  $auditCat = 'other';
                  if (str_contains($actLower, 'alert')) {
                    $auditCat = 'alerts';
                  } elseif (str_contains($actLower, 'account') || str_contains($actLower, 'office') || str_contains($actLower, 'login') || str_contains($actLower, 'profile')) {
                    $auditCat = 'auth';
                  } elseif (str_contains($actLower, 'forward') || str_contains($actLower, 'acknowledge') || str_contains($actLower, 'recall') || str_contains($actLower, 'return') || str_contains($actLower, 'complete') || str_contains($actLower, 'decline')) {
                    $auditCat = 'routing';
                  } elseif (str_contains($actLower, 'qr') || str_contains($actLower, 'password') || str_contains($actLower, 'presigned') || str_contains($actLower, 'denied')) {
                    $auditCat = 'security';
                  }
                @endphp
                <tr
                  class="audit-row"
                  data-search="{{ strtolower($log->action.' '.$log->actor_name.' '.$log->actor_office_code.' '.($log->tracking_code ?? '').' '.$log->summary) }}"
                  data-cat="{{ $auditCat }}"
                >
                  <td class="mono" style="font-size: 12px; color: var(--text-muted); white-space: nowrap;">
                    {{ optional($log->occurred_at)->format('Y-m-d H:i') }}
                  </td>
                  <td><span class="code-tag">{{ $log->action }}</span></td>
                  <td style="font-weight: 600;">{{ $log->actor_name }}</td>
                  <td><span class="pill pill-slate">{{ $log->actor_office_code }}</span></td>
                  <td class="mono" style="font-size: 12px; color: var(--navy);">{{ $log->tracking_code ?? '—' }}</td>
                  <td style="color: var(--text-secondary);">{{ $log->summary }}</td>
                </tr>
              @endforeach
            </tbody>
          </table>
        </div>
        <div class="pagination-bar" id="pager-audit"></div>
      </section>
    </main>
  </div>
</div>

<!-- ===========================================================================
     MODALS
     =========================================================================== -->

<!-- 1. Provision Verified User Account Modal (Supports Custom Office) -->
<div class="modal-backdrop" id="modal-provision-user" role="dialog" aria-modal="true" aria-labelledby="prov-modal-title">
  <div class="modal-panel">
    <div class="modal-header">
      <div>
        <h3 class="modal-title" id="prov-modal-title">Add User Account</h3>
        <p class="modal-sub">Creates an active standard User across Web and Mobile (for Admins, use Add Admin)</p>
      </div>
      <button type="button" class="modal-close" data-close-modal aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <form method="POST" action="{{ route('admin.users.provision') }}">
      @csrf
      <input type="hidden" name="return_section" value="personnel" />
      <div class="modal-body">
        <div class="field-grid-2">
          <div class="field-group">
            <label class="field-label" for="prov-fullname">Full Name</label>
            <input id="prov-fullname" name="full_name" class="input" placeholder="e.g. Clarissa D. Mendoza" required />
          </div>
          <div class="field-group">
            <label class="field-label" for="prov-empid">Employee ID</label>
            <input id="prov-empid" name="employee_id" class="input mono" placeholder="TRC-0921" required />
          </div>
        </div>

        <div class="field-grid-2">
          <div class="field-group">
            <label class="field-label" for="prov-email">Work Email</label>
            <input id="prov-email" name="email" type="email" class="input" placeholder="name@tracely.app" required />
          </div>
          <div class="field-group">
            <label class="field-label" for="prov-position">Position / Plantilla</label>
            <input id="prov-position" name="position" class="input" placeholder="Administrative Officer II" required />
          </div>
        </div>

        <div class="field-grid-2">
          <div class="field-group">
            <label class="field-label" for="prov-office">Assigned Office</label>
            <select id="prov-office" name="office_id" class="select">
              @foreach ($offices as $off)
                <option value="{{ $off->id }}">{{ $off->code }} — {{ $off->name }}</option>
              @endforeach
              <option value="__custom__">+ Add Custom Office / Branch...</option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label" for="prov-role">User Role</label>
            <select id="prov-role" name="role" class="select">
              @foreach ($userRoleOptions as $roleKey => $roleLabel)
                <option value="{{ $roleKey }}">{{ $roleLabel }}</option>
              @endforeach
            </select>
          </div>
        </div>

        <div class="custom-office-box" id="prov-custom-office-box">
          <div style="font-size: 12px; font-weight: 700; color: var(--navy);">New Custom Office / Branch</div>
          <div class="field-grid-2">
            <div class="field-group">
              <label class="field-label" for="prov-custom-code">Office Code (optional)</label>
              <input id="prov-custom-code" name="custom_office_code" class="input mono" placeholder="e.g. NORTH" maxlength="20" />
            </div>
            <div class="field-group">
              <label class="field-label" for="prov-custom-name">Office / Department Name</label>
              <input id="prov-custom-name" name="custom_office_name" class="input" placeholder="e.g. North Branch Office" maxlength="120" />
            </div>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label" for="prov-password">Initial Temporary Password</label>
          <input id="prov-password" name="password" type="text" class="input mono" value="Tracely@2026!" required />
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">Create User Account</button>
      </div>
    </form>
  </div>
</div>

<!-- 1B. Add Administrator Modal (Dedicated Admin Role Provisioning) -->
<div class="modal-backdrop" id="modal-provision-admin" role="dialog" aria-modal="true" aria-labelledby="prov-admin-title">
  <div class="modal-panel">
    <div class="modal-header">
      <div>
        <h3 class="modal-title" id="prov-admin-title">Add System Administrator</h3>
        <p class="modal-sub">Creates a dedicated Admin account with full access to the standalone Admin Portal</p>
      </div>
      <button type="button" class="modal-close" data-close-modal aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <form method="POST" action="{{ route('admin.admins.provision') }}">
      @csrf
      <div class="modal-body">
        <div class="field-grid-2">
          <div class="field-group">
            <label class="field-label" for="admin-fullname">Full Name</label>
            <input id="admin-fullname" name="full_name" class="input" placeholder="e.g. Engr. Paolo R. Cruz" required />
          </div>
          <div class="field-group">
            <label class="field-label" for="admin-empid">Employee ID (optional)</label>
            <input id="admin-empid" name="employee_id" class="input mono" placeholder="ADM-0901" />
          </div>
        </div>

        <div class="field-grid-2">
          <div class="field-group">
            <label class="field-label" for="admin-email">Work Email</label>
            <input id="admin-email" name="email" type="email" class="input" placeholder="admin@tracely.app" required />
          </div>
          <div class="field-group">
            <label class="field-label" for="admin-position">Position / Plantilla</label>
            <input id="admin-position" name="position" class="input" placeholder="Information Technology Officer I" required />
          </div>
        </div>

        <div class="field-grid-2">
          <div class="field-group">
            <label class="field-label" for="admin-office">Assigned Office</label>
            <select id="admin-office" name="office_id" class="select">
              @foreach ($offices as $off)
                <option value="{{ $off->id }}" {{ strtoupper($off->code) === 'ICT' ? 'selected' : '' }}>{{ $off->code }} — {{ $off->name }}</option>
              @endforeach
              <option value="__custom__">+ Add Custom Office / Branch...</option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label" for="admin-role">Admin Privilege Role</label>
            <select id="admin-role" name="role" class="select">
              @foreach ($adminRoleOptions as $roleKey => $roleLabel)
                <option value="{{ $roleKey }}">{{ $roleLabel }}</option>
              @endforeach
            </select>
          </div>
        </div>

        <div class="custom-office-box" id="admin-custom-office-box">
          <div style="font-size: 12px; font-weight: 700; color: var(--navy);">New Custom Office / Unit</div>
          <div class="field-grid-2">
            <div class="field-group">
              <label class="field-label" for="admin-custom-code">Office Code (optional)</label>
              <input id="admin-custom-code" name="custom_office_code" class="input mono" placeholder="e.g. ICT-EXT" maxlength="20" />
            </div>
            <div class="field-group">
              <label class="field-label" for="admin-custom-name">Official Office Name</label>
              <input id="admin-custom-name" name="custom_office_name" class="input" placeholder="e.g. ICT Operations Desk" maxlength="120" />
            </div>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label" for="admin-password">Initial Admin Password</label>
          <input id="admin-password" name="password" type="text" class="input mono" value="Admin@Sdo2026!" required />
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">Create Administrator</button>
      </div>
    </form>
  </div>
</div>

<!-- 2. Edit Account Assignment Modal (Supports Custom Office + User / Admin Roles) -->
<div class="modal-backdrop" id="modal-edit-user" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
  <div class="modal-panel">
    <div class="modal-header">
      <div>
        <h3 class="modal-title" id="edit-user-title">Edit Account Assignment</h3>
        <p class="modal-sub" id="edit-user-sub">Update office assignment, account role, position, or availability</p>
      </div>
      <button type="button" class="modal-close" data-close-modal aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <form method="POST" id="edit-user-form" action="">
      @csrf
      @method('PATCH')
      <input type="hidden" name="return_section" id="edit-user-return-section" value="personnel" />
      <div class="modal-body">
        <div class="field-group">
          <label class="field-label" for="edit-user-position">Position / Plantilla Title</label>
          <input id="edit-user-position" name="position" class="input" required />
        </div>

        <div class="field-group">
          <label class="field-label" for="edit-user-office">Assigned Office</label>
          <select id="edit-user-office" name="office_id" class="select">
            @foreach ($offices as $off)
              <option value="{{ $off->id }}">{{ $off->code }} — {{ $off->name }}</option>
            @endforeach
            <option value="__custom__">+ Add Custom Office / Branch...</option>
          </select>
        </div>

        <div class="custom-office-box" id="edit-custom-office-box">
          <div style="font-size: 12px; font-weight: 700; color: var(--navy);">Create &amp; Assign Custom Office</div>
          <div class="field-grid-2">
            <div class="field-group">
              <label class="field-label" for="edit-custom-code">Office Code (optional)</label>
              <input id="edit-custom-code" name="custom_office_code" class="input mono" placeholder="e.g. DRRM" maxlength="20" />
            </div>
            <div class="field-group">
              <label class="field-label" for="edit-custom-name">Office / Department Name</label>
              <input id="edit-custom-name" name="custom_office_name" class="input" placeholder="e.g. DRRM Field Unit" maxlength="120" />
            </div>
          </div>
        </div>

        <div class="field-grid-2">
          <div class="field-group">
            <label class="field-label" for="edit-user-role">Account Role (User vs Admin)</label>
            <select id="edit-user-role" name="role" class="select">
              <optgroup label="User Roles (Personnel Directory)">
                @foreach ($userRoleOptions as $roleKey => $roleLabel)
                  <option value="{{ $roleKey }}">{{ $roleLabel }}</option>
                @endforeach
              </optgroup>
              <optgroup label="Admin Roles (Administrators Directory)">
                @foreach ($adminRoleOptions as $roleKey => $roleLabel)
                  <option value="{{ $roleKey }}">{{ $roleLabel }}</option>
                @endforeach
              </optgroup>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label" for="edit-user-availability">Availability</label>
            <select id="edit-user-availability" name="availability" class="select">
              @foreach ($availabilityOptions as $avKey => $avLabel)
                <option value="{{ $avKey }}">{{ $avLabel }}</option>
              @endforeach
            </select>
          </div>
        </div>

        <div class="field-grid-2">
          <div class="field-group">
            <label class="field-label" for="edit-user-delegate">Leave Delegate Override</label>
            <select id="edit-user-delegate" name="delegate_id" class="select">
              <option value="">No delegate assigned</option>
              @foreach ($activeApprovedUsers as $candidateDelegate)
                <option value="{{ $candidateDelegate->id }}">{{ $candidateDelegate->office?->code ?? 'HQ' }} · {{ $candidateDelegate->full_name }}</option>
              @endforeach
            </select>
          </div>
          <div class="field-group">
            <label class="field-label" for="edit-user-avail-until">Unavailable Until (optional)</label>
            <input id="edit-user-avail-until" name="availability_until" type="date" class="input" />
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">Save Changes</button>
      </div>
    </form>
  </div>
</div>

<!-- 3. Send Manual Office Follow-Up Alert Modal -->
<div class="modal-backdrop" id="modal-alert-office" role="dialog" aria-modal="true" aria-labelledby="alert-office-title">
  <div class="modal-panel" style="max-width: 470px;">
    <div class="modal-header">
      <div>
        <h3 class="modal-title" id="alert-office-title">Send Office Follow-Up Alert</h3>
        <p class="modal-sub" id="alert-office-sub">Dispatches an instant in-app Web &amp; Mobile alert to the assigned office</p>
      </div>
      <button type="button" class="modal-close" data-close-modal aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <form method="POST" id="alert-office-form" action="">
      @csrf
      <input type="hidden" name="return_section" id="alert-return-section" value="overview" />
      <div class="modal-body">
        <div style="padding: 12px 14px; border-radius: 10px; background: var(--surface-soft); border: 1px solid var(--border); font-size: 12.5px; display: flex; flex-direction: column; gap: 4px;">
          <div><strong>Document:</strong> <span class="mono" id="alert-doc-code"></span> — <span id="alert-doc-title"></span></div>
          <div><strong>Target Office:</strong> <span id="alert-target-office"></span></div>
          <div><strong>Current Dwell:</strong> <span id="alert-idle-duration"></span></div>
        </div>

        <div class="field-group">
          <label class="field-label" for="alert-message-input">Follow-Up Message (optional — defaults to standard SLA reminder)</label>
          <input
            id="alert-message-input"
            name="message"
            type="text"
            class="input"
            maxlength="280"
            placeholder="e.g. Please confirm receipt and process immediately."
          />
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">Send Office Alert</button>
      </div>
    </form>
  </div>
</div>

<!-- 4. Reset Password Modal -->
<div class="modal-backdrop" id="modal-reset-password" role="dialog" aria-modal="true" aria-labelledby="reset-pwd-title">
  <div class="modal-panel" style="max-width: 440px;">
    <div class="modal-header">
      <div>
        <h3 class="modal-title" id="reset-pwd-title">Reset Account Password</h3>
        <p class="modal-sub" id="reset-pwd-sub">Revokes existing device sessions immediately</p>
      </div>
      <button type="button" class="modal-close" data-close-modal aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <form method="POST" id="reset-pwd-form" action="">
      @csrf
      <input type="hidden" name="return_section" id="reset-pwd-return-section" value="personnel" />
      <div class="modal-body">
        <div class="field-group">
          <label class="field-label" for="reset-pwd-input">New Strong Password (8–32 characters)</label>
          <input id="reset-pwd-input" name="new_password" type="text" class="input mono" placeholder="e.g. Tracely@Reset2026!" minlength="8" required />
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">Reset Password</button>
      </div>
    </form>
  </div>
</div>

<!-- 5. Reject Registration Modal -->
<div class="modal-backdrop" id="modal-reject-user" role="dialog" aria-modal="true" aria-labelledby="reject-user-title">
  <div class="modal-panel" style="max-width: 440px;">
    <div class="modal-header">
      <div>
        <h3 class="modal-title" id="reject-user-title">Reject Registration</h3>
        <p class="modal-sub" id="reject-user-sub">Provide an optional audit note for this rejection</p>
      </div>
      <button type="button" class="modal-close" data-close-modal aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <form method="POST" id="reject-user-form" action="">
      @csrf
      <div class="modal-body">
        <div class="field-group">
          <label class="field-label" for="reject-reason-input">Rejection Reason (Optional)</label>
          <input id="reject-reason-input" name="reason" type="text" class="input" placeholder="e.g. Unverified Employee ID or mismatched unit" />
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-danger">Confirm Rejection</button>
      </div>
    </form>
  </div>
</div>

<!-- 6. Add / Edit Office Modal -->
<div class="modal-backdrop" id="modal-office" role="dialog" aria-modal="true" aria-labelledby="office-modal-title">
  <div class="modal-panel" style="max-width: 440px;">
    <div class="modal-header">
      <div>
        <h3 class="modal-title" id="office-modal-title">Add Office</h3>
        <p class="modal-sub">Available immediately across Web and Mobile routing directories</p>
      </div>
      <button type="button" class="modal-close" data-close-modal aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <form method="POST" id="office-modal-form" action="{{ route('admin.offices.create') }}">
      @csrf
      <input type="hidden" name="_method" id="office-modal-method" value="POST" />
      <div class="modal-body">
        <div class="field-group">
          <label class="field-label" for="office-code-input">Unit Code</label>
          <input id="office-code-input" name="code" class="input mono" placeholder="e.g. SUPPLY" maxlength="20" required />
        </div>
        <div class="field-group">
          <label class="field-label" for="office-name-input">Office / Department Name</label>
          <input id="office-name-input" name="name" class="input" placeholder="e.g. Property & Supply Unit" maxlength="120" required />
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary" id="office-modal-submit">Register Office</button>
      </div>
    </form>
  </div>
</div>

<!-- 7. Add / Edit Document Category Modal -->
<div class="modal-backdrop" id="modal-category" role="dialog" aria-modal="true" aria-labelledby="cat-modal-title">
  <div class="modal-panel" style="max-width: 440px;">
    <div class="modal-header">
      <div>
        <h3 class="modal-title" id="cat-modal-title">Add Document Category</h3>
        <p class="modal-sub">Shared globally across all offices</p>
      </div>
      <button type="button" class="modal-close" data-close-modal aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <form method="POST" id="cat-modal-form" action="{{ route('admin.categories.create') }}">
      @csrf
      <input type="hidden" name="_method" id="cat-modal-method" value="POST" />
      <div class="modal-body">
        <div class="field-group">
          <label class="field-label" for="cat-code-input">Short Code</label>
          <input id="cat-code-input" name="code" class="input mono" placeholder="e.g. MEMO" maxlength="16" required />
        </div>
        <div class="field-group">
          <label class="field-label" for="cat-name-input">Category Name</label>
          <input id="cat-name-input" name="name" class="input" placeholder="e.g. Executive Memorandum" maxlength="120" required />
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary" id="cat-modal-submit">Add Category</button>
      </div>
    </form>
  </div>
</div>

<!-- 8. Delete Document Category Modal (Supports Safe Document Reassignment) -->
<div class="modal-backdrop" id="modal-delete-category" role="dialog" aria-modal="true" aria-labelledby="del-cat-title">
  <div class="modal-panel" style="max-width: 460px;">
    <div class="modal-header">
      <div>
        <h3 class="modal-title" id="del-cat-title">Delete Document Category</h3>
        <p class="modal-sub" id="del-cat-sub">Remove this global category from Tracely</p>
      </div>
      <button type="button" class="modal-close" data-close-modal aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <form method="POST" id="del-cat-form" action="">
      @csrf
      @method('DELETE')
      <div class="modal-body">
        <div style="padding: 12px 14px; border-radius: 10px; background: var(--rose-soft); border: 1px solid var(--rose-border); color: var(--rose-text); font-size: 13px; line-height: 1.5;" id="del-cat-warning">
          Are you sure you want to permanently delete this category?
        </div>

        <div class="field-group" id="del-cat-reassign-wrap" style="display: none;">
          <label class="field-label" for="del-cat-replacement">Reassign existing documents to</label>
          <select id="del-cat-replacement" name="replacement_category_id" class="select">
            @foreach ($categories as $catOption)
              <option value="{{ $catOption->id }}">{{ $catOption->code }} — {{ $catOption->name }}</option>
            @endforeach
            <option value="">Auto-create GEN — General Document (if none left)</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-danger">Confirm Delete</button>
      </div>
    </form>
  </div>
</div>

<!-- 9. Bulk Office Custody Reassignment Modal (Preserves Immutable Routing Chain) -->
<div class="modal-backdrop" id="modal-reassign-custody" role="dialog" aria-modal="true" aria-labelledby="reassign-title">
  <div class="modal-panel" style="max-width: 480px;">
    <div class="modal-header">
      <div>
        <h3 class="modal-title" id="reassign-title">Reassign Held Document Custody</h3>
        <p class="modal-sub" id="reassign-sub">Bulk-transfer active held documents to another officer with immutable audit trail</p>
      </div>
      <button type="button" class="modal-close" data-close-modal aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <form method="POST" id="reassign-custody-form" action="">
      @csrf
      <input type="hidden" name="return_section" value="personnel" />
      <div class="modal-body">
        <div style="padding: 12px 14px; border-radius: 10px; background: var(--amber-soft); border: 1px solid var(--amber-border); color: var(--amber-text); font-size: 12.5px; line-height: 1.5;" id="reassign-summary-box">
          All active documents held by this officer will be transferred cleanly while appending an administrative handoff record to each document's custody timeline.
        </div>

        <div class="field-group">
          <label class="field-label" for="reassign-target-user">Replacement Custodian</label>
          <select id="reassign-target-user" name="target_user_id" class="select" required>
            @foreach ($activeApprovedUsers as $officer)
              <option value="{{ $officer->id }}">{{ $officer->office?->code ?? 'HQ' }} · {{ $officer->full_name }} ({{ $officer->position }})</option>
            @endforeach
          </select>
        </div>

        <div class="field-group">
          <label class="field-label" for="reassign-reason">Administrative Reason (Logged to Timeline &amp; Audit)</label>
          <input
            id="reassign-reason"
            name="reason"
            class="input"
            maxlength="240"
            placeholder="e.g. Officer on unplanned sick leave; reassigned to unit OIC"
            required
          />
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">Reassign Custody</button>
      </div>
    </form>
  </div>
</div>

<!-- 10. Configure Per-Category SLA & Escalation Policy Modal -->
<div class="modal-backdrop" id="modal-sla-policy" role="dialog" aria-modal="true" aria-labelledby="sla-modal-title">
  <div class="modal-panel" style="max-width: 490px;">
    <div class="modal-header">
      <div>
        <h3 class="modal-title" id="sla-modal-title">Configure Category SLA Policy</h3>
        <p class="modal-sub" id="sla-modal-sub">Override division default deadlines and automatic escalation office</p>
      </div>
      <button type="button" class="modal-close" data-close-modal aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <form method="POST" action="{{ route('admin.sla-policies.save') }}">
      @csrf
      <input type="hidden" name="category_id" id="sla-category-id" value="" />
      <div class="modal-body">
        <div class="field-grid-2">
          <div class="field-group">
            <label class="field-label" for="sla-target-hours">Target SLA Deadline (Hours)</label>
            <input id="sla-target-hours" name="target_hours" type="number" min="1" max="720" class="input mono" value="48" required />
          </div>
          <div class="field-group">
            <label class="field-label" for="sla-stalled-hours">Stalled Alert Threshold (Hours)</label>
            <input id="sla-stalled-hours" name="stalled_alert_hours" type="number" min="1" max="720" class="input mono" value="24" required />
          </div>
        </div>

        <div class="field-grid-2">
          <div class="field-group">
            <label class="field-label" for="sla-escalation-hours">Auto-Escalate After (Hours)</label>
            <input id="sla-escalation-hours" name="escalation_hours" type="number" min="1" max="720" class="input mono" value="48" required />
          </div>
          <div class="field-group">
            <label class="field-label" for="sla-escalate-office">Escalate To Office</label>
            <select id="sla-escalate-office" name="escalate_to_office_id" class="select">
              <option value="">Disabled (No escalation)</option>
              @foreach ($offices as $off)
                <option value="{{ $off->id }}">{{ $off->code }} — {{ $off->name }}</option>
              @endforeach
            </select>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label" for="sla-active-select">Policy Status</label>
          <select id="sla-active-select" name="active" class="select">
            <option value="1">Active — Enforce on new documents &amp; watchdog sweeps</option>
            <option value="0">Paused — Fall back to division defaults</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-primary">Save SLA Policy</button>
      </div>
    </form>
  </div>
</div>

<!-- 11. Emergency Kill-Switch Confirmation Modal (Revoke All Staff Sessions) -->
<div class="modal-backdrop" id="modal-killswitch-sessions" role="dialog" aria-modal="true" aria-labelledby="ks-modal-title">
  <div class="modal-panel" style="max-width: 440px;">
    <div class="modal-header">
      <div>
        <h3 class="modal-title" id="ks-modal-title">Force Sign-Out All Staff Devices</h3>
        <p class="modal-sub">Emergency RA 10173 session kill-switch</p>
      </div>
      <button type="button" class="modal-close" data-close-modal aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
    </div>

    <form method="POST" action="{{ route('admin.sessions.revoke-all') }}">
      @csrf
      <div class="modal-body">
        <div style="padding: 12px 14px; border-radius: 10px; background: var(--rose-soft); border: 1px solid var(--rose-border); color: var(--rose-text); font-size: 13px; line-height: 1.5;">
          This immediately revokes every active Web and Mobile Sanctum token for all regular staff accounts. Staff will be required to sign in again on their devices. Your Admin Portal session remains active.
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-close-modal>Cancel</button>
        <button type="submit" class="btn btn-danger">Execute Kill-Switch</button>
      </div>
    </form>
  </div>
</div>

<!-- Floating Toast Notification -->
@if (session('admin_toast'))
  <div class="toast-banner toast-success" id="admin-toast" role="status">
    <span>{{ session('admin_toast') }}</span>
    <button type="button" class="toast-dismiss" onclick="this.parentElement.remove()" aria-label="Dismiss">✕</button>
  </div>
@elseif (session('admin_error') || $errors->any())
  <div class="toast-banner toast-error" id="admin-toast" role="alert">
    <span>{{ session('admin_error') ?: $errors->first() }}</span>
    <button type="button" class="toast-dismiss" onclick="this.parentElement.remove()" aria-label="Dismiss">✕</button>
  </div>
@endif

<script type="application/json" id="admin-tracking-payload">@json($trackingPayload)</script>
<script>
  (function () {
    var sectionMeta = @json($sectionMeta);
    var trackingPayloadEl = document.getElementById('admin-tracking-payload');
    var trackingData = trackingPayloadEl ? JSON.parse(trackingPayloadEl.textContent || '{}') : {};
    var initialSelectedDocId = @json($selectedDocId);
    var activeSection = @json($activeSection);
    var activeTrackingDocId = initialSelectedDocId || '';
    var livePulseUrl = @json(route('admin.live-pulse'));

    var sidebar = document.getElementById('admin-sidebar');
    var scrim = document.getElementById('sidebar-scrim');
    var mobileMenuBtn = document.getElementById('mobile-menu-btn');
    var topTitle = document.getElementById('topbar-title');
    var topSub = document.getElementById('topbar-sub');
    var liveSyncLabel = document.getElementById('admin-live-sync-label');
    var liveSyncDot = document.getElementById('admin-live-sync-dot');

    function closeMobileMenu() {
      if (sidebar) sidebar.classList.remove('open');
      if (scrim) scrim.classList.remove('open');
    }

    if (mobileMenuBtn) {
      mobileMenuBtn.addEventListener('click', function () {
        if (sidebar) sidebar.classList.toggle('open');
        if (scrim) scrim.classList.toggle('open');
      });
    }
    if (scrim) scrim.addEventListener('click', closeMobileMenu);

    // -------------------------------------------------------------------------
    // 1. Unified Reusable Pagination Engine (Always Visible on Every Screen)
    // -------------------------------------------------------------------------
    function createPaginator(opts) {
      var page = 1;
      var perPage = opts.perPage || 15;

      function getAllRows() {
        return Array.prototype.slice.call(document.querySelectorAll(opts.rowSelector));
      }

      function render(resetToFirst) {
        if (resetToFirst) page = 1;
        var pagerEl = document.getElementById(opts.pagerId);
        var all = getAllRows();
        var matched = all.filter(function (row) {
          return opts.predicate ? opts.predicate(row) : true;
        });

        var total = matched.length;
        var totalPages = Math.max(1, Math.ceil(total / perPage));
        if (page > totalPages) page = totalPages;

        var start = (page - 1) * perPage;
        var end = start + perPage;

        all.forEach(function (row) {
          row.style.display = 'none';
        });

        matched.slice(start, end).forEach(function (row) {
          row.style.display = '';
        });

        if (!pagerEl) return;

        var shownStart = total === 0 ? 0 : start + 1;
        var shownEnd = Math.min(end, total);

        pagerEl.innerHTML = '';
        var info = document.createElement('span');
        info.className = 'pagination-info';
        info.textContent = 'Showing ' + shownStart + '–' + shownEnd + ' of ' + total + ' · Page ' + page + ' of ' + totalPages;
        pagerEl.appendChild(info);

        var controls = document.createElement('div');
        controls.className = 'pagination-controls';

        var prevBtn = document.createElement('button');
        prevBtn.type = 'button';
        prevBtn.className = 'page-btn';
        prevBtn.textContent = 'Prev';
        prevBtn.disabled = page <= 1;
        prevBtn.addEventListener('click', function () {
          if (page > 1) {
            page--;
            render(false);
          }
        });
        controls.appendChild(prevBtn);

        var maxButtons = 5;
        var pStart = Math.max(1, page - 2);
        var pEnd = Math.min(totalPages, pStart + maxButtons - 1);
        pStart = Math.max(1, pEnd - maxButtons + 1);

        for (var p = pStart; p <= pEnd; p++) {
          (function (pageNum) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'page-btn' + (pageNum === page ? ' page-btn-active' : '');
            btn.textContent = String(pageNum);
            btn.addEventListener('click', function () {
              page = pageNum;
              render(false);
            });
            controls.appendChild(btn);
          })(p);
        }

        var nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'page-btn';
        nextBtn.textContent = 'Next';
        nextBtn.disabled = page >= totalPages;
        nextBtn.addEventListener('click', function () {
          if (page < totalPages) {
            page++;
            render(false);
          }
        });
        controls.appendChild(nextBtn);

        pagerEl.appendChild(controls);
      }

      render(true);
      return { refresh: function (reset) { render(Boolean(reset)); } };
    }

    // -------------------------------------------------------------------------
    // 2. Section Navigation + URL Sync (Delegated so Live Sync preserves state)
    // -------------------------------------------------------------------------
    function activateSection(targetId, docId) {
      if (!targetId) return;
      activeSection = targetId;

      document.querySelectorAll('[data-section-target]').forEach(function (btn) {
        btn.classList.toggle('nav-item-active', btn.getAttribute('data-section-target') === targetId);
      });

      var flexPanels = ['overview', 'sessions', 'integrity', 'diagnostics'];
      document.querySelectorAll('[data-section-panel]').forEach(function (panel) {
        var id = panel.getAttribute('data-section-panel');
        if (id === targetId) {
          panel.style.display = id === 'tracking' ? 'grid' : (flexPanels.indexOf(id) !== -1 ? 'flex' : 'block');
        } else {
          panel.style.display = 'none';
        }
      });

      if (sectionMeta[targetId]) {
        if (topTitle) topTitle.textContent = sectionMeta[targetId].title;
        if (topSub) topSub.textContent = sectionMeta[targetId].sub;
      }

      if (targetId === 'tracking' && docId) {
        renderTrackingTimeline(docId);
      }

      if (window.history && window.history.replaceState) {
        var url = new URL(window.location.href);
        url.searchParams.set('section', targetId);
        if (targetId === 'tracking' && (docId || activeTrackingDocId)) {
          url.searchParams.set('doc', docId || activeTrackingDocId);
        } else if (targetId !== 'tracking') {
          url.searchParams.delete('doc');
        }
        window.history.replaceState({}, '', url.toString());
      }
      closeMobileMenu();
    }

    // -------------------------------------------------------------------------
    // 3. Mobile-Parity Connected-Dot Tracking Renderer
    // -------------------------------------------------------------------------
    function escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function renderTrackingTimeline(docId) {
      var d = trackingData[docId];
      if (!d) return;
      activeTrackingDocId = docId;

      document.querySelectorAll('[data-select-track-doc]').forEach(function (item) {
        item.classList.toggle('track-list-item-active', item.getAttribute('data-select-track-doc') === docId);
      });

      var codeEl = document.getElementById('td-code');
      if (!codeEl) return;
      codeEl.textContent = d.trackingCode;
      document.getElementById('td-format').textContent = d.copyFormat;
      document.getElementById('td-status').textContent = d.lifecycleLabel;
      document.getElementById('td-title').textContent = d.title;
      document.getElementById('td-meta').textContent =
        d.categoryName + ' · ' + d.confidentiality + ' · Idle ' + d.idleLabel;

      var stalledPill = document.getElementById('td-stalled-pill');
      if (d.isStalled) {
        stalledPill.textContent = 'Stalled · Idle ' + d.idleLabel;
        stalledPill.style.display = 'inline-flex';
      } else {
        stalledPill.style.display = 'none';
      }

      var isFinalized = d.lifecycleStatus === 'approved' || d.lifecycleStatus === 'archived';
      var alertBtn = document.getElementById('td-alert-btn');
      if (!isFinalized) {
        alertBtn.style.display = 'inline-flex';
        alertBtn.onclick = function () {
          openAlertModal({
            action: d.notifyAction,
            code: d.trackingCode,
            title: d.title,
            office: d.targetOfficeCode + ' — ' + d.targetOfficeName,
            idle: d.idleLabel,
            returnSection: 'tracking',
          });
        };
      } else {
        alertBtn.style.display = 'none';
      }

      document.getElementById('td-origin-date').textContent = d.originDate;
      document.getElementById('td-origin-code').textContent = d.originCode;
      document.getElementById('td-origin-name').textContent = d.originName;
      document.getElementById('td-current-status-note').textContent = isFinalized
        ? 'Completed'
        : d.isInTransit
          ? 'Awaiting receipt'
          : 'Held at desk';
      document.getElementById('td-current-code').textContent = d.currentCode;
      document.getElementById('td-current-name').textContent = d.currentName;
      document.getElementById('td-holder-line').innerHTML =
        'Current location: <strong>' + escapeHtml(d.currentName) + '</strong> · ' + escapeHtml(d.currentHolder);
      document.getElementById('td-last-alert-line').textContent = d.lastAlertLabel
        ? 'Last follow-up alert sent ' + d.lastAlertLabel
        : '';

      // Update horizontal progress rail styling
      var railFill = document.getElementById('td-rail-fill');
      var railNode = document.getElementById('td-rail-node');
      var railDest = document.getElementById('td-rail-dest-dot');
      railFill.className = 'track-rail-fill ' + (isFinalized ? 'track-rail-fill-done' : (d.lifecycleStatus === 'returned_for_revision' ? 'track-rail-fill-returned' : 'track-rail-fill-transit'));
      railNode.className = 'track-rail-node ' + (isFinalized ? 'track-rail-node-done' : (d.isInTransit ? 'track-rail-node-pending' : ''));
      railDest.className = 'track-rail-dot ' + (isFinalized ? 'track-rail-dot-dest-done' : 'track-rail-dot-dest');

      // Render Mobile-style vertical connected-dot timeline
      var listEl = document.getElementById('td-timeline-list');
      listEl.innerHTML = '';

      (d.timeline || []).forEach(function (ev, idx, arr) {
        var isFirst = idx === 0;
        var isLast = idx === arr.length - 1;
        var dotClass = 'tl-dot-done';
        if (ev.state === 'active') dotClass = 'tl-dot-active';
        else if (ev.state === 'pending') dotClass = 'tl-dot-pending';
        else if (ev.state === 'exception') dotClass = 'tl-dot-exception';
        else if (ev.state === 'completed') dotClass = 'tl-dot-completed';

        var row = document.createElement('div');
        row.className = 'tl-row';
        row.innerHTML =
          '<div class="tl-time">' +
            '<div class="tl-date">' + escapeHtml(ev.dateLabel) + '</div>' +
            '<div class="tl-clock">' + escapeHtml(ev.timeLabel) + '</div>' +
          '</div>' +
          '<div class="tl-axis">' +
            '<div class="tl-line-top' + (isFirst ? ' tl-line-hidden' : '') + '"></div>' +
            '<div class="tl-dot ' + dotClass + '"></div>' +
            '<div class="tl-line-bottom' + (isLast ? ' tl-line-hidden' : '') + '"></div>' +
          '</div>' +
          '<div class="tl-body">' +
            '<div class="tl-time-inline">' + escapeHtml(ev.dateLabel) + ' · ' + escapeHtml(ev.timeLabel) + '</div>' +
            '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">' +
              '<span class="tl-label">' + escapeHtml(ev.label) + '</span>' +
              (ev.dwellLabel ? '<span class="pill pill-slate" style="font-size:10.5px;">' + escapeHtml(ev.dwellLabel) + '</span>' : '') +
            '</div>' +
            '<div class="tl-office"><span class="code-tag" style="margin-right:6px;">' + escapeHtml(ev.officeCode) + '</span>' + escapeHtml(ev.officeName) + ' · ' + escapeHtml(ev.actorName) + '</div>' +
            (ev.remarks ? '<div class="tl-remarks">' + escapeHtml(ev.remarks) + '</div>' : '') +
          '</div>';
        listEl.appendChild(row);
      });
    }

    if (initialSelectedDocId && trackingData[initialSelectedDocId]) {
      renderTrackingTimeline(initialSelectedDocId);
    }

    // -------------------------------------------------------------------------
    // 4. Custom Office Toggle on Provision & Edit Personnel Modals
    // -------------------------------------------------------------------------
    function wireCustomOfficeToggle(selectId, boxId, nameInputId) {
      var sel = document.getElementById(selectId);
      var box = document.getElementById(boxId);
      var nameInput = document.getElementById(nameInputId);
      if (!sel || !box) return;
      function sync() {
        var isCustom = sel.value === '__custom__';
        box.classList.toggle('visible', isCustom);
        if (nameInput) nameInput.required = isCustom;
      }
      sel.addEventListener('change', sync);
      sync();
      return sync;
    }

    var syncProvCustom = wireCustomOfficeToggle('prov-office', 'prov-custom-office-box', 'prov-custom-name');
    var syncAdminCustom = wireCustomOfficeToggle('admin-office', 'admin-custom-office-box', 'admin-custom-name');
    var syncEditCustom = wireCustomOfficeToggle('edit-user-office', 'edit-custom-office-box', 'edit-custom-name');

    // -------------------------------------------------------------------------
    // 5. Modal Management & Event Delegation (Survives Live Sync DOM Patches)
    // -------------------------------------------------------------------------
    function openModal(id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('open');
    }

    function closeAllModals() {
      document.querySelectorAll('.modal-backdrop.open').forEach(function (m) {
        m.classList.remove('open');
      });
      if (pendingLiveSync) {
        pendingLiveSync = false;
        applyLiveDomSync();
      }
    }

    function openAlertModal(info) {
      document.getElementById('alert-office-form').action = info.action;
      document.getElementById('alert-doc-code').textContent = info.code;
      document.getElementById('alert-doc-title').textContent = info.title;
      document.getElementById('alert-target-office').textContent = info.office;
      document.getElementById('alert-idle-duration').textContent = info.idle + ' without movement';
      document.getElementById('alert-return-section').value = info.returnSection || 'overview';
      document.getElementById('alert-message-input').value = '';
      openModal('modal-alert-office');
    }

    document.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;

      var secBtn = t.closest('[data-section-target]');
      if (secBtn) { activateSection(secBtn.getAttribute('data-section-target')); return; }

      var jumpBtn = t.closest('[data-section-jump]');
      if (jumpBtn) { activateSection(jumpBtn.getAttribute('data-section-jump')); return; }

      var openTrackBtn = t.closest('[data-open-tracking]');
      if (openTrackBtn) { activateSection('tracking', openTrackBtn.getAttribute('data-open-tracking')); return; }

      var selectTrackBtn = t.closest('[data-select-track-doc]');
      if (selectTrackBtn) { renderTrackingTimeline(selectTrackBtn.getAttribute('data-select-track-doc')); return; }

      var closeModalBtn = t.closest('[data-close-modal]');
      if (closeModalBtn) { closeAllModals(); return; }

      if (t.classList && t.classList.contains('modal-backdrop')) { closeAllModals(); return; }

      var openModalBtn = t.closest('[data-open-modal]');
      if (openModalBtn) {
        var modalId = openModalBtn.getAttribute('data-open-modal');
        if (modalId === 'modal-provision-user' && syncProvCustom) syncProvCustom();
        if (modalId === 'modal-provision-admin' && syncAdminCustom) syncAdminCustom();
        openModal(modalId);
        return;
      }

      var alertBtn = t.closest('[data-alert-office]');
      if (alertBtn) {
        openAlertModal({
          action: alertBtn.getAttribute('data-action'),
          code: alertBtn.getAttribute('data-code'),
          title: alertBtn.getAttribute('data-title'),
          office: alertBtn.getAttribute('data-office'),
          idle: alertBtn.getAttribute('data-idle'),
          returnSection: alertBtn.getAttribute('data-return-section'),
        });
        return;
      }

      var editUserBtn = t.closest('[data-edit-user]');
      if (editUserBtn) {
        var targetUserId = editUserBtn.getAttribute('data-user-id') || '';
        document.getElementById('edit-user-form').action = editUserBtn.getAttribute('data-action');
        document.getElementById('edit-user-sub').textContent = 'Updating ' + editUserBtn.getAttribute('data-name');
        document.getElementById('edit-user-position').value = editUserBtn.getAttribute('data-position') || '';
        document.getElementById('edit-user-office').value = editUserBtn.getAttribute('data-office') || '';
        document.getElementById('edit-user-role').value = editUserBtn.getAttribute('data-role') || 'staff';
        document.getElementById('edit-user-availability').value = editUserBtn.getAttribute('data-availability') || 'available';
        document.getElementById('edit-user-avail-until').value = editUserBtn.getAttribute('data-availability-until') || '';
        document.getElementById('edit-user-return-section').value = editUserBtn.getAttribute('data-return-section') || 'personnel';

        var delSelect = document.getElementById('edit-user-delegate');
        if (delSelect) {
          Array.prototype.forEach.call(delSelect.options, function (opt) {
            var isSame = opt.value !== '' && opt.value === targetUserId;
            opt.hidden = isSame;
            opt.disabled = isSame;
          });
          delSelect.value = editUserBtn.getAttribute('data-delegate') || '';
        }

        document.getElementById('edit-custom-code').value = '';
        document.getElementById('edit-custom-name').value = '';
        if (syncEditCustom) syncEditCustom();
        openModal('modal-edit-user');
        return;
      }

      var reassignBtn = t.closest('[data-reassign-custody]');
      if (reassignBtn) {
        var sourceId = reassignBtn.getAttribute('data-source-id') || '';
        var sourceName = reassignBtn.getAttribute('data-source-name') || 'Employee';
        var sourceOffice = reassignBtn.getAttribute('data-source-office') || 'HQ';
        var heldCount = reassignBtn.getAttribute('data-held-count') || '0';

        document.getElementById('reassign-custody-form').action = reassignBtn.getAttribute('data-action');
        document.getElementById('reassign-sub').textContent = 'From ' + sourceName + ' (' + sourceOffice + ')';
        document.getElementById('reassign-summary-box').textContent =
          'Reassigning ' + heldCount + ' active document(s) currently held by ' + sourceName +
          ' (' + sourceOffice + '). Each document receives an immutable Admin Custody Reassignment transaction on its timeline.';
        document.getElementById('reassign-reason').value = '';

        var targetSelect = document.getElementById('reassign-target-user');
        if (targetSelect) {
          var firstValid = null;
          Array.prototype.forEach.call(targetSelect.options, function (opt) {
            var isSame = opt.value === sourceId;
            opt.hidden = isSame;
            opt.disabled = isSame;
            if (!isSame && firstValid === null) firstValid = opt.value;
          });
          if (firstValid !== null) targetSelect.value = firstValid;
        }
        openModal('modal-reassign-custody');
        return;
      }

      var slaBtn = t.closest('[data-edit-sla-policy]');
      if (slaBtn) {
        document.getElementById('sla-category-id').value = slaBtn.getAttribute('data-category-id') || '';
        document.getElementById('sla-modal-sub').textContent = slaBtn.getAttribute('data-category-label') || 'Category SLA Policy';
        document.getElementById('sla-target-hours').value = slaBtn.getAttribute('data-target-hours') || '48';
        document.getElementById('sla-stalled-hours').value = slaBtn.getAttribute('data-stalled-hours') || '24';
        document.getElementById('sla-escalation-hours').value = slaBtn.getAttribute('data-escalation-hours') || '48';
        document.getElementById('sla-escalate-office').value = slaBtn.getAttribute('data-escalate-office-id') || '';
        document.getElementById('sla-active-select').value = slaBtn.getAttribute('data-active') || '1';
        openModal('modal-sla-policy');
        return;
      }

      var resetPwdBtn = t.closest('[data-reset-password]');
      if (resetPwdBtn) {
        document.getElementById('reset-pwd-form').action = resetPwdBtn.getAttribute('data-action');
        document.getElementById('reset-pwd-sub').textContent = 'Set a new password for ' + resetPwdBtn.getAttribute('data-name') + ' and revoke active tokens.';
        document.getElementById('reset-pwd-return-section').value = resetPwdBtn.getAttribute('data-return-section') || 'personnel';
        document.getElementById('reset-pwd-input').value = '';
        openModal('modal-reset-password');
        return;
      }

      var rejectBtn = t.closest('[data-reject-user]');
      if (rejectBtn) {
        document.getElementById('reject-user-form').action = rejectBtn.getAttribute('data-action');
        document.getElementById('reject-user-sub').textContent = 'Reject registration request for ' + rejectBtn.getAttribute('data-name');
        document.getElementById('reject-reason-input').value = '';
        openModal('modal-reject-user');
        return;
      }

      var officeCreateBtn = t.closest('[data-open-office-create]');
      if (officeCreateBtn) {
        document.getElementById('office-modal-title').textContent = 'Add Office';
        document.getElementById('office-modal-submit').textContent = 'Register Office';
        document.getElementById('office-modal-form').action = '{{ route('admin.offices.create') }}';
        document.getElementById('office-modal-method').value = 'POST';
        document.getElementById('office-code-input').value = '';
        document.getElementById('office-name-input').value = '';
        openModal('modal-office');
        return;
      }

      var editOfficeBtn = t.closest('[data-edit-office]');
      if (editOfficeBtn) {
        document.getElementById('office-modal-title').textContent = 'Edit Office Details';
        document.getElementById('office-modal-submit').textContent = 'Save Office';
        document.getElementById('office-modal-form').action = editOfficeBtn.getAttribute('data-action');
        document.getElementById('office-modal-method').value = 'PATCH';
        document.getElementById('office-code-input').value = editOfficeBtn.getAttribute('data-code') || '';
        document.getElementById('office-name-input').value = editOfficeBtn.getAttribute('data-name') || '';
        openModal('modal-office');
        return;
      }

      var catCreateBtn = t.closest('[data-open-category-create]');
      if (catCreateBtn) {
        document.getElementById('cat-modal-title').textContent = 'Add Document Category';
        document.getElementById('cat-modal-submit').textContent = 'Add Category';
        document.getElementById('cat-modal-form').action = '{{ route('admin.categories.create') }}';
        document.getElementById('cat-modal-method').value = 'POST';
        document.getElementById('cat-code-input').value = '';
        document.getElementById('cat-name-input').value = '';
        openModal('modal-category');
        return;
      }

      var editCatBtn = t.closest('[data-edit-category]');
      if (editCatBtn) {
        document.getElementById('cat-modal-title').textContent = 'Edit Document Category';
        document.getElementById('cat-modal-submit').textContent = 'Save Category';
        document.getElementById('cat-modal-form').action = editCatBtn.getAttribute('data-action');
        document.getElementById('cat-modal-method').value = 'PATCH';
        document.getElementById('cat-code-input').value = editCatBtn.getAttribute('data-code') || '';
        document.getElementById('cat-name-input').value = editCatBtn.getAttribute('data-name') || '';
        openModal('modal-category');
        return;
      }

      var delCatBtn = t.closest('[data-delete-category]');
      if (delCatBtn) {
        var catId = delCatBtn.getAttribute('data-id') || '';
        var catCode = delCatBtn.getAttribute('data-code') || '';
        var catName = delCatBtn.getAttribute('data-name') || '';
        var usedCount = parseInt(delCatBtn.getAttribute('data-used-count') || '0', 10) || 0;

        document.getElementById('del-cat-form').action = delCatBtn.getAttribute('data-action');
        document.getElementById('del-cat-sub').textContent = catCode + ' — ' + catName;

        var warnEl = document.getElementById('del-cat-warning');
        var reassignWrap = document.getElementById('del-cat-reassign-wrap');
        var selectEl = document.getElementById('del-cat-replacement');

        if (usedCount > 0) {
          warnEl.textContent =
            usedCount +
            ' tracked document' +
            (usedCount === 1 ? '' : 's') +
            ' currently use "' +
            catName +
            '" (' +
            catCode +
            '). Choose a replacement category below before deleting so no records lose their classification.';
          reassignWrap.style.display = 'flex';
          var firstValid = null;
          Array.prototype.forEach.call(selectEl.options, function (opt) {
            var isSame = opt.value === catId;
            opt.hidden = isSame;
            opt.disabled = isSame;
            if (!isSame && firstValid === null) firstValid = opt.value;
          });
          if (firstValid !== null) selectEl.value = firstValid;
        } else {
          warnEl.textContent =
            'Are you sure you want to permanently delete "' +
            catName +
            '" (' +
            catCode +
            ')? No documents currently reference this category.';
          reassignWrap.style.display = 'none';
        }
        openModal('modal-delete-category');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAllModals();
    });

    // -------------------------------------------------------------------------
    // 6. Initialize Filters + Always-Visible Pagination Across ALL Screens
    // -------------------------------------------------------------------------
    var filterState = {
      admStatus: 'all',
      persStatus: 'all',
      trackFilter: 'all',
      custFilter: 'all',
      sessPlatform: 'all',
      intStatus: 'all',
      audFilter: 'all',
    };

    function bindPaginatorsAndFilters() {
      // Overview: Office Matrix + Attention Queue
      createPaginator({ rowSelector: '.overview-office-row', pagerId: 'pager-overview', perPage: 10 });
      createPaginator({ rowSelector: '.attention-item', pagerId: 'pager-attention', perPage: 6 });

      // Administrators
      var admSearch = document.getElementById('admins-search-input');
      var admPager = createPaginator({
        rowSelector: '.admin-row',
        pagerId: 'pager-admins',
        perPage: 15,
        predicate: function (row) {
          var q = admSearch ? admSearch.value.trim().toLowerCase() : '';
          var okSearch = !q || (row.getAttribute('data-search') || '').indexOf(q) !== -1;
          var okStatus = filterState.admStatus === 'all' || row.getAttribute('data-status') === filterState.admStatus;
          return okSearch && okStatus;
        },
      });
      if (admSearch) admSearch.addEventListener('input', function () { admPager.refresh(true); });
      document.querySelectorAll('[data-admin-status-filter]').forEach(function (btn) {
        btn.classList.toggle('filter-pill-active', btn.getAttribute('data-admin-status-filter') === filterState.admStatus);
        btn.addEventListener('click', function () {
          filterState.admStatus = btn.getAttribute('data-admin-status-filter');
          document.querySelectorAll('[data-admin-status-filter]').forEach(function (b) {
            b.classList.toggle('filter-pill-active', b === btn);
          });
          admPager.refresh(true);
        });
      });

      // Approvals
      var appSearch = document.getElementById('approvals-search-input');
      var appPager = createPaginator({
        rowSelector: '.approval-row',
        pagerId: 'pager-approvals',
        perPage: 15,
        predicate: function (row) {
          var q = appSearch ? appSearch.value.trim().toLowerCase() : '';
          return !q || (row.getAttribute('data-search') || '').indexOf(q) !== -1;
        },
      });
      if (appSearch) appSearch.addEventListener('input', function () { appPager.refresh(true); });

      // Personnel
      var persSearch = document.getElementById('personnel-search-input');
      var persOffice = document.getElementById('personnel-office-filter');
      var persPager = createPaginator({
        rowSelector: '.personnel-row',
        pagerId: 'pager-personnel',
        perPage: 15,
        predicate: function (row) {
          var q = persSearch ? persSearch.value.trim().toLowerCase() : '';
          var off = persOffice ? persOffice.value : 'all';
          var okSearch = !q || (row.getAttribute('data-search') || '').indexOf(q) !== -1;
          var okOffice = off === 'all' || row.getAttribute('data-office') === off;
          var okStatus = filterState.persStatus === 'all' || row.getAttribute('data-status') === filterState.persStatus;
          return okSearch && okOffice && okStatus;
        },
      });
      if (persSearch) persSearch.addEventListener('input', function () { persPager.refresh(true); });
      if (persOffice) persOffice.addEventListener('change', function () { persPager.refresh(true); });
      document.querySelectorAll('[data-status-filter]').forEach(function (btn) {
        btn.classList.toggle('filter-pill-active', btn.getAttribute('data-status-filter') === filterState.persStatus);
        btn.addEventListener('click', function () {
          filterState.persStatus = btn.getAttribute('data-status-filter');
          document.querySelectorAll('[data-status-filter]').forEach(function (b) {
            b.classList.toggle('filter-pill-active', b === btn);
          });
          persPager.refresh(true);
        });
      });

      // Offices
      var offSearch = document.getElementById('office-search-input');
      var offPager = createPaginator({
        rowSelector: '.office-item',
        pagerId: 'pager-offices',
        perPage: 12,
        predicate: function (card) {
          var q = offSearch ? offSearch.value.trim().toLowerCase() : '';
          return !q || (card.getAttribute('data-search') || '').indexOf(q) !== -1;
        },
      });
      if (offSearch) offSearch.addEventListener('input', function () { offPager.refresh(true); });

      // Document Tracking Index
      var trackSearch = document.getElementById('tracking-search-input');
      var trackPager = createPaginator({
        rowSelector: '.tracking-row',
        pagerId: 'pager-tracking',
        perPage: 10,
        predicate: function (row) {
          var q = trackSearch ? trackSearch.value.trim().toLowerCase() : '';
          var okSearch = !q || (row.getAttribute('data-search') || '').indexOf(q) !== -1;
          var okFilter = true;
          if (filterState.trackFilter === 'in_transit') okFilter = row.getAttribute('data-in-transit') === '1';
          if (filterState.trackFilter === 'stalled') okFilter = row.getAttribute('data-stalled') === '1';
          if (filterState.trackFilter === 'finalized') okFilter = row.getAttribute('data-finalized') === '1';
          return okSearch && okFilter;
        },
      });
      if (trackSearch) trackSearch.addEventListener('input', function () { trackPager.refresh(true); });
      document.querySelectorAll('[data-tracking-filter]').forEach(function (btn) {
        btn.classList.toggle('filter-pill-active', btn.getAttribute('data-tracking-filter') === filterState.trackFilter);
        btn.addEventListener('click', function () {
          filterState.trackFilter = btn.getAttribute('data-tracking-filter');
          document.querySelectorAll('[data-tracking-filter]').forEach(function (b) {
            b.classList.toggle('filter-pill-active', b === btn);
          });
          trackPager.refresh(true);
        });
      });

      // Custody & SLA
      var custSearch = document.getElementById('custody-search-input');
      var custPager = createPaginator({
        rowSelector: '.custody-row',
        pagerId: 'pager-custody',
        perPage: 15,
        predicate: function (row) {
          var q = custSearch ? custSearch.value.trim().toLowerCase() : '';
          var okSearch = !q || (row.getAttribute('data-search') || '').indexOf(q) !== -1;
          var okFilter = true;
          if (filterState.custFilter === 'stalled') okFilter = row.getAttribute('data-stalled') === '1';
          if (filterState.custFilter === 'sla_risk') okFilter = row.getAttribute('data-sla-risk') === '1';
          if (filterState.custFilter === 'in_transit') okFilter = row.getAttribute('data-in-transit') === '1';
          if (filterState.custFilter === 'finalized') okFilter = row.getAttribute('data-finalized') === '1';
          return okSearch && okFilter;
        },
      });
      if (custSearch) custSearch.addEventListener('input', function () { custPager.refresh(true); });
      document.querySelectorAll('[data-custody-filter]').forEach(function (btn) {
        btn.classList.toggle('filter-pill-active', btn.getAttribute('data-custody-filter') === filterState.custFilter);
        btn.addEventListener('click', function () {
          filterState.custFilter = btn.getAttribute('data-custody-filter');
          document.querySelectorAll('[data-custody-filter]').forEach(function (b) {
            b.classList.toggle('filter-pill-active', b === btn);
          });
          custPager.refresh(true);
        });
      });

      // Categories
      var catSearch = document.getElementById('categories-search-input');
      var catPager = createPaginator({
        rowSelector: '.category-row',
        pagerId: 'pager-categories',
        perPage: 15,
        predicate: function (row) {
          var q = catSearch ? catSearch.value.trim().toLowerCase() : '';
          return !q || (row.getAttribute('data-search') || '').indexOf(q) !== -1;
        },
      });
      if (catSearch) catSearch.addEventListener('input', function () { catPager.refresh(true); });

      // Per-Category SLA & Escalation Policies
      var slaSearch = document.getElementById('sla-search-input');
      var slaPager = createPaginator({
        rowSelector: '.sla-policy-row',
        pagerId: 'pager-sla-policies',
        perPage: 15,
        predicate: function (row) {
          var q = slaSearch ? slaSearch.value.trim().toLowerCase() : '';
          return !q || (row.getAttribute('data-search') || '').indexOf(q) !== -1;
        },
      });
      if (slaSearch) slaSearch.addEventListener('input', function () { slaPager.refresh(true); });

      // Active Sanctum Device Sessions
      var sessSearch = document.getElementById('sessions-search-input');
      var sessPager = createPaginator({
        rowSelector: '.session-row',
        pagerId: 'pager-sessions',
        perPage: 15,
        predicate: function (row) {
          var q = sessSearch ? sessSearch.value.trim().toLowerCase() : '';
          var okSearch = !q || (row.getAttribute('data-search') || '').indexOf(q) !== -1;
          var okPlatform = filterState.sessPlatform === 'all' || row.getAttribute('data-platform') === filterState.sessPlatform;
          return okSearch && okPlatform;
        },
      });
      if (sessSearch) sessSearch.addEventListener('input', function () { sessPager.refresh(true); });
      document.querySelectorAll('[data-session-platform]').forEach(function (btn) {
        btn.classList.toggle('filter-pill-active', btn.getAttribute('data-session-platform') === filterState.sessPlatform);
        btn.addEventListener('click', function () {
          filterState.sessPlatform = btn.getAttribute('data-session-platform');
          document.querySelectorAll('[data-session-platform]').forEach(function (b) {
            b.classList.toggle('filter-pill-active', b === btn);
          });
          sessPager.refresh(true);
        });
      });

      // File Integrity & Storage Health Verifier
      var intSearch = document.getElementById('integrity-search-input');
      var intPager = createPaginator({
        rowSelector: '.integrity-row',
        pagerId: 'pager-integrity',
        perPage: 12,
        predicate: function (row) {
          var q = intSearch ? intSearch.value.trim().toLowerCase() : '';
          var okSearch = !q || (row.getAttribute('data-search') || '').indexOf(q) !== -1;
          var okStatus = filterState.intStatus === 'all' || row.getAttribute('data-status') === filterState.intStatus;
          return okSearch && okStatus;
        },
      });
      if (intSearch) intSearch.addEventListener('input', function () { intPager.refresh(true); });
      document.querySelectorAll('[data-integrity-status]').forEach(function (btn) {
        btn.classList.toggle('filter-pill-active', btn.getAttribute('data-integrity-status') === filterState.intStatus);
        btn.addEventListener('click', function () {
          filterState.intStatus = btn.getAttribute('data-integrity-status');
          document.querySelectorAll('[data-integrity-status]').forEach(function (b) {
            b.classList.toggle('filter-pill-active', b === btn);
          });
          intPager.refresh(true);
        });
      });
      createPaginator({ rowSelector: '.office-storage-row', pagerId: 'pager-office-storage', perPage: 10 });

      // Real-Time Delivery & Push Diagnostics
      var tokSearch = document.getElementById('tokens-search-input');
      var tokPager = createPaginator({
        rowSelector: '.push-token-row',
        pagerId: 'pager-push-tokens',
        perPage: 10,
        predicate: function (row) {
          var q = tokSearch ? tokSearch.value.trim().toLowerCase() : '';
          return !q || (row.getAttribute('data-search') || '').indexOf(q) !== -1;
        },
      });
      if (tokSearch) tokSearch.addEventListener('input', function () { tokPager.refresh(true); });
      createPaginator({ rowSelector: '.push-log-row', pagerId: 'pager-push-logs', perPage: 10 });

      // Audit Ledger
      var audSearch = document.getElementById('audit-search-input');
      var audPager = createPaginator({
        rowSelector: '.audit-row',
        pagerId: 'pager-audit',
        perPage: 15,
        predicate: function (row) {
          var q = audSearch ? audSearch.value.trim().toLowerCase() : '';
          var okSearch = !q || (row.getAttribute('data-search') || '').indexOf(q) !== -1;
          var okFilter = filterState.audFilter === 'all' || row.getAttribute('data-cat') === filterState.audFilter;
          return okSearch && okFilter;
        },
      });
      if (audSearch) audSearch.addEventListener('input', function () { audPager.refresh(true); });
      document.querySelectorAll('[data-audit-filter]').forEach(function (btn) {
        btn.classList.toggle('filter-pill-active', btn.getAttribute('data-audit-filter') === filterState.audFilter);
        btn.addEventListener('click', function () {
          filterState.audFilter = btn.getAttribute('data-audit-filter');
          document.querySelectorAll('[data-audit-filter]').forEach(function (b) {
            b.classList.toggle('filter-pill-active', b === btn);
          });
          audPager.refresh(true);
        });
      });
    }

    bindPaginatorsAndFilters();

    // -------------------------------------------------------------------------
    // 7. Zero-Refresh Real-Time Live Sync Engine (Polls /admin/live-pulse)
    // -------------------------------------------------------------------------
    var lastPulseCursor = 0;
    var lastPulseFingerprint = '';
    var pendingLiveSync = false;
    var syncingDom = false;
    var searchInputIds = [
      'admins-search-input',
      'approvals-search-input',
      'personnel-search-input',
      'personnel-office-filter',
      'office-search-input',
      'tracking-search-input',
      'custody-search-input',
      'categories-search-input',
      'sla-search-input',
      'sessions-search-input',
      'integrity-search-input',
      'tokens-search-input',
      'audit-search-input',
    ];

    function isSafeToPatchDom() {
      if (document.querySelector('.modal-backdrop.open')) return false;
      var active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
        return false;
      }
      return true;
    }

    function applyLiveDomSync() {
      if (syncingDom) return;
      if (!isSafeToPatchDom()) {
        pendingLiveSync = true;
        if (liveSyncLabel) liveSyncLabel.textContent = 'Live Sync · Pending';
        return;
      }
      syncingDom = true;
      var savedInputs = {};
      searchInputIds.forEach(function (id) {
        var el = document.getElementById(id);
        if (el) savedInputs[id] = el.value;
      });
      var scrollY = window.scrollY || 0;

      var fetchUrl = new URL(window.location.href);
      fetchUrl.searchParams.set('section', activeSection);
      if (activeSection === 'tracking' && activeTrackingDocId) {
        fetchUrl.searchParams.set('doc', activeTrackingDocId);
      }

      fetch(fetchUrl.toString(), {
        credentials: 'same-origin',
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
      })
        .then(function (resp) {
          if (!resp.ok || resp.redirected) return null;
          return resp.text();
        })
        .then(function (html) {
          if (!html || !isSafeToPatchDom()) {
            if (html) pendingLiveSync = true;
            return;
          }
          var parser = new DOMParser();
          var nextDoc = parser.parseFromString(html, 'text/html');
          var nextContent = nextDoc.querySelector('.admin-content');
          var currContent = document.querySelector('.admin-content');
          var nextNav = nextDoc.querySelector('.sidebar-nav');
          var currNav = document.querySelector('.sidebar-nav');
          var nextPayload = nextDoc.getElementById('admin-tracking-payload');

          if (nextPayload) {
            try {
              trackingData = JSON.parse(nextPayload.textContent || '{}');
            } catch (_e) {}
          }
          if (nextNav && currNav) {
            currNav.innerHTML = nextNav.innerHTML;
          }
          if (nextContent && currContent) {
            currContent.innerHTML = nextContent.innerHTML;
          }

          searchInputIds.forEach(function (id) {
            var el = document.getElementById(id);
            if (el && savedInputs[id] !== undefined) {
              el.value = savedInputs[id];
            }
          });

          activateSection(activeSection, activeTrackingDocId);
          bindPaginatorsAndFilters();
          if (activeTrackingDocId && trackingData[activeTrackingDocId]) {
            renderTrackingTimeline(activeTrackingDocId);
          }
          window.scrollTo(0, scrollY);

          if (liveSyncLabel) {
            liveSyncLabel.textContent = 'Live Sync · Updated';
            setTimeout(function () {
              if (liveSyncLabel && !pendingLiveSync) liveSyncLabel.textContent = 'Live Sync';
            }, 2200);
          }
        })
        .catch(function () {
          // Transient network error — retry on next pulse
        })
        .finally(function () {
          syncingDom = false;
        });
    }

    function pollAdminLivePulse() {
      if (document.hidden) return;
      if (pendingLiveSync && isSafeToPatchDom()) {
        pendingLiveSync = false;
        applyLiveDomSync();
        return;
      }
      fetch(livePulseUrl + '?since=' + encodeURIComponent(String(lastPulseCursor)), {
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      })
        .then(function (resp) {
          if (resp.status === 401) return null;
          if (!resp.ok) throw new Error('pulse_failed');
          return resp.json();
        })
        .then(function (data) {
          if (!data) return;
          var nextCursor = Number(data.cursor || 0);
          var nextFp = String(data.fingerprint || '');
          var initialized = lastPulseFingerprint !== '';
          var changed =
            initialized &&
            (nextCursor > lastPulseCursor || (nextFp !== '' && nextFp !== lastPulseFingerprint));

          lastPulseCursor = Math.max(lastPulseCursor, nextCursor);
          if (nextFp) lastPulseFingerprint = nextFp;
          if (liveSyncDot) liveSyncDot.style.background = '#10B981';

          if (changed) {
            applyLiveDomSync();
          }
        })
        .catch(function () {
          if (liveSyncDot) liveSyncDot.style.background = '#F59E0B';
        });
    }

    document.addEventListener('focusout', function () {
      if (pendingLiveSync) {
        setTimeout(function () {
          if (pendingLiveSync && isSafeToPatchDom()) {
            pendingLiveSync = false;
            applyLiveDomSync();
          }
        }, 180);
      }
    });

    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        pollAdminLivePulse();
      }
    });

    // Seed initial fingerprint immediately, then poll every 4 seconds
    pollAdminLivePulse();
    setInterval(pollAdminLivePulse, 4000);

    // Auto-dismiss flash toast after 5s
    var toast = document.getElementById('admin-toast');
    if (toast) {
      setTimeout(function () {
        if (toast && toast.parentElement) toast.remove();
      }, 5000);
    }
  })();
</script>
@endsection
