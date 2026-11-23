import { AuditLogEntry } from '../entities/AuditLogEntry';
import { Document, ExternalMilestone } from '../entities/Document';
import { DocumentCategory } from '../entities/DocumentCategory';
import { DocumentVersion } from '../entities/DocumentVersion';
import {
  DEFAULT_USER_WORKFLOW_PREFERENCES,
  LandingTabPreference,
  OfficeSummary,
  Personnel,
  UserWorkflowPreferences,
} from '../entities/Personnel';
import { RoutingTransaction } from '../entities/RoutingTransaction';
import { School } from '../entities/School';
import type { ActiveDeviceSession } from '../entities/UserSecurityProfile';
import {
  AuditAction,
  AvailabilityStatus,
  ConfidentialityTier,
  DocumentCopyFormat,
  DocumentLifecycleStatus,
  ReceiptStatus,
  RoutingScope,
  SlaState,
  SystemRole,
} from '../enums/DomainEnums';
import type { DocumentTrackingSnapshot } from '../security/AccessPolicy';

export interface PersonnelPreferencesDto {
  default_copy_format?: 'digital' | 'hard_copy';
  default_routing_scope?: RoutingScope;
  default_remarks?: string;
  default_landing_screen?: LandingTabPreference;
  compact_density?: boolean;
  desktop_notifications?: boolean;
  notification_sound?: boolean;
  hide_lock_screen_titles?: boolean;
}

export interface PersonnelDto {
  id: string;
  employee_id: string;
  full_name: string;
  position: string;
  contact_number?: string | null;
  desk_note?: string | null;
  avatar_color?: string | null;
  preferences?: PersonnelPreferencesDto | null;
  office: OfficeSummary;
  role: SystemRole;
  email: string;
  availability: AvailabilityStatus;
  availability_until?: string | null;
  delegate_id?: string | null;
  active?: boolean;
  created_at?: string;
}

export interface ActiveSessionDto {
  id: string;
  device_name: string;
  platform: 'android' | 'ios' | 'web';
  last_active_at: string;
  is_current_device: boolean;
  ip_hint?: string;
}

export interface SchoolDto {
  id: string;
  deped_school_id: string;
  name: string;
  district: string;
  municipality: string;
}

export interface DocumentVersionDto {
  id: string;
  version_number: number;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256_checksum: string;
  uploaded_by_id: string;
  uploaded_by_name: string;
  uploaded_at: string;
  revision_note?: string;
  storage_key: string;
}

export interface RoutingTransactionDto {
  id: string;
  document_id: string;
  from_user_id: string;
  from_user_name: string;
  from_office: OfficeSummary;
  to_user_id: string;
  to_user_name: string;
  to_office: OfficeSummary;
  routing_scope: RoutingScope;
  receipt_status: ReceiptStatus;
  remarks: string;
  is_internal_only: boolean;
  sent_at: string;
  acknowledged_at?: string | null;
  acknowledged_by_name?: string | null;
  proof_photo?: {
    file_name: string;
    compressed_bytes: number;
    sha256_checksum: string;
    exif_stripped: boolean;
    captured_at: string;
  } | null;
}

export interface DocumentDto {
  id: string;
  is_sealed?: boolean;
  attachment_count?: number;
  tracking_code: string;
  qr_token: string;
  title: string;
  category_id: string;
  category_name: string;
  confidentiality_tier: ConfidentialityTier;
  lifecycle_status: DocumentLifecycleStatus;
  copy_format?: DocumentCopyFormat;
  physical_reference?: string | null;
  physical_page_count?: number | null;
  has_digital_file?: boolean;
  physical_summary?: string | null;
  sla_state: SlaState;
  sla_due_at: string;
  origin_office: OfficeSummary;
  origin_user_id: string;
  origin_user_name: string;
  current_office: OfficeSummary;
  current_holder_id: string;
  current_holder_name: string;
  explicit_participant_ids: string[];
  submitted_school?: SchoolDto | null;
  versions: DocumentVersionDto[];
  transactions: RoutingTransactionDto[];
  external_milestones: Array<{
    id: string;
    stage_label: string;
    office_name: string;
    occurred_at: string;
  }>;
  created_at?: string;
}

