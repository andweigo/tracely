@extends('admin::layouts.app')

@section('title', 'Executive SLA & Bottleneck Report · Tracely')

@section('body')
<style>
  .exec-wrap {
    min-height: 100vh;
    background: var(--bg);
    padding: 20px 16px 56px;
  }

  .exec-toolbar {
    max-width: 960px;
    margin: 0 auto 18px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    box-shadow: var(--shadow-xs);
  }

  .exec-toolbar-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .exec-sheet {
    max-width: 960px;
    margin: 0 auto;
    background: #ffffff;
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 36px 40px;
    box-shadow: 0 8px 28px rgba(9, 35, 77, 0.06);
    color: var(--text-primary);
  }

  .exec-masthead {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    padding-bottom: 18px;
    border-bottom: 2px solid var(--navy);
  }

  .exec-brand-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .exec-republic {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .exec-agency {
    margin: 2px 0 0;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--navy-deep);
  }

  .exec-doc-title {
    margin: 3px 0 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .exec-period-box {
    text-align: right;
    flex-shrink: 0;
  }

  .exec-period-label {
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .exec-period-value {
    font-size: 15px;
    font-weight: 800;
    color: var(--navy);
    margin-top: 2px;
  }

  .exec-generated {
    font-size: 11px;
    color: var(--text-muted);
    margin-top: 3px;
  }

  .exec-kpi-grid {
    margin-top: 22px;
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
  }

  .exec-kpi-card {
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 13px 14px;
    background: var(--surface-muted);
  }

  .exec-kpi-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }

  .exec-kpi-val {
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
    margin-top: 4px;
    line-height: 1.15;
  }

  .exec-kpi-sub {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  .exec-section {
    margin-top: 26px;
    break-inside: avoid;
  }

  .exec-section-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .exec-section-title {
    margin: 0;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: -0.01em;
    color: var(--navy-deep);
    text-transform: uppercase;
  }

  .exec-section-note {
    font-size: 11.5px;
    color: var(--text-muted);
  }

  .exec-table-wrap {
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow-x: auto;
  }

  .exec-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
  }

  .exec-table th {
    background: var(--surface-soft);
    border-bottom: 1px solid var(--border);
    padding: 9px 12px;
    text-align: left;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .exec-table td {
    padding: 9px 12px;
    border-bottom: 1px solid var(--border);
    color: var(--text-primary);
    vertical-align: middle;
  }

  .exec-table tbody tr:last-child td {
    border-bottom: none;
  }

  .exec-signatories {
    margin-top: 32px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 36px;
    break-inside: avoid;
  }

  .exec-sig-block {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .exec-sig-role {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
  }

  .exec-sig-line {
    margin-top: 28px;
    padding-top: 6px;
    border-top: 1px solid var(--text-primary);
    font-size: 13px;
    font-weight: 800;
    color: var(--text-primary);
  }

  .exec-sig-title {
    font-size: 11.5px;
    color: var(--text-secondary);
  }

  .exec-footer-note {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px dashed var(--border-strong);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    font-size: 11px;
    color: var(--text-muted);
  }

  @media (max-width: 820px) {
    .exec-sheet {
      padding: 22px 18px;
    }
    .exec-masthead {
      flex-direction: column;
    }
    .exec-period-box {
      text-align: left;
    }
    .exec-kpi-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .exec-signatories {
      grid-template-columns: 1fr;
      gap: 20px;
    }
  }

  @media (max-width: 480px) {
    .exec-kpi-grid {
      grid-template-columns: 1fr;
    }
  }

  @media print {
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
    html,
    body {
      background: #ffffff !important;
      font-size: 11pt;
    }
    .no-print {
      display: none !important;
    }
    .exec-wrap {
      padding: 0 !important;
      background: #ffffff !important;
    }
    .exec-sheet {
      max-width: none !important;
      border: none !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      padding: 0 !important;
    }
    .exec-kpi-grid {
      grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
    }
    .exec-signatories {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
  }
</style>

<div class="exec-wrap" data-testid="admin-executive-sla-report">
  <!-- Non-Printable Navigation & Period Controls -->
  <div class="exec-toolbar no-print">
    <div class="exec-toolbar-left">
      <a href="{{ route('admin.dashboard', ['section' => 'overview']) }}" class="btn btn-secondary btn-sm">
        ← Back to Admin Portal
      </a>
      <form method="GET" action="{{ route('admin.reports.executive-sla') }}" style="display: inline-flex; align-items: center; gap: 8px; margin: 0;">
        <label for="report-month-select" style="font-size: 12.5px; font-weight: 600; color: var(--text-secondary);">Period:</label>
        <select id="report-month-select" name="month" class="select" style="height: 34px; font-size: 13px;" onchange="this.form.submit()">
          @foreach ($monthOptions as $opt)
            <option value="{{ $opt['value'] }}" {{ $monthParam === $opt['value'] ? 'selected' : '' }}>
              {{ $opt['label'] }}
            </option>
          @endforeach
        </select>
      </form>
    </div>

    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
      <a href="{{ route('admin.export.documents') }}" class="btn btn-secondary btn-sm">Export Raw CSV</a>
      <button type="button" class="btn btn-primary btn-sm" onclick="window.print()">
        Print / Save A4 PDF
      </button>
    </div>
  </div>

  <!-- A4 Executive Report Sheet -->
  <article class="exec-sheet">
    <header class="exec-masthead">
      <div class="exec-brand-row">
        <img
          src="{{ asset('images/tracely-logo.png') }}"
          alt="Tracely logo"
          class="brand-logo-lg"
          width="48"
          height="48"
        />
        <div>
          <div class="exec-republic">Tracely</div>
          <h1 class="exec-agency">Admin Report</h1>
          <div class="exec-doc-title">Document Turnaround &amp; SLA Report</div>
        </div>
      </div>

      <div class="exec-period-box">
        <div class="exec-period-label">Reporting Period</div>
        <div class="exec-period-value">{{ $periodLabel }}</div>
        <div class="exec-generated mono">Generated {{ $generatedAt->format('Y-m-d H:i') }}</div>
      </div>
    </header>

    <!-- 1. Executive KPI Strip -->
    <section class="exec-kpi-grid" aria-label="Executive SLA summary metrics">
      <div class="exec-kpi-card">
        <div class="exec-kpi-label">Total Processed</div>
        <div class="exec-kpi-val">{{ $summary['totalDocs'] }}</div>
        <div class="exec-kpi-sub">{{ $summary['activeDocs'] }} active · {{ $summary['finalizedDocs'] }} finalized</div>
      </div>

      <div class="exec-kpi-card">
        <div class="exec-kpi-label">On-Time SLA Rate</div>
        <div class="exec-kpi-val" style="color: {{ $summary['onTimeRate'] >= 85 ? 'var(--emerald)' : ($summary['onTimeRate'] >= 65 ? 'var(--amber-text)' : 'var(--rose)') }};">
          {{ number_format($summary['onTimeRate'], 1) }}%
        </div>
        <div class="exec-kpi-sub">Within policy target</div>
      </div>

      <div class="exec-kpi-card">
        <div class="exec-kpi-label">Avg Dwell / Cycle</div>
        <div class="exec-kpi-val">{{ number_format($summary['avgDwellHours'], 1) }}h</div>
        <div class="exec-kpi-sub">Mean office dwell time</div>
      </div>

      <div class="exec-kpi-card">
        <div class="exec-kpi-label">Stalled</div>
        <div class="exec-kpi-val" style="color: {{ $summary['stalledDocs'] > 0 ? 'var(--rose)' : 'var(--emerald)' }};">
          {{ $summary['stalledDocs'] }}
        </div>
        <div class="exec-kpi-sub">Past alert threshold</div>
      </div>

      <div class="exec-kpi-card">
        <div class="exec-kpi-label">Overdue SLA</div>
        <div class="exec-kpi-val" style="color: {{ $summary['overdueDocs'] > 0 ? 'var(--rose)' : 'var(--text-primary)' }};">
          {{ $summary['overdueDocs'] }}
        </div>
        <div class="exec-kpi-sub">Breached due date</div>
      </div>
    </section>

    <!-- 2. Division Office Throughput & Average Dwell Time -->
    <section class="exec-section">
      <div class="exec-section-head">
        <h2 class="exec-section-title">1. Office Throughput &amp; Average Dwell Time</h2>
        <span class="exec-section-note">Ranked by current SLA bottleneck count</span>
      </div>
      <div class="exec-table-wrap">
        <table class="exec-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Division / Functional Unit</th>
              <th class="num-col">Handled</th>
              <th class="num-col">Finalized</th>
              <th class="num-col">Active Backlog</th>
              <th class="num-col">Pending Receipt</th>
              <th class="num-col">Avg Dwell</th>
              <th>SLA Status</th>
            </tr>
          </thead>
          <tbody>
            @foreach ($officeStats as $row)
              <tr>
                <td><span class="code-tag">{{ $row['office']->code }}</span></td>
                <td style="font-weight: 600;">{{ $row['office']->name }}</td>
                <td class="num-col">{{ $row['handledCount'] }}</td>
                <td class="num-col">{{ $row['finalizedCount'] }}</td>
                <td class="num-col">{{ $row['activeBacklog'] }}</td>
                <td class="num-col">{{ $row['pendingReceipt'] }}</td>
                <td class="num-col mono">{{ number_format($row['avgDwellHours'], 1) }}h</td>
                <td>
                  @if ($row['delayedCount'] > 0)
                    <span class="pill pill-rose">{{ $row['delayedCount'] }} delayed</span>
                  @else
                    <span style="color: var(--text-muted); font-size: 12px;">On track</span>
                  @endif
                </td>
              </tr>
            @endforeach
          </tbody>
        </table>
      </div>
    </section>

    <!-- 3. Top Delayed Document Categories & SLA Policies -->
    <section class="exec-section">
      <div class="exec-section-head">
        <h2 class="exec-section-title">2. Document Category Performance &amp; SLA Policies</h2>
        <span class="exec-section-note">Comparison against configured per-category SLA targets</span>
      </div>
      <div class="exec-table-wrap">
        <table class="exec-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Category</th>
              <th>SLA Policy</th>
              <th class="num-col">Volume</th>
              <th class="num-col">Delayed</th>
              <th class="num-col">Avg Dwell</th>
              <th class="num-col">On-Time Rate</th>
            </tr>
          </thead>
          <tbody>
            @foreach ($categoryStats as $row)
              @php $pol = $row['policy']; @endphp
              <tr>
                <td><span class="code-tag">{{ $row['category']->code }}</span></td>
                <td style="font-weight: 600;">{{ $row['category']->name }}</td>
                <td style="font-size: 11.5px; color: var(--text-secondary);">
                  @if ($pol && $pol->active)
                    {{ $pol->target_hours }}h target · alert {{ $pol->stalled_alert_hours }}h
                    @if ($pol->escalateToOffice)
                      · esc → <strong>{{ $pol->escalateToOffice->code }}</strong> ({{ $pol->escalation_hours }}h)
                    @endif
                  @else
                    Division Default (48h / 24h)
                  @endif
                </td>
                <td class="num-col">{{ $row['totalDocs'] }}</td>
                <td class="num-col">
                  @if ($row['delayedCount'] > 0)
                    <span class="pill pill-rose">{{ $row['delayedCount'] }}</span>
                  @else
                    0
                  @endif
                </td>
                <td class="num-col mono">{{ number_format($row['avgDwellHours'], 1) }}h</td>
                <td class="num-col mono" style="font-weight: 700;">{{ number_format($row['onTimeRate'], 1) }}%</td>
              </tr>
            @endforeach
          </tbody>
        </table>
      </div>
    </section>

    <!-- 4. Chronic Bottleneck Watchlist -->
    <section class="exec-section">
      <div class="exec-section-head">
        <h2 class="exec-section-title">3. Active Bottleneck &amp; Escalation Watchlist</h2>
        <span class="exec-section-note">Documents requiring immediate executive or office head follow-up</span>
      </div>
      @if ($bottlenecks->isEmpty())
        <div style="padding: 18px; border: 1px solid var(--emerald-border); background: var(--emerald-soft); border-radius: 10px; font-size: 12.5px; font-weight: 600; color: var(--emerald-text);">
          No active SLA breaches or stalled documents detected for {{ $periodLabel }}.
        </div>
      @else
        <div class="exec-table-wrap">
          <table class="exec-table">
            <thead>
              <tr>
                <th>Tracking Code</th>
                <th>Document Subject</th>
                <th>Current Desk</th>
                <th>Custodian</th>
                <th class="num-col">Idle Dwell</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              @foreach ($bottlenecks as $item)
                @php
                  $doc = $item['model'];
                  $ev = $item['eval'];
                @endphp
                <tr>
                  <td class="mono" style="font-weight: 700; color: var(--navy); white-space: nowrap;">{{ $doc->tracking_code }}</td>
                  <td>
                    <div style="font-weight: 600;">{{ $doc->title }}</div>
                    <div style="font-size: 11px; color: var(--text-muted);">{{ $doc->category?->name ?? 'Uncategorized' }}</div>
                  </td>
                  <td><span class="pill pill-navy">{{ $ev['targetOfficeCode'] }}</span></td>
                  <td>{{ $ev['targetHolderName'] ?? 'Office Desk' }}</td>
                  <td class="num-col mono" style="font-weight: 700; color: var(--rose-text);">{{ $ev['idleLabel'] }}</td>
                  <td>
                    @if ($ev['shouldEscalate'])
                      <span class="pill pill-rose">Escalate → {{ $ev['escalationOfficeCode'] }}</span>
                    @elseif ($ev['isStalled'])
                      <span class="pill pill-rose">Stalled</span>
                    @else
                      <span class="pill pill-amber">At Risk</span>
                    @endif
                  </td>
                </tr>
              @endforeach
            </tbody>
          </table>
        </div>
      @endif
    </section>

    <!-- 5. Executive Signatory Block -->
    <section class="exec-signatories">
      <div class="exec-sig-block">
        <span class="exec-sig-role">Prepared &amp; Verified By</span>
        <div class="exec-sig-line">{{ $admin->full_name }}</div>
        <div class="exec-sig-title">{{ $admin->position }} · {{ $admin->office?->name ?? 'Systems Unit' }}</div>
      </div>

      <div class="exec-sig-block">
        <span class="exec-sig-role">Noted &amp; Approved By</span>
        <div class="exec-sig-line">Executive Director</div>
        <div class="exec-sig-title">Executive &amp; Operations Office</div>
      </div>
    </section>

    <footer class="exec-footer-note">
      <span>Tracely Governance Console · Official Custody Report</span>
      <span class="mono">Privacy &amp; Audit Compliant · Generated by {{ $admin->employee_id }}</span>
    </footer>
  </article>
</div>
@endsection
