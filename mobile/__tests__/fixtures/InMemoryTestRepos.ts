import { ApiConfig } from '../../src/config/ApiConfig';
import { AuditLogEntry } from '../../src/domain/entities/AuditLogEntry';
import { Document } from '../../src/domain/entities/Document';
import { DocumentCategory } from '../../src/domain/entities/DocumentCategory';
import { OfflineAttachment } from '../../src/domain/entities/OfflineAttachment';
import {
  OfficeSummary,
  Personnel,
  ProfileUpdatePayload,
  UserWorkflowPreferences,
} from '../../src/domain/entities/Personnel';
import { RoutingTransaction } from '../../src/domain/entities/RoutingTransaction';
import {
  AvailabilityStatus,
  DocumentCopyFormat,
  DocumentLifecycleStatus,
  ReceiptStatus,
  RoutingScope,
  SlaState,
  SystemRole,
} from '../../src/domain/enums/DomainEnums';
import {
  DocumentTrackingPolicy,
  DocumentTrackingSnapshot,
} from '../../src/domain/security/AccessPolicy';
import {
  IImageSanitizer,
  NativeImageSanitizer,
  SanitizedImageResult,
} from '../../src/domain/security/ImageSanitizer';
import { DesktopPairingSession } from '../../src/domain/security/QrPayload';
import type { IAuditRepository } from '../../src/repositories/contracts/IAuditRepository';
import type {
  IAuthRepository,
  LoginResult,
  RegisterAccountPayload,
  RegistrationResult,
} from '../../src/repositories/contracts/IAuthRepository';
import type { ActiveDeviceSession } from '../../src/domain/entities/UserSecurityProfile';
import type {
  AcknowledgePayload,
  CreateDigitalDocumentPayload,
  ForwardDocumentPayload,
  IDocumentRepository,
  PresignedDownloadGrant,
  PrivacySafeNotification,
  RegisterHardCopyPayload,
  UploadMobilePhotoPayload,
  UploadRevisionPayload,
} from '../../src/repositories/contracts/IDocumentRepository';
import { DocumentVersion } from '../../src/domain/entities/DocumentVersion';
import type { IOfflineQueueStore } from '../../src/repositories/contracts/IOfflineQueueStore';
import type {
  ISecureTokenStore,
  SecureSessionRecord,
} from '../../src/repositories/contracts/ISecureTokenStore';
import type { AppDependencies } from '../../src/state/AppServiceContext';
import { createTestFixtureBundle, TestFixtureBundle } from './testSeed';

export class TestSecureTokenStore implements ISecureTokenStore {
  private _session: SecureSessionRecord | null = null;
  private _token: string | null = null;

  constructor(initial?: { bearerToken: string; session: SecureSessionRecord }) {
    if (initial) {
      this._token = initial.bearerToken;
      this._session = initial.session;
    }
  }

  public async getSession(): Promise<SecureSessionRecord | null> {
    return this._session;
  }

  public async getBearerToken(): Promise<string | null> {
    return this._token;
  }

  public async saveSession(bearerToken: string, session: SecureSessionRecord): Promise<void> {
    this._token = bearerToken;
    this._session = Object.freeze({ ...session });
  }

  public async clearAndWipeAllLocalCache(): Promise<void> {
    this._token = null;
    this._session = null;
  }
}

export class TestOfflineQueueStore implements IOfflineQueueStore {
  private _items: OfflineAttachment[];

  constructor(initialItems: ReadonlyArray<OfflineAttachment> = []) {
    this._items = [...initialItems];
  }

  public async loadQueue(): Promise<OfflineAttachment[]> {
    return [...this._items];
  }

  public async saveQueue(items: ReadonlyArray<OfflineAttachment>): Promise<void> {
    this._items = [...items];
  }

  public async clearQueue(): Promise<void> {
    this._items = [];
  }
}

