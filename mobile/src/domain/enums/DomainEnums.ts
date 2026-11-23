export const ConfidentialityTier = {
  STANDARD_INTERNAL: 'standard_internal',
  RESTRICTED: 'restricted',
  CONFIDENTIAL: 'confidential',
} as const;
export type ConfidentialityTier = (typeof ConfidentialityTier)[keyof typeof ConfidentialityTier];

export const DocumentCopyFormat = {
  DIGITAL: 'digital',
  HARD_COPY: 'hard_copy',
  HYBRID: 'hybrid',
} as const;
export type DocumentCopyFormat =
  (typeof DocumentCopyFormat)[keyof typeof DocumentCopyFormat];

export const AvailabilityStatus = {
  AVAILABLE: 'available',
  ON_LEAVE: 'on_leave',
  OFFICIAL_BUSINESS: 'official_business',
} as const;
export type AvailabilityStatus = (typeof AvailabilityStatus)[keyof typeof AvailabilityStatus];

export const SystemRole = {
  RECORDS_OFFICER: 'records_officer',
  UNIT_HEAD: 'unit_head',
  STAFF: 'staff',
  LEGAL_OFFICER: 'legal_officer',
  ICT_ADMIN: 'ict_admin',
} as const;
export type SystemRole = (typeof SystemRole)[keyof typeof SystemRole];

export const RoutingScope = {
  INTERNAL_OFFICE: 'internal_office',
  INTER_OFFICE: 'inter_office',
} as const;
export type RoutingScope = (typeof RoutingScope)[keyof typeof RoutingScope];

export const ReceiptStatus = {
  PENDING: 'pending',
  ACKNOWLEDGED: 'acknowledged',
  RECALLED: 'recalled',
  DECLINED_MISROUTED: 'declined_misrouted',
  RETURNED_FOR_REVISION: 'returned_for_revision',
} as const;
export type ReceiptStatus = (typeof ReceiptStatus)[keyof typeof ReceiptStatus];

export const DocumentLifecycleStatus = {
  REGISTERED: 'registered',
  IN_TRANSIT: 'in_transit',
  IN_REVIEW: 'in_review',
  RETURNED_FOR_REVISION: 'returned_for_revision',
  APPROVED: 'approved',
  ARCHIVED: 'archived',
} as const;
export type DocumentLifecycleStatus =
  (typeof DocumentLifecycleStatus)[keyof typeof DocumentLifecycleStatus];

export const SlaState = {
  ON_TRACK: 'on_track',
  AT_RISK: 'at_risk',
  OVERDUE: 'overdue',
} as const;
export type SlaState = (typeof SlaState)[keyof typeof SlaState];

export const AuditAction = {
  VIEWED: 'viewed',
  DOWNLOADED: 'downloaded',
  PRESIGNED_URL_ISSUED: 'presigned_url_issued',
  QR_SCANNED: 'qr_scanned',
  QR_ACCESS_DENIED: 'qr_access_denied',
  ACKNOWLEDGED: 'acknowledged',
  FORWARDED: 'forwarded',
  RECALLED: 'recalled',
  DECLINED_MISROUTED: 'declined_misrouted',
  RETURNED_FOR_REVISION: 'returned_for_revision',
  VERSION_UPLOADED: 'version_uploaded',
  MOBILE_PHOTO_ATTACHED: 'mobile_photo_attached',
  CATEGORY_DECLARED: 'category_declared',
  CACHE_WIPED: 'cache_wiped',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

export const OfflineQueueStatus = {
  QUEUED: 'queued',
  UPLOADING: 'uploading',
  SYNCED: 'synced',
  FAILED: 'failed',
} as const;
export type OfflineQueueStatus = (typeof OfflineQueueStatus)[keyof typeof OfflineQueueStatus];
