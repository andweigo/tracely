import { AuditLogEntry } from '../../src/domain/entities/AuditLogEntry';
import { Document } from '../../src/domain/entities/Document';
import { DocumentCategory } from '../../src/domain/entities/DocumentCategory';
import { DocumentVersion } from '../../src/domain/entities/DocumentVersion';
import { OfflineAttachment } from '../../src/domain/entities/OfflineAttachment';
import { OfficeSummary, Personnel } from '../../src/domain/entities/Personnel';
import { RoutingTransaction } from '../../src/domain/entities/RoutingTransaction';
import { School } from '../../src/domain/entities/School';
import {
  AuditAction,
  AvailabilityStatus,
  ConfidentialityTier,
  DocumentLifecycleStatus,
  OfflineQueueStatus,
  ReceiptStatus,
  RoutingScope,
  SlaState,
  SystemRole,
} from '../../src/domain/enums/DomainEnums';
import type { DesktopPairingSession } from '../../src/domain/security/QrPayload';
import type { PrivacySafeNotification } from '../../src/repositories/contracts/IDocumentRepository';

export const TEST_OFFICES: ReadonlyArray<OfficeSummary> = [
  { id: 'off-records', code: 'RECORDS', name: 'Records Section' },
  { id: 'off-osds', code: 'OSDS', name: 'Office of the Schools Division Superintendent' },
  { id: 'off-cid', code: 'CID', name: 'Curriculum Implementation Division' },
  { id: 'off-sgod', code: 'SGOD', name: 'School Governance & Operations Division' },
  { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
  { id: 'off-acct', code: 'ACCT', name: 'Accounting Unit' },
  { id: 'off-hr', code: 'HR', name: 'Human Resource Management Unit' },
  { id: 'off-legal', code: 'LEGAL', name: 'Legal Unit' },
  { id: 'off-ict', code: 'ICT', name: 'Information & Communications Technology Unit' },
];

export interface TestFixtureBundle {
  offices: ReadonlyArray<OfficeSummary>;
  personnel: Personnel[];
  schools: School[];
  categories: DocumentCategory[];
  documents: Document[];
  pairings: DesktopPairingSession[];
  offlineQueue: OfflineAttachment[];
  notifications: PrivacySafeNotification[];
  auditLogs: AuditLogEntry[];
}

export function createTestFixtureBundle(): TestFixtureBundle {
  const [records, osds, , sgod, budget, acct, hr, legal, ict] = TEST_OFFICES;

  const schools: School[] = [
    new School({
      id: 'sch-110001',
      depedSchoolId: '110001',
      name: 'Naujan Central School',
      district: 'Naujan North',
      municipality: 'Naujan, Oriental Mindoro',
    }),
    new School({
      id: 'sch-301002',
      depedSchoolId: '301002',
      name: 'Pinamalayan National High School',
      district: 'Pinamalayan East',
      municipality: 'Pinamalayan, Oriental Mindoro',
    }),
  ];

  const personnel: Personnel[] = [
    new Personnel({
      id: 'usr-records-1',
      employeeId: 'SDO-0101',
      fullName: 'Clarissa Mendoza',
      position: 'Administrative Officer IV (Records)',
      office: records,
      role: SystemRole.RECORDS_OFFICER,
      email: 'records@deped.gov.ph',
      availability: AvailabilityStatus.AVAILABLE,
    }),
    new Personnel({
      id: 'usr-budget-1',
      employeeId: 'SDO-0204',
      fullName: 'Marco Villareal',
      position: 'Budget Officer II',
      office: budget,
      role: SystemRole.UNIT_HEAD,
      email: 'budget@deped.gov.ph',
      availability: AvailabilityStatus.AVAILABLE,
    }),
    new Personnel({
      id: 'usr-budget-2',
      employeeId: 'SDO-0208',
      fullName: 'Teresa Bautista',
      position: 'Administrative Assistant III (Budget)',
      office: budget,
      role: SystemRole.STAFF,
      email: 'teresa.bautista@deped.gov.ph',
      availability: AvailabilityStatus.ON_LEAVE,
      delegateId: 'usr-budget-1',
    }),
    new Personnel({
      id: 'usr-sgod-1',
      employeeId: 'SDO-0312',
      fullName: 'Rafael Manalo',
      position: 'Senior Education Program Specialist (SGOD)',
      office: sgod,
      role: SystemRole.UNIT_HEAD,
      email: 'sgod@deped.gov.ph',
      availability: AvailabilityStatus.AVAILABLE,
    }),
    new Personnel({
      id: 'usr-hr-1',
      employeeId: 'SDO-0419',
      fullName: 'Lourdes Navarro',
      position: 'Administrative Officer IV (HRMO)',
      office: hr,
      role: SystemRole.UNIT_HEAD,
      email: 'hr@deped.gov.ph',
      availability: AvailabilityStatus.OFFICIAL_BUSINESS,
    }),
    new Personnel({
      id: 'usr-legal-1',
      employeeId: 'SDO-0502',
      fullName: 'Atty. Noel Pangilinan',
      position: 'Attorney III (Legal Unit)',
      office: legal,
      role: SystemRole.LEGAL_OFFICER,
      email: 'legal@deped.gov.ph',
      availability: AvailabilityStatus.AVAILABLE,
    }),
    new Personnel({
      id: 'usr-osds-1',
      employeeId: 'SDO-0001',
      fullName: 'Dr. Elena Magbanua',
      position: 'Schools Division Superintendent',
      office: osds,
      role: SystemRole.UNIT_HEAD,
      email: 'osds@deped.gov.ph',
      availability: AvailabilityStatus.AVAILABLE,
    }),
    new Personnel({
      id: 'usr-acct-1',
      employeeId: 'SDO-0611',
      fullName: 'Danilo Reyes',
      position: 'Accountant III',
      office: acct,
      role: SystemRole.UNIT_HEAD,
      email: 'acct@deped.gov.ph',
      availability: AvailabilityStatus.AVAILABLE,
    }),
    new Personnel({
      id: 'usr-ict-1',
      employeeId: 'SDO-0801',
      fullName: 'Arvin Soriano',
      position: 'Information Technology Officer I',
      office: ict,
      role: SystemRole.ICT_ADMIN,
      email: 'ict@deped.gov.ph',
      availability: AvailabilityStatus.AVAILABLE,
    }),
  ];

  const categories: DocumentCategory[] = [
    new DocumentCategory({
      id: 'cat-1',
      name: 'MOOE Liquidation & Cash Advance',
      code: 'MOOE-LIQ',
      declaredByOfficeCode: 'ACCT',
      declaredByOfficeName: 'Accounting Unit',
      usageCount: 48,
    }),
    new DocumentCategory({
      id: 'cat-2',
      name: 'School Repair & Facilities Request',
      code: 'FAC-REQ',
      declaredByOfficeCode: 'SGOD',
      declaredByOfficeName: 'School Governance & Operations Division',
      usageCount: 31,
    }),
    new DocumentCategory({
      id: 'cat-3',
      name: 'Authority to Travel (Local)',
      code: 'TRAV-LOC',
      declaredByOfficeCode: 'RECORDS',
      declaredByOfficeName: 'Records Section',
      usageCount: 64,
    }),
  ];

  const now = Date.now();
  const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();
  const hoursAhead = (h: number) => new Date(now + h * 3600_000).toISOString();

  const documents: Document[] = [
    new Document({
      id: 'doc-142',
      trackingCode: 'SDO-OM-2026-000142',
      qrToken: '9f4a8b12c7e04a3d91f2a77c8d04142a',
      title: 'Q4 School DRRM Minor Repair Funding Request',
      categoryId: 'cat-2',
      categoryName: 'School Repair & Facilities Request',
      confidentialityTier: ConfidentialityTier.STANDARD_INTERNAL,
      lifecycleStatus: DocumentLifecycleStatus.IN_TRANSIT,
      slaState: SlaState.AT_RISK,
      slaDueAt: hoursAhead(3),
      originOffice: sgod,
      originUserId: 'usr-sgod-1',
      originUserName: 'Rafael Manalo',
      currentOffice: budget,
      currentHolderId: 'usr-budget-1',
      currentHolderName: 'Marco Villareal',
      explicitParticipantIds: ['usr-sgod-1', 'usr-budget-1'],
      submittedSchool: schools[0],
      createdAt: hoursAgo(18),
      versions: [
        new DocumentVersion({
          id: 'ver-142-1',
          versionNumber: 1,
          fileName: 'drrm_repair_endorsement_v1.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1_284_500,
          sha256Checksum: '7c4e9b2011a4f83d9e6b21a5f40983b1c881092a6d7b9e3120a1f7b2c3d4e501',
          uploadedById: 'usr-sgod-1',
          uploadedByName: 'Rafael Manalo',
          uploadedAt: hoursAgo(18),
          revisionNote: 'Endorsed program of works & school inspection sheet',
          storageKey: 'private/docs/doc-142/v1.pdf',
        }),
      ],
      transactions: [
        new RoutingTransaction({
          id: 'tx-142-1',
          documentId: 'doc-142',
          fromUserId: 'usr-sgod-1',
          fromUserName: 'Rafael Manalo',
          fromOffice: sgod,
          toUserId: 'usr-budget-1',
          toUserName: 'Marco Villareal',
          toOffice: budget,
          routingScope: RoutingScope.INTER_OFFICE,
          receiptStatus: ReceiptStatus.PENDING,
          remarks: 'For allotment availability verification and ORS preparation.',
          isInternalOnly: true,
          sentAt: hoursAgo(2),
        }),
      ],
      externalMilestones: [
        {
          id: 'ms-142-1',
          stageLabel: 'Registered at SGOD',
          officeName: sgod.name,
          occurredAt: hoursAgo(18),
        },
        {
          id: 'ms-142-2',
          stageLabel: 'Routed to BUDGET',
          officeName: budget.name,
          occurredAt: hoursAgo(2),
        },
      ],
    }),
    new Document({
      id: 'doc-138',
      trackingCode: 'SDO-OM-2026-000138',
      qrToken: '4b7c2d81e5a1492f88c3b910e21138bc',
      title: 'District Supervisors Quarter Monitoring Travel Order',
      categoryId: 'cat-3',
      categoryName: 'Authority to Travel (Local)',
      confidentialityTier: ConfidentialityTier.STANDARD_INTERNAL,
      lifecycleStatus: DocumentLifecycleStatus.IN_TRANSIT,
      slaState: SlaState.ON_TRACK,
      slaDueAt: hoursAhead(22),
      originOffice: records,
      originUserId: 'usr-records-1',
      originUserName: 'Clarissa Mendoza',
      currentOffice: sgod,
      currentHolderId: 'usr-sgod-1',
      currentHolderName: 'Rafael Manalo',
      explicitParticipantIds: ['usr-records-1', 'usr-sgod-1'],
      submittedSchool: null,
      createdAt: hoursAgo(6),
      versions: [
        new DocumentVersion({
          id: 'ver-138-1',
          versionNumber: 1,
          fileName: 'travel_order_batch_04_v1.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 642_100,
          sha256Checksum: '3d9a12b4009c8812f3b4d118a7c66e9051a2b3c4d5e6f708192a3b4c5d6e7138',
          uploadedById: 'usr-records-1',
          uploadedByName: 'Clarissa Mendoza',
          uploadedAt: hoursAgo(6),
          revisionNote: 'Initial batch logged at Records desk',
          storageKey: 'private/docs/doc-138/v1.pdf',
        }),
      ],
      transactions: [
        new RoutingTransaction({
          id: 'tx-138-1',
          documentId: 'doc-138',
          fromUserId: 'usr-records-1',
          fromUserName: 'Clarissa Mendoza',
          fromOffice: records,
          toUserId: 'usr-sgod-1',
          toUserName: 'Rafael Manalo',
          toOffice: sgod,
          routingScope: RoutingScope.INTER_OFFICE,
          receiptStatus: ReceiptStatus.PENDING,
          remarks: 'Please review attached itinerary before OSDS endorsement.',
          isInternalOnly: true,
          sentAt: hoursAgo(1),
        }),
      ],
      externalMilestones: [
        {
          id: 'ms-138-1',
          stageLabel: 'Registered at RECORDS',
          officeName: records.name,
          occurredAt: hoursAgo(6),
        },
        {
          id: 'ms-138-2',
          stageLabel: 'Routed to SGOD',
          officeName: sgod.name,
          occurredAt: hoursAgo(1),
        },
      ],
    }),
    new Document({
      id: 'doc-115',
      trackingCode: 'SDO-OM-2026-000115',
      qrToken: '1c60a922f1b34b8a9910e4a8c32115ef',
      title: 'Teacher I Reclassification & Service Record Endorsement',
      categoryId: 'cat-1',
      categoryName: 'Appointment & Service Record Endorsement',
      confidentialityTier: ConfidentialityTier.RESTRICTED,
      lifecycleStatus: DocumentLifecycleStatus.IN_REVIEW,
      slaState: SlaState.ON_TRACK,
      slaDueAt: hoursAhead(36),
      originOffice: records,
      originUserId: 'usr-records-1',
      originUserName: 'Clarissa Mendoza',
      currentOffice: budget,
      currentHolderId: 'usr-budget-1',
      currentHolderName: 'Marco Villareal',
      explicitParticipantIds: ['usr-records-1', 'usr-hr-1', 'usr-budget-1'],
      submittedSchool: schools[1],
      createdAt: hoursAgo(24),
      versions: [
        new DocumentVersion({
          id: 'ver-115-1',
          versionNumber: 1,
          fileName: 'reclass_endorsement_pack_v1.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1_850_000,
          sha256Checksum: '9b11e74d2c3a4f508192b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e61115',
          uploadedById: 'usr-records-1',
          uploadedByName: 'Clarissa Mendoza',
          uploadedAt: hoursAgo(24),
          revisionNote: 'Verified NOSCA and CSC evaluation checklist',
          storageKey: 'private/docs/doc-115/v1.pdf',
        }),
      ],
      transactions: [
        new RoutingTransaction({
          id: 'tx-115-1',
          documentId: 'doc-115',
          fromUserId: 'usr-hr-1',
          fromUserName: 'Lourdes Navarro',
          fromOffice: hr,
          toUserId: 'usr-budget-1',
          toUserName: 'Marco Villareal',
          toOffice: budget,
          routingScope: RoutingScope.INTER_OFFICE,
          receiptStatus: ReceiptStatus.ACKNOWLEDGED,
          remarks: 'Funding certification requested prior to OSDS approval.',
          isInternalOnly: true,
          sentAt: hoursAgo(9),
          acknowledgedAt: hoursAgo(8),
          acknowledgedByName: 'Marco Villareal',
        }),
      ],
      externalMilestones: [
        {
          id: 'ms-115-1',
          stageLabel: 'Registered at RECORDS',
          officeName: records.name,
          occurredAt: hoursAgo(24),
        },
        {
          id: 'ms-115-2',
          stageLabel: 'Received by BUDGET',
          officeName: budget.name,
          occurredAt: hoursAgo(8),
        },
      ],
    }),
    new Document({
      id: 'doc-099',
      trackingCode: 'SDO-OM-2026-000099',
      qrToken: '6d2e4a88b9104f3c8765c1e0a90099fa',
      title: 'Confidential Legal Fact-Finding Memo',
      categoryId: 'cat-1',
      categoryName: 'Administrative Fact-Finding Case Folder',
      confidentialityTier: ConfidentialityTier.CONFIDENTIAL,
      lifecycleStatus: DocumentLifecycleStatus.IN_REVIEW,
      slaState: SlaState.ON_TRACK,
      slaDueAt: hoursAhead(14),
      originOffice: legal,
      originUserId: 'usr-legal-1',
      originUserName: 'Atty. Noel Pangilinan',
      currentOffice: osds,
      currentHolderId: 'usr-osds-1',
      currentHolderName: 'Dr. Elena Magbanua',
      explicitParticipantIds: ['usr-legal-1', 'usr-osds-1'],
      submittedSchool: null,
      createdAt: hoursAgo(12),
      versions: [
        new DocumentVersion({
          id: 'ver-099-1',
          versionNumber: 1,
          fileName: 'legal_memo_sealed_v1.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 918_400,
          sha256Checksum: 'f192837465aabbccddeeff00112233445566778899aabbccddeeff0011220099',
          uploadedById: 'usr-legal-1',
          uploadedByName: 'Atty. Noel Pangilinan',
          uploadedAt: hoursAgo(12),
          revisionNote: 'Sealed confidential report under RA 10173 custody',
          storageKey: 'private/docs/doc-099/v1.pdf',
        }),
      ],
      transactions: [
        new RoutingTransaction({
          id: 'tx-099-1',
          documentId: 'doc-099',
          fromUserId: 'usr-legal-1',
          fromUserName: 'Atty. Noel Pangilinan',
          fromOffice: legal,
          toUserId: 'usr-osds-1',
          toUserName: 'Dr. Elena Magbanua',
          toOffice: osds,
          routingScope: RoutingScope.INTER_OFFICE,
          receiptStatus: ReceiptStatus.PENDING,
          remarks: 'For confidential SDS review only.',
          isInternalOnly: true,
          sentAt: hoursAgo(3),
        }),
      ],
      externalMilestones: [
        {
          id: 'ms-099-1',
          stageLabel: 'Registered (Restricted Handling)',
          officeName: legal.name,
          occurredAt: hoursAgo(12),
        },
      ],
    }),
  ];

  const pairings: DesktopPairingSession[] = personnel.map((person) => ({
    pairToken: `pair_${person.id}_01`,
    ownerUserId: person.id,
    draftLabel: `Desktop Registration Draft (${person.office.code})`,
    expiresAt: hoursAhead(2),
  }));

  const offlineQueue: OfflineAttachment[] = [
    new OfflineAttachment({
      id: 'offq-1',
      targetType: 'receipt_proof',
      targetId: 'doc-142',
      targetLabel: 'SDO-OM-2026-000142 (Signed Transmittal Slip)',
      fileName: 'transmittal_slip_0142.jpg',
      mimeType: 'image/jpeg',
      originalBytes: 2_890_000,
      compressedBytes: 264_120,
      sha256Checksum: 'a8d9e1f2c3b4a5968778695a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c',
      exifStripped: true,
      localUri: 'file:///cache/transmittal_slip_0142.jpg',
      status: OfflineQueueStatus.QUEUED,
      retryCount: 1,
      lastError: 'Queued while in low-signal area; ready for retry.',
      createdAt: hoursAgo(1),
    }),
  ];

  const notifications: PrivacySafeNotification[] = [
    {
      id: 'notif-1',
      targetUserId: 'usr-budget-1',
      targetOfficeId: 'off-budget',
      documentId: 'doc-142',
      title: 'Incoming Document · SDO-OM-2026-000142',
      content: 'Q4 School DRRM Minor Repair Funding Request routed from SGOD (SLA due soon).',
      lockScreenPreview: 'New incoming document requires receipt confirmation in BUDGET.',
      authenticatedDetail: 'SDO-OM-2026-000142 routed from SGOD (SLA due soon).',
      receivedAt: hoursAgo(2),
      read: false,
    },
  ];

  const auditLogs: AuditLogEntry[] = [
    new AuditLogEntry({
      id: 'aud-seed-1',
      actorId: 'usr-legal-1',
      actorName: 'Atty. Noel Pangilinan',
      actorOfficeCode: 'LEGAL',
      action: AuditAction.FORWARDED,
      documentId: 'doc-099',
      trackingCode: 'SDO-OM-2026-000099',
      summary: 'Forwarded Confidential record to OSDS custody.',
      deviceLabel: 'Web Desktop (TLS)',
      occurredAt: hoursAgo(3),
    }),
  ];

  return {
    offices: TEST_OFFICES,
    personnel,
    schools,
    categories,
    documents,
    pairings,
    offlineQueue,
    notifications,
    auditLogs,
  };
}