export class TestAuthRepository implements IAuthRepository {
  private _currentUser: Personnel;
  private readonly _personnel: Personnel[];
  private readonly _issueSessionOnRegister: boolean;
  private _sessions: ActiveDeviceSession[];

  constructor(
    personnel: ReadonlyArray<Personnel>,
    initialUserId = 'usr-budget-1',
    issueSessionOnRegister = false,
  ) {
    this._personnel = [...personnel];
    this._currentUser = personnel.find((p) => p.id === initialUserId) ?? personnel[0];
    this._issueSessionOnRegister = issueSessionOnRegister;
    this._sessions = [
      {
        id: 'sess-mobile-1',
        deviceName: 'TECNO LJ9 (This Phone)',
        platform: 'android',
        lastActiveAt: new Date().toISOString(),
        isCurrentDevice: true,
        ipHint: 'SDO Wi-Fi',
      },
      {
        id: 'sess-web-2',
        deviceName: 'Chrome · Budget Workstation',
        platform: 'web',
        lastActiveAt: new Date(Date.now() - 3600_000).toISOString(),
        isCurrentDevice: false,
        ipHint: 'SDO LAN',
      },
    ];
  }

  public get currentUser(): Personnel {
    return this._currentUser;
  }

  public async login(identifier: string, password: string): Promise<LoginResult> {
    if (!password) {
      throw new Error('Password required');
    }
    const clean = identifier.trim().toLowerCase();
    const matched =
      this._personnel.find(
        (p) => p.email.toLowerCase() === clean || p.employeeId.toLowerCase() === clean,
      ) ?? this._currentUser;
    this._currentUser = matched;
    return {
      bearerToken: `test_token_${matched.id}_9999`,
      expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
      user: matched,
    };
  }

  public async register(payload: RegisterAccountPayload): Promise<RegistrationResult> {
    const duplicate = this._personnel.some(
      (p) =>
        p.email.toLowerCase() === payload.email.toLowerCase() ||
        p.employeeId.toLowerCase() === payload.employeeId.toLowerCase(),
    );
    if (duplicate) {
      throw new Error('Account already exists for this Employee ID or DepEd email.');
    }

    if (!this._issueSessionOnRegister) {
      return {
        pendingApproval: true,
        message: 'Registration submitted for SDO ICT/HR verification.',
        session: null,
      };
    }

    const matchedOffice = this._personnel.find((p) => p.office.code === payload.officeCode)
      ?.office ?? {
      id: `off-${payload.officeCode.toLowerCase()}`,
      code: payload.officeCode,
      name: payload.customOfficeName?.trim() || `${payload.officeCode} Unit`,
    };
    const newUser = new Personnel({
      id: `usr-reg-${this._personnel.length + 1}`,
      employeeId: payload.employeeId,
      fullName: payload.fullName,
      position: payload.position,
      office: matchedOffice,
      role: SystemRole.STAFF,
      email: payload.email,
      availability: AvailabilityStatus.AVAILABLE,
    });
    this._personnel.push(newUser);
    this._currentUser = newUser;

    return {
      pendingApproval: false,
      message: 'Account created and signed in.',
      session: {
        bearerToken: `test_token_${newUser.id}_7777`,
        expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
        user: newUser,
      },
    };
  }

  public async fetchCurrentProfile(): Promise<Personnel> {
    return this._currentUser;
  }

  public async updateAvailability(
    status: AvailabilityStatus,
    delegateId?: string | null,
    availabilityUntil?: string | null,
  ): Promise<Personnel> {
    this._currentUser.setAvailability(status, delegateId, availabilityUntil);
    return this._currentUser;
  }

  public async updateProfile(patch: ProfileUpdatePayload): Promise<Personnel> {
    this._currentUser.updateProfileInfo(patch);
    return this._currentUser;
  }

  public async updatePreferences(
    patch: Partial<UserWorkflowPreferences>,
  ): Promise<{ user: Personnel; preferences: UserWorkflowPreferences }> {
    const preferences = this._currentUser.updatePreferences(patch);
    return { user: this._currentUser, preferences };
  }