export interface DocumentCategoryDto {
  id: string;
  name: string;
  code: string;
  declared_by_office_code: string;
  declared_by_office_name: string;
  usage_count: number;
  is_verified_global?: boolean;
  created_at?: string;
}

export interface AuditLogDto {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_office_code: string;
  action: AuditAction;
  document_id: string | null;
  tracking_code: string | null;
  summary: string;
  device_label: string;
  occurred_at?: string;
}

export interface DocumentTrackingSnapshotDto {
  visibility: 'full_custody' | 'location_only';
  document_id: string;
  tracking_code: string;
  display_title: string;
  category_name: string;
  confidentiality_tier: ConfidentialityTier;
  lifecycle_status: DocumentLifecycleStatus;
  copy_format?: DocumentCopyFormat;
  physical_reference?: string | null;
  physical_page_count?: number | null;
  has_digital_file?: boolean;
  physical_summary?: string | null;
  sla_state: SlaState;
  sla_due_at: string;
  origin_office: OfficeSummary;
  current_office: OfficeSummary;
  origin_timestamp?: string;
  received_at?: string | null;
  last_updated_at?: string;
  is_internal_office_stage?: boolean;
  current_holder_name?: string | null;
  can_open_full_record: boolean;
  sent_by_actor_office?: boolean;
  pending_for_actor_office: boolean;
  latest_receipt_status?: ReceiptStatus | null;
  external_milestones: Array<{
    id: string;
    stage_label: string;
    office_name: string;
    occurred_at: string;
  }>;
  timeline_events?: Array<{
    id: string;
    label: string;
    office_name: string;
    occurred_at: string;
    state: 'completed' | 'active' | 'pending';
    is_internal: boolean;
  }>;
}

/**
 * Hydrates validated REST JSON DTOs into encapsulated OOP domain entities.
 */
export class DocumentMapper {
  public static toUserPreferences(raw?: PersonnelPreferencesDto | null): UserWorkflowPreferences {
    return Object.freeze({
      defaultCopyFormat:
        raw?.default_copy_format === 'hard_copy'
          ? 'hard_copy'
          : DEFAULT_USER_WORKFLOW_PREFERENCES.defaultCopyFormat,
      defaultRoutingScope:
        raw?.default_routing_scope === RoutingScope.INTERNAL_OFFICE
          ? RoutingScope.INTERNAL_OFFICE
          : DEFAULT_USER_WORKFLOW_PREFERENCES.defaultRoutingScope,
      defaultRemarks:
        typeof raw?.default_remarks === 'string'
          ? raw.default_remarks
          : DEFAULT_USER_WORKFLOW_PREFERENCES.defaultRemarks,
      defaultLandingScreen:
        raw?.default_landing_screen &&
        ['inbox', 'scanner', 'sent', 'track'].includes(raw.default_landing_screen)
          ? raw.default_landing_screen
          : DEFAULT_USER_WORKFLOW_PREFERENCES.defaultLandingScreen,
      compactDensity: Boolean(
        raw?.compact_density ?? DEFAULT_USER_WORKFLOW_PREFERENCES.compactDensity,
      ),
      desktopNotifications:
        raw?.desktop_notifications !== undefined
          ? Boolean(raw.desktop_notifications)
          : DEFAULT_USER_WORKFLOW_PREFERENCES.desktopNotifications,
      notificationSound:
        raw?.notification_sound !== undefined
          ? Boolean(raw.notification_sound)
          : DEFAULT_USER_WORKFLOW_PREFERENCES.notificationSound,
      hideLockScreenTitles:
        raw?.hide_lock_screen_titles !== undefined
          ? Boolean(raw.hide_lock_screen_titles)
          : DEFAULT_USER_WORKFLOW_PREFERENCES.hideLockScreenTitles,
    });
  }

