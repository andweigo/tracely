import { Document } from '../../domain/entities/Document';
import { DocumentCategory } from '../../domain/entities/DocumentCategory';
import { DocumentVersion } from '../../domain/entities/DocumentVersion';
import { OfficeSummary, Personnel } from '../../domain/entities/Personnel';
import { ConfidentialityTier } from '../../domain/enums/DomainEnums';
import {
  DocumentCategoryDto,
  DocumentDto,
  DocumentMapper,
  DocumentTrackingSnapshotDto,
  DocumentVersionDto,
  PersonnelDto,
} from '../../domain/mappers/DocumentMapper';
import type { DocumentTrackingSnapshot } from '../../domain/security/AccessPolicy';
import { DesktopPairingSession } from '../../domain/security/QrPayload';
import { ApiClient } from '../../network/ApiClient';
import type {
  AcknowledgePayload,
  CommentVisibility,
  CreateDigitalDocumentPayload,
  DocumentComment,
  ForwardDocumentPayload,
  IDocumentRepository,
  PresignedDownloadGrant,
  PrivacySafeNotification,
  RealtimePulseResponse,
  RegisterHardCopyPayload,
  UploadMobilePhotoPayload,
  UploadRevisionPayload,
} from '../contracts/IDocumentRepository';

export class HttpDocumentRepository implements IDocumentRepository {
  private readonly _api: ApiClient;

  constructor(api: ApiClient) {
    this._api = api;
  }

  public async listOffices(): Promise<ReadonlyArray<OfficeSummary>> {
    const res = await this._api.get<{ data: OfficeSummary[] }>('/offices');
    return res.data;
  }

  public async listPersonnel(): Promise<ReadonlyArray<Personnel>> {
    const res = await this._api.get<{ data: PersonnelDto[] }>('/personnel');
    return res.data.map(DocumentMapper.toPersonnel);
  }

  public async listDocuments(): Promise<ReadonlyArray<Document>> {
    const res = await this._api.get<{ data: DocumentDto[] }>('/documents');
    return res.data.map(DocumentMapper.toDocument);
  }

  public async listTrackedSummaries(): Promise<ReadonlyArray<DocumentTrackingSnapshot>> {
    const res = await this._api.get<{ data: DocumentTrackingSnapshotDto[] }>('/documents/tracked');
    return res.data.map(DocumentMapper.toTrackingSnapshot);
  }

  public async trackByCode(trackingCode: string): Promise<DocumentTrackingSnapshot | null> {
    const res = await this._api.get<{ data: DocumentTrackingSnapshotDto | null }>(
      `/documents/track/${encodeURIComponent(trackingCode.trim())}`,
    );
    return res.data ? DocumentMapper.toTrackingSnapshot(res.data) : null;
  }

  public async getDocumentById(id: string): Promise<Document> {
    const res = await this._api.get<{ data: DocumentDto }>(`/documents/${encodeURIComponent(id)}`);
    return DocumentMapper.toDocument(res.data);
  }

  public async createDigitalDocument(payload: CreateDigitalDocumentPayload): Promise<Document> {
    const form = new FormData();
    form.append('title', payload.title);
    form.append('category_id', payload.categoryId);
    form.append('confidentiality_tier', payload.confidentialityTier);
    form.append('file_name', payload.fileName);
    form.append('sha256_checksum', payload.sha256Checksum);
    form.append('size_bytes', String(payload.sizeBytes));
    form.append('remarks', payload.remarks ?? '');
    form.append('route_to_delegate_if_on_leave', payload.routeToDelegateIfOnLeave ? '1' : '0');
    if (payload.recipientUserId) {
      form.append('recipient_user_id', payload.recipientUserId);
    }
    form.append('file', {
      uri: payload.fileUri,
      name: payload.fileName,
      type: payload.mimeType,
    } as unknown as Blob);

    const res = await this._api.postMultipart<{ data: DocumentDto }>('/documents', form);
    return DocumentMapper.toDocument(res.data);
  }

  public async registerHardCopyDocument(payload: RegisterHardCopyPayload): Promise<Document> {
    const res = await this._api.post<{ data: DocumentDto }>('/documents/hard-copy', {
      title: payload.title,
      category_id: payload.categoryId,
      confidentiality_tier: payload.confidentialityTier,
      recipient_user_id: payload.recipientUserId ?? null,
      remarks: payload.remarks ?? '',
      route_to_delegate_if_on_leave: Boolean(payload.routeToDelegateIfOnLeave),
      physical_reference: payload.physicalReference ?? null,
      physical_page_count: payload.physicalPageCount ?? null,
    });
    return DocumentMapper.toDocument(res.data);
  }

