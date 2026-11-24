export type LegalDocumentType = 'terms' | 'privacy';

export interface LegalPolicySection {
  readonly heading: string;
  readonly body: string;
}

export interface LegalDocumentContent {
  readonly id: LegalDocumentType;
  readonly title: string;
  readonly effectiveDate: string;
  readonly intro: string;
  readonly sections: ReadonlyArray<LegalPolicySection>;
}

export const TERMS_AND_CONDITIONS: LegalDocumentContent = {
  id: 'terms',
  title: 'Terms and Conditions',
  effectiveDate: 'Effective November 2026',
  intro:
    'By registering for and using Tracely, you agree to abide by these Terms and Conditions governing authorized document custody, routing, and tracking services.',
  sections: [
    {
      heading: '1. Authorized Use & Account Verification',
      body: 'Tracely is intended for authorized personnel managing official digital and physical document custody. Self-registered accounts remain pending until reviewed and approved by a designated administrator. You are responsible for providing accurate employee identification, work email, and office assignment details.',
    },
    {
      heading: '2. Account Security & Session Responsibility',
      body: 'You must keep your password confidential and avoid sharing active device sessions. You agree to sign out on shared devices, lock confidential records when stepping away, and immediately report suspected unauthorized access to your administrator.',
    },
    {
      heading: '3. Document Custody & Audit Accountability',
      body: 'Every transfer, QR receipt confirmation, revision upload, recall, approval, and archive action performed under your account is permanently recorded in a tamper-evident custody audit trail. Falsifying receipts, bypassing routing approvals, or sharing restricted files outside authorized recipients is strictly prohibited.',
    },
    {
      heading: '4. Device & Service Usage',
      body: 'Tracely uses optional device capabilities—including camera access for QR verification and proof-of-delivery capture, notifications for transfer alerts, and encrypted local storage for offline queuing—strictly to deliver custody workflows. You may review and manage permissions at any time under Settings.',
    },
    {
      heading: '5. Acceptable Use & Service Availability',
      body: 'You agree not to upload malicious files, attempt automated flooding or unauthorized probing, or interfere with service availability. Administrators may suspend or deactivate accounts that violate organizational security policies.',
    },
  ],
};

export const PRIVACY_POLICY: LegalDocumentContent = {
  id: 'privacy',
  title: 'Privacy Policy',
  effectiveDate: 'Effective November 2026',
  intro:
    'Tracely is committed to protecting personal and institutional information in accordance with applicable data privacy standards, including Republic Act No. 10173 (Data Privacy Act of 2012).',
  sections: [
    {
      heading: '1. Information We Collect',
      body: 'When you register and use Tracely, we collect your full name, employee ID, work email, position, office assignment, optional contact number or desk note, device session labels, and document custody activity logs (timestamps, routing remarks, and receipt proofs).',
    },
    {
      heading: '2. How Your Data Is Used',
      body: 'Your information is used strictly to verify identity, route documents accurately across offices, generate verified QR routing slips and digital ID badges, enforce turnaround SLA alerts, and maintain verifiable custody audit records.',
    },
    {
      heading: '3. Device Permissions & Privacy Safeguards',
      body: 'Camera access is used only when scanning QR slips or capturing receipt proofs, and captured proof photos automatically strip GPS/EXIF metadata before upload. Notifications use privacy-safe lock-screen masking so confidential document titles are not exposed while your screen is locked.',
    },
    {
      heading: '4. Data Protection & Integrity',
      body: 'All transmissions use encrypted TLS connections. Stored attachments are verified with SHA-256 checksums, audit records are cryptographically hash-chained, and access to restricted or confidential documents is enforced through role-based access control and recipient verification.',
    },
    {
      heading: '5. Retention & Your Rights',
      body: 'Official custody logs are retained according to your organization’s records retention policy. You may update your personal profile details, revoke active device sessions, manage service permissions in Settings, or contact your organization’s Data Protection Officer or administrator regarding data requests.',
    },
  ],
};
