import { BaseEntity } from '../base/BaseEntity';
import { DomainRuleError } from '../base/DomainRuleError';
import {
  ConfidentialityTier,
  DocumentCopyFormat,
  DocumentLifecycleStatus,
  SlaState,
} from '../enums/DomainEnums';
import type { OfficeSummary } from './Personnel';
import { DocumentVersion } from './DocumentVersion';
import { RoutingTransaction } from './RoutingTransaction';
import { School } from './School';

export interface ExternalMilestone {
  readonly id: string;
  readonly stageLabel: string;
  readonly officeName: string;
  readonly occurredAt: string;
}

export interface AddRevisionInput {
  readonly id: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256Checksum: string;
  readonly uploadedById: string;
  readonly uploadedByName: string;
  readonly revisionNote: string;
  readonly storageKey: string;
}

export interface DocumentProps {
  id: string;
  isSealed?: boolean;
  attachmentCount?: number;
  trackingCode: string;
  qrToken: string;
  title: string;
  categoryId: string;
  categoryName: string;
  confidentialityTier: ConfidentialityTier;
  lifecycleStatus: DocumentLifecycleStatus;
  copyFormat?: DocumentCopyFormat;
  physicalReference?: string | null;
  physicalPageCount?: number | null;
  slaState: SlaState;
  slaDueAt: string;
  originOffice: OfficeSummary;
  originUserId: string;
  originUserName: string;
  currentOffice: OfficeSummary;
  currentHolderId: string;
  currentHolderName: string;
  explicitParticipantIds: ReadonlyArray<string>;
  submittedSchool?: School | null;
  versions: ReadonlyArray<DocumentVersion>;
  transactions: ReadonlyArray<RoutingTransaction>;
  externalMilestones: ReadonlyArray<ExternalMilestone>;
  createdAt?: string;
}

/**
 * Aggregate root encapsulating custody, non-destructive versions, routing history,
 * opaque QR token, and separation of internal remarks vs Phase-2 external milestones.
 */
export class Document extends BaseEntity {
  private readonly _isSealed: boolean;
  private readonly _attachmentCount: number;
  private readonly _trackingCode: string;
  private readonly _qrToken: string;
  private _title: string;
  private _categoryId: string;
  private _categoryName: string;
  private _confidentialityTier: ConfidentialityTier;
  private _lifecycleStatus: DocumentLifecycleStatus;
  private _copyFormat: DocumentCopyFormat;
  private _physicalReference: string | null;
  private _physicalPageCount: number | null;
  private readonly _slaState: SlaState;
  private readonly _slaDueAt: string;
  private readonly _originOffice: OfficeSummary;
  private readonly _originUserId: string;
  private readonly _originUserName: string;
  private _currentOffice: OfficeSummary;
  private _currentHolderId: string;
  private _currentHolderName: string;
  private readonly _participantIds: Set<string>;
  private readonly _submittedSchool: School | null;
  private readonly _versions: DocumentVersion[];
  private readonly _transactions: RoutingTransaction[];
  private readonly _externalMilestones: ExternalMilestone[];

  constructor(props: DocumentProps) {
    super(props.id, props.createdAt);
    this._isSealed = Boolean(props.isSealed);
    this._attachmentCount =
      typeof props.attachmentCount === 'number'
        ? Math.max(0, Math.floor(props.attachmentCount))
        : props.versions.length;
    this._trackingCode = BaseEntity.requireNonEmpty(props.trackingCode, 'trackingCode');
    this._qrToken = this._isSealed
      ? (props.qrToken ?? '').trim()
      : BaseEntity.requireNonEmpty(props.qrToken, 'qrToken');
    this._title = BaseEntity.requireNonEmpty(props.title, 'title');
    this._categoryId = BaseEntity.requireNonEmpty(props.categoryId, 'categoryId');
    this._categoryName = BaseEntity.requireNonEmpty(props.categoryName, 'categoryName');
    this._confidentialityTier = props.confidentialityTier;
    this._lifecycleStatus = props.lifecycleStatus;
    this._copyFormat =
      props.copyFormat ??
      (props.versions.length === 0 ? DocumentCopyFormat.HARD_COPY : DocumentCopyFormat.DIGITAL);
    this._physicalReference = props.physicalReference?.trim() || null;
    this._physicalPageCount =
      typeof props.physicalPageCount === 'number' && props.physicalPageCount > 0
        ? Math.floor(props.physicalPageCount)
        : null;
    this._slaState = props.slaState;
    this._slaDueAt = props.slaDueAt;
    this._originOffice = Object.freeze({ ...props.originOffice });
    this._originUserId = BaseEntity.requireNonEmpty(props.originUserId, 'originUserId');
    this._originUserName = BaseEntity.requireNonEmpty(props.originUserName, 'originUserName');
    this._currentOffice = Object.freeze({ ...props.currentOffice });
    this._currentHolderId = BaseEntity.requireNonEmpty(props.currentHolderId, 'currentHolderId');
    this._currentHolderName = BaseEntity.requireNonEmpty(props.currentHolderName, 'currentHolderName');
    this._participantIds = new Set(props.explicitParticipantIds);
    this._submittedSchool = props.submittedSchool ?? null;
    this._versions = [...props.versions].sort((a, b) => a.versionNumber - b.versionNumber);
    this._transactions = [...props.transactions];
    this._externalMilestones = [...props.externalMilestones];
  }