  public async listActiveSessions(): Promise<ReadonlyArray<ActiveDeviceSession>> {
    return [...this._sessions];
  }

  public async revokeOtherSessions(): Promise<number> {
    const others = this._sessions.filter((s) => !s.isCurrentDevice).length;
    this._sessions = this._sessions.filter((s) => s.isCurrentDevice);
    return others;
  }

  public async changePassword(_currentPassword: string, _newPassword: string): Promise<void> {}

  public async requestPasswordReset(
    _identifier: string,
  ): Promise<{ message: string; devResetCode?: string }> {
    return {
      message: 'Reset code issued.',
      devResetCode: 'K7P-492',
    };
  }

  public async confirmPasswordReset(
    _identifier: string,
    resetCode: string,
    _newPassword: string,
  ): Promise<string> {
    if (resetCode.trim().toUpperCase().replace(/-/g, '') !== 'K7P492') {
      throw new Error('Invalid or expired reset code.');
    }
    return 'Password reset successful.';
  }

  public readonly provisionedUsers: Array<{
    fullName: string;
    employeeId: string;
    email: string;
    position: string;
    officeId: string;
    role: string;
    password: string;
  }> = [];

  public readonly adminUserUpdates: Array<{
    userId: string;
    patch: Record<string, unknown>;
  }> = [];

  public async listAdminUsers(): Promise<ReadonlyArray<Personnel>> {
    return [...this._personnel];
  }

  public async createAdminUser(payload: {
    fullName: string;
    employeeId: string;
    email: string;
    position: string;
    officeId: string;
    role: string;
    password: string;
  }): Promise<Personnel> {
    this.provisionedUsers.push(payload);
    const office = this._personnel.find((p) => p.office.id === payload.officeId)?.office ?? {
      id: payload.officeId,
      code: 'RECORDS',
      name: 'Records Section',
    };
    const created = new Personnel({
      id: `usr-prov-${this._personnel.length + 1}`,
      employeeId: payload.employeeId,
      fullName: payload.fullName,
      position: payload.position,
      office,
      role: (payload.role as SystemRole) ?? SystemRole.STAFF,
      email: payload.email,
      availability: AvailabilityStatus.AVAILABLE,
      active: true,
    });
    this._personnel.unshift(created);
    return created;
  }

  public async updateAdminUser(
    userId: string,
    patch: {
      fullName?: string;
      email?: string;
      role?: string;
      officeId?: string;
      position?: string;
      availability?: AvailabilityStatus;
      active?: boolean;
      newPassword?: string;
    },
  ): Promise<Personnel> {
    this.adminUserUpdates.push({ userId, patch });
    const existing = this._personnel.find((p) => p.id === userId) ?? this._currentUser;
    return existing;
  }

  public async logout(): Promise<void> {}
}

export class TestAuditRepository implements IAuditRepository {
  private readonly _entries: AuditLogEntry[];

  constructor(initialEntries: ReadonlyArray<AuditLogEntry> = []) {
    this._entries = [...initialEntries];
  }

  public async listAll(): Promise<ReadonlyArray<AuditLogEntry>> {
    return [...this._entries];
  }

  public async listByDocument(documentId: string): Promise<ReadonlyArray<AuditLogEntry>> {
    return this._entries.filter((e) => e.documentId === documentId);
  }
}

export class TestDocumentRepository implements IDocumentRepository {
  private readonly _bundle: TestFixtureBundle;
  private readonly _authRepo: TestAuthRepository;
  private readonly _trackingPolicy = new DocumentTrackingPolicy();
  private readonly _unlockChallenges: Array<{
    documentId: string;
    userId: string;
    token: string;
    shortCode: string;
    consumed: boolean;
  }> = [];
  public readonly uploadedPhotos: UploadMobilePhotoPayload[] = [];
  public readonly acknowledgedPayloads: AcknowledgePayload[] = [];