  public static toPersonnel(dto: PersonnelDto): Personnel {
    return new Personnel({
      id: dto.id,
      employeeId: dto.employee_id,
      fullName: dto.full_name,
      position: dto.position,
      contactNumber: dto.contact_number ?? null,
      deskNote: dto.desk_note ?? null,
      avatarColor: dto.avatar_color ?? '#0D3472',
      preferences: DocumentMapper.toUserPreferences(dto.preferences),
      office: dto.office,
      role: dto.role,
      email: dto.email,
      availability: dto.availability,
      availabilityUntil: dto.availability_until ?? null,
      delegateId: dto.delegate_id ?? null,
      active: dto.active ?? true,
      createdAt: dto.created_at,
    });
  }

  public static toActiveSession(dto: ActiveSessionDto): ActiveDeviceSession {
    return Object.freeze({
      id: dto.id,
      deviceName: dto.device_name,
      platform: dto.platform,
      lastActiveAt: dto.last_active_at,
      isCurrentDevice: Boolean(dto.is_current_device),
      ipHint: dto.ip_hint ?? 'Workspace Network',
    });
  }

  public static toCategory(dto: DocumentCategoryDto): DocumentCategory {
    return new DocumentCategory({
      id: dto.id,
      name: dto.name,
      code: dto.code,
      declaredByOfficeCode: dto.declared_by_office_code,
      declaredByOfficeName: dto.declared_by_office_name,
      usageCount: dto.usage_count,
      isVerifiedGlobal: dto.is_verified_global ?? true,
      createdAt: dto.created_at,
    });
  }

  public static toAuditLog(dto: AuditLogDto): AuditLogEntry {
    return new AuditLogEntry({
      id: dto.id,
      actorId: dto.actor_id,
      actorName: dto.actor_name,
      actorOfficeCode: dto.actor_office_code,
      action: dto.action,
      documentId: dto.document_id,
      trackingCode: dto.tracking_code,
      summary: dto.summary,
      deviceLabel: dto.device_label,
      occurredAt: dto.occurred_at,
    });
  }

  public static toDocument(dto: DocumentDto): Document {
    const school = dto.submitted_school
      ? new School({
          id: dto.submitted_school.id,
          depedSchoolId: dto.submitted_school.deped_school_id,
          name: dto.submitted_school.name,
          district: dto.submitted_school.district,
          municipality: dto.submitted_school.municipality,
        })
      : null;

    const versions = (dto.versions ?? []).map(
      (v) =>
        new DocumentVersion({
          id: v.id,
          versionNumber: v.version_number,
          fileName: v.file_name,
          mimeType: v.mime_type,
          sizeBytes: v.size_bytes,
          sha256Checksum: v.sha256_checksum,
          uploadedById: v.uploaded_by_id,
          uploadedByName: v.uploaded_by_name,
          uploadedAt: v.uploaded_at,
          revisionNote: v.revision_note,
          storageKey: v.storage_key,
        }),
    );

    const transactions = dto.transactions.map(
      (tx) =>
        new RoutingTransaction({
          id: tx.id,
          documentId: tx.document_id,
          fromUserId: tx.from_user_id,
          fromUserName: tx.from_user_name,
          fromOffice: tx.from_office,
          toUserId: tx.to_user_id,
          toUserName: tx.to_user_name,
          toOffice: tx.to_office,
          routingScope: tx.routing_scope,
          receiptStatus: tx.receipt_status,
          remarks: tx.remarks,
          isInternalOnly: tx.is_internal_only,
          sentAt: tx.sent_at,
          acknowledgedAt: tx.acknowledged_at,
          acknowledgedByName: tx.acknowledged_by_name,
          proofPhoto: tx.proof_photo
            ? {
                fileName: tx.proof_photo.file_name,
                compressedBytes: tx.proof_photo.compressed_bytes,
                sha256Checksum: tx.proof_photo.sha256_checksum,
                exifStripped: tx.proof_photo.exif_stripped,
                capturedAt: tx.proof_photo.captured_at,
              }
            : null,
        }),
    );

    const externalMilestones: ExternalMilestone[] = dto.external_milestones.map((m) => ({
      id: m.id,
      stageLabel: m.stage_label,
      officeName: m.office_name,
      occurredAt: m.occurred_at,
    }));

    return new Document({
      id: dto.id,
      isSealed: Boolean(dto.is_sealed),
      attachmentCount:
        typeof dto.attachment_count === 'number' ? dto.attachment_count : versions.length,
      trackingCode: dto.tracking_code,
      qrToken: dto.qr_token ?? '',
      title: dto.title,
      categoryId: dto.category_id,
      categoryName: dto.category_name,
      confidentialityTier: dto.confidentiality_tier,
      lifecycleStatus: dto.lifecycle_status,
      copyFormat: dto.copy_format,
      physicalReference: dto.physical_reference ?? null,
      physicalPageCount: dto.physical_page_count ?? null,
      slaState: dto.sla_state,
      slaDueAt: dto.sla_due_at,
      originOffice: dto.origin_office,
      originUserId: dto.origin_user_id,
      originUserName: dto.origin_user_name,
      currentOffice: dto.current_office,
      currentHolderId: dto.current_holder_id,
      currentHolderName: dto.current_holder_name,
      explicitParticipantIds: dto.explicit_participant_ids,
      submittedSchool: school,
      versions,
      transactions,
      externalMilestones,
      createdAt: dto.created_at,
    });
  }

