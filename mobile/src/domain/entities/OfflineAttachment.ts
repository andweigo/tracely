import { BaseEntity } from '../base/BaseEntity';
import { OfflineQueueStatus } from '../enums/DomainEnums';

export type OfflineAttachmentTargetType = 'desktop_pair' | 'receipt_proof' | 'revision_draft';

export interface OfflineAttachmentProps {
  id: string;
  targetType: OfflineAttachmentTargetType;
  targetId: string;
  targetLabel: string;
  fileName: string;
  mimeType: string;
  originalBytes: number;
  compressedBytes: number;
  sha256Checksum: string;
  exifStripped: boolean;
  localUri: string;
  status?: OfflineQueueStatus;
  retryCount?: number;
  lastError?: string | null;
  createdAt?: string;
}

/**
 * Encapsulates a compressed, EXIF-stripped mobile capture queued for resilient sync.
 */
export class OfflineAttachment extends BaseEntity {
  private readonly _targetType: OfflineAttachmentTargetType;
  private readonly _targetId: string;
  private readonly _targetLabel: string;
  private readonly _fileName: string;
  private readonly _mimeType: string;
  private readonly _originalBytes: number;
  private readonly _compressedBytes: number;
  private readonly _sha256Checksum: string;
  private readonly _exifStripped: boolean;
  private readonly _localUri: string;
  private _status: OfflineQueueStatus;
  private _retryCount: number;
  private _lastError: string | null;

  constructor(props: OfflineAttachmentProps) {
    super(props.id, props.createdAt);
    this._targetType = props.targetType;
    this._targetId = BaseEntity.requireNonEmpty(props.targetId, 'targetId');
    this._targetLabel = BaseEntity.requireNonEmpty(props.targetLabel, 'targetLabel');
    this._fileName = BaseEntity.requireNonEmpty(props.fileName, 'fileName');
    this._mimeType = BaseEntity.requireNonEmpty(props.mimeType, 'mimeType');
    this._originalBytes = Math.max(1, props.originalBytes);
    this._compressedBytes = Math.max(1, props.compressedBytes);
    this._sha256Checksum = BaseEntity.requireNonEmpty(props.sha256Checksum, 'sha256Checksum');
    this._exifStripped = props.exifStripped;
    this._localUri = BaseEntity.requireNonEmpty(props.localUri, 'localUri');
    this._status = props.status ?? OfflineQueueStatus.QUEUED;
    this._retryCount = props.retryCount ?? 0;
    this._lastError = props.lastError ?? null;
  }

  public get targetType(): OfflineAttachmentTargetType {
    return this._targetType;
  }
  public get targetId(): string {
    return this._targetId;
  }
  public get targetLabel(): string {
    return this._targetLabel;
  }
  public get fileName(): string {
    return this._fileName;
  }
  public get mimeType(): string {
    return this._mimeType;
  }
  public get originalBytes(): number {
    return this._originalBytes;
  }
  public get compressedBytes(): number {
    return this._compressedBytes;
  }
  public get sha256Checksum(): string {
    return this._sha256Checksum;
  }
  public get exifStripped(): boolean {
    return this._exifStripped;
  }
  public get localUri(): string {
    return this._localUri;
  }
  public get status(): OfflineQueueStatus {
    return this._status;
  }
  public get retryCount(): number {
    return this._retryCount;
  }
  public get lastError(): string | null {
    return this._lastError;
  }

  public get compressionPercent(): number {
    if (this._originalBytes <= 0) return 0;
    return Math.max(0, Math.round((1 - this._compressedBytes / this._originalBytes) * 100));
  }

  public markUploading(): void {
    this._status = OfflineQueueStatus.UPLOADING;
    this._lastError = null;
  }

  public markSynced(): void {
    this._status = OfflineQueueStatus.SYNCED;
    this._lastError = null;
  }

  public markFailed(errorMessage: string): void {
    this._status = OfflineQueueStatus.FAILED;
    this._retryCount += 1;
    this._lastError = errorMessage;
  }

  public toJSON(): OfflineAttachmentProps {
    return {
      id: this.id,
      targetType: this._targetType,
      targetId: this._targetId,
      targetLabel: this._targetLabel,
      fileName: this._fileName,
      mimeType: this._mimeType,
      originalBytes: this._originalBytes,
      compressedBytes: this._compressedBytes,
      sha256Checksum: this._sha256Checksum,
      exifStripped: this._exifStripped,
      localUri: this._localUri,
      status: this._status,
      retryCount: this._retryCount,
      lastError: this._lastError,
      createdAt: this.createdAt,
    };
  }
}
