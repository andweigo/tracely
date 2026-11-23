import { BaseEntity } from '../base/BaseEntity';

export interface DocumentVersionProps {
  id: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256Checksum: string;
  uploadedById: string;
  uploadedByName: string;
  uploadedAt: string;
  revisionNote?: string;
  storageKey: string;
}

/**
 * Immutable document file version with SHA-256 integrity metadata.
 */
export class DocumentVersion extends BaseEntity {
  private readonly _versionNumber: number;
  private readonly _fileName: string;
  private readonly _mimeType: string;
  private readonly _sizeBytes: number;
  private readonly _sha256Checksum: string;
  private readonly _uploadedById: string;
  private readonly _uploadedByName: string;
  private readonly _uploadedAt: string;
  private readonly _revisionNote: string;
  private readonly _storageKey: string;

  constructor(props: DocumentVersionProps) {
    super(props.id, props.uploadedAt);
    this._versionNumber = props.versionNumber;
    this._fileName = BaseEntity.requireNonEmpty(props.fileName, 'fileName');
    this._mimeType = BaseEntity.requireNonEmpty(props.mimeType, 'mimeType');
    this._sizeBytes = Math.max(0, props.sizeBytes);
    this._sha256Checksum = BaseEntity.requireNonEmpty(props.sha256Checksum, 'sha256Checksum');
    this._uploadedById = BaseEntity.requireNonEmpty(props.uploadedById, 'uploadedById');
    this._uploadedByName = BaseEntity.requireNonEmpty(props.uploadedByName, 'uploadedByName');
    this._uploadedAt = props.uploadedAt;
    this._revisionNote = props.revisionNote ?? 'Initial submission';
    this._storageKey = BaseEntity.requireNonEmpty(props.storageKey, 'storageKey');
    Object.freeze(this);
  }

  public get versionNumber(): number {
    return this._versionNumber;
  }
  public get fileName(): string {
    return this._fileName;
  }
  public get mimeType(): string {
    return this._mimeType;
  }
  public get sizeBytes(): number {
    return this._sizeBytes;
  }
  public get sha256Checksum(): string {
    return this._sha256Checksum;
  }
  public get shortChecksum(): string {
    return `${this._sha256Checksum.slice(0, 12)}...${this._sha256Checksum.slice(-6)}`;
  }
  public get uploadedById(): string {
    return this._uploadedById;
  }
  public get uploadedByName(): string {
    return this._uploadedByName;
  }
  public get uploadedAt(): string {
    return this._uploadedAt;
  }
  public get revisionNote(): string {
    return this._revisionNote;
  }
  public get storageKey(): string {
    return this._storageKey;
  }
  public get formattedSize(): string {
    if (this._sizeBytes < 1024) return `${this._sizeBytes} B`;
    if (this._sizeBytes < 1024 * 1024) return `${(this._sizeBytes / 1024).toFixed(1)} KB`;
    return `${(this._sizeBytes / (1024 * 1024)).toFixed(2)} MB`;
  }
}
