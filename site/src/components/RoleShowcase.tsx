import React, { useState } from 'react';

interface RoleConfig {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly summary: string;
  readonly bullets: ReadonlyArray<string>;
  readonly previewCode: string;
  readonly previewTitle: string;
  readonly previewRows: ReadonlyArray<{
    readonly label: string;
    readonly value: string;
    readonly tone: 'ink' | 'muted' | 'warn';
  }>;
}

const ROLES: ReadonlyArray<RoleConfig> = [
  {
    id: 'records',
    label: 'Records & Receiving',
    title: 'Receive incoming batches in seconds',
    summary:
      'Replace handwritten logbooks with printable QR routing slips and quick phone camera scanning.',
    bullets: [
      'Print QR routing slips for physical folders',
      'Scan incoming folders back-to-back on Android',
      'Recall misrouted dispatches before receipt',
      'Share public verification links when needed',
    ],
    previewCode: 'QUEUE · REC',
    previewTitle: 'Incoming Receiving Queue',
    previewRows: [
      { label: 'Budget Proposal', value: 'Received · 09:28', tone: 'ink' },
      { label: 'Personnel Order', value: 'Received · 09:29', tone: 'ink' },
      { label: 'Procurement Slip', value: 'Awaiting scan', tone: 'warn' },
    ],
  },
  {
    id: 'staff',
    label: 'Office Staff',
    title: 'One inbox across desktop and Android',
    summary:
      'Receive, review, comment, attach updates, and forward files from your desk or phone.',
    bullets: [
      'Scan QR slips on Android or enter the 6-character code on desktop',
      'Pair your phone camera to attach paper pages to web drafts',
      'Capture proof photos offline and sync automatically later',
      'Assign a delegate while on leave so files keep moving',
    ],
    previewCode: 'CAPTURE · DESK',
    previewTitle: 'Phone-to-Desktop Capture',
    previewRows: [
      { label: 'Signed_Memo_Page1.jpg', value: 'Synced · 412 KB', tone: 'ink' },
      { label: 'Signed_Memo_Page2.jpg', value: 'Added to draft', tone: 'ink' },
      { label: 'Checksum check', value: 'Verified', tone: 'muted' },
    ],
  },
  {
    id: 'executives',
    label: 'Office Heads',
    title: 'Spot delays before deadlines slip',
    summary:
      'See where documents are sitting, follow up quickly, and print clean monthly reports.',
    bullets: [
      'Track due-soon and overdue documents by office',
      'Review average turnaround times across units',
      'View full handoff timelines with remarks and proof photos',
      'Export printable reports and CSV logs in one click',
    ],
    previewCode: 'REPORT · SLA',
    previewTitle: 'Office Turnaround Snapshot',
    previewRows: [
      { label: 'Records & Receiving', value: 'Avg 1.4 hrs', tone: 'ink' },
      { label: 'Finance & Budget', value: 'Avg 3.8 hrs', tone: 'muted' },
      { label: 'Legal Review', value: '2 due soon', tone: 'warn' },
    ],
  },
  {
    id: 'admins',
    label: 'Administrators',
    title: 'Manage accounts, offices, and security in one place',
    summary:
      'Approve staff registrations, manage offices and categories, and monitor active devices from a separate Admin Portal.',
    bullets: [
      'Approve or reject new staff registrations with password confirmation',
      'Manage offices, categories, announcements, and deadline rules',
      'Review active web or phone logins and sign out lost devices',
      'Verify uploaded files, recall recent actions, and export logs',
    ],
    previewCode: 'PORTAL · ADMIN',
    previewTitle: 'Admin Governance Summary',
    previewRows: [
      { label: 'Account Approvals', value: '3 pending', tone: 'warn' },
      { label: 'File Verification', value: '100% verified', tone: 'ink' },
      { label: 'Signed-In Devices', value: '42 active', tone: 'muted' },
    ],
  },
];

export const RoleShowcase: React.FC = () => {
  const [activeId, setActiveId] = useState<string>(ROLES[0].id);
  const current = ROLES.find((r) => r.id === activeId) ?? ROLES[0];

  return (
    <section id="roles" className="section section-paper">
      <div className="container">
        <div className="section-header center">
          <span className="section-kicker">BY ROLE</span>
          <h2 className="editorial-heading">
            Built for every desk <em>in your organization.</em>
          </h2>
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
              {role.label}
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
                  <span className="bullet-dash" aria-hidden="true">—</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="role-preview-card">
            <div className="role-preview-head">
              <span className="role-preview-title">{current.previewTitle}</span>
              <span className="role-preview-code">{current.previewCode}</span>
            </div>
            <div className="role-preview-rows">
              {current.previewRows.map((row) => (
                <div key={row.label} className="role-preview-row">
                  <span className="preview-row-label">{row.label}</span>
                  <span className={`ledger-status tone-${row.tone}`}>
                    <span className="ledger-status-dot" aria-hidden="true" />
                    <span>{row.value}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="role-preview-foot">
              <span>Synced live across Tracely Web and Android</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