  public static toTrackingSnapshot(dto: DocumentTrackingSnapshotDto): DocumentTrackingSnapshot {
    const full = dto.visibility === 'full_custody';
    const milestones = dto.external_milestones.map((m) =>
      Object.freeze({
        id: m.id,
        stageLabel: m.stage_label,
        officeName: m.office_name,
        occurredAt: m.occurred_at,
      }),
    );

    const originTimestamp =
      dto.origin_timestamp ?? milestones[0]?.occurredAt ?? dto.sla_due_at;
    const lastUpdatedAt =
      dto.last_updated_at ??
      dto.received_at ??
      milestones[milestones.length - 1]?.occurredAt ??
      originTimestamp;

    const timelineEvents = dto.timeline_events
      ? dto.timeline_events.map((ev) =>
          Object.freeze({
            id: ev.id,
            label: ev.label,
            officeName: ev.office_name,
            occurredAt: ev.occurred_at,
            state: ev.state,
            isInternal: Boolean(ev.is_internal),
          }),
        )
      : milestones.map((m, idx, arr) =>
          Object.freeze({
            id: m.id,
            label: m.stageLabel,
            officeName: m.officeName,
            occurredAt: m.occurredAt,
            state:
              idx === arr.length - 1
                ? dto.latest_receipt_status === ReceiptStatus.PENDING
                  ? ('pending' as const)
                  : ('active' as const)
                : ('completed' as const),
            isInternal: false,
          }),
        );

    return Object.freeze({
      visibility: dto.visibility,
      documentId: dto.document_id,
      trackingCode: dto.tracking_code,
      displayTitle: dto.display_title,
      categoryName: dto.category_name,
      confidentialityTier: dto.confidentiality_tier,
      lifecycleStatus: dto.lifecycle_status,
      copyFormat: dto.copy_format ?? DocumentCopyFormat.DIGITAL,
      hasDigitalFile:
        dto.has_digital_file ??
        (dto.copy_format ?? DocumentCopyFormat.DIGITAL) !== DocumentCopyFormat.HARD_COPY,
      physicalSummary: full ? (dto.physical_summary ?? null) : null,
      slaState: dto.sla_state,
      slaDueAt: dto.sla_due_at,
      originOffice: Object.freeze({ ...dto.origin_office }),
      currentOffice: Object.freeze({ ...dto.current_office }),
      originTimestamp,
      receivedAt: dto.received_at ?? null,
      lastUpdatedAt,
      isInternalOfficeStage:
        dto.is_internal_office_stage ?? dto.origin_office.id === dto.current_office.id,
      currentHolderName: full ? dto.current_holder_name ?? null : null,
      canOpenFullRecord: full && Boolean(dto.can_open_full_record),
      sentByActorOffice: Boolean(dto.sent_by_actor_office),
      pendingForActorOffice: full && Boolean(dto.pending_for_actor_office),
      latestReceiptStatus: dto.latest_receipt_status ?? null,
      externalMilestones: Object.freeze(milestones),
      timelineEvents: Object.freeze(timelineEvents),
    });
  }
}
