<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="csrf-token" content="{{ csrf_token() }}" />
  <title>@yield('title', 'Tracely Admin · Document Governance Portal')</title>
  <link rel="icon" type="image/png" href="{{ asset('images/tracely-logo.png') }}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap"
    rel="stylesheet"
  />
  <style>
    :root {
      /* Exact Tracely Web & Mobile Design Tokens */
      --navy: #0D3472;
      --navy-mid: #164A9E;
      --navy-deep: #09234D;
      --navy-ink: #0D1B3E;
      --amber: #F3B32A;
      --amber-hover: #E5A41C;
      --amber-soft: #FEF3C7;
      --amber-border: #FDE68A;
      --amber-text: #92400E;
      --teal: #0F766E;
      --teal-dot: #0D9488;
      --teal-soft: #CCFBF1;
      --teal-border: #99F6E4;
      --teal-text: #115E59;

      /* Semantic Status Pills */
      --sky-soft: #EFF6FF;
      --sky-border: #BFDBFE;
      --sky-text: #1D4ED8;
      --emerald: #15803D;
      --emerald-soft: #DCFCE7;
      --emerald-border: #BBF7D0;
      --emerald-text: #166534;
      --rose: #DC2626;
      --rose-soft: #FEE2E2;
      --rose-border: #FECACA;
      --rose-text: #991B1B;

      /* Surfaces & Typography */
      --bg: #F8FAFC;
      --surface: #FFFFFF;
      --surface-soft: #F4F6FA;
      --surface-muted: #F8FAFC;
      --border: #E5E7EB;
      --border-strong: #CBD5E1;
      --text-primary: #0F172A;
      --text-secondary: #475569;
      --text-muted: #64748B;

      /* Radii & Elevation */
      --radius-sm: 8px;
      --radius-input: 10px;
      --radius-md: 12px;
      --radius-card: 16px;
      --radius-pill: 999px;
      --shadow-xs: 0 1px 2px rgba(15, 23, 42, 0.04);
      --shadow-modal: 0 20px 52px rgba(9, 35, 77, 0.18);
      --focus-ring: 0 0 0 3px rgba(13, 52, 114, 0.14);

      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      min-height: 100%;
      max-width: 100%;
      overflow-x: clip;
      background: var(--bg);
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: 14px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
    }

    .brand-logo-img {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      object-fit: contain;
      display: block;
      flex-shrink: 0;
      box-shadow: 0 2px 6px rgba(9, 35, 77, 0.14);
    }

    .brand-logo-lg {
      width: 46px;
      height: 46px;
      border-radius: 12px;
      object-fit: contain;
      display: block;
      flex-shrink: 0;
      box-shadow: 0 4px 12px rgba(9, 35, 77, 0.25);
    }

    button,
    input,
    select,
    textarea {
      font: inherit;
    }

    button {
      cursor: pointer;
    }

    button:focus-visible,
    a:focus-visible,
    input:focus-visible,
    select:focus-visible {
      outline: none;
      box-shadow: var(--focus-ring);
    }

    .mono {
      font-family: var(--font-mono);
      font-variant-numeric: tabular-nums;
    }

    .tabular {
      font-variant-numeric: tabular-nums;
    }

    /* ---------- Admin Workspace Shell (Mirrors Tracely WebShell) ---------- */
    .admin-shell {
      display: flex;
      min-height: 100vh;
      background: var(--bg);
    }

    .admin-sidebar-scrim {
      display: none;
    }

    .admin-sidebar {
      width: 252px;
      background: var(--surface);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      padding: 16px 12px;
      gap: 12px;
      position: sticky;
      top: 0;
      height: 100vh;
      z-index: 30;
      flex-shrink: 0;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 11px;
      padding: 2px 6px 14px;
      border-bottom: 1px solid var(--border);
      text-decoration: none;
      color: inherit;
    }

    .sidebar-brand-title {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -0.015em;
      color: var(--text-primary);
      line-height: 1.2;
    }

    .sidebar-brand-sub {
      margin: 2px 0 0;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      line-height: 1.2;
    }

    .sidebar-nav {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      overflow-y: auto;
    }

    .sidebar-section-label {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: var(--text-muted);
      padding: 12px 10px 4px;
    }

    .sidebar-section-label:first-child {
      padding-top: 2px;
    }

    .nav-item {
      width: 100%;
      min-height: 39px;
      border: 0;
      background: transparent;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 8px 11px;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: 500;
      text-align: left;
      text-decoration: none;
      transition: background-color 120ms ease, color 120ms ease;
    }

    .nav-item:hover {
      background: var(--surface-soft);
      color: var(--text-primary);
    }

    .nav-item-active {
      background: var(--sky-soft);
      color: var(--navy);
      font-weight: 600;
    }

    .nav-item-active:hover {
      background: var(--sky-soft);
      color: var(--navy);
    }

    .nav-item-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .nav-item-left svg {
      flex-shrink: 0;
      opacity: 0.85;
    }

    .nav-item-active .nav-item-left svg {
      opacity: 1;
      color: var(--navy);
    }

    .nav-badge {
      min-width: 20px;
      height: 20px;
      border-radius: var(--radius-pill);
      padding: 0 6px;
      background: var(--surface-soft);
      color: var(--text-secondary);
      font-size: 11px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .nav-badge-amber {
      background: var(--amber-soft);
      color: var(--amber-text);
    }

    .nav-badge-rose {
      background: var(--rose-soft);
      color: var(--rose-text);
    }

    .nav-item-active .nav-badge {
      background: var(--navy);
      color: #ffffff;
    }

    .sidebar-footer {
      border-top: 1px solid var(--border);
      padding-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .sidebar-actor-card {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 9px;
      border-radius: 10px;
      background: var(--surface-soft);
    }

    .sidebar-actor-name {
      font-size: 12.5px;
      font-weight: 700;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sidebar-actor-meta {
      font-size: 11px;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ---------- Main Content & Sticky Topbar ---------- */
    .admin-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .admin-topbar {
      height: 62px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      padding: 0 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      position: sticky;
      top: 0;
      z-index: 20;
    }

    .topbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }

    .mobile-menu-btn {
      display: none;
      border: 1px solid var(--border);
      background: var(--surface);
      width: 36px;
      height: 36px;
      border-radius: 10px;
      align-items: center;
      justify-content: center;
      color: var(--text-primary);
      flex-shrink: 0;
    }

    .topbar-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      letter-spacing: -0.015em;
      color: var(--text-primary);
    }

    .topbar-sub {
      margin: 1px 0 0;
      font-size: 12px;
      color: var(--text-muted);
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-shrink: 0;
    }

    .status-indicator {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 6px 11px;
      border-radius: var(--radius-pill);
      background: var(--surface-soft);
      border: 1px solid var(--border);
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 999px;
      background: var(--teal-dot);
    }

    .admin-content {
      width: 100%;
      max-width: 1320px;
      margin: 0 auto;
      padding: 24px 28px 56px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* ---------- Unified Metric Strip (Clean, Zero Clutter) ---------- */
    .kpi-strip {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-xs);
      overflow: hidden;
    }

    .kpi-cell {
      padding: 20px 22px;
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 6px;
      height: 100%;
      background: var(--surface);
      transition: background-color 120ms ease;
    }

    .kpi-cell:last-child {
      border-right: none;
    }

    .kpi-cell-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 24px;
    }

    .kpi-label {
      font-size: 12.5px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    .kpi-value {
      font-size: 28px;
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.15;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
      margin-top: 2px;
    }

    .kpi-meta {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.4;
    }

    .kpi-action {
      margin-top: auto;
      padding: 6px 0 0;
      border: 0;
      background: transparent;
      color: var(--navy);
      font-size: 12px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      align-self: flex-start;
    }

    .kpi-action:hover {
      text-decoration: underline;
    }

    /* ---------- Surface Cards & Grids (Aligned Equal-Height Containers) ---------- */
    .split-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(320px, 1fr);
      gap: 20px;
      align-items: stretch;
    }

    .surface-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-card);
      box-shadow: var(--shadow-xs);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .split-grid > .surface-card,
    .tracking-workspace > .surface-card {
      height: 100%;
    }

    .card-header {
      padding: 16px 20px;
      min-height: 76px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .card-header > div:first-child {
      min-width: 0;
    }

    .split-grid .table-scroll,
    .split-grid .empty-state,
    .split-grid #attention-list,
    .tracking-workspace #tracking-doc-list {
      flex: 1;
    }

    .card-title {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--text-primary);
    }

    .card-subtitle {
      margin: 2px 0 0;
      font-size: 12.5px;
      color: var(--text-muted);
    }

    .card-toolbar {
      padding: 12px 20px;
      border-bottom: 1px solid var(--border);
      background: var(--surface-muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
    }

    .card-body {
      padding: 18px 20px;
    }

    /* ---------- Clean Enterprise Data Tables ---------- */
    .table-scroll {
      width: 100%;
      overflow-x: auto;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .data-table th {
      text-align: left;
      padding: 10px 16px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--text-muted);
      background: var(--surface-muted);
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }

    .data-table td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
      color: var(--text-primary);
    }

    .data-table tbody tr:last-child td {
      border-bottom: none;
    }

    .data-table tbody tr:hover {
      background: var(--surface-muted);
    }

    .num-col {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    /* ---------- Buttons, Inputs, Search & Pills ---------- */
    .btn {
      min-height: 36px;
      border-radius: 10px;
      padding: 7px 14px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid transparent;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      text-decoration: none;
      white-space: nowrap;
      transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
    }

    .btn-sm {
      min-height: 31px;
      padding: 4px 10px;
      font-size: 12px;
      border-radius: 8px;
    }

    .btn-primary {
      background: var(--navy);
      color: #ffffff;
    }

    .btn-primary:hover {
      background: var(--navy-deep);
    }

    .btn-secondary {
      background: var(--surface);
      border-color: var(--border-strong);
      color: var(--text-primary);
    }

    .btn-secondary:hover {
      background: var(--surface-soft);
      border-color: #94a3b8;
    }

    .btn-ghost {
      background: transparent;
      color: var(--text-secondary);
    }

    .btn-ghost:hover {
      background: var(--surface-soft);
      color: var(--text-primary);
    }

    .btn-danger {
      background: var(--surface);
      border-color: var(--rose-border);
      color: var(--rose-text);
    }

    .btn-danger:hover {
      background: var(--rose-soft);
    }

    .input,
    .select {
      height: 38px;
      border-radius: var(--radius-input);
      border: 1px solid var(--border-strong);
      background: var(--surface);
      color: var(--text-primary);
      font-size: 13.5px;
      padding: 0 12px;
      outline: none;
      transition: border-color 120ms ease, box-shadow 120ms ease;
    }

    .input:focus,
    .select:focus {
      border-color: var(--navy);
      box-shadow: var(--focus-ring);
    }

    .search-field {
      position: relative;
      display: inline-flex;
      align-items: center;
      flex: 1;
      min-width: 220px;
      max-width: 360px;
    }

    .search-field svg {
      position: absolute;
      left: 11px;
      color: var(--text-muted);
      pointer-events: none;
    }

    .search-field .input {
      width: 100%;
      padding-left: 34px;
      height: 36px;
      font-size: 13px;
      border-color: var(--border);
      background: var(--surface);
    }

    .filter-pills {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }

    .filter-pill {
      height: 32px;
      padding: 0 12px;
      border-radius: var(--radius-pill);
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-secondary);
      font-size: 12px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 120ms ease;
    }

    .filter-pill:hover {
      border-color: var(--border-strong);
      color: var(--text-primary);
    }

    .filter-pill-active {
      background: var(--navy);
      border-color: var(--navy);
      color: #ffffff !important;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      border-radius: var(--radius-pill);
      padding: 2px 9px;
      font-size: 11.5px;
      font-weight: 600;
      border: 1px solid transparent;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .pill-navy {
      background: var(--sky-soft);
      border-color: var(--sky-border);
      color: var(--navy);
    }

    .pill-emerald {
      background: var(--emerald-soft);
      border-color: var(--emerald-border);
      color: var(--emerald-text);
    }

    .pill-amber {
      background: var(--amber-soft);
      border-color: var(--amber-border);
      color: var(--amber-text);
    }

    .pill-rose {
      background: var(--rose-soft);
      border-color: var(--rose-border);
      color: var(--rose-text);
    }

    .pill-slate {
      background: var(--surface-soft);
      border-color: var(--border);
      color: var(--text-secondary);
    }

    .code-tag {
      display: inline-flex;
      align-items: center;
      padding: 2px 7px;
      border-radius: 6px;
      background: var(--surface-soft);
      border: 1px solid var(--border);
      color: var(--navy-ink);
      font-family: var(--font-mono);
      font-size: 11.5px;
      font-weight: 600;
    }

    .avatar-circle {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      color: #ffffff;
      background: var(--navy);
      flex-shrink: 0;
    }

    .avail-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      border-radius: 999px;
      margin-right: 5px;
    }

    .avail-available { background: var(--emerald); }
    .avail-official_business { background: var(--navy-mid); }
    .avail-on_leave { background: var(--amber); }

    /* ---------- List Rows (Action Queue, Taxonomy) ---------- */
    .list-row {
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }

    .list-row:last-child {
      border-bottom: none;
    }

    .list-row:hover {
      background: var(--surface-muted);
    }

    /* ---------- Empty State ---------- */
    .empty-state {
      padding: 40px 24px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .empty-icon {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: var(--surface-soft);
      border: 1px solid var(--border);
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .empty-title {
      margin: 4px 0 0;
      font-size: 14.5px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .empty-desc {
      margin: 0;
      max-width: 360px;
      font-size: 13px;
      color: var(--text-muted);
    }

    /* ---------- Modal Dialogs (Clean White Institutional Layer) ---------- */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 60;
      background: rgba(9, 35, 77, 0.36);
      backdrop-filter: blur(2px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .modal-backdrop.open {
      display: flex;
    }

    .modal-panel {
      width: 100%;
      max-width: 500px;
      max-height: 90vh;
      overflow-y: auto;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 18px;
      box-shadow: var(--shadow-modal);
      display: flex;
      flex-direction: column;
    }

    .modal-header {
      padding: 18px 22px 14px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .modal-title {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .modal-sub {
      margin: 3px 0 0;
      font-size: 12.5px;
      color: var(--text-muted);
    }

    .modal-close {
      border: 0;
      background: var(--surface-soft);
      color: var(--text-secondary);
      width: 30px;
      height: 30px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .modal-close:hover {
      background: var(--border);
      color: var(--text-primary);
    }

    .modal-body {
      padding: 18px 22px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .modal-footer {
      padding: 14px 22px;
      border-top: 1px solid var(--border);
      background: var(--surface-muted);
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }

    .field-grid-2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .field-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .field-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-secondary);
    }

    /* ---------- Flash Toast ---------- */
    .toast-banner {
      position: fixed;
      right: 22px;
      bottom: 22px;
      z-index: 70;
      max-width: 420px;
      padding: 12px 16px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      font-weight: 600;
      box-shadow: var(--shadow-modal);
      color: #ffffff;
      background: var(--navy-deep);
    }

    .toast-success {
      background: var(--emerald);
    }

    .toast-error {
      background: var(--rose);
    }

    .toast-dismiss {
      border: 0;
      background: transparent;
      color: rgba(255, 255, 255, 0.85);
      padding: 2px;
      display: inline-flex;
      margin-left: auto;
    }

    /* ---------- Office Directory Grid ---------- */
    .office-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
      gap: 14px;
      align-items: stretch;
    }

    .office-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 100%;
      transition: border-color 120ms ease;
    }

    .office-card:hover {
      border-color: var(--border-strong);
    }

    .office-metrics {
      margin-top: auto;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
    }

    .office-metric-val {
      font-size: 16px;
      font-weight: 700;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
      display: block;
    }

    .office-metric-label {
      font-size: 11px;
      color: var(--text-muted);
      display: block;
    }

    /* ---------- Always-Visible Pagination Footer Bar ---------- */
    .pagination-bar {
      margin-top: auto;
      padding: 12px 20px;
      border-top: 1px solid var(--border);
      background: var(--surface-muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }

    .pagination-info {
      font-size: 12.5px;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }

    .pagination-controls {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .page-btn {
      min-width: 32px;
      height: 32px;
      padding: 0 9px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-secondary);
      font-size: 12.5px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 120ms ease;
    }

    .page-btn:hover:not(:disabled) {
      border-color: var(--border-strong);
      color: var(--text-primary);
      background: var(--surface-soft);
    }

    .page-btn:disabled {
      opacity: 0.42;
      cursor: not-allowed;
    }

    .page-btn-active {
      background: var(--navy) !important;
      border-color: var(--navy) !important;
      color: #ffffff !important;
    }

    /* ---------- Custom Office Nested Form Box ---------- */
    .custom-office-box {
      padding: 12px 14px;
      border-radius: 12px;
      background: var(--surface-soft);
      border: 1px dashed var(--border-strong);
      display: none;
      flex-direction: column;
      gap: 10px;
    }

    .custom-office-box.visible {
      display: flex;
    }

    /* ---------- Mobile-Parity Connected-Dot Tracking Workspace ---------- */
    .tracking-workspace {
      display: grid;
      grid-template-columns: minmax(300px, 390px) minmax(0, 1fr);
      gap: 20px;
      align-items: stretch;
    }

    .track-list-item {
      width: 100%;
      border: 0;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      padding: 14px 18px;
      text-align: left;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: background-color 120ms ease;
    }

    .track-list-item:last-child {
      border-bottom: none;
    }

    .track-list-item:hover {
      background: var(--surface-muted);
    }

    .track-list-item-active {
      background: var(--sky-soft) !important;
      box-shadow: inset 3px 0 0 var(--navy);
    }

    /* Mobile-style Horizontal Progress Rail */
    .track-rail-box {
      padding: 18px 20px;
      border-radius: 14px;
      background: var(--surface-soft);
      border: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .track-endpoints {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
    }

    .track-ep-code {
      font-family: var(--font-mono);
      font-size: 15px;
      font-weight: 700;
      color: var(--text-primary);
    }

    .track-ep-meta {
      font-size: 11.5px;
      color: var(--text-muted);
      margin-bottom: 2px;
    }

    .track-rail-track {
      position: relative;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .track-rail-bg {
      position: absolute;
      left: 8px;
      right: 8px;
      height: 3px;
      border-radius: 999px;
      background: var(--border-strong);
    }

    .track-rail-fill {
      position: absolute;
      left: 8px;
      height: 3px;
      border-radius: 999px;
      background: var(--navy);
    }

    .track-rail-fill-done {
      right: 8px;
      background: var(--emerald);
    }

    .track-rail-fill-transit {
      width: 52%;
      background: var(--navy);
    }

    .track-rail-fill-returned {
      width: 52%;
      background: var(--amber);
    }

    .track-rail-dot {
      position: relative;
      z-index: 2;
      width: 12px;
      height: 12px;
      border-radius: 999px;
      background: var(--navy);
      border: 2.5px solid var(--surface);
      box-shadow: 0 0 0 1px var(--navy);
    }

    .track-rail-dot-dest {
      background: var(--surface);
      border: 2.5px solid var(--border-strong);
      box-shadow: none;
    }

    .track-rail-dot-dest-done {
      background: var(--emerald);
      border: 2.5px solid var(--surface);
      box-shadow: 0 0 0 1px var(--emerald);
    }

    .track-rail-node {
      position: relative;
      z-index: 2;
      width: 28px;
      height: 28px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--navy);
      color: #ffffff;
      border: 2.5px solid var(--surface);
      box-shadow: 0 2px 8px rgba(13, 52, 114, 0.25);
    }

    .track-rail-node-done {
      background: var(--emerald);
    }

    .track-rail-node-pending {
      background: var(--amber);
      color: var(--navy-ink);
    }

    /* Mobile-style Vertical Connected-Dot Timeline */
    .tl-list {
      display: flex;
      flex-direction: column;
      padding: 6px 0;
    }

    .tl-row {
      display: grid;
      grid-template-columns: 78px 28px minmax(0, 1fr);
      gap: 12px;
      min-height: 70px;
    }

    .tl-time {
      padding-top: 2px;
      text-align: right;
    }

    .tl-date {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }

    .tl-clock {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 1px;
    }

    .tl-axis {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .tl-line-top {
      width: 2px;
      height: 8px;
      background: var(--border-strong);
    }

    .tl-line-bottom {
      width: 2px;
      flex: 1;
      min-height: 28px;
      background: var(--border-strong);
    }

    .tl-line-hidden {
      background: transparent;
    }

    .tl-dot {
      width: 12px;
      height: 12px;
      border-radius: 999px;
      flex-shrink: 0;
      margin: 2px 0;
    }

    .tl-dot-done {
      background: var(--navy);
      border: 2px solid var(--surface);
      box-shadow: 0 0 0 1.5px var(--navy);
    }

    .tl-dot-active {
      width: 14px;
      height: 14px;
      background: var(--teal);
      border: 2.5px solid var(--surface);
      box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.18);
    }

    .tl-dot-pending {
      width: 14px;
      height: 14px;
      background: var(--amber);
      border: 2.5px solid var(--surface);
      box-shadow: 0 0 0 4px rgba(243, 179, 42, 0.24);
    }

    .tl-dot-exception {
      width: 13px;
      height: 13px;
      background: var(--rose);
      border: 2px solid var(--surface);
      box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.16);
    }

    .tl-dot-completed {
      width: 14px;
      height: 14px;
      background: var(--emerald);
      border: 2.5px solid var(--surface);
      box-shadow: 0 0 0 4px rgba(21, 128, 61, 0.18);
    }

    .tl-body {
      padding: 0 0 18px;
    }

    .tl-label {
      font-size: 13.5px;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.35;
    }

    .tl-office {
      font-size: 12.5px;
      color: var(--text-secondary);
      margin-top: 2px;
    }

    .tl-remarks {
      margin-top: 5px;
      padding: 6px 10px;
      border-radius: 8px;
      background: var(--surface-soft);
      border: 1px solid var(--border);
      font-size: 12px;
      color: var(--text-secondary);
      display: inline-block;
    }

    .tl-time-inline {
      display: none;
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 3px;
    }

    .btn-amber-soft {
      background: var(--amber-soft);
      border-color: var(--amber-border);
      color: var(--amber-text);
    }

    .btn-amber-soft:hover {
      background: #fde68a;
    }

    /* ---------- Responsive Breakpoints (Desktop → Tablet → Mobile 320px+) ---------- */
    @media (max-width: 1120px) {
      .kpi-strip {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .kpi-cell {
        border-bottom: 1px solid var(--border);
      }
      .kpi-cell:nth-child(2n) {
        border-right: none;
      }
      .kpi-cell:nth-last-child(-n+2) {
        border-bottom: none;
      }
      .split-grid,
      .tracking-workspace {
        grid-template-columns: 1fr;
        align-items: start;
      }
      .split-grid > .surface-card,
      .tracking-workspace > .surface-card {
        height: auto;
      }
    }

    @media (max-width: 920px) {
      .mobile-menu-btn {
        display: inline-flex;
      }
      .admin-sidebar {
        position: fixed;
        top: 0;
        bottom: 0;
        left: -272px;
        width: 260px;
        max-width: 84vw;
        transition: left 180ms ease;
        box-shadow: var(--shadow-modal);
      }
      .admin-sidebar.open {
        left: 0;
      }
      .admin-sidebar-scrim.open {
        display: block;
        position: fixed;
        inset: 0;
        z-index: 25;
        background: rgba(9, 35, 77, 0.36);
      }
      .admin-topbar {
        height: auto;
        min-height: 60px;
        padding: 10px 16px;
        gap: 10px;
      }
      .admin-content {
        padding: 16px 16px 44px;
        gap: 16px;
      }
      .status-indicator {
        display: none;
      }
    }

    @media (max-width: 680px) {
      .admin-topbar {
        flex-wrap: wrap;
        padding: 10px 14px;
      }
      .topbar-left {
        flex: 1 1 auto;
      }
      .topbar-right {
        width: 100%;
        justify-content: flex-end;
      }
      .topbar-right .btn {
        flex: 1 1 auto;
        justify-content: center;
      }
      .topbar-sub {
        display: none;
      }
      .card-header {
        padding: 14px 16px;
        min-height: 0;
      }
      .card-toolbar {
        padding: 12px 14px;
        flex-direction: column;
        align-items: stretch;
      }
      .card-toolbar > div {
        width: 100%;
      }
      .search-field {
        min-width: 0;
        max-width: none;
        width: 100%;
      }
      .card-toolbar .select {
        width: 100%;
      }
      .card-body {
        padding: 14px 16px;
      }
      .data-table th,
      .data-table td {
        padding: 10px 12px;
      }
      .list-row {
        padding: 12px 14px;
        flex-direction: column;
        align-items: stretch;
        gap: 10px;
      }
      .list-row > form,
      .list-row > div:last-child {
        align-self: flex-start;
      }
      .office-grid {
        grid-template-columns: 1fr;
      }
      .pagination-bar {
        flex-direction: column;
        align-items: center;
        text-align: center;
        padding: 12px 14px;
        gap: 8px;
      }
      .pagination-controls {
        flex-wrap: wrap;
        justify-content: center;
      }
      .modal-backdrop {
        align-items: flex-end;
        padding: 0;
      }
      .modal-panel {
        max-width: none !important;
        max-height: 92vh;
        border-radius: 18px 18px 0 0;
        border-left: 0;
        border-right: 0;
        border-bottom: 0;
      }
      .modal-header {
        padding: 16px 18px 12px;
      }
      .modal-body {
        padding: 14px 18px;
      }
      .modal-footer {
        padding: 12px 18px calc(14px + env(safe-area-inset-bottom, 0px));
        flex-wrap: wrap;
      }
      .modal-footer .btn {
        flex: 1 1 120px;
      }
      .toast-banner {
        left: 12px;
        right: 12px;
        bottom: 12px;
        max-width: none;
      }
    }

    @media (max-width: 600px) {
      .kpi-strip,
      .field-grid-2 {
        grid-template-columns: 1fr;
      }
      .kpi-cell {
        padding: 16px;
        border-right: none;
        border-bottom: 1px solid var(--border);
      }
      .kpi-cell:last-child {
        border-bottom: none;
      }
      .kpi-value {
        font-size: 24px;
      }
      .track-rail-box {
        padding: 14px;
      }
      .track-endpoints {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
      .track-endpoints > div:last-child {
        text-align: left !important;
      }
    }

    @media (max-width: 520px) {
      .admin-content {
        padding: 12px 12px 40px;
      }
      .tl-row {
        grid-template-columns: 24px minmax(0, 1fr);
        gap: 10px;
        min-height: 60px;
      }
      .tl-time {
        display: none;
      }
      .tl-time-inline {
        display: block;
      }
      .topbar-title {
        font-size: 15px;
      }
    }
  </style>
</head>
<body>
  @yield('body')
</body>
</html>