  constructor(bundle: TestFixtureBundle, authRepo: TestAuthRepository) {
    this._bundle = bundle;
    this._authRepo = authRepo;
  }

  public seedUnlockChallenge(params: {
    documentId: string;
    userId: string;
    token: string;
    shortCode: string;
  }): void {
    this._unlockChallenges.push({
      documentId: params.documentId,
      userId: params.userId,
      token: params.token,
      shortCode: params.shortCode.replace(/-/g, '').toUpperCase(),
      consumed: false,
    });
  }

  public async listOffices(): Promise<ReadonlyArray<OfficeSummary>> {
    return [...this._bundle.offices];
  }

  public async listPersonnel(): Promise<ReadonlyArray<Personnel>> {
    return [...this._bundle.personnel];
  }

  public async listDocuments(): Promise<ReadonlyArray<Document>> {
    return [...this._bundle.documents];
  }

  public async listTrackedSummaries(): Promise<ReadonlyArray<DocumentTrackingSnapshot>> {
    const actor = this._authRepo.currentUser;
    return this._bundle.documents
      .filter((doc) => doc.involvesOffice(actor.office.id))
      .map((doc) => this._trackingPolicy.toTrackingSnapshot(actor, doc))
      .filter((snap): snap is DocumentTrackingSnapshot => snap !== null);
  }

  public async trackByCode(trackingCode: string): Promise<DocumentTrackingSnapshot | null> {
    const clean = trackingCode.trim().toUpperCase();
    const doc = this._bundle.documents.find((d) => d.trackingCode.toUpperCase() === clean);
    if (!doc) return null;
    return this._trackingPolicy.toTrackingSnapshot(this._authRepo.currentUser, doc);
  }

  public async getDocumentById(id: string): Promise<Document> {
    const doc = this._bundle.documents.find((d) => d.id === id);
    if (!doc) throw new Error(`Document ${id} not found`);
    return doc;
  }

  public async createDigitalDocument(payload: CreateDigitalDocumentPayload): Promise<Document> {
    return this._createOriginDocument({
      title: payload.title,
      categoryId: payload.categoryId,
      confidentialityTier: payload.confidentialityTier,
      recipientUserId: payload.recipientUserId,
      remarks: payload.remarks,
      routeToDelegateIfOnLeave: payload.routeToDelegateIfOnLeave,
      copyFormat: DocumentCopyFormat.DIGITAL,
      digitalFile: {
        fileName: payload.fileName,
        mimeType: payload.mimeType,
        sizeBytes: payload.sizeBytes,
        sha256Checksum: payload.sha256Checksum,
      },
    });
  }

  public async registerHardCopyDocument(payload: RegisterHardCopyPayload): Promise<Document> {
    return this._createOriginDocument({
      title: payload.title,
      categoryId: payload.categoryId,
      confidentialityTier: payload.confidentialityTier,
      recipientUserId: payload.recipientUserId,
      remarks: payload.remarks,
      routeToDelegateIfOnLeave: payload.routeToDelegateIfOnLeave,
      copyFormat: DocumentCopyFormat.HARD_COPY,
      physicalReference: payload.physicalReference ?? null,
      physicalPageCount: payload.physicalPageCount ?? null,
    });
  }

