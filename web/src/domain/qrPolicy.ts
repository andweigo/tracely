import { QrResolutionResult } from './types';

const ENV_API_BASE_URL = (
  typeof import.meta !== 'undefined'
    ? ((import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ?? '')
    : ''
)
  .trim()
  .replace(/\/+$/, '');

export const PRODUCTION_API_BASE_URL = ENV_API_BASE_URL || 'https://api.tracely.app/api/v1';
export const LOCAL_DEV_API_BASE_URL = 'http://127.0.0.1:8000/api/v1';
const IS_VITE_DEV =
  typeof import.meta !== 'undefined' &&
  Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);

export const DEFAULT_API_BASE_URL = IS_VITE_DEV
  ? LOCAL_DEV_API_BASE_URL
  : PRODUCTION_API_BASE_URL;
export const STORAGE_KEY_API_URL = '@sdo_doctrack/api_base_url';
export const AUTH_REQUIRED = true;

export type ParsedQrToken =
  | { readonly kind: 'document'; readonly opaqueToken: string }
  | { readonly kind: 'desktop_pair'; readonly opaqueToken: string }
  | { readonly kind: 'transmittal_verify'; readonly opaqueToken: string }
  | { readonly kind: 'unlock_challenge'; readonly opaqueToken: string };

export function parseOpaqueQrToken(rawValue: string): ParsedQrToken {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    throw new Error('Enter a tracking code or QR token.');
  }

  const upper = trimmed.toUpperCase();
  for (const prefix of ['TRC-QR:DOC:', 'SDO-QR:DOC:']) {
    if (upper.startsWith(prefix)) {
      const token = trimmed.slice(prefix.length).trim();
      if (!token) throw new Error('Document QR token is missing.');
      return { kind: 'document', opaqueToken: token };
    }
  }
  for (const prefix of ['TRC-QR:PAIR:', 'SDO-QR:PAIR:']) {
    if (upper.startsWith(prefix)) {
      const token = trimmed.slice(prefix.length).trim();
      if (!token) throw new Error('Desktop pairing QR token is missing.');
      return { kind: 'desktop_pair', opaqueToken: token };
    }
  }
  for (const prefix of ['TRC-QR:VERIFY:', 'SDO-QR:VERIFY:']) {
    if (upper.startsWith(prefix)) {
      const token = trimmed.slice(prefix.length).trim();
      if (!token) throw new Error('Transmittal verification QR token is missing.');
      return { kind: 'transmittal_verify', opaqueToken: token };
    }
  }
  for (const prefix of ['TRC-QR:UNLOCK:', 'SDO-QR:UNLOCK:']) {
    if (upper.startsWith(prefix)) {
      const token = trimmed.slice(prefix.length).trim();
      if (!token) throw new Error('Unlock QR token is missing.');
      return { kind: 'unlock_challenge', opaqueToken: token };
    }
  }

  // Manual entry: 6-char Mobile <-> Web unlock code (e.g. K7P-492)
  if (/^[2-9A-HJ-NP-Z]{3}-?[2-9A-HJ-NP-Z]{3}$/i.test(trimmed)) {
    return { kind: 'unlock_challenge', opaqueToken: upper.replace(/-/g, '') };
  }

  // Manual entry: human-readable tracking code (e.g. TRC-2026-000142 or legacy SDO-OM-2026-000142)
  if (/^(?:TRC|SDO)-[A-Z0-9]{2,8}(?:-[A-Z0-9]+)+$/i.test(trimmed)) {
    return { kind: 'document', opaqueToken: upper };
  }

  // Manual entry: raw desktop pairing token (e.g. pair-9f4a8b12...)
  if (/^pair-[a-z0-9_-]{6,64}$/i.test(trimmed)) {
    return { kind: 'desktop_pair', opaqueToken: trimmed };
  }

  // Manual entry: raw opaque document QR token (hex 16-64 chars or prefixed test token)
  if (/^[0-9a-f]{16,64}$/i.test(trimmed) || /^(?:qr_|tok_|opaque)[a-z0-9_-]{4,64}$/i.test(trimmed)) {
    return { kind: 'document', opaqueToken: trimmed };
  }

  throw new Error(
    'Enter a valid Tracely tracking code (e.g. TRC-2026-000142) or opaque QR token.',
  );
}

