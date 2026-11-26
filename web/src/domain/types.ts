export type ConfidentialityTier = 'standard_internal' | 'restricted' | 'confidential';
export type DocumentCopyFormat = 'digital' | 'hard_copy' | 'hybrid';
export type AvailabilityStatus = 'available' | 'on_leave' | 'official_business';
export type RoutingScope = 'internal_office' | 'inter_office';
export type ReceiptStatus =
  | 'pending'
  | 'acknowledged'
  | 'recalled'
  | 'declined_misrouted'
  | 'returned_for_revision';
export type DocumentLifecycleStatus =
  | 'registered'
  | 'in_transit'
  | 'in_review'
  | 'returned_for_revision'
  | 'approved'
  | 'archived';
export type SlaState = 'on_track' | 'at_risk' | 'overdue';

export type WebRoute =
  | 'dashboard'
  | 'inbox'
  | 'send'
  | 'sent'
  | 'completed'
  | 'document'
  | 'track'
  | 'analytics'
  | 'categories'
  | 'alerts'
  | 'profile'
  | 'user_profile'
  | 'settings'
  | 'verify'
  | 'pending_approval'
  | 'login';

export type PendingApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface PendingRegistrationSummary {
  readonly fullName: string;
  readonly employeeId: string;
  readonly email: string;
  readonly position: string;
  readonly officeCode: string;
  readonly officeName: string;
  readonly submittedAt: string;
}

export interface PendingRegistrationRecord extends PendingRegistrationSummary {
  readonly status: PendingApprovalStatus;
  readonly statusToken: string | null;
  readonly message: string;
  readonly checkedAt?: string | null;
}

export interface AdminCreateUserPayload {
  readonly fullName: string;
  readonly employeeId: string;
  readonly email: string;
  readonly position: string;
  readonly officeId: string;
  readonly role: string;
  readonly password: string;
}

export interface AdminUpdateUserPayload {
  readonly fullName?: string;
  readonly email?: string;
  readonly role?: string;
  readonly officeId?: string;
  readonly position?: string;
  readonly availability?: AvailabilityStatus;
  readonly active?: boolean;
  readonly newPassword?: string;
}

export type LandingScreenPreference = 'inbox' | 'sent' | 'track';

export interface UserPreferences {
  readonly defaultCopyFormat: 'digital' | 'hard_copy';
  readonly defaultRoutingScope: RoutingScope;
  readonly defaultRemarks: string;
  readonly defaultLandingScreen: LandingScreenPreference;
  readonly compactDensity: boolean;
  readonly desktopNotifications: boolean;
  readonly notificationSound: boolean;
  readonly hideLockScreenTitles: boolean;
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  defaultCopyFormat: 'digital',
  defaultRoutingScope: 'inter_office',
  defaultRemarks: '',
  defaultLandingScreen: 'inbox',
  compactDensity: false,
  desktopNotifications: true,
  notificationSound: true,
  hideLockScreenTitles: true,
};

export const AVATAR_COLOR_OPTIONS: ReadonlyArray<{ hex: string; label: string }> = [
  { hex: '#5736E4', label: 'Royal Violet' },
  { hex: '#0D3472', label: 'Tracely Navy' },
  { hex: '#0F766E', label: 'Teal' },
  { hex: '#047857', label: 'Emerald' },
  { hex: '#4338CA', label: 'Indigo' },
  { hex: '#B45309', label: 'Amber' },
  { hex: '#BE123C', label: 'Crimson' },
];

export interface ProfileUpdatePayload {
  readonly fullName?: string;
  readonly email?: string;
  readonly position?: string;
  readonly contactNumber?: string | null;
  readonly deskNote?: string | null;
  readonly avatarColor?: string;
}

export interface DocumentUpdatePayload {
  readonly title?: string;
  readonly categoryId?: string;
  readonly confidentialityTier?: ConfidentialityTier;
  readonly physicalReference?: string | null;
  readonly physicalPageCount?: number | null;
}

export interface OfficeSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isCustom?: boolean;
}

