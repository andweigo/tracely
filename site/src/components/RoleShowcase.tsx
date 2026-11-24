import React, { useState } from 'react';
import {
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  QrCode,
  Shield,
  Smartphone,
  Users,
} from 'lucide-react';

interface RoleConfig {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly summary: string;
  readonly icon: React.ReactNode;
  readonly bullets: ReadonlyArray<string>;
  readonly previewTitle: string;
  readonly previewBadge: string;
  readonly previewRows: ReadonlyArray<{
    readonly label: string;
    readonly value: string;
    readonly status: 'teal' | 'amber' | 'navy' | 'emerald';
  }>;
}

const ROLES: ReadonlyArray<RoleConfig> = [
  {
    id: 'records',
    label: 'Records & Receiving',
    title: 'Process incoming batches in seconds, not spreadsheets',
    summary:
      'Replace handwritten logbooks with printable QR routing slips, rapid mobile QR camera receiving, and instant transmittal manifests.',
    icon: <QrCode size={16} />,
    bullets: [
      'Generate crisp printable QR slips for physical folders and packets',
      'Receive physical folders consecutively using the native Android QR camera scanner',
      'Recall misrouted dispatches safely with built-in FuseButton Undo protection',
      'Issue public QR verification links for external stakeholders and citizens',
    ],
    previewTitle: 'Incoming QR Receiving Queue',
    previewBadge: '12 Scanned',
    previewRows: [
      { label: 'TRC-2026-00418 · Budget Proposal', value: 'Verified · 09:28', status: 'emerald' },
      { label: 'TRC-2026-00421 · Personnel Order', value: 'Verified · 09:29', status: 'emerald' },
      { label: 'TRC-2026-00424 · Procurement Slip', value: 'Awaiting Scan', status: 'amber' },
    ],
  },
  {
    id: 'staff',
    label: 'Department Staff',
    title: 'One unified inbox across desktop and Android',
    summary:
      'Receive, review, comment, attach revisions, and forward documents from your desk or hallway—with live alerts that never leak document titles on lock screens.',
    icon: <Smartphone size={16} />,
    bullets: [
      'Scan QR slips with your Android camera or unlock digital bundles seamlessly',
      'Pair phone camera with desktop drafts to upload physical pages instantly',
      'Snap proof-of-receipt photos offline—EXIF stripped and auto-synced when online',
      'Set Out-of-Office status with automatic delegate routing so files never stall',
    ],
    previewTitle: 'Desktop ↔ Mobile Camera Pairing',
    previewBadge: 'Paired Live',
    previewRows: [
      { label: 'Signed_Memo_Page1.jpg', value: 'EXIF Stripped · 412 KB', status: 'teal' },
      { label: 'Signed_Memo_Page2.jpg', value: 'Synced to Web Draft', status: 'emerald' },
      { label: 'SHA-256 Checksum', value: 'Matched & Verified', status: 'navy' },
    ],
  },
  {
    id: 'executives',
    label: 'Unit Heads & Executives',
    title: 'See every bottleneck before deadlines slip',
    summary:
      'Monitor cross-department turnaround times, spot overdue files immediately, and export clean A4 executive reports for leadership reviews.',
    icon: <BarChart3 size={16} />,
    bullets: [
      'Real-time On Track, Due Soon, and Overdue SLA indicators per office',
      'Department turnaround analytics highlighting average handling duration',
      'Complete chronological custody timeline with comments and proof photos',
      'One-click printable A4 Executive SLA Reports and CSV ledger exports',
    ],
    previewTitle: 'Agency SLA Turnaround Snapshot',
    previewBadge: '96.4% On Time',
    previewRows: [
      { label: 'Records & Receiving', value: 'Avg 1.4 hrs', status: 'emerald' },
      { label: 'Finance & Budget', value: 'Avg 3.8 hrs', status: 'teal' },
      { label: 'Legal Review Queue', value: '2 Due Soon', status: 'amber' },
    ],
  },
  {
    id: 'admins',
    label: 'ICT & System Admins',
    title: 'Dedicated governance without touching production databases',
    summary:
      'Operate a separate Admin Governance Studio with account approval gates, RBAC management, active session revocation, and cryptographic integrity sweeps.',
    icon: <Shield size={16} />,
    bullets: [
      'Approve or reject self-registered staff with live Pending Approval feedback',
      'Manage offices, custom categories, SLA policy thresholds, and custody overrides',
      'Inspect and revoke active web or mobile Sanctum sessions immediately',
      'Run automated SHA-256 integrity verification across stored document versions',
    ],
    previewTitle: 'Admin Governance Studio',
    previewBadge: 'Protected Portal',
    previewRows: [
      { label: 'Account Approval Gate', value: '3 Pending Review', status: 'amber' },
      { label: 'SHA-256 Integrity Audit', value: '100% Intact', status: 'emerald' },
      { label: 'Active Sanctum Sessions', value: '42 Verified Devices', status: 'navy' },
    ],
  },
];

export const RoleShowcase: React.FC = () => {
  const [activeId, setActiveId] = useState<string>(ROLES[0].id);
  const current = ROLES.find((r) => r.id === activeId) ?? ROLES[0];

  return (
    <section id="roles" className="section section-soft">
      <div className="container">
        <div className="section-header center">
          <span className="eyebrow">
            <Users size={13} /> Built for Every Role
          </span>
          <h2>One custody platform, tailored to every desk in the organization</h2>
          <p>
            From high-volume receiving counters to executive approval desks and ICT governance teams,
            everyone works from the same real-time record.
          </p>
        </div>

        <div className="role-tabs" role="tablist" aria-label="Organization roles">
          {ROLES.map((role) => (
            <button
              key={role.id}
              type="button"
              role="tab"
              aria-selected={role.id === activeId}
              className={`role-tab ${role.id === activeId ? 'is-active' : ''}`}
              onClick={() => setActiveId(role.id)}
            >
              {role.icon}
              <span>{role.label}</span>
            </button>
          ))}
        </div>

        <div className="role-panel" role="tabpanel">
          <div className="role-copy">
            <h3>{current.title}</h3>
            <p>{current.summary}</p>
            <ul className="role-bullets">
              {current.bullets.map((bullet) => (
                <li key={bullet}>
                  <CheckCircle2 size={16} className="bullet-icon" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="role-preview-card">
            <div className="role-preview-head">
              <div className="role-preview-title">
                <Building2 size={15} />
                <span>{current.previewTitle}</span>
              </div>
              <span className="preview-pill">{current.previewBadge}</span>
            </div>
            <div className="role-preview-rows">
              {current.previewRows.map((row) => (
                <div key={row.label} className="role-preview-row">
                  <span className="preview-row-label">{row.label}</span>
                  <span className={`status-pill tone-${row.status}`}>{row.value}</span>
                </div>
              ))}
            </div>
            <div className="role-preview-foot">
              <ClipboardCheck size={14} />
              <span>Synchronized in real time across Tracely Web &amp; Android</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