  public async acknowledgeReceipt(payload: AcknowledgePayload): Promise<Document> {
    if (payload.proofPhoto) {
      const form = new FormData();
      form.append('sha256_checksum', payload.proofPhoto.sha256Checksum);
      form.append('exif_stripped', payload.proofPhoto.exifStripped ? '1' : '0');
      if (payload.verificationCode) {
        form.append('verification_code', payload.verificationCode);
      }
      if (payload.password) {
        form.append('password', payload.password);
      }
      form.append('proof_photo', {
        uri: payload.proofPhoto.uri,
        name: payload.proofPhoto.fileName,
        type: payload.proofPhoto.mimeType,
      } as unknown as Blob);

      const res = await this._api.postMultipart<{ data: DocumentDto }>(
        `/documents/${encodeURIComponent(payload.documentId)}/acknowledge`,
        form,
      );
      return DocumentMapper.toDocument(res.data);
    }

    const body: Record<string, string> = {};
    if (payload.verificationCode) {
      body.verification_code = payload.verificationCode;
    }
    if (payload.password) {
      body.password = payload.password;
    }
    const res = await this._api.post<{ data: DocumentDto }>(
      `/documents/${encodeURIComponent(payload.documentId)}/acknowledge`,
      body,
    );
    return DocumentMapper.toDocument(res.data);
  }

  public async forwardDocument(payload: ForwardDocumentPayload): Promise<Document> {
    const res = await this._api.post<{ data: DocumentDto }>(
      `/documents/${encodeURIComponent(payload.documentId)}/forward`,
      {
        recipient_user_id: payload.recipientUserId,
        remarks: payload.remarks,
        route_to_delegate_if_on_leave: Boolean(payload.routeToDelegateIfOnLeave),
      },
    );
    return DocumentMapper.toDocument(res.data);
  }

  public async recallLatestTransfer(documentId: string): Promise<Document> {
    const res = await this._api.post<{ data: DocumentDto }>(
      `/documents/${encodeURIComponent(documentId)}/recall`,
      {},
    );
    return DocumentMapper.toDocument(res.data);
  }

  public async updateDocumentDetails(
    documentId: string,
    patch: {
      title?: string;
      categoryId?: string;
      confidentialityTier?: ConfidentialityTier;
      physicalReference?: string | null;
      physicalPageCount?: number | null;
    },
  ): Promise<Document> {
    const res = await this._api.patch<{ data: DocumentDto }>(
      `/documents/${encodeURIComponent(documentId)}`,
      {
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
      },
    );
    return DocumentMapper.toDocument(res.data);
  }

  public async declineMisrouted(documentId: string, reason: string): Promise<Document> {
    const res = await this._api.post<{ data: DocumentDto }>(
      `/documents/${encodeURIComponent(documentId)}/decline`,
      { reason },
    );
    return DocumentMapper.toDocument(res.data);
  }

  public async returnForRevision(documentId: string, remarks: string): Promise<Document> {
    const res = await this._api.post<{ data: DocumentDto }>(
      `/documents/${encodeURIComponent(documentId)}/return-revision`,
      { remarks },
    );
    return DocumentMapper.toDocument(res.data);
  }

  public async uploadRevisionVersion(payload: UploadRevisionPayload): Promise<Document> {
    const form = new FormData();
    form.append('revision_note', payload.revisionNote);
    form.append('file_name', payload.fileName);
    if (payload.changeType) {
      form.append('change_type', payload.changeType);
    }
    form.append('sha256_checksum', payload.sha256Checksum);
    form.append('size_bytes', String(payload.sizeBytes));
    form.append('file', {
      uri: payload.fileUri,
      name: payload.fileName,
      type: payload.mimeType,
    } as unknown as Blob);

    const res = await this._api.postMultipart<{ data: DocumentDto }>(
      `/documents/${encodeURIComponent(payload.documentId)}/versions`,
      form,
    );
    return DocumentMapper.toDocument(res.data);
  }