export interface Personnel {
  readonly id: string;
  readonly fullName: string;
  readonly employeeId: string;
  readonly email: string;
  readonly position: string;
  readonly contactNumber?: string | null;
  readonly deskNote?: string | null;
  readonly avatarColor?: string;
  readonly preferences?: UserPreferences;
  readonly role?: string;
  readonly roleLabel: string;
  readonly office: OfficeSummary;
  readonly availability: AvailabilityStatus;
  readonly availabilityUntil?: string | null;
  readonly delegateId?: string | null;
  readonly active?: boolean;
  readonly approvalStatus?: string;
  readonly mustChangePassword?: boolean;
  readonly initials: string;
}

export interface ProofPhotoSummary {
  readonly fileName: string;
  readonly compressedBytes: number;
  readonly sha256Checksum: string;
  readonly exifStripped: boolean;
  readonly capturedAt: string;
}

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

export type VersionChangeType =
  | 'initial'
  | 'signed'
  | 'revised'
  | 'endorsed'
  | 'supporting_attachment';

export interface DocumentVersion {
  readonly versionNumber: number;
  readonly changeType?: VersionChangeType;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256Checksum: string;
  readonly uploadedAt: string;
  readonly uploadedByName: string;
  readonly uploadedByOfficeCode?: string;
  readonly uploadedByOfficeName?: string;
  readonly note: string;
}

export interface RoutingTransaction {
  readonly id: string;
  readonly fromUserId?: string;
  readonly fromUserName?: string;
  readonly fromOffice: OfficeSummary;
  readonly toUserId?: string;
  readonly toOffice: OfficeSummary;
  readonly recipientName: string;
  readonly scope: RoutingScope;
  readonly status: ReceiptStatus;
  readonly remarks: string;
  readonly sentAt: string;
  readonly receivedAt: string | null;
  readonly receivedByName: string | null;
  readonly proofPhoto?: ProofPhotoSummary | null;
}

export interface DocumentRecord {
  readonly id: string;
  readonly isSealed?: boolean;
  readonly attachmentCount?: number;
  readonly trackingCode: string;
  readonly qrToken: string;
  readonly title: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly confidentialityTier: ConfidentialityTier;
  readonly copyFormat: DocumentCopyFormat;
  readonly lifecycleStatus: DocumentLifecycleStatus;
  readonly slaState: SlaState;
  readonly slaDueAt: string | null;
  readonly originUserId?: string;
  readonly originUserName?: string;
  readonly originOffice: OfficeSummary;
  readonly currentOffice: OfficeSummary;
  readonly submittedSchoolName: string | null;
  readonly submittedSchoolId: string | null;
  readonly physicalReference: string | null;
  readonly physicalPageCount: number | null;
  readonly versions: ReadonlyArray<DocumentVersion>;
  readonly transactions: ReadonlyArray<RoutingTransaction>;
  readonly createdAt: string;
}

export interface DocumentTrackingSnapshot {
  readonly documentId: string;
  readonly trackingCode: string;
  readonly displayTitle: string;
  readonly copyFormat: DocumentCopyFormat;
  readonly lifecycleStatus: DocumentLifecycleStatus;
  readonly slaState: SlaState;
  readonly originOffice?: OfficeSummary;
  readonly originTimestamp?: string | null;
  readonly currentOffice: OfficeSummary;
  readonly currentHolderName: string | null;
  readonly receivedAt: string | null;
  readonly lastUpdatedAt: string;
  readonly visibility: 'full' | 'location_only';
  readonly isInternalOfficeStage: boolean;
  readonly physicalSummary: string | null;
  readonly milestones: ReadonlyArray<{
    readonly id: string;
    readonly officeCode: string;
    readonly officeName: string;
    readonly status: ReceiptStatus;
    readonly state?: 'completed' | 'active' | 'pending';
    readonly timestamp: string;
    readonly actorName: string | null;
    readonly note: string;
  }>;
}

export interface DocumentCategory {
  readonly id: string;
  readonly name: string;
  readonly code: string;
  readonly declaredByOfficeCode: string;
  readonly isGlobal: boolean;
}

export interface PrivacySafeNotification {
  readonly id: string;
  readonly documentId: string;
  readonly title: string;
  readonly content: string;
  readonly lockScreenPreview: string;
  readonly authenticatedDetail: string;
  readonly receivedAt: string;
  readonly read: boolean;
}

export interface AuditLogEntry {
  readonly id: string;
  readonly action: string;
  readonly actorName: string;
  readonly officeCode: string;
  readonly summary: string;
  readonly createdAt: string;
}

