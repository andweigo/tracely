import { Document } from '../../domain/entities/Document';
import { DocumentCategory } from '../../domain/entities/DocumentCategory';
import { DocumentVersion, VersionChangeType } from '../../domain/entities/DocumentVersion';
import { ConfidentialityTier } from '../../domain/enums/DomainEnums';
import { OfficeSummary, Personnel } from '../../domain/entities/Personnel';
import type { DocumentTrackingSnapshot } from '../../domain/security/AccessPolicy';
import { DesktopPairingSession } from '../../domain/security/QrPayload';

export type CommentVisibility = 'cross_office' | 'internal_office';

export interface DocumentComment {
  readonly id: string;
  readonly documentId: string;
  readonly authorId: string;
  readonly authorName: string;
  readonly authorOfficeId: string;
  readonly authorOfficeCode: string;
  readonly authorPosition: string;
  readonly visibility: CommentVisibility;
  readonly body: string;
  readonly createdAt: string;
}

export interface RealtimePulseResponse {
  readonly cursor: number;
  readonly changed: boolean;
  readonly transport: string;
  readonly fcmConfigured: boolean;
  readonly registeredPushDevices: number;
}

export const DISPOSITION_REMARK_PRESETS: ReadonlyArray<string> = [
  'For Signature',
  'For Indorsement',
  'For Budget Certification',
  'For Appropriate Action',
  'For Information / File',
  'Approved & Released',
  'Complied / Revised',
];

export interface PrivacySafeNotification {
  readonly id: string;
  readonly targetUserId: string;
  readonly targetOfficeId: string;
  readonly documentId: string;
  readonly title: string;
  readonly content: string;
  readonly lockScreenPreview: string;
  readonly authenticatedDetail: string;
  readonly receivedAt: string;
  read: boolean;
}

export interface PresignedDownloadGrant {
  readonly url: string;
  readonly expiresAt: string;
  readonly ttlSeconds: number;
  readonly version: DocumentVersion;
}

export interface AcknowledgePayload {
  readonly documentId: string;
  readonly verificationCode?: string;
  readonly password?: string;
  readonly proofPhoto?: {
    readonly uri: string;
    readonly fileName: string;
    readonly mimeType: string;
    readonly compressedBytes: number;
    readonly sha256Checksum: string;
    readonly exifStripped: boolean;
  } | null;
}

export interface ForwardDocumentPayload {
  readonly documentId: string;
  readonly recipientUserId: string;
  readonly remarks: string;
  readonly routeToDelegateIfOnLeave?: boolean;
}

export interface UploadRevisionPayload {
  readonly documentId: string;
  readonly fileUri: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256Checksum: string;
  readonly revisionNote: string;
  readonly changeType?: VersionChangeType;
}

export interface RegisterHardCopyPayload {
  readonly title: string;
  readonly categoryId: string;
  readonly confidentialityTier: ConfidentialityTier;
  readonly recipientUserId?: string | null;
  readonly remarks?: string;
  readonly routeToDelegateIfOnLeave?: boolean;
  readonly physicalReference?: string | null;
  readonly physicalPageCount?: number | null;
}

export interface CreateDigitalDocumentPayload {
  readonly title: string;
  readonly categoryId: string;
  readonly confidentialityTier: ConfidentialityTier;
  readonly fileUri: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256Checksum: string;
  readonly recipientUserId?: string | null;
  readonly remarks?: string;
  readonly routeToDelegateIfOnLeave?: boolean;
}

export interface UploadMobilePhotoPayload {
  readonly targetType: 'desktop_pair' | 'receipt_proof' | 'revision_draft';
  readonly targetId: string;
  readonly fileUri: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly compressedBytes: number;
  readonly sha256Checksum: string;
  readonly exifStripped: boolean;
}

export interface IDocumentRepository {
  listOffices(): Promise<ReadonlyArray<OfficeSummary>>;
  listPersonnel(): Promise<ReadonlyArray<Personnel>>;
  listDocuments(): Promise<ReadonlyArray<Document>>;
  listTrackedSummaries(): Promise<ReadonlyArray<DocumentTrackingSnapshot>>;
  trackByCode(trackingCode: string): Promise<DocumentTrackingSnapshot | null>;
  getDocumentById(id: string): Promise<Document>;
  createDigitalDocument(payload: CreateDigitalDocumentPayload): Promise<Document>;
  registerHardCopyDocument(payload: RegisterHardCopyPayload): Promise<Document>;
  acknowledgeReceipt(payload: AcknowledgePayload): Promise<Document>;
  forwardDocument(payload: ForwardDocumentPayload): Promise<Document>;
  recallLatestTransfer(documentId: string): Promise<Document>;
  declineMisrouted(documentId: string, reason: string): Promise<Document>;
  returnForRevision(documentId: string, remarks: string): Promise<Document>;
  uploadRevisionVersion(payload: UploadRevisionPayload): Promise<Document>;
  issuePresignedViewGrant(documentId: string, versionNumber: number): Promise<PresignedDownloadGrant>;
  resolveDocumentQr(opaqueToken: string): Promise<Document>;
  resolveDesktopPairingQr(opaqueToken: string): Promise<DesktopPairingSession>;
  consumeUnlockChallenge?(codeOrToken: string, documentId?: string): Promise<Document>;
  verifyTransmittalQr(opaqueToken: string): Promise<{
    readonly trackingCode: string;
    readonly lifecycleStatus: string;
    readonly currentOfficeName: string;
    readonly latestChecksumShort: string;
    readonly milestoneCount: number;
  }>;
  uploadMobilePhoto(payload: UploadMobilePhotoPayload): Promise<void>;
  listCategories(): Promise<ReadonlyArray<DocumentCategory>>;
  declareCategory(name: string, code: string): Promise<DocumentCategory>;
  updateAdminCategory?(
    categoryId: string,
    patch: { name?: string; code?: string },
  ): Promise<DocumentCategory>;
  deleteAdminCategory?(categoryId: string): Promise<void>;
  listNotifications(): Promise<ReadonlyArray<PrivacySafeNotification>>;
  markNotificationRead(notificationId: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
  completeDocument?(
    documentId: string,
    status: 'approved' | 'archived',
    remarks?: string,
  ): Promise<Document>;
  updateDocumentDetails?(
    documentId: string,
    patch: {
      title?: string;
      categoryId?: string;
      confidentialityTier?: ConfidentialityTier;
      physicalReference?: string | null;
      physicalPageCount?: number | null;
    },
  ): Promise<Document>;
  listDocumentComments?(documentId: string): Promise<ReadonlyArray<DocumentComment>>;
  addDocumentComment?(
    documentId: string,
    body: string,
    visibility: CommentVisibility,
  ): Promise<DocumentComment>;
  issueProofPhotoViewGrant?(
    documentId: string,
    transactionId: string,
  ): Promise<PresignedDownloadGrant>;
  pollRealtimePulse?(sinceCursor: number): Promise<RealtimePulseResponse>;
  getSentContributions?(timezone?: string): Promise<SentContributionReport>;
}

export interface SentContributionSeries {
  readonly officeId?: string;
  readonly officeCode?: string;
  readonly officeName?: string;
  readonly total: number;
  readonly activeDays: number;
  readonly peakCount: number;
  readonly peakDate: string | null;
  readonly currentStreak: number;
  readonly days: Readonly<Record<string, number>>;
}

export interface SentContributionReport {
  readonly generatedAt: string;
  readonly timezone: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly user: SentContributionSeries;
  readonly office: SentContributionSeries;
}
