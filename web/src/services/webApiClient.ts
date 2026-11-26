import {
  ActiveDeviceSession,
  AdminCreateUserPayload,
  AdminUpdateUserPayload,
  AuditLogEntry,
  AvailabilityStatus,
  CommentVisibility,
  ConfidentialityTier,
  DEFAULT_USER_PREFERENCES,
  DesktopPairingSession,
  DesktopPairStatus,
  DocumentCategory,
  DocumentComment,
  DocumentCopyFormat,
  DocumentLifecycleStatus,
  DocumentRecord,
  DocumentTrackingSnapshot,
  DocumentUpdatePayload,
  DocumentVersion,
  LandingScreenPreference,
  OfficeSummary,
  PaginatedDocumentsResult,
  PendingApprovalStatus,
  PendingRegistrationSummary,
  Personnel,
  PresignedDownloadGrant,
  PrivacySafeNotification,
  ProfileUpdatePayload,
  QrResolutionResult,
  RealtimePulseResponse,
  ReceiptStatus,
  RoutingScope,
  RoutingTemplate,
  RoutingTransaction,
  SlaState,
  TurnaroundAnalyticsReport,
  UserPreferences,
} from '../domain/types';
import { parseOpaqueQrToken, WebBackendGateway } from '../domain/qrPolicy';
import { normalizeUploadFileName } from '../utils/formatters';

interface ApiUserPreferencesDto {
  default_copy_format?: 'digital' | 'hard_copy';
  default_routing_scope?: RoutingScope;
  default_remarks?: string;
  default_landing_screen?: LandingScreenPreference;
  compact_density?: boolean;
  desktop_notifications?: boolean;
  notification_sound?: boolean;
  hide_lock_screen_titles?: boolean;
}

interface ApiPersonnelDto {
  id: string;
  employee_id: string;
  full_name: string;
  position: string;
  contact_number?: string | null;
  desk_note?: string | null;
  avatar_color?: string | null;
  preferences?: ApiUserPreferencesDto | null;
  office: OfficeSummary;
  role: string;
  email: string;
  availability: AvailabilityStatus;
  availability_until?: string | null;
  delegate_id?: string | null;
  active?: boolean;
  approval_status?: string;
  must_change_password?: boolean;
}

interface ApiVersionDto {
  version_number: number;
  change_type?: import('../domain/types').VersionChangeType;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  sha256_checksum: string;
  uploaded_at: string;
  uploaded_by_name?: string;
  uploaded_by_office_code?: string;
  uploaded_by_office_name?: string;
  revision_note?: string;
}

