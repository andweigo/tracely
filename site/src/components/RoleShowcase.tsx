import React, { useState } from 'react';
import {
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  QrCode,
  Shield,
  Smartphone,
} from 'lucide-react';

interface RoleConfig {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly summary: string;
  readonly icon: React.ReactNode;
  readonly bullets: ReadonlyArray<string>;
  readonly previewTitle: string;
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
    title: 'Receive incoming batches in seconds',
    summary:
      'Replace handwritten logbooks with printable QR routing slips and quick phone camera scanning.',
    icon: <QrCode size={16} />,
    bullets: [
      'Print QR routing slips for physical folders',
      'Scan incoming folders back-to-back on Android',
      'Undo misrouted dispatches before receipt',
      'Share public verification links when needed',
    ],
    previewTitle: 'Incoming Receiving Queue',
    previewRows: [
      { label: 'Budget Proposal', value: 'Received · 09:28', status: 'emerald' },
      { label: 'Personnel Order', value: 'Received · 09:29', status: 'emerald' },
      { label: 'Procurement Slip', value: 'Waiting scan', status: 'amber' },
    ],
  },
  {
    id: 'staff',
    label: 'Office Staff',
    title: 'One inbox across desktop and Android',
    summary:
      'Receive, review, comment, attach updates, and forward files from your desk or phone.',
    icon: <Smartphone size={16} />,
    bullets: [
      'Scan QR slips on Android or enter the 6-character code on desktop',
      'Pair your phone camera to attach paper pages to web drafts',
      'Capture proof photos offline and sync automatically later',
      'Assign a delegate while on leave so files keep moving',
    ],
    previewTitle: 'Phone-to-Desktop Capture',
    previewRows: [
      { label: 'Signed_Memo_Page1.jpg', value: 'Synced · 412 KB', status: 'teal' },
      { label: 'Signed_Memo_Page2.jpg', value: 'Added to draft', status: 'emerald' },
      { label: 'File Check', value: 'Verified', status: 'navy' },
    ],
  },
  {
    id: 'executives',
    label: 'Office Heads',
    title: 'Spot delays before deadlines slip',
    summary:
      'See where documents are sitting, follow up quickly, and print clean monthly reports.',
    icon: <BarChart3 size={16} />,
    bullets: [
      'Track due-soon and overdue documents by office',
      'Review average turnaround times across units',
      'View full handoff timelines with remarks and proof photos',
      'Export printable reports and CSV logs in one click',
    ],
    previewTitle: 'Office Turnaround Snapshot',
    previewRows: [
      { label: 'Records & Receiving', value: 'Avg 1.4 hrs', status: 'emerald' },
      { label: 'Finance & Budget', value: 'Avg 3.8 hrs', status: 'teal' },
      { label: 'Legal Review', value: '2 due soon', status: 'amber' },
    ],
  },
  {
    id: 'admins',
    label: 'Administrators',
    title: 'Manage accounts, offices, and security in one place',
    summary:
      'Approve staff registrations, manage offices and categories, and monitor active devices from a separate Admin Portal.',
    icon: <Shield size={16} />,
    bullets: [
      'Approve or reject new staff registrations',
      'Manage offices, categories, and deadline rules',
      'Review active web or phone logins and sign out lost devices',
      'Verify uploaded files and export activity logs',
    ],
    previewTitle: 'Admin Portal',
    previewRows: [
      { label: 'Account Approvals', value: '3 pending', status: 'amber' },
      { label: 'File Verification', value: '100% verified', status: 'emerald' },
      { label: 'Signed-In Devices', value: '42 active', status: 'navy' },
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
          <h2>Built for every desk in your organization</h2>
          <p>
            From receiving counters to office heads and admins, everyone works from the same live
            record.
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
              <span>Synced across Tracely Web and Android</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