  public get isSealed(): boolean {
    return this._isSealed;
  }
  public get attachmentCount(): number {
    return Math.max(this._attachmentCount, this._versions.length);
  }
  public get trackingCode(): string {
    return this._trackingCode;
  }
  public get qrToken(): string {
    return this._qrToken;
  }
  public get title(): string {
    return this._title;
  }
  public get categoryId(): string {
    return this._categoryId;
  }
  public get categoryName(): string {
    return this._categoryName;
  }
  public get confidentialityTier(): ConfidentialityTier {
    return this._confidentialityTier;
  }
  public get lifecycleStatus(): DocumentLifecycleStatus {
    return this._lifecycleStatus;
  }
  public get copyFormat(): DocumentCopyFormat {
    return this._copyFormat;
  }
  public get physicalReference(): string | null {
    return this._physicalReference;
  }
  public get physicalPageCount(): number | null {
    return this._physicalPageCount;
  }
  public get physicalSummary(): string | null {
    const parts: string[] = [];
    if (this._physicalReference) parts.push(this._physicalReference);
    if (this._physicalPageCount) parts.push(`${this._physicalPageCount} pg(s)`);
    return parts.length > 0 ? parts.join(' · ') : null;
  }
  public get isHardCopy(): boolean {
    return (
      this._copyFormat === DocumentCopyFormat.HARD_COPY ||
      this._copyFormat === DocumentCopyFormat.HYBRID
    );
  }
  public get hasDigitalFile(): boolean {
    return this._versions.length > 0;
  }
  public get slaState(): SlaState {
    return this._slaState;
  }
  public get slaDueAt(): string {
    return this._slaDueAt;
  }
  public get originOffice(): OfficeSummary {
    return this._originOffice;
  }
  public get originUserId(): string {
    return this._originUserId;
  }
  public get currentOffice(): OfficeSummary {
    return this._currentOffice;
  }
  public get currentHolderId(): string {
    return this._currentHolderId;
  }
  public get currentHolderName(): string {
    return this._currentHolderName;
  }
  public get explicitParticipantIds(): ReadonlyArray<string> {
    return [...this._participantIds];
  }
  public get submittedSchool(): School | null {
    return this._submittedSchool;
  }
  public get versions(): ReadonlyArray<DocumentVersion> {
    return [...this._versions];
  }
  public get latestVersionOrNull(): DocumentVersion | null {
    return this._versions[this._versions.length - 1] ?? null;
  }
  public get latestVersion(): DocumentVersion {
    const latest = this.latestVersionOrNull;
    if (!latest) {
      throw new DomainRuleError('NO_DOCUMENT_VERSION', 'Document has no versions.');
    }
    return latest;
  }
  public get transactions(): ReadonlyArray<RoutingTransaction> {
    return [...this._transactions];
  }
  public get externalMilestones(): ReadonlyArray<ExternalMilestone> {
    return [...this._externalMilestones];
  }

  public updateDetails(patch: {
    title?: string;
    categoryId?: string;
    categoryName?: string;
    confidentialityTier?: ConfidentialityTier;
    physicalReference?: string | null;
    physicalPageCount?: number | null;
  }): Document {
    if (patch.title !== undefined && patch.title.trim()) {
      this._title = patch.title.trim();
    }
    if (patch.categoryId !== undefined && patch.categoryId.trim()) {
      this._categoryId = patch.categoryId.trim();
    }
    if (patch.categoryName !== undefined && patch.categoryName.trim()) {
      this._categoryName = patch.categoryName.trim();
    }
    if (patch.confidentialityTier !== undefined) {
      this._confidentialityTier = patch.confidentialityTier;
    }
    if (patch.physicalReference !== undefined) {
      const ref = patch.physicalReference?.trim() ?? '';
      this._physicalReference = ref || null;
    }
    if (patch.physicalPageCount !== undefined) {
      this._physicalPageCount =
        typeof patch.physicalPageCount === 'number' && patch.physicalPageCount > 0
          ? Math.floor(patch.physicalPageCount)
          : null;
    }
    return this;
  }
  public get latestTransaction(): RoutingTransaction | null {
    return this._transactions[this._transactions.length - 1] ?? null;
  }

  public isParticipant(userId: string): boolean {
    return this._participantIds.has(userId) || this._currentHolderId === userId;
  }

  public involvesOffice(officeId: string): boolean {
    if (this._originOffice.id === officeId || this._currentOffice.id === officeId) {
      return true;
    }
    return this._transactions.some(
      (tx) => tx.fromOffice.id === officeId || tx.toOffice.id === officeId,
    );
  }