interface ApiTransactionDto {
  id: string;
  from_user_id?: string;
  from_user_name?: string;
  from_office: OfficeSummary;
  to_user_id?: string;
  to_office: OfficeSummary;
  to_user_name?: string;
  routing_scope: RoutingScope;
  receipt_status: ReceiptStatus;
  remarks?: string;
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

interface ApiDocumentDto {
  id: string;
  is_sealed?: boolean;
  attachment_count?: number;
  tracking_code: string;
  qr_token: string;
  title: string;
  category_id: string;
  category_name: string;
  confidentiality_tier: ConfidentialityTier;
  copy_format?: DocumentCopyFormat;
  lifecycle_status: DocumentLifecycleStatus;
  sla_state: SlaState;
  sla_due_at: string | null;
  origin_user_id?: string;
  origin_user_name?: string;
  origin_office: OfficeSummary;
  current_office: OfficeSummary;
  submitted_school?: { id: string; name: string } | null;
  physical_reference?: string | null;
  physical_page_count?: number | null;
  versions?: ApiVersionDto[];
  transactions?: ApiTransactionDto[];
  created_at?: string;
}

interface ApiTrackingSnapshotDto {
  visibility: 'full_custody' | 'location_only';
  document_id: string;
  tracking_code: string;
  display_title: string;
  copy_format?: DocumentCopyFormat;
  lifecycle_status: DocumentLifecycleStatus;
  sla_state: SlaState;
  origin_office?: OfficeSummary;
  origin_timestamp?: string | null;
  current_office: OfficeSummary;
  current_holder_name?: string | null;
  received_at?: string | null;
  last_updated_at?: string;
  is_internal_office_stage?: boolean;
  physical_summary?: string | null;
  latest_receipt_status?: ReceiptStatus | null;
  external_milestones?: Array<{
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

const ROLE_LABELS: Record<string, string> = {
  records_officer: 'Records Officer',
  unit_head: 'Unit Head',
  staff: 'Staff',
  legal_officer: 'Legal Officer',
  ict_admin: 'ICT Admin',
};

function computeInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SD';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function mapApiPreferences(raw?: ApiUserPreferencesDto | null): UserPreferences {
  return {
    defaultCopyFormat:
      raw?.default_copy_format === 'hard_copy'
        ? 'hard_copy'
        : DEFAULT_USER_PREFERENCES.defaultCopyFormat,
    defaultRoutingScope:
      raw?.default_routing_scope === 'internal_office'
        ? 'internal_office'
        : DEFAULT_USER_PREFERENCES.defaultRoutingScope,
    defaultRemarks:
      typeof raw?.default_remarks === 'string'
        ? raw.default_remarks
        : DEFAULT_USER_PREFERENCES.defaultRemarks,
    defaultLandingScreen:
      raw?.default_landing_screen &&
      ['inbox', 'sent', 'track'].includes(raw.default_landing_screen)
        ? (raw.default_landing_screen as UserPreferences['defaultLandingScreen'])
        : DEFAULT_USER_PREFERENCES.defaultLandingScreen,
    compactDensity: Boolean(raw?.compact_density ?? DEFAULT_USER_PREFERENCES.compactDensity),
    desktopNotifications:
      raw?.desktop_notifications !== undefined
        ? Boolean(raw.desktop_notifications)
        : DEFAULT_USER_PREFERENCES.desktopNotifications,
    notificationSound:
      raw?.notification_sound !== undefined
        ? Boolean(raw.notification_sound)
        : DEFAULT_USER_PREFERENCES.notificationSound,
    hideLockScreenTitles:
      raw?.hide_lock_screen_titles !== undefined
        ? Boolean(raw.hide_lock_screen_titles)
        : DEFAULT_USER_PREFERENCES.hideLockScreenTitles,
  };
}

export function mapApiPersonnel(dto: ApiPersonnelDto): Personnel {
  return {
    id: dto.id,
    fullName: dto.full_name,
    employeeId: dto.employee_id,
    email: dto.email,
    position: dto.position,
    contactNumber: dto.contact_number ?? null,
    deskNote: dto.desk_note ?? null,
    avatarColor: dto.avatar_color ?? '#0D3472',
    preferences: mapApiPreferences(dto.preferences),
    role: dto.role,
    roleLabel: ROLE_LABELS[dto.role] ?? 'Personnel',
    office: dto.office,
    availability: dto.availability,
    availabilityUntil: dto.availability_until ?? null,
    delegateId: dto.delegate_id ?? null,
    active: dto.active ?? true,
    approvalStatus: dto.approval_status ?? 'approved',
    mustChangePassword: Boolean(dto.must_change_password ?? false),
    initials: computeInitials(dto.full_name),
  };
}

function mapApiVersion(dto: ApiVersionDto): DocumentVersion {
  return {
    versionNumber: dto.version_number,
    changeType: dto.change_type ?? (dto.version_number <= 1 ? 'initial' : 'revised'),
    fileName: dto.file_name,
    mimeType: dto.mime_type,
    sizeBytes: dto.size_bytes,
    sha256Checksum: dto.sha256_checksum,
    uploadedAt: dto.uploaded_at,
    uploadedByName: dto.uploaded_by_name ?? 'Team Member',
    uploadedByOfficeCode: dto.uploaded_by_office_code,
    uploadedByOfficeName: dto.uploaded_by_office_name,
    note: dto.revision_note ?? '',
  };
}

function mapApiTransaction(dto: ApiTransactionDto): RoutingTransaction {
  return {
    id: dto.id,
    fromUserId: dto.from_user_id,
    fromUserName: dto.from_user_name,
    fromOffice: dto.from_office,
    toUserId: dto.to_user_id,
    toOffice: dto.to_office,
    recipientName: dto.to_user_name ?? dto.to_office.name,
    scope: dto.routing_scope,
    status: dto.receipt_status,
    remarks: dto.remarks ?? '',
    sentAt: dto.sent_at,
    receivedAt: dto.acknowledged_at ?? null,
    receivedByName: dto.acknowledged_by_name ?? null,
    proofPhoto: dto.proof_photo
      ? {
          fileName: dto.proof_photo.file_name,
          compressedBytes: dto.proof_photo.compressed_bytes,
          sha256Checksum: dto.proof_photo.sha256_checksum,
          exifStripped: dto.proof_photo.exif_stripped,
          capturedAt: dto.proof_photo.captured_at,
        }
      : null,
  };
}

export function mapApiDocument(dto: ApiDocumentDto): DocumentRecord {
  const mappedVersions = (dto.versions ?? []).map(mapApiVersion);
  return {
    id: dto.id,
    isSealed: Boolean(dto.is_sealed),
    attachmentCount:
      typeof dto.attachment_count === 'number' ? dto.attachment_count : mappedVersions.length,
    trackingCode: dto.tracking_code,
    qrToken: dto.qr_token ?? '',
    title: dto.title,
    categoryId: dto.category_id,
    categoryName: dto.category_name,
    confidentialityTier: dto.confidentiality_tier,
    copyFormat: dto.copy_format ?? 'digital',
    lifecycleStatus: dto.lifecycle_status,
    slaState: dto.sla_state,
    slaDueAt: dto.sla_due_at,
    originUserId: dto.origin_user_id,
    originUserName: dto.origin_user_name,
    originOffice: dto.origin_office,
    currentOffice: dto.current_office,
    submittedSchoolName: dto.submitted_school?.name ?? null,
    submittedSchoolId: dto.submitted_school?.id ?? null,
    physicalReference: dto.physical_reference ?? null,
    physicalPageCount: dto.physical_page_count ?? null,
    versions: mappedVersions,
    transactions: (dto.transactions ?? []).map(mapApiTransaction),
    createdAt: dto.created_at ?? new Date().toISOString(),
  };
}

export function mapApiTrackingSnapshot(dto: ApiTrackingSnapshotDto): DocumentTrackingSnapshot {
  const events = dto.timeline_events ?? [];
  const milestones =
    events.length > 0
      ? events.map((ev) => ({
          id: ev.id,
          officeCode: ev.office_name.slice(0, 8).toUpperCase(),
          officeName: ev.office_name,
          status: (ev.state === 'pending' ? 'pending' : 'acknowledged') as ReceiptStatus,
          state: ev.state,
          timestamp: ev.occurred_at,
          actorName: null,
          note: ev.label,
        }))
      : (dto.external_milestones ?? []).map((ms, idx, arr) => ({
          id: ms.id,
          officeCode: dto.current_office.code,
          officeName: ms.office_name,
          status: (idx === arr.length - 1 && dto.latest_receipt_status === 'pending'
            ? 'pending'
            : 'acknowledged') as ReceiptStatus,
          state: (idx === arr.length - 1
            ? dto.latest_receipt_status === 'pending'
              ? 'pending'
              : 'active'
            : 'completed') as 'completed' | 'active' | 'pending',
          timestamp: ms.occurred_at,
          actorName: null,
          note: ms.stage_label,
        }));

  return {
    documentId: dto.document_id,
    trackingCode: dto.tracking_code,
    displayTitle: dto.display_title,
    copyFormat: dto.copy_format ?? 'digital',
    lifecycleStatus: dto.lifecycle_status,
    slaState: dto.sla_state,
    originOffice: dto.origin_office,
    originTimestamp: dto.origin_timestamp ?? null,
    currentOffice: dto.current_office,
    currentHolderName: dto.current_holder_name ?? null,
    receivedAt: dto.received_at ?? null,
    lastUpdatedAt: dto.last_updated_at ?? dto.received_at ?? new Date().toISOString(),
    visibility: dto.visibility === 'full_custody' ? 'full' : 'location_only',
    isInternalOfficeStage: Boolean(dto.is_internal_office_stage),
    physicalSummary: dto.physical_summary ?? null,
    milestones,
  };
}

/**
 * Laravel Sanctum API v1 client gateway for Tracely Web.
/**
 * Builds local-development fallback URLs so the web dashboard works transparently whether
 * Laravel artisan serve runs on port 8000 or 8080, or through Vite's /__doctrack_api proxy.
 */
export function getWebDevFallbackBaseUrls(
  primaryBaseUrl: string,
  isViteDev: boolean,
  origin?: string,
): string[] {
  if (!isViteDev) {
    return [];
  }

  const normalized = primaryBaseUrl.replace(/\/+$/, '');
  const candidates: string[] = [];

  if (normalized.startsWith('http://127.0.0.1:8000')) {
    candidates.push(normalized.replace('http://127.0.0.1:8000', 'http://127.0.0.1:8080'));
  } else if (normalized.startsWith('http://localhost:8000')) {
    candidates.push(normalized.replace('http://localhost:8000', 'http://localhost:8080'));
    candidates.push(normalized.replace('http://localhost:8000', 'http://127.0.0.1:8080'));
  } else if (normalized.startsWith('http://127.0.0.1:8080')) {
    candidates.push(normalized.replace('http://127.0.0.1:8080', 'http://127.0.0.1:8000'));
  } else if (normalized.startsWith('http://localhost:8080')) {
    candidates.push(normalized.replace('http://localhost:8080', 'http://localhost:8000'));
    candidates.push(normalized.replace('http://localhost:8080', 'http://127.0.0.1:8000'));
  } else {
    return [];
  }

  if (origin) {
    candidates.push(`${origin.replace(/\/+$/, '')}/__doctrack_api/v1`);
  }

  return candidates.filter((url, idx) => url !== normalized && candidates.indexOf(url) === idx);
}

export const NO_INTERNET_ERROR_MESSAGE = 'No internet connection. Please try again.';

const NETWORK_ERROR_PATTERN =
  /failed to fetch|networkerror|network request failed|load failed|err_internet_disconnected|err_name_not_resolved|err_connection|timed out|unable to reach|no internet|fetch failed/i;

export function isWebNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  if (!(err instanceof Error)) {
    return false;
  }
  const tagged = err as Error & { isHttpError?: boolean; isNetworkError?: boolean; code?: string };
  if (tagged.isNetworkError || tagged.code === 'NO_INTERNET') {
    return true;
  }
  if (tagged.isHttpError) {
    return false;
  }
  return (
    err.name === 'AbortError' ||
    err instanceof TypeError ||
    NETWORK_ERROR_PATTERN.test(err.message)
  );
}

export function normalizeWebErrorMessage(err: unknown, fallback = 'Request failed.'): string {
  if (isWebNetworkError(err)) {
    return NO_INTERNET_ERROR_MESSAGE;
  }
  if (err instanceof Error && err.message.trim()) {
    return err.message;
  }
  return fallback;
}

function createNoInternetError(): Error & { isNetworkError: boolean; code: string } {
  const err = new Error(NO_INTERNET_ERROR_MESSAGE) as Error & {
    isNetworkError: boolean;
    code: string;
  };
  err.isNetworkError = true;
  err.code = 'NO_INTERNET';
  return err;
}

/**
 * Connects directly to the same REST v1 endpoints used by the React Native companion app.
 */
export class LaravelSanctumGateway implements WebBackendGateway {
  private readonly getBaseUrl: () => string;
  private readonly getToken: () => string | null;
  private readonly devFallbackOverride?: boolean;
  private resolvedDevProxyUrl: string | null = null;