  public async issuePresignedViewGrant(
    documentId: string,
    versionNumber: number,
  ): Promise<PresignedDownloadGrant> {
    const res = await this._api.post<{
      url: string;
      expires_at: string;
      ttl_seconds: number;
      version: DocumentVersionDto;
    }>(
      `/documents/${encodeURIComponent(documentId)}/versions/${versionNumber}/presigned-url`,
      {},
    );

    let resolvedUrl = res.url;
    const apiV1Idx = res.url.indexOf('/api/v1/');
    const activeBase = this._api.baseUrl;
    if (
      apiV1Idx !== -1 &&
      activeBase &&
      (res.url.startsWith('http://127.0.0.1:') ||
        res.url.startsWith('http://localhost:') ||
        res.url.startsWith('http://10.0.2.2:'))
    ) {
      resolvedUrl = `${activeBase.replace(/\/+$/, '')}${res.url.slice(apiV1Idx + '/api/v1'.length)}`;
    }

    return Object.freeze({
      url: resolvedUrl,
      expiresAt: res.expires_at,
      ttlSeconds: res.ttl_seconds,
      version: new DocumentVersion({
        id: res.version.id,
        versionNumber: res.version.version_number,
        changeType: res.version.change_type,
        fileName: res.version.file_name,
        mimeType: res.version.mime_type,
        sizeBytes: res.version.size_bytes,
        sha256Checksum: res.version.sha256_checksum,
        uploadedById: res.version.uploaded_by_id,
        uploadedByName: res.version.uploaded_by_name,
        uploadedByOfficeCode: res.version.uploaded_by_office_code,
        uploadedByOfficeName: res.version.uploaded_by_office_name,
        uploadedAt: res.version.uploaded_at,
        revisionNote: res.version.revision_note,
        storageKey: res.version.storage_key,
      }),
    });
  }

  public async resolveDocumentQr(opaqueToken: string): Promise<Document> {
    const res = await this._api.post<{ data: DocumentDto }>('/qr/resolve-document', {
      token: opaqueToken,
    });
    return DocumentMapper.toDocument(res.data);
  }

  public async consumeUnlockChallenge(
    codeOrToken: string,
    documentId?: string,
  ): Promise<Document> {
    const res = await this._api.post<{ data: DocumentDto }>('/qr/consume-unlock', {
      code: codeOrToken,
      ...(documentId ? { document_id: documentId } : {}),
    });
    return DocumentMapper.toDocument(res.data);
  }

  public async resolveDesktopPairingQr(opaqueToken: string): Promise<DesktopPairingSession> {
    const res = await this._api.post<{
      pair_token: string;
      owner_user_id: string;
      draft_label: string;
      expires_at: string;
    }>('/qr/resolve-pair', { token: opaqueToken });

    return {
      pairToken: res.pair_token,
      ownerUserId: res.owner_user_id,
      draftLabel: res.draft_label,
      expiresAt: res.expires_at,
    };
  }

  public async verifyTransmittalQr(opaqueToken: string): Promise<{
    readonly trackingCode: string;
    readonly lifecycleStatus: string;
    readonly currentOfficeName: string;
    readonly latestChecksumShort: string;
    readonly milestoneCount: number;
  }> {
    const res = await this._api.post<{
      tracking_code: string;
      lifecycle_status: string;
      current_office_name: string;
      latest_checksum_short: string;
      milestone_count: number;
    }>('/qr/verify-transmittal', { token: opaqueToken });

    return {
      trackingCode: res.tracking_code,
      lifecycleStatus: res.lifecycle_status,
      currentOfficeName: res.current_office_name,
      latestChecksumShort: res.latest_checksum_short,
      milestoneCount: res.milestone_count,
    };
  }

  public async uploadMobilePhoto(payload: UploadMobilePhotoPayload): Promise<void> {
    const form = new FormData();
    form.append('target_type', payload.targetType);
    form.append('target_id', payload.targetId);
    form.append('sha256_checksum', payload.sha256Checksum);
    form.append('exif_stripped', payload.exifStripped ? '1' : '0');
    form.append('compressed_bytes', String(payload.compressedBytes));
    form.append('photo', {
      uri: payload.fileUri,
      name: payload.fileName,
      type: payload.mimeType,
    } as unknown as Blob);

    await this._api.postMultipart<void>('/attachments/mobile-capture', form);
  }

  public async listCategories(): Promise<ReadonlyArray<DocumentCategory>> {
    const res = await this._api.get<{ data: DocumentCategoryDto[] }>('/categories');
    return res.data.map(DocumentMapper.toCategory);
  }

  public async declareCategory(name: string, code: string): Promise<DocumentCategory> {
    const res = await this._api.post<{ data: DocumentCategoryDto }>('/categories', {
      name,
      code: code || undefined,
    });
    return DocumentMapper.toCategory(res.data);
  }