  private _createOriginDocument(params: {
    title: string;
    categoryId: string;
    confidentialityTier: RegisterHardCopyPayload['confidentialityTier'];
    recipientUserId?: string | null;
    remarks?: string;
    routeToDelegateIfOnLeave?: boolean;
    copyFormat: DocumentCopyFormat;
    physicalReference?: string | null;
    physicalPageCount?: number | null;
    digitalFile?: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      sha256Checksum: string;
    };
  }): Document {
    const actor = this._authRepo.currentUser;
    const category = this._bundle.categories.find((c) => c.id === params.categoryId);
    const seq = 900 + this._bundle.documents.length;
    const prefix = params.copyFormat === DocumentCopyFormat.HARD_COPY ? 'hc' : 'sc';
    const id = `doc-${prefix}-${seq}`;
    const trackingCode = `SDO-OM-2026-000${seq}`;
    const qrToken = `qr_${prefix}_${seq}_opaque_token`;
    const nowIso = new Date().toISOString();

    let recipient: Personnel | undefined;
    if (params.recipientUserId) {
      const requested = this._bundle.personnel.find((p) => p.id === params.recipientUserId);
      recipient =
        requested &&
        !requested.canReceiveDirectRouting() &&
        params.routeToDelegateIfOnLeave &&
        requested.delegateId
          ? (this._bundle.personnel.find((p) => p.id === requested.delegateId) ?? requested)
          : requested;
    }

    const tx = recipient
      ? new RoutingTransaction({
          id: `tx-${prefix}-${seq}`,
          documentId: id,
          fromUserId: actor.id,
          fromUserName: actor.fullName,
          fromOffice: actor.office,
          toUserId: recipient.id,
          toUserName: recipient.fullName,
          toOffice: recipient.office,
          routingScope:
            recipient.office.id === actor.office.id
              ? RoutingScope.INTERNAL_OFFICE
              : RoutingScope.INTER_OFFICE,
          receiptStatus: ReceiptStatus.PENDING,
          remarks:
            params.remarks?.trim() ||
            (params.copyFormat === DocumentCopyFormat.HARD_COPY
              ? 'Physical folder dispatched with QR slip'
              : 'Soft-copy document dispatched'),
          isInternalOnly: true,
          sentAt: nowIso,
        })
      : null;

    const versions = params.digitalFile
      ? [
          new DocumentVersion({
            id: `ver-${prefix}-${seq}`,
            versionNumber: 1,
            fileName: params.digitalFile.fileName,
            mimeType: params.digitalFile.mimeType,
            sizeBytes: params.digitalFile.sizeBytes,
            sha256Checksum: params.digitalFile.sha256Checksum,
            uploadedById: actor.id,
            uploadedByName: actor.fullName,
            uploadedAt: nowIso,
            revisionNote: 'Initial soft-copy upload',
            storageKey: `private/docs/${id}/v1.pdf`,
          }),
        ]
      : [];

    const doc = new Document({
      id,
      trackingCode,
      qrToken,
      title: params.title,
      categoryId: params.categoryId,
      categoryName: category?.name ?? 'SDO Records',
      confidentialityTier: params.confidentialityTier,
      lifecycleStatus: tx
        ? DocumentLifecycleStatus.IN_TRANSIT
        : DocumentLifecycleStatus.IN_REVIEW,
      copyFormat: params.copyFormat,
      physicalReference: params.physicalReference ?? null,
      physicalPageCount: params.physicalPageCount ?? null,
      slaState: SlaState.ON_TRACK,
      slaDueAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
      originOffice: actor.office,
      originUserId: actor.id,
      originUserName: actor.fullName,
      currentOffice: recipient?.office ?? actor.office,
      currentHolderId: recipient?.id ?? actor.id,
      currentHolderName: recipient?.fullName ?? actor.fullName,
      explicitParticipantIds: recipient ? [actor.id, recipient.id] : [actor.id],
      versions,
      transactions: tx ? [tx] : [],
      externalMilestones: [
        {
          id: `ms-${prefix}-${seq}`,
          stageLabel:
            params.copyFormat === DocumentCopyFormat.HARD_COPY
              ? `Hard-copy logged by ${actor.office.code}`
              : `Uploaded by ${actor.office.code}`,
          officeName: actor.office.name,
          occurredAt: nowIso,
        },
        ...(tx
          ? [
              {
                id: `ms-${prefix}-tx-${seq}`,
                stageLabel: `Routed to ${tx.toOffice.code}`,
                officeName: tx.toOffice.name,
                occurredAt: nowIso,
              },
            ]
          : []),
      ],
      createdAt: nowIso,
    });

    this._bundle.documents.unshift(doc);
    return doc;
  }

  public async acknowledgeReceipt(payload: AcknowledgePayload): Promise<Document> {
    if (payload.password !== undefined && payload.password === 'WrongPassword!') {
      throw new Error('Incorrect account password.');
    }
    this.acknowledgedPayloads.push(payload);
    const doc = await this.getDocumentById(payload.documentId);
    const actor = this._authRepo.currentUser;
    const latest = doc.latestTransaction!;
    latest.acknowledge(
      actor.fullName,
      payload.proofPhoto
        ? {
            fileName: payload.proofPhoto.fileName,
            compressedBytes: payload.proofPhoto.compressedBytes,
            sha256Checksum: payload.proofPhoto.sha256Checksum,
            exifStripped: payload.proofPhoto.exifStripped,
            capturedAt: new Date().toISOString(),
            localUri: payload.proofPhoto.uri,
          }
        : null,
    );
    doc.markAccepted(actor.office, actor.id, actor.fullName);
    return doc;
  }

  public async completeDocument(
    documentId: string,
    status: 'approved' | 'archived',
    _remarks?: string,
  ): Promise<Document> {
    const doc = await this.getDocumentById(documentId);
    const actor = this._authRepo.currentUser;
    doc.markCompleted(status, actor.office);
    return doc;
  }

  public async forwardDocument(payload: ForwardDocumentPayload): Promise<Document> {
    const doc = await this.getDocumentById(payload.documentId);
    const actor = this._authRepo.currentUser;
    const recipient = this._bundle.personnel.find((p) => p.id === payload.recipientUserId)!;
    const target =
      !recipient.canReceiveDirectRouting() && payload.routeToDelegateIfOnLeave && recipient.delegateId
        ? this._bundle.personnel.find((p) => p.id === recipient.delegateId)!
        : recipient;

    doc.appendTransaction(
      new RoutingTransaction({
        id: `tx-${Date.now()}`,
        documentId: doc.id,
        fromUserId: actor.id,
        fromUserName: actor.fullName,
        fromOffice: actor.office,
        toUserId: target.id,
        toUserName: target.fullName,
        toOffice: target.office,
        routingScope:
          target.office.id === actor.office.id
            ? RoutingScope.INTERNAL_OFFICE
            : RoutingScope.INTER_OFFICE,
        receiptStatus: ReceiptStatus.PENDING,
        remarks: payload.remarks,
        isInternalOnly: true,
        sentAt: new Date().toISOString(),
      }),
    );
    return doc;
  }

  public async recallLatestTransfer(documentId: string): Promise<Document> {
    const doc = await this.getDocumentById(documentId);
    const latest = doc.latestTransaction!;
    latest.recall(this._authRepo.currentUser.id);
    doc.markRecalled(latest.fromOffice, latest.fromUserId, latest.fromUserName);
    return doc;
  }

  public async declineMisrouted(documentId: string, reason: string): Promise<Document> {
    const doc = await this.getDocumentById(documentId);
    const latest = doc.latestTransaction!;
    latest.declineAsMisrouted(reason);
    doc.markDeclinedToSender(latest.fromOffice, latest.fromUserId, latest.fromUserName);
    return doc;
  }

  public async returnForRevision(documentId: string, remarks: string): Promise<Document> {
    const doc = await this.getDocumentById(documentId);
    doc.latestTransaction?.markReturnedForRevision(remarks);
    doc.markReturnedToOrigin();
    return doc;
  }

  public async uploadRevisionVersion(payload: UploadRevisionPayload): Promise<Document> {
    const doc = await this.getDocumentById(payload.documentId);
    const actor = this._authRepo.currentUser;
    doc.addRevisionVersion({
      id: `ver-${Date.now()}-${doc.versions.length + 1}`,
      fileName: payload.fileName,
      mimeType: payload.mimeType,
      sizeBytes: payload.sizeBytes,
      sha256Checksum: payload.sha256Checksum,
      uploadedById: actor.id,
      uploadedByName: actor.fullName,
      revisionNote: payload.revisionNote,
      storageKey: `private/docs/${doc.id}/v${doc.versions.length + 1}.pdf`,
    });
    return doc;
  }

  public async issuePresignedViewGrant(
    documentId: string,
    versionNumber: number,
  ): Promise<PresignedDownloadGrant> {
    const doc = await this.getDocumentById(documentId);
    const version = doc.versions.find((v) => v.versionNumber === versionNumber) ?? doc.latestVersion;
    return {
      url: `https://doctrack.depedormin.gov.ph/presigned/${doc.id}/v${version.versionNumber}`,
      expiresAt: new Date(Date.now() + 90_000).toISOString(),
      ttlSeconds: 90,
      version,
    };
  }

  public async resolveDocumentQr(opaqueToken: string): Promise<Document> {
    const clean = opaqueToken.trim();
    const lower = clean.toLowerCase();
    const upper = clean.toUpperCase();
    const doc = this._bundle.documents.find(
      (d) =>
        d.qrToken === clean ||
        d.qrToken.toLowerCase() === lower ||
        d.trackingCode.toUpperCase() === upper,
    );
    if (!doc) throw new Error('No document matches this QR token or tracking code.');
    return doc;
  }

  public async consumeUnlockChallenge(codeOrToken: string): Promise<Document> {
    const stripped = codeOrToken.trim().replace(/^(?:TRC|SDO)-QR:UNLOCK:/i, '').trim();
    const compact = stripped.replace(/-/g, '').toUpperCase();
    const challenge = this._unlockChallenges.find(
      (c) => c.token === stripped || c.shortCode === compact,
    );
    if (!challenge) {
      throw new Error('Unlock QR or 6-character code not found.');
    }
    if (challenge.userId !== this._authRepo.currentUser.id) {
      throw new Error('This Unlock QR belongs to a different Tracely account.');
    }
    if (challenge.consumed) {
      throw new Error('This Unlock QR has already been used.');
    }
    challenge.consumed = true;
    return this.acknowledgeReceipt({
      documentId: challenge.documentId,
      verificationCode: challenge.token,
    });
  }

  public async resolveDesktopPairingQr(opaqueToken: string): Promise<DesktopPairingSession> {
    const pairing = this._bundle.pairings.find((p) => p.pairToken === opaqueToken);
    if (!pairing) throw new Error('Pairing token not found');
    return pairing;
  }

  public async verifyTransmittalQr(opaqueToken: string) {
    const doc = await this.resolveDocumentQr(opaqueToken);
    const latestVer = doc.latestVersionOrNull;
    return {
      trackingCode: doc.trackingCode,
      lifecycleStatus: doc.lifecycleStatus,
      currentOfficeName: doc.currentOffice.name,
      latestChecksumShort: latestVer ? `${latestVer.sha256Checksum.slice(0, 12)}...` : 'PHYSICAL-ONLY',
      milestoneCount: doc.externalMilestones.length,
    };
  }

  public async uploadMobilePhoto(payload: UploadMobilePhotoPayload): Promise<void> {
    this.uploadedPhotos.push(payload);
  }

  public async listCategories(): Promise<ReadonlyArray<DocumentCategory>> {
    return [...this._bundle.categories];
  }

  public async declareCategory(name: string, code: string): Promise<DocumentCategory> {
    const actor = this._authRepo.currentUser;
    const cat = new DocumentCategory({
      id: `cat-${Date.now()}`,
      name,
      code: code || name.slice(0, 6).toUpperCase(),
      declaredByOfficeCode: actor.office.code,
      declaredByOfficeName: actor.office.name,
      usageCount: 0,
    });
    this._bundle.categories.unshift(cat);
    return cat;
  }

  public async updateAdminCategory(
    categoryId: string,
    patch: { name?: string; code?: string },
  ): Promise<DocumentCategory> {
    const existing = this._bundle.categories.find((c) => c.id === categoryId);
    const updated = new DocumentCategory({
      id: categoryId,
      name: patch.name ?? existing?.name ?? 'Updated Category',
      code: patch.code ?? existing?.code ?? 'CAT',
      declaredByOfficeCode: existing?.declaredByOfficeCode ?? 'RECORDS',
      declaredByOfficeName: existing?.declaredByOfficeName ?? 'Records Section',
      usageCount: existing?.usageCount ?? 0,
    });
    const idx = this._bundle.categories.findIndex((c) => c.id === categoryId);
    if (idx !== -1) {
      this._bundle.categories[idx] = updated;
    }
    return updated;
  }

  public async deleteAdminCategory(categoryId: string): Promise<void> {
    const idx = this._bundle.categories.findIndex((c) => c.id === categoryId);
    if (idx !== -1) {
      this._bundle.categories.splice(idx, 1);
    }
  }

  public async listNotifications(): Promise<ReadonlyArray<PrivacySafeNotification>> {
    return [...this._bundle.notifications];
  }

  public async markNotificationRead(notificationId: string): Promise<void> {
    this._bundle.notifications.forEach((n) => {
      if (n.id === notificationId) {
        n.read = true;
      }
    });
  }

  public async markAllNotificationsRead(): Promise<void> {
    this._bundle.notifications.forEach((n) => {
      n.read = true;
    });
  }
}