  public appendTransaction(transaction: RoutingTransaction): void {
    this._transactions.push(transaction);
    this._currentOffice = Object.freeze({ ...transaction.toOffice });
    this._currentHolderId = transaction.toUserId;
    this._currentHolderName = transaction.toUserName;
    this._participantIds.add(transaction.fromUserId);
    this._participantIds.add(transaction.toUserId);
    this._lifecycleStatus = DocumentLifecycleStatus.IN_TRANSIT;
    this._externalMilestones.push(
      Object.freeze({
        id: `ms-${transaction.id}`,
        stageLabel: `Routed to ${transaction.toOffice.code}`,
        officeName: transaction.toOffice.name,
        occurredAt: transaction.sentAt,
      }),
    );
  }

  public markAccepted(office: OfficeSummary, holderId: string, holderName: string): void {
    this._currentOffice = Object.freeze({ ...office });
    this._currentHolderId = holderId;
    this._currentHolderName = holderName;
    this._participantIds.add(holderId);
    this._lifecycleStatus = DocumentLifecycleStatus.IN_REVIEW;
    this._externalMilestones.push(
      Object.freeze({
        id: `ms-ack-${Date.now()}`,
        stageLabel: `Received by ${office.code}`,
        officeName: office.name,
        occurredAt: new Date().toISOString(),
      }),
    );
  }

  public markReturnedToOrigin(): void {
    this._currentOffice = this._originOffice;
    this._currentHolderId = this._originUserId;
    this._currentHolderName = this._originUserName;
    this._lifecycleStatus = DocumentLifecycleStatus.RETURNED_FOR_REVISION;
    this._externalMilestones.push(
      Object.freeze({
        id: `ms-ret-${Date.now()}`,
        stageLabel: `Returned to ${this._originOffice.code} for revision`,
        officeName: this._originOffice.name,
        occurredAt: new Date().toISOString(),
      }),
    );
  }

  public markRecalled(senderOffice: OfficeSummary, senderId: string, senderName: string): void {
    this._currentOffice = senderOffice;
    this._currentHolderId = senderId;
    this._currentHolderName = senderName;
    this._lifecycleStatus = DocumentLifecycleStatus.IN_REVIEW;
  }

  public markDeclinedToSender(
    senderOffice: OfficeSummary,
    senderId: string,
    senderName: string,
  ): void {
    this._currentOffice = senderOffice;
    this._currentHolderId = senderId;
    this._currentHolderName = senderName;
    this._lifecycleStatus = DocumentLifecycleStatus.IN_REVIEW;
  }

  public markCompleted(
    status: 'approved' | 'archived',
    office: OfficeSummary,
  ): void {
    this._lifecycleStatus =
      status === 'approved'
        ? DocumentLifecycleStatus.APPROVED
        : DocumentLifecycleStatus.ARCHIVED;
    this._externalMilestones.push(
      Object.freeze({
        id: `ms-done-${Date.now()}`,
        stageLabel:
          status === 'approved'
            ? `Approved & released by ${office.code}`
            : `Archived by ${office.code}`,
        officeName: office.name,
        occurredAt: new Date().toISOString(),
      }),
    );
  }

  public addRevisionVersion(version: AddRevisionInput): DocumentVersion {
    const isInitialScan = this._versions.length === 0;
    const isOriginPreDispatch =
      this._transactions.length === 0 &&
      this._lifecycleStatus === DocumentLifecycleStatus.IN_REVIEW;
    if (
      !isInitialScan &&
      !isOriginPreDispatch &&
      this._lifecycleStatus !== DocumentLifecycleStatus.RETURNED_FOR_REVISION
    ) {
      throw new DomainRuleError(
        'REVISION_NOT_ALLOWED',
        'A new version can only be uploaded when the document has been returned for revision.',
      );
    }

    const nextNumber = (this.latestVersionOrNull?.versionNumber ?? 0) + 1;
    const created = new DocumentVersion({
      id: version.id,
      versionNumber: nextNumber,
      fileName: version.fileName,
      mimeType: version.mimeType,
      sizeBytes: version.sizeBytes,
      sha256Checksum: version.sha256Checksum,
      uploadedById: version.uploadedById,
      uploadedByName: version.uploadedByName,
      uploadedAt: new Date().toISOString(),
      revisionNote: version.revisionNote,
      storageKey: version.storageKey,
    });
    this._versions.push(created);
    if (this._copyFormat === DocumentCopyFormat.HARD_COPY) {
      this._copyFormat = DocumentCopyFormat.HYBRID;
    }
    if (this._lifecycleStatus === DocumentLifecycleStatus.RETURNED_FOR_REVISION) {
      this._lifecycleStatus = DocumentLifecycleStatus.IN_REVIEW;
    }
    this._externalMilestones.push(
      Object.freeze({
        id: `ms-ver-${created.id}`,
        stageLabel:
          nextNumber === 1
            ? `Digital scan v1 attached by ${this._currentOffice.code}`
            : isOriginPreDispatch
              ? `Supporting file #${nextNumber} attached by ${this._originOffice.code}`
              : `Revision v${nextNumber} submitted by ${this._originOffice.code}`,
        officeName: nextNumber === 1 ? this._currentOffice.name : this._originOffice.name,
        occurredAt: created.uploadedAt,
      }),
    );
    return created;
  }
}