  constructor(
    getBaseUrl: () => string,
    getToken: () => string | null,
    devFallbackOverride?: boolean,
  ) {
    this.getBaseUrl = getBaseUrl;
    this.getToken = getToken;
    this.devFallbackOverride = devFallbackOverride;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw createNoInternetError();
    }

    const primaryBaseUrl = this.getBaseUrl();
    const effectiveBaseUrl = this.resolvedDevProxyUrl ?? primaryBaseUrl;
    const token = this.getToken();
    const isFormData = typeof FormData !== 'undefined' && init.body instanceof FormData;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const sendOnce = async (targetBaseUrl: string): Promise<T> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`${targetBaseUrl}${path}`, {
          ...init,
          cache: 'no-store',
          headers,
          signal: controller.signal,
        });
        const text = await response.text();
        let parsed: {
          code?: string;
          message?: string;
          data?: unknown;
          approval_status?: string;
          status_token?: string;
          submitted?: {
            full_name?: string;
            employee_id?: string;
            email?: string;
            position?: string;
            office_code?: string;
            office_name?: string;
            submitted_at?: string;
          } | null;
        } = {};
        if (text) {
          try {
            parsed = JSON.parse(text);
          } catch {
            if (!response.ok && response.status >= 500) {
              parsed = { message: 'Service temporarily unavailable. Please try again shortly.' };
            } else if (!response.ok && response.status === 429) {
              parsed = { message: 'Too many requests. Please wait a moment and try again.' };
            } else {
              throw new SyntaxError('Non-JSON server response');
            }
          }
        }
        if (!response.ok) {
          const fallbackHttpMessage =
            response.status === 429
              ? 'Too many requests. Please wait a moment and try again.'
              : response.status >= 502 && response.status <= 504
                ? 'Service temporarily unavailable. Please try again shortly.'
                : `Server responded with HTTP ${response.status}.`;
          const httpErr = new Error(parsed.message ?? fallbackHttpMessage) as Error & {
            isHttpError?: boolean;
            status?: number;
            code?: string;
            approvalStatus?: PendingApprovalStatus;
            statusToken?: string | null;
            submitted?: PendingRegistrationSummary | null;
          };
          httpErr.isHttpError = true;
          httpErr.status = response.status;
          httpErr.code = parsed.code;
          if (parsed.approval_status === 'pending' || parsed.approval_status === 'rejected') {
            httpErr.approvalStatus = parsed.approval_status;
          }
          if (typeof parsed.status_token === 'string') {
            httpErr.statusToken = parsed.status_token;
          }
          if (parsed.submitted && typeof parsed.submitted === 'object') {
            httpErr.submitted = {
              fullName: parsed.submitted.full_name ?? '',
              employeeId: parsed.submitted.employee_id ?? '',
              email: parsed.submitted.email ?? '',
              position: parsed.submitted.position ?? '',
              officeCode: parsed.submitted.office_code ?? '',
              officeName: parsed.submitted.office_name ?? '',
              submittedAt: parsed.submitted.submitted_at ?? new Date().toISOString(),
            };
          }
          throw httpErr;
        }
        return parsed as T;
      } finally {
        clearTimeout(timer);
      }
    };

    const isViteDev =
      this.devFallbackOverride ??
      (typeof import.meta !== 'undefined' &&
        Boolean((import.meta as { env?: { DEV?: boolean; MODE?: string } }).env?.DEV) &&
        (import.meta as { env?: { MODE?: string } }).env?.MODE !== 'test');

    try {
      return await sendOnce(effectiveBaseUrl);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw createNoInternetError();
      }
      if (err instanceof Error && (err as Error & { isHttpError?: boolean }).isHttpError) {
        throw err;
      }
      if (err instanceof SyntaxError) {
        throw new Error('Server returned an unexpected response. Please try again.');
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const devFallbacks = getWebDevFallbackBaseUrls(primaryBaseUrl, isViteDev, origin);
      const retryTargets = [
        ...(this.resolvedDevProxyUrl ? [primaryBaseUrl] : []),
        ...devFallbacks,
      ].filter((url, idx, all) => url !== effectiveBaseUrl && all.indexOf(url) === idx);

      if (retryTargets.length > 0) {
        this.resolvedDevProxyUrl = null;
        for (const candidateBaseUrl of retryTargets) {
          try {
            const fallbackResult = await sendOnce(candidateBaseUrl);
            this.resolvedDevProxyUrl =
              candidateBaseUrl === primaryBaseUrl ? null : candidateBaseUrl;
            return fallbackResult;
          } catch (fallbackErr) {
            if (
              fallbackErr instanceof Error &&
              ((fallbackErr as Error & { isHttpError?: boolean }).isHttpError ||
                fallbackErr instanceof SyntaxError)
            ) {
              throw fallbackErr;
            }
          }
        }
      }

      throw createNoInternetError();
    }
  }

  public async login(identifier: string, password: string) {
    const res = await this.request<{
      token?: string;
      bearer_token?: string;
      user: ApiPersonnelDto;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier,
        password,
        device_name: 'Tracely Web',
        platform: 'web',
      }),
    });
    const bearerToken = res.bearer_token ?? res.token ?? '';
    return { bearerToken, user: mapApiPersonnel(res.user) };
  }

  public async register(payload: {
    fullName: string;
    employeeId: string;
    email: string;
    position: string;
    officeCode: string;
    customOfficeName?: string;
    password: string;
  }) {
    const res = await this.request<{
      pending_approval?: boolean;
      message?: string;
      status_token?: string;
      submitted?: {
        full_name?: string;
        employee_id?: string;
        email?: string;
        position?: string;
        office_code?: string;
        office_name?: string;
        submitted_at?: string;
      } | null;
      bearer_token?: string;
      token?: string;
      user?: ApiPersonnelDto;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        full_name: payload.fullName,
        employee_id: payload.employeeId,
        email: payload.email,
        position: payload.position,
        office_code: payload.officeCode,
        custom_office_name: payload.customOfficeName ?? null,
        password: payload.password,
        device_name: 'Tracely Web',
      }),
    });
    const submitted: PendingRegistrationSummary | null = res.submitted
      ? {
          fullName: res.submitted.full_name ?? payload.fullName,
          employeeId: res.submitted.employee_id ?? payload.employeeId,
          email: res.submitted.email ?? payload.email,
          position: res.submitted.position ?? payload.position,
          officeCode: res.submitted.office_code ?? payload.officeCode,
          officeName: res.submitted.office_name ?? payload.customOfficeName ?? payload.officeCode,
          submittedAt: res.submitted.submitted_at ?? new Date().toISOString(),
        }
      : null;
    return {
      pendingApproval: Boolean(res.pending_approval ?? !res.user),
      message: res.message ?? 'Registration submitted for administrator verification.',
      statusToken: res.status_token ?? null,
      submitted,
      bearerToken: res.bearer_token ?? res.token,
      user: res.user ? mapApiPersonnel(res.user) : undefined,
    };
  }

  public async checkRegistrationStatus(statusToken: string): Promise<{
    status: PendingApprovalStatus;
    canSignIn: boolean;
    message: string;
    submitted?: PendingRegistrationSummary | null;
  }> {
    const res = await this.request<{
      status: PendingApprovalStatus;
      can_sign_in?: boolean;
      message?: string;
      submitted?: {
        full_name?: string;
        employee_id?: string;
        email?: string;
        position?: string;
        office_code?: string;
        office_name?: string;
        submitted_at?: string;
      } | null;
    }>(`/auth/registration-status/${encodeURIComponent(statusToken)}`);
    return {
      status: res.status,
      canSignIn: Boolean(res.can_sign_in ?? res.status === 'approved'),
      message: res.message ?? 'Registration status updated.',
      submitted: res.submitted
        ? {
            fullName: res.submitted.full_name ?? '',
            employeeId: res.submitted.employee_id ?? '',
            email: res.submitted.email ?? '',
            position: res.submitted.position ?? '',
            officeCode: res.submitted.office_code ?? '',
            officeName: res.submitted.office_name ?? '',
            submittedAt: res.submitted.submitted_at ?? new Date().toISOString(),
          }
        : null,
    };
  }

  public async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
  }

  public async listWorkspace() {
    // Batch workspace hydration in two waves to avoid exhausting single-worker Windows PHP CLI connections
    const [offices, personnel, documents] = await Promise.all([
      this.request<{ data: OfficeSummary[] }>('/offices').then((r) => r.data),
      this.request<{ data: ApiPersonnelDto[] }>('/personnel').then((r) =>
        r.data.map(mapApiPersonnel),
      ),
      this.request<{ data: ApiDocumentDto[] }>('/documents').then((r) =>
        r.data.map(mapApiDocument),
      ),
    ]);
    const [trackedSnapshots, categories, notifications] = await Promise.all([
      this.request<{ data: ApiTrackingSnapshotDto[] }>('/documents/tracked').then((r) =>
        r.data.map(mapApiTrackingSnapshot),
      ),
      this.request<{
        data: Array<{
          id: string;
          name: string;
          code: string;
          declared_by_office_code: string;
          is_verified_global?: boolean;
        }>;
      }>('/categories').then((r) =>
        r.data.map(
          (cat): DocumentCategory => ({
            id: cat.id,
            name: cat.name,
            code: cat.code,
            declaredByOfficeCode: cat.declared_by_office_code,
            isGlobal: Boolean(cat.is_verified_global ?? true),
          }),
        ),
      ),
      this.request<{
        data: Array<{
          id: string;
          document_id: string;
          title?: string | null;
          content?: string | null;
          lock_screen_preview: string;
          authenticated_detail: string;
          received_at: string;
          read: boolean;
        }>;
      }>('/notifications').then((r) =>
        r.data.map(
          (n): PrivacySafeNotification => ({
            id: n.id,
            documentId: n.document_id,
            title: n.title?.trim() || 'Document Custody Alert',
            content: n.content?.trim() || n.authenticated_detail,
            lockScreenPreview: n.lock_screen_preview,
            authenticatedDetail: n.authenticated_detail,
            receivedAt: n.received_at,
            read: Boolean(n.read),
          }),
        ),
      ),
    ]);
    return { offices, personnel, documents, trackedSnapshots, categories, notifications };
  }

  public async trackByCode(code: string): Promise<DocumentTrackingSnapshot | null> {
    const res = await this.request<{ data: ApiTrackingSnapshotDto | null }>(
      `/documents/track/${encodeURIComponent(code.trim())}`,
    );
    return res.data ? mapApiTrackingSnapshot(res.data) : null;
  }

  public async createDigitalDocument(payload: {
    title: string;
    categoryId: string;
    confidentialityTier: ConfidentialityTier;
    file: File;
    fileName?: string;
    sha256Checksum: string;
    recipientUserId?: string | null;
    remarks?: string;
  }): Promise<DocumentRecord> {
    const resolvedFileName = normalizeUploadFileName(
      payload.fileName ?? payload.file.name,
      payload.file.name,
    );
    const form = new FormData();
    form.append('title', payload.title);
    form.append('category_id', payload.categoryId);
    form.append('confidentiality_tier', payload.confidentialityTier);
    form.append('file_name', resolvedFileName);
    form.append('sha256_checksum', payload.sha256Checksum);
    form.append('size_bytes', String(payload.file.size));
    form.append('file', payload.file, resolvedFileName);
    if (payload.recipientUserId) form.append('recipient_user_id', payload.recipientUserId);
    if (payload.remarks) form.append('remarks', payload.remarks);
    const res = await this.request<{ data: ApiDocumentDto }>('/documents', {
      method: 'POST',
      body: form,
    });
    return mapApiDocument(res.data);
  }

  public async registerHardCopyDocument(payload: {
    title: string;
    categoryId: string;
    confidentialityTier: ConfidentialityTier;
    physicalReference?: string | null;
    physicalPageCount?: number | null;
    recipientUserId?: string | null;
    remarks?: string;
  }): Promise<DocumentRecord> {
    const res = await this.request<{ data: ApiDocumentDto }>('/documents/hard-copy', {
      method: 'POST',
      body: JSON.stringify({
        title: payload.title,
        category_id: payload.categoryId,
        confidentiality_tier: payload.confidentialityTier,
        physical_reference: payload.physicalReference ?? null,
        physical_page_count: payload.physicalPageCount ?? null,
        recipient_user_id: payload.recipientUserId ?? null,
        remarks: payload.remarks ?? '',
      }),
    });
    return mapApiDocument(res.data);
  }

  public async acknowledgeReceipt(
    documentId: string,
    remarks?: string,
    proofPhoto?: { file: File; sha256Checksum: string } | null,
    verificationCode?: string,
    password?: string,
  ): Promise<DocumentRecord> {
    if (proofPhoto) {
      const form = new FormData();
      form.append('proof_photo', proofPhoto.file, proofPhoto.file.name);
      form.append('sha256_checksum', proofPhoto.sha256Checksum);
      form.append('exif_stripped', '1');
      if (remarks) form.append('remarks', remarks);
      if (verificationCode) form.append('verification_code', verificationCode);
      if (password) form.append('password', password);
      const res = await this.request<{ data: ApiDocumentDto }>(
        `/documents/${encodeURIComponent(documentId)}/acknowledge`,
        { method: 'POST', body: form },
      );
      return mapApiDocument(res.data);
    }
    const res = await this.request<{ data: ApiDocumentDto }>(
      `/documents/${encodeURIComponent(documentId)}/acknowledge`,
      {
        method: 'POST',
        body: JSON.stringify({
          remarks: remarks ?? '',
          ...(verificationCode ? { verification_code: verificationCode } : {}),
          ...(password ? { password } : {}),
        }),
      },
    );
    return mapApiDocument(res.data);
  }

  public async createUnlockChallenge(
    documentId: string,
  ): Promise<import('../domain/types').DocumentUnlockChallenge> {
    const res = await this.request<{
      challenge_id: string;
      document_id: string;
      token: string;
      qr_payload: string;
      short_code: string;
      expires_at: string;
      ttl_seconds?: number;
      reused?: boolean;
    }>(`/documents/${encodeURIComponent(documentId)}/unlock-challenge`, {
      method: 'POST',
    });
    return {
      challengeId: res.challenge_id,
      documentId: res.document_id,
      token: res.token,
      qrPayload: res.qr_payload,
      shortCode: res.short_code,
      expiresAt: res.expires_at,
      ttlSeconds: res.ttl_seconds,
      reused: res.reused,
    };
  }

  public async consumeUnlockChallenge(
    codeOrToken: string,
    documentId?: string,
  ): Promise<DocumentRecord> {
    const res = await this.request<{ data: ApiDocumentDto }>('/qr/consume-unlock', {
      method: 'POST',
      body: JSON.stringify({
        code: codeOrToken,
        ...(documentId ? { document_id: documentId } : {}),
      }),
    });
    return mapApiDocument(res.data);
  }

  public async completeDocument(
    documentId: string,
    status: 'approved' | 'archived',
    remarks?: string,
  ): Promise<DocumentRecord> {
    const res = await this.request<{ data: ApiDocumentDto }>(
      `/documents/${encodeURIComponent(documentId)}/complete`,
      { method: 'POST', body: JSON.stringify({ status, remarks: remarks ?? '' }) },
    );
    return mapApiDocument(res.data);
  }

  public async listDocumentComments(documentId: string): Promise<ReadonlyArray<DocumentComment>> {
    const res = await this.request<{
      data: Array<{
        id: string;
        document_id: string;
        author_id: string;
        author_name: string;
        author_office_id: string;
        author_office_code: string;
        author_position: string;
        visibility: CommentVisibility;
        body: string;
        created_at: string;
      }>;
    }>(`/documents/${encodeURIComponent(documentId)}/comments`);
    return res.data.map((c) => ({
      id: c.id,
      documentId: c.document_id,
      authorId: c.author_id,
      authorName: c.author_name,
      authorOfficeId: c.author_office_id,
      authorOfficeCode: c.author_office_code,
      authorPosition: c.author_position,
      visibility: c.visibility,
      body: c.body,
      createdAt: c.created_at,
    }));
  }

  public async addDocumentComment(
    documentId: string,
    body: string,
    visibility: CommentVisibility,
  ): Promise<DocumentComment> {
    const res = await this.request<{
      data: {
        id: string;
        document_id: string;
        author_id: string;
        author_name: string;
        author_office_id: string;
        author_office_code: string;
        author_position: string;
        visibility: CommentVisibility;
        body: string;
        created_at: string;
      };
    }>(`/documents/${encodeURIComponent(documentId)}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body, visibility }),
    });
    const c = res.data;
    return {
      id: c.id,
      documentId: c.document_id,
      authorId: c.author_id,
      authorName: c.author_name,
      authorOfficeId: c.author_office_id,
      authorOfficeCode: c.author_office_code,
      authorPosition: c.author_position,
      visibility: c.visibility,
      body: c.body,
      createdAt: c.created_at,
    };
  }

  public async issueProofPhotoView(
    documentId: string,
    transactionId: string,
  ): Promise<PresignedDownloadGrant> {
    const res = await this.request<{
      url: string;
      expires_at: string;
      ttl_seconds: number;
      version: ApiVersionDto;
    }>(
      `/documents/${encodeURIComponent(documentId)}/transactions/${encodeURIComponent(transactionId)}/proof-url`,
      { method: 'POST' },
    );
    return {
      url: res.url,
      expiresAt: res.expires_at,
      ttlSeconds: res.ttl_seconds,
      version: mapApiVersion(res.version),
    };
  }

  public async forwardDocument(
    documentId: string,
    recipientUserId: string,
    remarks: string,
  ): Promise<DocumentRecord> {
    const res = await this.request<{ data: ApiDocumentDto }>(
      `/documents/${encodeURIComponent(documentId)}/forward`,
      {
        method: 'POST',
        body: JSON.stringify({ recipient_user_id: recipientUserId, remarks }),
      },
    );
    return mapApiDocument(res.data);
  }

  public async returnForRevision(documentId: string, remarks: string): Promise<DocumentRecord> {
    const res = await this.request<{ data: ApiDocumentDto }>(
      `/documents/${encodeURIComponent(documentId)}/return-revision`,
      { method: 'POST', body: JSON.stringify({ remarks }) },
    );
    return mapApiDocument(res.data);
  }

  public async declineMisrouted(documentId: string, reason: string): Promise<DocumentRecord> {
    const res = await this.request<{ data: ApiDocumentDto }>(
      `/documents/${encodeURIComponent(documentId)}/decline`,
      { method: 'POST', body: JSON.stringify({ reason }) },
    );
    return mapApiDocument(res.data);
  }

  public async recallTransfer(documentId: string): Promise<DocumentRecord> {
    const res = await this.request<{ data: ApiDocumentDto }>(
      `/documents/${encodeURIComponent(documentId)}/recall`,
      { method: 'POST' },
    );
    return mapApiDocument(res.data);
  }

  public async updateDocumentDetails(
    documentId: string,
    patch: DocumentUpdatePayload,
  ): Promise<DocumentRecord> {
    const res = await this.request<{ data: ApiDocumentDto }>(
      `/documents/${encodeURIComponent(documentId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          ...(patch.title !== undefined ? { title: patch.title } : {}),
          ...(patch.categoryId !== undefined ? { category_id: patch.categoryId } : {}),
          ...(patch.confidentialityTier !== undefined
            ? { confidentiality_tier: patch.confidentialityTier }
            : {}),
          ...(patch.physicalReference !== undefined
            ? { physical_reference: patch.physicalReference }
            : {}),
          ...(patch.physicalPageCount !== undefined
            ? { physical_page_count: patch.physicalPageCount }
            : {}),
        }),
      },
    );
    return mapApiDocument(res.data);
  }

  public async uploadRevision(payload: {
    documentId: string;
    file: File;
    fileName?: string;
    sha256Checksum: string;
    revisionNote: string;
    changeType?: import('../domain/types').VersionChangeType;
  }): Promise<DocumentRecord> {
    const resolvedFileName = normalizeUploadFileName(
      payload.fileName ?? payload.file.name,
      payload.file.name,
    );
    const form = new FormData();
    form.append('file', payload.file, resolvedFileName);
    form.append('file_name', resolvedFileName);
    form.append('sha256_checksum', payload.sha256Checksum);
    form.append('revision_note', payload.revisionNote);
    if (payload.changeType) {
      form.append('change_type', payload.changeType);
    }
    const res = await this.request<{ data: ApiDocumentDto }>(
      `/documents/${encodeURIComponent(payload.documentId)}/versions`,
      { method: 'POST', body: form },
    );
    return mapApiDocument(res.data);
  }

  public async issuePresignedView(
    documentId: string,
    versionNumber: number,
  ): Promise<PresignedDownloadGrant> {
    const res = await this.request<{
      url: string;
      expires_at: string;
      ttl_seconds: number;
      version: ApiVersionDto;
    }>(
      `/documents/${encodeURIComponent(documentId)}/versions/${versionNumber}/presigned-url`,
      { method: 'POST' },
    );
    let resolvedUrl = res.url;
    const activeBase = this.resolvedDevProxyUrl ?? this.getBaseUrl();
    const apiV1Idx = res.url.indexOf('/api/v1/');
    if (
      apiV1Idx !== -1 &&
      (res.url.startsWith('http://127.0.0.1:') || res.url.startsWith('http://localhost:')) &&
      activeBase
    ) {
      resolvedUrl = `${activeBase.replace(/\/+$/, '')}${res.url.slice(apiV1Idx + '/api/v1'.length)}`;
    }
    return {
      url: resolvedUrl,
      expiresAt: res.expires_at,
      ttlSeconds: res.ttl_seconds,
      version: mapApiVersion(res.version),
    };
  }

  public async resolveQr(rawValue: string): Promise<QrResolutionResult> {
    const parsed = parseOpaqueQrToken(rawValue);
    if (parsed.kind === 'unlock_challenge') {
      const unlocked = await this.consumeUnlockChallenge(parsed.opaqueToken);
      return {
        kind: 'document_authorized',
        document: unlocked,
        pendingForActorOffice: false,
        sentByActor: false,
      };
    }
    if (parsed.kind === 'document') {
      const res = await this.request<{
        data: ApiDocumentDto;
        pending_for_actor_office?: boolean;
        sent_by_actor?: boolean;
        verification_code?: string;
      }>(`/qr/document/${encodeURIComponent(parsed.opaqueToken)}`);
      const sentByActor = Boolean(res.sent_by_actor);
      return {
        kind: 'document_authorized',
        document: mapApiDocument(res.data),
        pendingForActorOffice: sentByActor ? false : Boolean(res.pending_for_actor_office),
        sentByActor,
        verificationCode: res.verification_code ?? parsed.opaqueToken,
      };
    }
    if (parsed.kind === 'desktop_pair') {
      const res = await this.request<{
        pair_token: string;
        draft_label: string;
        expires_at: string;
      }>(`/qr/desktop-pair/${encodeURIComponent(parsed.opaqueToken)}`);
      return {
        kind: 'desktop_pair_ready',
        pairing: {
          pairToken: res.pair_token,
          draftLabel: res.draft_label,
          expiresAt: res.expires_at,
        },
      };
    }
    const res = await this.request<{
      tracking_code: string;
      lifecycle_status: string;
      current_office_name: string;
      latest_checksum_short: string;
      milestone_count: number;
    }>(`/qr/verify/${encodeURIComponent(parsed.opaqueToken)}`);
    return {
      kind: 'transmittal_verified',
      trackingCode: res.tracking_code,
      lifecycleStatus: res.lifecycle_status,
      currentOfficeName: res.current_office_name,
      latestChecksumShort: res.latest_checksum_short,
      milestoneCount: res.milestone_count,
    };
  }

  public async createDesktopPairSession(draftLabel: string): Promise<DesktopPairingSession> {
    const res = await this.request<{
      pair_token: string;
      draft_label: string;
      expires_at: string;
    }>('/qr/desktop-pair', {
      method: 'POST',
      body: JSON.stringify({ draft_label: draftLabel }),
    });
    return {
      pairToken: res.pair_token,
      draftLabel: res.draft_label,
      expiresAt: res.expires_at,
    };
  }

  public async getDesktopPairStatus(pairToken: string): Promise<DesktopPairStatus> {
    const res = await this.request<{
      pair_token: string;
      attached: boolean;
      file_name?: string | null;
      sha256_checksum?: string | null;
      compressed_bytes?: number | null;
      uploaded_at?: string | null;
    }>(`/qr/desktop-pair/${encodeURIComponent(pairToken)}/status`);
    return {
      pairToken: res.pair_token,
      attached: Boolean(res.attached),
      fileName: res.file_name ?? null,
      sha256Checksum: res.sha256_checksum ?? null,
      compressedBytes: res.compressed_bytes ?? null,
      uploadedAt: res.uploaded_at ?? null,
    };
  }

  public async declareCategory(name: string, code: string): Promise<DocumentCategory> {
    const res = await this.request<{
      data: {
        id: string;
        name: string;
        code: string;
        declared_by_office_code: string;
        is_verified_global?: boolean;
      };
    }>('/categories', {
      method: 'POST',
      body: JSON.stringify({ name, code }),
    });
    return {
      id: res.data.id,
      name: res.data.name,
      code: res.data.code,
      declaredByOfficeCode: res.data.declared_by_office_code,
      isGlobal: Boolean(res.data.is_verified_global ?? true),
    };
  }

  public async markNotificationRead(notificationId: string): Promise<void> {
    await this.request(`/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'POST',
    });
  }

  public async markAllNotificationsRead(): Promise<void> {
    await this.request('/notifications/read-all', { method: 'POST' });
  }

  public async listAuditLogs(documentId?: string): Promise<ReadonlyArray<AuditLogEntry>> {
    const endpoint =
      documentId && documentId.trim()
        ? `/documents/${encodeURIComponent(documentId)}/audit-logs`
        : '/audit-logs';
    const res = await this.request<{
      data: Array<{
        id: string;
        action: string;
        actor_name: string;
        actor_office_code: string;
        summary: string;
        occurred_at: string;
      }>;
    }>(endpoint);
    return res.data.map((log) => ({
      id: log.id,
      action: log.action,
      actorName: log.actor_name,
      officeCode: log.actor_office_code,
      summary: log.summary,
      createdAt: log.occurred_at,
    }));
  }

  public async updateAvailability(
    status: AvailabilityStatus,
    delegateId?: string | null,
    until?: string | null,
  ): Promise<Personnel> {
    const res = await this.request<{ data: ApiPersonnelDto }>('/personnel/availability', {
      method: 'PATCH',
      body: JSON.stringify({
        availability: status,
        delegate_id: delegateId ?? null,
        availability_until: until ?? null,
      }),
    });
    return mapApiPersonnel(res.data);
  }

  public async updateProfile(patch: ProfileUpdatePayload): Promise<Personnel> {
    const res = await this.request<{ data: ApiPersonnelDto }>('/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify({
        ...(patch.fullName !== undefined ? { full_name: patch.fullName } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.position !== undefined ? { position: patch.position } : {}),
        ...(patch.contactNumber !== undefined ? { contact_number: patch.contactNumber } : {}),
        ...(patch.deskNote !== undefined ? { desk_note: patch.deskNote } : {}),
        ...(patch.avatarColor !== undefined ? { avatar_color: patch.avatarColor } : {}),
      }),
    });
    return mapApiPersonnel(res.data);
  }

  public async updatePreferences(
    patch: Partial<UserPreferences>,
  ): Promise<{ user: Personnel; preferences: UserPreferences }> {
    const res = await this.request<{
      data: ApiPersonnelDto;
      preferences?: ApiUserPreferencesDto;
    }>('/auth/preferences', {
      method: 'PATCH',
      body: JSON.stringify({
        ...(patch.defaultCopyFormat !== undefined
          ? { default_copy_format: patch.defaultCopyFormat }
          : {}),
        ...(patch.defaultRoutingScope !== undefined
          ? { default_routing_scope: patch.defaultRoutingScope }
          : {}),
        ...(patch.defaultRemarks !== undefined ? { default_remarks: patch.defaultRemarks } : {}),
        ...(patch.defaultLandingScreen !== undefined
          ? { default_landing_screen: patch.defaultLandingScreen }
          : {}),
        ...(patch.compactDensity !== undefined ? { compact_density: patch.compactDensity } : {}),
        ...(patch.desktopNotifications !== undefined
          ? { desktop_notifications: patch.desktopNotifications }
          : {}),
        ...(patch.notificationSound !== undefined
          ? { notification_sound: patch.notificationSound }
          : {}),
        ...(patch.hideLockScreenTitles !== undefined
          ? { hide_lock_screen_titles: patch.hideLockScreenTitles }
          : {}),
      }),
    });
    const user = mapApiPersonnel(res.data);
    return {
      user,
      preferences: user.preferences ?? mapApiPreferences(res.preferences),
    };
  }

  public async listActiveSessions(): Promise<ReadonlyArray<ActiveDeviceSession>> {
    const res = await this.request<{
      data: Array<{
        id: string;
        device_name: string;
        ip_hint?: string;
        last_active_at: string;
        is_current_device: boolean;
      }>;
    }>('/auth/sessions');
    return res.data.map((s) => ({
      id: s.id,
      deviceName: s.device_name,
      ipHint: s.ip_hint ?? 'Workspace Network',
      lastActiveAt: s.last_active_at,
      current: Boolean(s.is_current_device),
    }));
  }

  public async revokeOtherSessions(): Promise<number> {
    const res = await this.request<{ revoked_count: number }>('/auth/sessions/revoke-others', {
      method: 'POST',
    });
    return res.revoked_count;
  }

  public async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.request('/auth/password', {
      method: 'POST',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    });
  }

  public async listPendingUsers(): Promise<ReadonlyArray<Personnel>> {
    const res = await this.request<{ data: ApiPersonnelDto[] }>('/admin/pending-users');
    return res.data.map(mapApiPersonnel);
  }

  public async approveUser(userId: string): Promise<Personnel> {
    const res = await this.request<{ data: ApiPersonnelDto }>(
      `/admin/users/${encodeURIComponent(userId)}/approve`,
      { method: 'POST' },
    );
    return mapApiPersonnel(res.data);
  }

  public async rejectUser(userId: string, reason?: string): Promise<void> {
    await this.request(`/admin/users/${encodeURIComponent(userId)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason?.trim() || undefined }),
    });
  }

  public async listAdminUsers(): Promise<ReadonlyArray<Personnel>> {
    const res = await this.request<{ data: ApiPersonnelDto[] }>('/admin/users');
    return res.data.map(mapApiPersonnel);
  }

  public async createAdminUser(payload: AdminCreateUserPayload): Promise<Personnel> {
    const res = await this.request<{ data: ApiPersonnelDto }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        full_name: payload.fullName,
        employee_id: payload.employeeId,
        email: payload.email,
        position: payload.position,
        office_id: payload.officeId,
        role: payload.role,
        password: payload.password,
      }),
    });
    return mapApiPersonnel(res.data);
  }

  public async updateAdminUser(
    userId: string,
    patch: AdminUpdateUserPayload,
  ): Promise<Personnel> {
    const res = await this.request<{ data: ApiPersonnelDto }>(
      `/admin/users/${encodeURIComponent(userId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          ...(patch.fullName !== undefined ? { full_name: patch.fullName } : {}),
          ...(patch.email !== undefined ? { email: patch.email } : {}),
          ...(patch.role !== undefined ? { role: patch.role } : {}),
          ...(patch.officeId !== undefined ? { office_id: patch.officeId } : {}),
          ...(patch.position !== undefined ? { position: patch.position } : {}),
          ...(patch.availability !== undefined ? { availability: patch.availability } : {}),
          ...(patch.active !== undefined ? { active: patch.active } : {}),
          ...(patch.newPassword !== undefined ? { new_password: patch.newPassword } : {}),
        }),
      },
    );
    return mapApiPersonnel(res.data);
  }

  public async createAdminOffice(payload: { code: string; name: string }): Promise<OfficeSummary> {
    const res = await this.request<{ data: OfficeSummary }>('/admin/offices', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.data;
  }

  public async updateAdminOffice(
    officeId: string,
    patch: { code?: string; name?: string },
  ): Promise<OfficeSummary> {
    const res = await this.request<{ data: OfficeSummary }>(
      `/admin/offices/${encodeURIComponent(officeId)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(patch),
      },
    );
    return res.data;
  }

  public async updateAdminCategory(
    categoryId: string,
    patch: { name?: string; code?: string },
  ): Promise<DocumentCategory> {
    const res = await this.request<{
      data: {
        id: string;
        name: string;
        code: string;
        declared_by_office_code: string;
        is_verified_global?: boolean;
      };
    }>(`/admin/categories/${encodeURIComponent(categoryId)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return {
      id: res.data.id,
      name: res.data.name,
      code: res.data.code,
      declaredByOfficeCode: res.data.declared_by_office_code,
      isGlobal: Boolean(res.data.is_verified_global ?? true),
    };
  }

  public async deleteAdminCategory(categoryId: string): Promise<void> {
    await this.request(`/admin/categories/${encodeURIComponent(categoryId)}`, {
      method: 'DELETE',
    });
  }

  public async pollRealtimePulse(sinceCursor: number): Promise<RealtimePulseResponse> {
    const res = await this.request<{
      cursor: number;
      changed: boolean;
      transport: string;
      fcm_configured: boolean;
      registered_push_devices: number;
    }>(`/events/pulse?since=${encodeURIComponent(String(sinceCursor))}`);
    return {
      cursor: res.cursor,
      changed: Boolean(res.changed),
      transport: res.transport ?? 'live_pulse',
      fcmConfigured: Boolean(res.fcm_configured),
      registeredPushDevices: Number(res.registered_push_devices ?? 0),
    };
  }

  public async streamRealtimeEvents(
    sinceCursor: number,
    signal: AbortSignal,
    onUpdate: (cursor: number) => void,
  ): Promise<void> {
    const token = this.getToken();
    if (!token) return;
    const base = (this.resolvedDevProxyUrl ?? this.getBaseUrl()).replace(/\/+$/, '');
    const url = `${base}/events/stream?since=${encodeURIComponent(String(sinceCursor))}&max_seconds=10`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
      },
      signal,
    });
    if (!response.ok || !response.body) {
      throw new Error(`SSE stream unavailable (${response.status})`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';
      for (const block of blocks) {
        const lines = block.split('\n');
        let eventName = '';
        let dataLine = '';
        for (const line of lines) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          if (line.startsWith('data:')) dataLine += line.slice(5).trim();
        }
        if (eventName === 'workspace_update' && dataLine) {
          try {
            const parsed = JSON.parse(dataLine) as { cursor?: number };
            onUpdate(Number(parsed.cursor ?? sinceCursor + 1));
          } catch {
            onUpdate(sinceCursor + 1);
          }
        }
      }
    }
  }

  public async requestPasswordReset(
    identifier: string,
  ): Promise<{ message: string; devResetCode?: string }> {
    const res = await this.request<{ message: string; dev_reset_code?: string }>(
      '/auth/forgot-password',
      {
        method: 'POST',
        body: JSON.stringify({ identifier: identifier.trim() }),
      },
    );
    return {
      message: res.message,
      devResetCode: res.dev_reset_code,
    };
  }

  public async confirmPasswordReset(
    identifier: string,
    resetCode: string,
    newPassword: string,
  ): Promise<string> {
    const res = await this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({
        identifier: identifier.trim(),
        reset_code: resetCode.trim(),
        new_password: newPassword,
      }),
    });
    return res.message;
  }

  public async listRoutingTemplates(): Promise<ReadonlyArray<RoutingTemplate>> {
    const res = await this.request<{
      data: Array<{
        id: string;
        name: string;
        description?: string | null;
        category_id?: string | null;
        category_name?: string | null;
        office_id: string;
        office_code: string;
        office_name: string;
        created_by_user_id: string;
        created_by_name: string;
        is_global: boolean;
        steps: Array<{
          order: number;
          office_id: string;
          office_code: string;
          office_name: string;
          default_remarks?: string;
        }>;
        created_at?: string;
      }>;
    }>('/routing-templates');

    return res.data.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description ?? null,
      categoryId: t.category_id ?? null,
      categoryName: t.category_name ?? null,
      officeId: t.office_id,
      officeCode: t.office_code,
      officeName: t.office_name,
      createdByUserId: t.created_by_user_id,
      createdByName: t.created_by_name,
      isGlobal: Boolean(t.is_global),
      steps: (t.steps ?? []).map((s, idx) => ({
        order: Number(s.order ?? idx + 1),
        officeId: s.office_id,
        officeCode: s.office_code,
        officeName: s.office_name,
        defaultRemarks: s.default_remarks ?? '',
      })),
      createdAt: t.created_at,
    }));
  }

  public async createRoutingTemplate(payload: {
    name: string;
    description?: string;
    categoryId?: string | null;
    isGlobal?: boolean;
    steps: ReadonlyArray<{ officeId: string; defaultRemarks?: string }>;
  }): Promise<RoutingTemplate> {
    const res = await this.request<{
      data: {
        id: string;
        name: string;
        description?: string | null;
        category_id?: string | null;
        category_name?: string | null;
        office_id: string;
        office_code: string;
        office_name: string;
        created_by_user_id: string;
        created_by_name: string;
        is_global: boolean;
        steps: Array<{
          order: number;
          office_id: string;
          office_code: string;
          office_name: string;
          default_remarks?: string;
        }>;
        created_at?: string;
      };
    }>('/routing-templates', {
      method: 'POST',
      body: JSON.stringify({
        name: payload.name,
        description: payload.description ?? null,
        category_id: payload.categoryId ?? null,
        is_global: Boolean(payload.isGlobal),
        steps: payload.steps.map((s) => ({
          office_id: s.officeId,
          default_remarks: s.defaultRemarks ?? '',
        })),
      }),
    });
    const t = res.data;
    return {
      id: t.id,
      name: t.name,
      description: t.description ?? null,
      categoryId: t.category_id ?? null,
      categoryName: t.category_name ?? null,
      officeId: t.office_id,
      officeCode: t.office_code,
      officeName: t.office_name,
      createdByUserId: t.created_by_user_id,
      createdByName: t.created_by_name,
      isGlobal: Boolean(t.is_global),
      steps: (t.steps ?? []).map((s, idx) => ({
        order: Number(s.order ?? idx + 1),
        officeId: s.office_id,
        officeCode: s.office_code,
        officeName: s.office_name,
        defaultRemarks: s.default_remarks ?? '',
      })),
      createdAt: t.created_at,
    };
  }

  public async deleteRoutingTemplate(templateId: string): Promise<void> {
    await this.request(`/routing-templates/${encodeURIComponent(templateId)}`, {
      method: 'DELETE',
    });
  }

  public async getTurnaroundAnalytics(): Promise<TurnaroundAnalyticsReport> {
    const res = await this.request<{
      data: {
        generated_at: string;
        summary: {
          total_documents: number;
          active_count: number;
          completed_count: number;
          stalled_count: number;
          overdue_count: number;
          at_risk_count: number;
          on_track_count: number;
          avg_turnaround_hours: number;
          on_time_rate_percent: number;
        };
        by_format: { digital: number; hard_copy: number; hybrid: number };
        by_office: Array<{
          office_id: string;
          office_code: string;
          office_name: string;
          handled_count: number;
          pending_count: number;
          overdue_count: number;
          avg_hours: number;
        }>;
        monthly_throughput: Array<{
          month: string;
          label: string;
          created_count: number;
          completed_count: number;
        }>;
      };
    }>('/analytics/turnaround');
    const d = res.data;
    return {
      generatedAt: d.generated_at,
      summary: {
        totalDocuments: d.summary.total_documents,
        activeCount: d.summary.active_count,
        completedCount: d.summary.completed_count,
        stalledCount: d.summary.stalled_count,
        overdueCount: d.summary.overdue_count,
        atRiskCount: d.summary.at_risk_count,
        onTrackCount: d.summary.on_track_count,
        avgTurnaroundHours: d.summary.avg_turnaround_hours,
        onTimeRatePercent: d.summary.on_time_rate_percent,
      },
      byFormat: {
        digital: d.by_format.digital,
        hardCopy: d.by_format.hard_copy,
        hybrid: d.by_format.hybrid,
      },
      byOffice: d.by_office.map((o) => ({
        officeId: o.office_id,
        officeCode: o.office_code,
        officeName: o.office_name,
        handledCount: o.handled_count,
        pendingCount: o.pending_count,
        overdueCount: o.overdue_count,
        avgHours: o.avg_hours,
      })),
      monthlyThroughput: d.monthly_throughput.map((m) => ({
        month: m.month,
        label: m.label,
        createdCount: m.created_count,
        completedCount: m.completed_count,
      })),
    };
  }

  public async getSentContributions(timezone?: string): Promise<import('../domain/types').SentContributionReport> {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila';
    const qs = new URLSearchParams({ tz });
    const res = await this.request<{
      data: {
        generated_at: string;
        timezone: string;
        start_date: string;
        end_date: string;
        user: {
          total: number;
          active_days: number;
          peak_count: number;
          peak_date: string | null;
          current_streak: number;
          days: Record<string, number>;
        };
        office: {
          office_id?: string;
          office_code?: string;
          office_name?: string;
          total: number;
          active_days: number;
          peak_count: number;
          peak_date: string | null;
          current_streak: number;
          days: Record<string, number>;
        };
      };
    }>(`/analytics/contributions?${qs.toString()}`);
    const d = res.data;
    return {
      generatedAt: d.generated_at,
      timezone: d.timezone,
      startDate: d.start_date,
      endDate: d.end_date,
      user: {
        total: d.user.total,
        activeDays: d.user.active_days,
        peakCount: d.user.peak_count,
        peakDate: d.user.peak_date,
        currentStreak: d.user.current_streak,
        days: d.user.days ?? {},
      },
      office: {
        officeId: d.office.office_id,
        officeCode: d.office.office_code,
        officeName: d.office.office_name,
        total: d.office.total,
        activeDays: d.office.active_days,
        peakCount: d.office.peak_count,
        peakDate: d.office.peak_date,
        currentStreak: d.office.current_streak,
        days: d.office.days ?? {},
      },
    };
  }

  public async listDocumentsPage(params: {
    q?: string;
    status?: string;
    copyFormat?: string;
    categoryId?: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedDocumentsResult> {
    const qs = new URLSearchParams();
    if (params.q?.trim()) qs.set('q', params.q.trim());
    if (params.status) qs.set('status', params.status);
    if (params.copyFormat) qs.set('copy_format', params.copyFormat);
    if (params.categoryId) qs.set('category_id', params.categoryId);
    qs.set('page', String(params.page ?? 1));
    qs.set('per_page', String(params.perPage ?? 15));

    const res = await this.request<{
      data: ApiDocumentDto[];
      meta?: { current_page: number; last_page: number; per_page: number; total: number };
    }>(`/documents?${qs.toString()}`);

    const mapped = res.data.map(mapApiDocument);
    return {
      data: mapped,
      meta: {
        currentPage: res.meta?.current_page ?? 1,
        lastPage: res.meta?.last_page ?? 1,
        perPage: res.meta?.per_page ?? mapped.length,
        total: res.meta?.total ?? mapped.length,
      },
    };
  }

  public async verifyPublicTransmittal(token: string): Promise<{
    readonly trackingCode: string;
    readonly lifecycleStatus: string;
    readonly currentOfficeName: string;
    readonly latestChecksumShort: string;
    readonly milestoneCount: number;
  }> {
    const clean = token.trim().replace(/^(?:TRC|SDO)-QR:VERIFY:/i, '').trim();
    const res = await this.request<{
      tracking_code: string;
      lifecycle_status: string;
      current_office_name: string;
      latest_checksum_short: string;
      milestone_count: number;
    }>('/qr/verify-transmittal', {
      method: 'POST',
      body: JSON.stringify({ token: clean }),
    });
    return {
      trackingCode: res.tracking_code,
      lifecycleStatus: res.lifecycle_status,
      currentOfficeName: res.current_office_name,
      latestChecksumShort: res.latest_checksum_short,
      milestoneCount: res.milestone_count,
    };
  }
}