  public async updateAdminCategory(
    categoryId: string,
    patch: { name?: string; code?: string },
  ): Promise<DocumentCategory> {
    const res = await this._api.patch<{ data: DocumentCategoryDto }>(
      `/admin/categories/${encodeURIComponent(categoryId)}`,
      patch,
    );
    return DocumentMapper.toCategory(res.data);
  }

  public async deleteAdminCategory(categoryId: string): Promise<void> {
    await this._api.delete<void>(`/admin/categories/${encodeURIComponent(categoryId)}`);
  }

  public async listNotifications(): Promise<ReadonlyArray<PrivacySafeNotification>> {
    const res = await this._api.get<{
      data: Array<{
        id: string;
        target_user_id: string;
        target_office_id: string;
        document_id: string;
        title?: string | null;
        content?: string | null;
        lock_screen_preview: string;
        authenticated_detail: string;
        received_at: string;
        read: boolean;
      }>;
    }>('/notifications');

    return res.data.map((n) => ({
      id: n.id,
      targetUserId: n.target_user_id,
      targetOfficeId: n.target_office_id,
      documentId: n.document_id,
      title: n.title?.trim() || 'Document Custody Alert',
      content: n.content?.trim() || n.authenticated_detail,
      lockScreenPreview: n.lock_screen_preview,
      authenticatedDetail: n.authenticated_detail,
      receivedAt: n.received_at,
      read: n.read,
    }));
  }

  public async markNotificationRead(notificationId: string): Promise<void> {
    await this._api.post<void>(`/notifications/${encodeURIComponent(notificationId)}/read`, {});
  }

  public async markAllNotificationsRead(): Promise<void> {
    await this._api.post<void>('/notifications/read-all', {});
  }

  public async completeDocument(
    documentId: string,
    status: 'approved' | 'archived',
    remarks?: string,
  ): Promise<Document> {
    const res = await this._api.post<{ data: DocumentDto }>(
      `/documents/${encodeURIComponent(documentId)}/complete`,
      { status, remarks: remarks ?? '' },
    );
    return DocumentMapper.toDocument(res.data);
  }

  public async listDocumentComments(documentId: string): Promise<ReadonlyArray<DocumentComment>> {
    const res = await this._api.get<{
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
    const res = await this._api.post<{
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
    }>(`/documents/${encodeURIComponent(documentId)}/comments`, { body, visibility });
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

  public async issueProofPhotoViewGrant(
    documentId: string,
    transactionId: string,
  ): Promise<PresignedDownloadGrant> {
    const res = await this._api.post<{
      url: string;
      expires_at: string;
      ttl_seconds: number;
      version: DocumentVersionDto;
    }>(
      `/documents/${encodeURIComponent(documentId)}/transactions/${encodeURIComponent(transactionId)}/proof-url`,
      {},
    );

    let resolvedUrl = res.url;
    const apiV1Idx = res.url.indexOf('/api/v1/');
    const activeBase = this._api.baseUrl;
    if (
      apiV1Idx !== -1 &&
      activeBase &&
      (res.url.startsWith('http://127.0.0.1:') ||
        res.url.startsWith('http://localhost:') ||
        res.url.startsWith('http://10.0.2.2:'))
    ) {
      resolvedUrl = `${activeBase.replace(/\/+$/, '')}${res.url.slice(apiV1Idx + '/api/v1'.length)}`;
    }

    return Object.freeze({
      url: resolvedUrl,
      expiresAt: res.expires_at,
      ttlSeconds: res.ttl_seconds,
      version: new DocumentVersion({
        id: res.version.id,
        versionNumber: res.version.version_number || 1,
        fileName: res.version.file_name,
        mimeType: res.version.mime_type,
        sizeBytes: Math.max(1, res.version.size_bytes || 1),
        sha256Checksum: res.version.sha256_checksum || '0'.repeat(64),
        uploadedById: res.version.uploaded_by_id || 'usr-receiver',
        uploadedByName: res.version.uploaded_by_name || 'Receiving Officer',
        uploadedAt: res.version.uploaded_at,
        revisionNote: res.version.revision_note || 'Signed slip receive-proof photo',
        storageKey: res.version.storage_key || `proofs/${documentId}/${transactionId}`,
      }),
    });
  }

  public async pollRealtimePulse(sinceCursor: number): Promise<RealtimePulseResponse> {
    const res = await this._api.get<{
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

  public async getSentContributions(
    timezone?: string,
  ): Promise<import('../contracts/IDocumentRepository').SentContributionReport> {
    const tz = timezone || 'Asia/Manila';
    const res = await this._api.get<{
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
    }>(`/analytics/contributions?tz=${encodeURIComponent(tz)}`);
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
}