export class TestImageSanitizer implements IImageSanitizer {
  private readonly _native = new NativeImageSanitizer();

  public async sanitizeImageAsset(input: {
    uri: string;
    fileName?: string | null;
    originalBytes?: number | null;
  }): Promise<SanitizedImageResult> {
    const fakeBytes = new Uint8Array(
      Array.from(`${input.uri}|${input.fileName ?? 'capture.jpg'}`).map((ch) =>
        ch.charCodeAt(0),
      ),
    );
    const sha256Checksum = this._native.computeSha256Bytes(fakeBytes);
    return {
      uri: input.uri,
      fileName: input.fileName ?? 'capture.jpg',
      mimeType: 'image/jpeg',
      originalBytes: input.originalBytes ?? 2_400_000,
      compressedBytes: 245_000,
      sha256Checksum,
      exifStripped: true,
    };
  }

  public async computeSha256FromUri(uri: string): Promise<string> {
    const bytes = new Uint8Array(Array.from(uri).map((ch) => ch.charCodeAt(0)));
    return this._native.computeSha256Bytes(bytes);
  }

  public computeSha256Bytes(bytes: Uint8Array): string {
    return this._native.computeSha256Bytes(bytes);
  }
}

export function createTestAppDependencies(options?: {
  authenticatedUserId?: string;
  skipOnboarding?: boolean;
}): {
  deps: AppDependencies;
  bundle: TestFixtureBundle;
  authRepo: TestAuthRepository;
  docRepo: TestDocumentRepository;
} {
  const bundle = createTestFixtureBundle();
  const userId = options?.authenticatedUserId;
  const authRepo = new TestAuthRepository(bundle.personnel, userId ?? 'usr-budget-1');
  const docRepo = new TestDocumentRepository(bundle, authRepo);
  const tokenStore = userId
    ? new TestSecureTokenStore({
        bearerToken: `token_${userId}_1234`,
        session: {
          tokenHint: 'sdo_mob_••••1234',
          userId,
          issuedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
          storageBacking: 'Test Keystore',
        },
      })
    : new TestSecureTokenStore();

  return {
    bundle,
    authRepo,
    docRepo,
    deps: {
      apiConfig: new ApiConfig(),
      tokenStore,
      queueStore: new TestOfflineQueueStore(bundle.offlineQueue),
      authRepo,
      docRepo,
      auditRepo: new TestAuditRepository(bundle.auditLogs),
      imageSanitizer: new TestImageSanitizer(),
      disableNetInfoListener: true,
      skipOnboarding: options?.skipOnboarding ?? true,
    },
  };
}
