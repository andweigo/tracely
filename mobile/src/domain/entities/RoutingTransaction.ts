import { BaseEntity } from '../base/BaseEntity';
import { DomainRuleError } from '../base/DomainRuleError';
import { ReceiptStatus, RoutingScope } from '../enums/DomainEnums';
import type { OfficeSummary } from './Personnel';

export interface ReceiptPhotoProof {
  readonly fileName: string;
  readonly compressedBytes: number;
  readonly sha256Checksum: string;
  readonly exifStripped: boolean;
  readonly capturedAt: string;
  readonly localUri?: string;
}

export interface RoutingTransactionProps {
  id: string;
  documentId: string;
  fromUserId: string;
  fromUserName: string;
  fromOffice: OfficeSummary;
  toUserId: string;
  toUserName: string;
  toOffice: OfficeSummary;
  routingScope: RoutingScope;
  receiptStatus: ReceiptStatus;
  remarks: string;
  isInternalOnly: boolean;
  sentAt: string;
  acknowledgedAt?: string | null;
  acknowledgedByName?: string | null;
  proofPhoto?: ReceiptPhotoProof | null;
}

/**
 * Encapsulates a single routing handoff and enforces state transition invariants
 * (Recall only before acceptance; mandatory remarks for Decline and Return).
 */
export class RoutingTransaction extends BaseEntity {
  private readonly _documentId: string;
  private readonly _fromUserId: string;
  private readonly _fromUserName: string;
  private readonly _fromOffice: OfficeSummary;
  private readonly _toUserId: string;
  private readonly _toUserName: string;
  private readonly _toOffice: OfficeSummary;
  private readonly _routingScope: RoutingScope;
  private _receiptStatus: ReceiptStatus;
  private _remarks: string;
  private readonly _isInternalOnly: boolean;
  private readonly _sentAt: string;
  private _acknowledgedAt: string | null;
  private _acknowledgedByName: string | null;
  private _proofPhoto: ReceiptPhotoProof | null;

  constructor(props: RoutingTransactionProps) {
    super(props.id, props.sentAt);
    this._documentId = BaseEntity.requireNonEmpty(props.documentId, 'documentId');
    this._fromUserId = BaseEntity.requireNonEmpty(props.fromUserId, 'fromUserId');
    this._fromUserName = BaseEntity.requireNonEmpty(props.fromUserName, 'fromUserName');
    this._fromOffice = Object.freeze({ ...props.fromOffice });
    this._toUserId = BaseEntity.requireNonEmpty(props.toUserId, 'toUserId');
    this._toUserName = BaseEntity.requireNonEmpty(props.toUserName, 'toUserName');
    this._toOffice = Object.freeze({ ...props.toOffice });
    this._routingScope = props.routingScope;
    this._receiptStatus = props.receiptStatus;
    this._remarks = props.remarks.trim();
    this._isInternalOnly = props.isInternalOnly;
    this._sentAt = props.sentAt;
    this._acknowledgedAt = props.acknowledgedAt ?? null;
    this._acknowledgedByName = props.acknowledgedByName ?? null;
    this._proofPhoto = props.proofPhoto ? Object.freeze({ ...props.proofPhoto }) : null;
  }

  public get documentId(): string {
    return this._documentId;
  }
  public get fromUserId(): string {
    return this._fromUserId;
  }
  public get fromUserName(): string {
    return this._fromUserName;
  }
  public get fromOffice(): OfficeSummary {
    return this._fromOffice;
  }
  public get toUserId(): string {
    return this._toUserId;
  }
  public get toUserName(): string {
    return this._toUserName;
  }
  public get toOffice(): OfficeSummary {
    return this._toOffice;
  }
  public get routingScope(): RoutingScope {
    return this._routingScope;
  }
  public get receiptStatus(): ReceiptStatus {
    return this._receiptStatus;
  }
  public get remarks(): string {
    return this._remarks;
  }
  public get isInternalOnly(): boolean {
    return this._isInternalOnly;
  }
  public get sentAt(): string {
    return this._sentAt;
  }
  public get acknowledgedAt(): string | null {
    return this._acknowledgedAt;
  }
  public get acknowledgedByName(): string | null {
    return this._acknowledgedByName;
  }
  public get proofPhoto(): ReceiptPhotoProof | null {
    return this._proofPhoto;
  }

  public isPendingForOffice(officeId: string): boolean {
    return this._receiptStatus === ReceiptStatus.PENDING && this._toOffice.id === officeId;
  }

  public isPendingSentBy(actorId: string): boolean {
    return this._receiptStatus === ReceiptStatus.PENDING && this._fromUserId === actorId;
  }

  public canBeAcknowledgedBy(actor: { id: string; office: { id: string } }): boolean {
    return this.isPendingForOffice(actor.office.id) && this._fromUserId !== actor.id;
  }

  public canBeRecalledBy(actorId: string): boolean {
    return this._receiptStatus === ReceiptStatus.PENDING && this._fromUserId === actorId;
  }

  public acknowledge(actorName: string, proofPhoto?: ReceiptPhotoProof | null): void {
    if (this._receiptStatus !== ReceiptStatus.PENDING) {
      throw new DomainRuleError(
        'ALREADY_PROCESSED',
        'Only pending routing transactions can be acknowledged.',
      );
    }
    this._receiptStatus = ReceiptStatus.ACKNOWLEDGED;
    this._acknowledgedAt = new Date().toISOString();
    this._acknowledgedByName = BaseEntity.requireNonEmpty(actorName, 'actorName');
    if (proofPhoto) {
      this._proofPhoto = Object.freeze({ ...proofPhoto });
    }
  }

  public recall(actorId: string): void {
    if (this._fromUserId !== actorId) {
      throw new DomainRuleError('FORBIDDEN_RECALL', 'Only the sender may recall this transfer.');
    }
    if (this._receiptStatus !== ReceiptStatus.PENDING) {
      throw new DomainRuleError(
        'RECALL_AFTER_RECEIPT',
        'Cannot recall a document after the recipient has acknowledged or acted on it.',
      );
    }
    this._receiptStatus = ReceiptStatus.RECALLED;
  }

  public declineAsMisrouted(reason: string): void {
    if (this._receiptStatus !== ReceiptStatus.PENDING) {
      throw new DomainRuleError(
        'INVALID_DECLINE_STATE',
        'Only pending incoming transfers can be declined as misrouted.',
      );
    }
    const cleanReason = BaseEntity.requireNonEmpty(reason, 'Decline reason');
    this._receiptStatus = ReceiptStatus.DECLINED_MISROUTED;
    this._remarks = cleanReason;
  }

  public markReturnedForRevision(remarks: string): void {
    if (
      this._receiptStatus !== ReceiptStatus.PENDING &&
      this._receiptStatus !== ReceiptStatus.ACKNOWLEDGED
    ) {
      throw new DomainRuleError(
        'INVALID_RETURN_STATE',
        'Cannot return a recalled or already declined transaction.',
      );
    }
    this._receiptStatus = ReceiptStatus.RETURNED_FOR_REVISION;
    this._remarks = BaseEntity.requireNonEmpty(remarks, 'Revision remarks');
  }

  public attachProofPhoto(proofPhoto: ReceiptPhotoProof): void {
    this._proofPhoto = Object.freeze({ ...proofPhoto });
  }
}