export function validateApiBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('API base URL cannot be empty.');
  }
  const isHttps = trimmed.startsWith('https://');
  const isLocalHttp =
    trimmed.startsWith('http://localhost') ||
    trimmed.startsWith('http://127.0.0.1') ||
    trimmed.startsWith('http://10.0.2.2');
  const isDevLanHttp =
    IS_VITE_DEV &&
    /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3})(:\d+)?(\/|$)/.test(
      trimmed,
    );
  if (!isHttps && !isLocalHttp && !isDevLanHttp) {
    throw new Error(
      'Production Tracely endpoints must use HTTPS (plain HTTP is allowed only for localhost or dev LAN).',
    );
  }
  return trimmed;
}

export interface WebBackendGateway {
  login(
    identifier: string,
    password: string,
  ): Promise<{ bearerToken: string; user: import('./types').Personnel }>;
  register(payload: {
    fullName: string;
    employeeId: string;
    email: string;
    position: string;
    officeCode: string;
    customOfficeName?: string;
    password: string;
  }): Promise<{
    pendingApproval: boolean;
    message: string;
    statusToken?: string | null;
    submitted?: import('./types').PendingRegistrationSummary | null;
    bearerToken?: string;
    user?: import('./types').Personnel;
  }>;
  checkRegistrationStatus?(statusToken: string): Promise<{
    status: import('./types').PendingApprovalStatus;
    canSignIn: boolean;
    message: string;
    submitted?: import('./types').PendingRegistrationSummary | null;
  }>;
  logout(): Promise<void>;
  listWorkspace(): Promise<{
    offices: ReadonlyArray<import('./types').OfficeSummary>;
    personnel: ReadonlyArray<import('./types').Personnel>;
    documents: ReadonlyArray<import('./types').DocumentRecord>;
    trackedSnapshots: ReadonlyArray<import('./types').DocumentTrackingSnapshot>;
    categories: ReadonlyArray<import('./types').DocumentCategory>;
    notifications: ReadonlyArray<import('./types').PrivacySafeNotification>;
  }>;
  trackByCode(code: string): Promise<import('./types').DocumentTrackingSnapshot | null>;
  createDigitalDocument(payload: {
    title: string;
    categoryId: string;
    confidentialityTier: import('./types').ConfidentialityTier;
    file: File;
    fileName?: string;
    sha256Checksum: string;
    recipientUserId?: string | null;
    remarks?: string;
  }): Promise<import('./types').DocumentRecord>;
  registerHardCopyDocument(payload: {
    title: string;
    categoryId: string;
    confidentialityTier: import('./types').ConfidentialityTier;
    physicalReference?: string | null;
    physicalPageCount?: number | null;
    recipientUserId?: string | null;
    remarks?: string;
  }): Promise<import('./types').DocumentRecord>;
  acknowledgeReceipt(
    documentId: string,
    remarks?: string,
    proofPhoto?: { file: File; sha256Checksum: string } | null,
    verificationCode?: string,
    password?: string,
  ): Promise<import('./types').DocumentRecord>;
  createUnlockChallenge?(
    documentId: string,
  ): Promise<import('./types').DocumentUnlockChallenge>;
  consumeUnlockChallenge?(
    codeOrToken: string,
  ): Promise<import('./types').DocumentRecord>;
  completeDocument?(
    documentId: string,
    status: 'approved' | 'archived',
    remarks?: string,
  ): Promise<import('./types').DocumentRecord>;
  listDocumentComments?(
    documentId: string,
  ): Promise<ReadonlyArray<import('./types').DocumentComment>>;
  addDocumentComment?(
    documentId: string,
    body: string,
    visibility: import('./types').CommentVisibility,
  ): Promise<import('./types').DocumentComment>;
  issueProofPhotoView?(
    documentId: string,
    transactionId: string,
  ): Promise<import('./types').PresignedDownloadGrant>;
  forwardDocument(
    documentId: string,
    recipientUserId: string,
    remarks: string,
  ): Promise<import('./types').DocumentRecord>;
  returnForRevision(documentId: string, remarks: string): Promise<import('./types').DocumentRecord>;
  declineMisrouted(documentId: string, reason: string): Promise<import('./types').DocumentRecord>;
  recallTransfer(documentId: string): Promise<import('./types').DocumentRecord>;
  updateDocumentDetails?(
    documentId: string,
    patch: import('./types').DocumentUpdatePayload,
  ): Promise<import('./types').DocumentRecord>;
  uploadRevision(payload: {
    documentId: string;
    file: File;
    fileName?: string;
    sha256Checksum: string;
    revisionNote: string;
  }): Promise<import('./types').DocumentRecord>;
  issuePresignedView(
    documentId: string,
    versionNumber: number,
  ): Promise<import('./types').PresignedDownloadGrant>;
  resolveQr(rawValue: string): Promise<QrResolutionResult>;
  createDesktopPairSession(draftLabel: string): Promise<import('./types').DesktopPairingSession>;
  getDesktopPairStatus?(pairToken: string): Promise<import('./types').DesktopPairStatus>;
  declareCategory(name: string, code: string): Promise<import('./types').DocumentCategory>;
  markNotificationRead?(notificationId: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
  listAuditLogs(documentId?: string): Promise<ReadonlyArray<import('./types').AuditLogEntry>>;
  updateAvailability(
    status: import('./types').AvailabilityStatus,
    delegateId?: string | null,
    until?: string | null,
  ): Promise<import('./types').Personnel>;
  updateProfile?(
    patch: import('./types').ProfileUpdatePayload,
  ): Promise<import('./types').Personnel>;
  updatePreferences?(
    patch: Partial<import('./types').UserPreferences>,
  ): Promise<{ user: import('./types').Personnel; preferences: import('./types').UserPreferences }>;
  listActiveSessions(): Promise<ReadonlyArray<import('./types').ActiveDeviceSession>>;
  revokeOtherSessions(): Promise<number>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  listPendingUsers?(): Promise<ReadonlyArray<import('./types').Personnel>>;
  approveUser?(userId: string): Promise<import('./types').Personnel>;
  rejectUser?(userId: string, reason?: string): Promise<void>;
  listAdminUsers?(): Promise<ReadonlyArray<import('./types').Personnel>>;
  createAdminUser?(
    payload: import('./types').AdminCreateUserPayload,
  ): Promise<import('./types').Personnel>;
  updateAdminUser?(
    userId: string,
    patch: import('./types').AdminUpdateUserPayload,
  ): Promise<import('./types').Personnel>;
  createAdminOffice?(payload: { code: string; name: string }): Promise<import('./types').OfficeSummary>;
  updateAdminOffice?(
    officeId: string,
    patch: { code?: string; name?: string },
  ): Promise<import('./types').OfficeSummary>;
  updateAdminCategory?(
    categoryId: string,
    patch: { name?: string; code?: string },
  ): Promise<import('./types').DocumentCategory>;
  deleteAdminCategory?(categoryId: string): Promise<void>;
  pollRealtimePulse?(sinceCursor: number): Promise<import('./types').RealtimePulseResponse>;
  streamRealtimeEvents?(
    sinceCursor: number,
    signal: AbortSignal,
    onUpdate: (cursor: number) => void,
  ): Promise<void>;
  requestPasswordReset?(identifier: string): Promise<{ message: string; devResetCode?: string }>;
  confirmPasswordReset?(identifier: string, resetCode: string, newPassword: string): Promise<string>;
  listRoutingTemplates?(): Promise<ReadonlyArray<import('./types').RoutingTemplate>>;
  createRoutingTemplate?(payload: {
    name: string;
    description?: string;
    categoryId?: string | null;
    isGlobal?: boolean;
    steps: ReadonlyArray<{ officeId: string; defaultRemarks?: string }>;
  }): Promise<import('./types').RoutingTemplate>;
  deleteRoutingTemplate?(templateId: string): Promise<void>;
  getTurnaroundAnalytics?(): Promise<import('./types').TurnaroundAnalyticsReport>;
  listDocumentsPage?(params: {
    q?: string;
    status?: string;
    copyFormat?: string;
    categoryId?: string;
    page?: number;
    perPage?: number;
  }): Promise<import('./types').PaginatedDocumentsResult>;
  verifyPublicTransmittal?(token: string): Promise<{
    readonly trackingCode: string;
    readonly lifecycleStatus: string;
    readonly currentOfficeName: string;
    readonly latestChecksumShort: string;
    readonly milestoneCount: number;
  }>;
}
