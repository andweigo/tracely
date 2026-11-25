import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Printer,
  RefreshCw,
} from 'lucide-react';
import { TurnaroundAnalyticsReport } from '../domain/types';
import { useWebApp } from '../state/WebAppContext';
import { downloadCsvFile } from '../utils/exportCsv';

function buildAnalyticsCsv(report: TurnaroundAnalyticsReport): string {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    ['Office Code', 'Office Name', 'Handled', 'Active Pending', 'Overdue', 'Avg Processing Hours'].map(escape).join(','),
    ...report.byOffice.map((o) =>
      [o.officeCode, o.officeName, o.handledCount, o.pendingCount, o.overdueCount, o.avgHours]
        .map(escape)
        .join(','),
    ),
  ];
  return lines.join('\r\n');
}

export const AnalyticsPage: React.FC = () => {
  const { getTurnaroundAnalytics, notify } = useWebApp();
  const [report, setReport] = useState<TurnaroundAnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTurnaroundAnalytics();
      setReport(data);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to load SLA analytics.');
    } finally {
      setLoading(false);
    }
  }, [getTurnaroundAnalytics, notify]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExportCsv = () => {
    if (!report) return;
    downloadCsvFile(
      `tracely-sla-analytics-${new Date().toISOString().slice(0, 10)}.csv`,
      buildAnalyticsCsv(report),
    );
    notify('success', 'Exported office turnaround analytics CSV.');
  };

  const maxMonthly = Math.max(
    1,
    ...(report?.monthlyThroughput ?? []).flatMap((m) => [m.createdCount, m.completedCount]),
  );

  return (
    <div data-testid="web-analytics-page" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div className="section-header-row no-print">
        <h3 className="section-title">Office Performance</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            type="button"
            className="btn btn-outline"
            data-testid="web-analytics-export-csv"
            disabled={!report}
            onClick={handleExportCsv}
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!report}
            onClick={() => window.print()}
          >
            <Printer size={14} /> Print Report
          </button>
        </div>
      </div>

      {loading && !report ? (
        <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading live SLA analytics...
        </div>
      ) : report ? (
        <>
          <div className="analytics-kpi-grid">
            <div className="card analytics-kpi-card">
              <div className="analytics-kpi-label">
                <FileText size={14} /> Active / Total Docs
              </div>
              <div className="analytics-kpi-value" data-testid="analytics-total-docs">
                {report.summary.activeCount} / {report.summary.totalDocuments}
              </div>
              <div className="doc-meta">{report.summary.completedCount} completed</div>
            </div>

            <div className="card analytics-kpi-card">
              <div className="analytics-kpi-label">
                <Clock size={14} /> Avg Turnaround
              </div>
              <div className="analytics-kpi-value">
                {report.summary.avgTurnaroundHours > 0 ? `${report.summary.avgTurnaroundHours}h` : '—'}
              </div>
              <div className="doc-meta">Completed record cycle time</div>
            </div>

            <div className="card analytics-kpi-card">
              <div className="analytics-kpi-label">
                <CheckCircle2 size={14} color="var(--emerald-text)" /> On-Time SLA Rate
              </div>
              <div className="analytics-kpi-value" style={{ color: 'var(--emerald-text)' }}>
                {report.summary.onTimeRatePercent}%
              </div>
              <div className="doc-meta">
                {report.summary.onTrackCount} on track · {report.summary.atRiskCount} due soon
              </div>
            </div>

            <div className="card analytics-kpi-card">
              <div className="analytics-kpi-label">
                <AlertTriangle size={14} color="var(--rose-text)" /> Overdue / Stalled
              </div>
              <div
                className="analytics-kpi-value"
                style={{ color: report.summary.overdueCount > 0 ? 'var(--rose-text)' : 'var(--text-primary)' }}
              >
                {report.summary.overdueCount} / {report.summary.stalledCount}
              </div>
              <div className="doc-meta">
                Soft {report.byFormat.digital} · Hard {report.byFormat.hardCopy} · Hybrid {report.byFormat.hybrid}
              </div>
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="section-header-row">
              <h4 className="section-title" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}>
                <BarChart3 size={16} color="var(--navy)" /> 6-Month Document Throughput
              </h4>
              <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: 'var(--text-secondary)' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span className="analytics-legend-dot" style={{ background: 'var(--navy)' }} /> Created
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span className="analytics-legend-dot" style={{ background: 'var(--amber)' }} /> Completed
                </span>
              </div>
            </div>

            <div className="analytics-bar-grid">
              {report.monthlyThroughput.map((m) => (
                <div key={m.month} className="analytics-bar-col">
                  <div className="analytics-bar-track">
                    <div
                      className="analytics-bar-fill"
                      style={{
                        height: `${Math.max(6, Math.round((m.createdCount / maxMonthly) * 100))}%`,
                        background: 'var(--navy)',
                      }}
                      title={`${m.label}: ${m.createdCount} created`}
                    />
                    <div
                      className="analytics-bar-fill"
                      style={{
                        height: `${Math.max(6, Math.round((m.completedCount / maxMonthly) * 100))}%`,
                        background: 'var(--amber)',
                      }}
                      title={`${m.label}: ${m.completedCount} completed`}
                    />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {m.createdCount}/{m.completedCount}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h4 className="section-title" style={{ fontSize: 15 }}>
              Office Turnaround &amp; Bottleneck Breakdown
            </h4>
            {report.byOffice.length === 0 ? (
              <p className="doc-meta" style={{ margin: 0 }}>
                No office routing activity recorded yet.
              </p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="analytics-table" data-testid="analytics-office-table">
                  <thead>
                    <tr>
                      <th>Office / Unit</th>
                      <th>Handled</th>
                      <th>Active Pending</th>
                      <th>Overdue</th>
                      <th>Avg Receive Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byOffice.map((row) => (
                      <tr key={row.officeId}>
                        <td>
                          <strong>{row.officeCode}</strong>{' '}
                          <span style={{ color: 'var(--text-secondary)' }}>— {row.officeName}</span>
                        </td>
                        <td>{row.handledCount}</td>
                        <td>{row.pendingCount}</td>
                        <td>
                          {row.overdueCount > 0 ? (
                            <span className="pill pill-rose">{row.overdueCount}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>0</span>
                          )}
                        </td>
                        <td className="mono">{row.avgHours > 0 ? `${row.avgHours}h` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
};