export interface ActiveDeviceSession {
  readonly id: string;
  readonly deviceName: string;
  readonly ipHint: string;
  readonly lastActiveAt: string;
  readonly current: boolean;
}

export interface PresignedDownloadGrant {
  readonly url: string;
  readonly expiresAt: string;
  readonly ttlSeconds: number;
  readonly version: DocumentVersion;
}

export interface DesktopPairingSession {
  readonly pairToken: string;
  readonly draftLabel: string;
  readonly expiresAt: string;
}

export interface DocumentUnlockChallenge {
  readonly challengeId: string;
  readonly documentId: string;
  readonly token: string;
  readonly qrPayload: string;
  readonly shortCode: string;
  readonly expiresAt: string;
  readonly ttlSeconds?: number;
  readonly reused?: boolean;
}

export interface RoutingTemplateStep {
  readonly order: number;
  readonly officeId: string;
  readonly officeCode: string;
  readonly officeName: string;
  readonly defaultRemarks: string;
}

export interface RoutingTemplate {
  readonly id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly categoryId?: string | null;
  readonly categoryName?: string | null;
  readonly officeId: string;
  readonly officeCode: string;
  readonly officeName: string;
  readonly createdByUserId: string;
  readonly createdByName: string;
  readonly isGlobal: boolean;
  readonly steps: ReadonlyArray<RoutingTemplateStep>;
  readonly createdAt?: string;
}

export interface TurnaroundAnalyticsReport {
  readonly generatedAt: string;
  readonly summary: {
    readonly totalDocuments: number;
    readonly activeCount: number;
    readonly completedCount: number;
    readonly stalledCount: number;
    readonly overdueCount: number;
    readonly atRiskCount: number;
    readonly onTrackCount: number;
    readonly avgTurnaroundHours: number;
    readonly onTimeRatePercent: number;
  };
  readonly byFormat: {
    readonly digital: number;
    readonly hardCopy: number;
    readonly hybrid: number;
  };
  readonly byOffice: ReadonlyArray<{
    readonly officeId: string;
    readonly officeCode: string;
    readonly officeName: string;
    readonly handledCount: number;
    readonly pendingCount: number;
    readonly overdueCount: number;
    readonly avgHours: number;
  }>;
  readonly monthlyThroughput: ReadonlyArray<{
    readonly month: string;
    readonly label: string;
    readonly createdCount: number;
    readonly completedCount: number;
  }>;
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

export interface PaginatedDocumentsResult {
  readonly data: ReadonlyArray<DocumentRecord>;
  readonly meta: {
    readonly currentPage: number;
    readonly lastPage: number;
    readonly perPage: number;
    readonly total: number;
  };
}

export interface DesktopPairStatus {
  readonly pairToken: string;
  readonly attached: boolean;
  readonly fileName?: string | null;
  readonly sha256Checksum?: string | null;
  readonly compressedBytes?: number | null;
  readonly uploadedAt?: string | null;
}

export type QrResolutionResult =
  | {
      readonly kind: 'document_authorized';
      readonly document: DocumentRecord;
      readonly pendingForActorOffice: boolean;
      readonly sentByActor?: boolean;
      readonly verificationCode?: string;
    }
  | {
      readonly kind: 'document_denied';
      readonly trackingCode: string;
      readonly reason: string;
    }
  | {
      readonly kind: 'desktop_pair_ready';
      readonly pairing: DesktopPairingSession;
    }
  | {
      readonly kind: 'transmittal_verified';
      readonly trackingCode: string;
      readonly lifecycleStatus: string;
      readonly currentOfficeName: string;
      readonly latestChecksumShort: string;
      readonly milestoneCount: number;
    };

export interface RecentScanEntry {
  readonly id: string;
  readonly kind: QrResolutionResult['kind'];
  readonly trackingCode: string;
  readonly label: string;
  readonly subtitle: string;
  readonly documentId?: string;
  readonly scannedAt: string;
}

export interface UserSecurityPreferences {
  readonly biometricLock: boolean;
  readonly screenshotShield: boolean;
}

export interface ToastAction {
  readonly label: string;
  readonly onClick: () => void;
}

export interface ToastMessage {
  readonly id: number;
  readonly tone: 'success' | 'error' | 'info';
  readonly text: string;
  readonly action?: ToastAction;
}
