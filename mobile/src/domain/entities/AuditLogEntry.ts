import { BaseEntity } from '../base/BaseEntity';
import { AuditAction } from '../enums/DomainEnums';

export interface AuditLogEntryProps {
  id: string;
  actorId: string;
  actorName: string;
  actorOfficeCode: string;
  action: AuditAction;
  documentId: string | null;
  trackingCode: string | null;
  summary: string;
  deviceLabel: string;
  occurredAt?: string;
}

/**
 * Append-only, immutable audit trail record (frozen on instantiation).
 */
export class AuditLogEntry extends BaseEntity {
  private readonly _actorId: string;
  private readonly _actorName: string;
  private readonly _actorOfficeCode: string;
  private readonly _action: AuditAction;
  private readonly _documentId: string | null;
  private readonly _trackingCode: string | null;
  private readonly _summary: string;
  private readonly _deviceLabel: string;

  constructor(props: AuditLogEntryProps) {
    super(props.id, props.occurredAt);
    this._actorId = BaseEntity.requireNonEmpty(props.actorId, 'actorId');
    this._actorName = BaseEntity.requireNonEmpty(props.actorName, 'actorName');
    this._actorOfficeCode = BaseEntity.requireNonEmpty(props.actorOfficeCode, 'actorOfficeCode');
    this._action = props.action;
    this._documentId = props.documentId;
    this._trackingCode = props.trackingCode;
    this._summary = BaseEntity.requireNonEmpty(props.summary, 'summary');
    this._deviceLabel = BaseEntity.requireNonEmpty(props.deviceLabel, 'deviceLabel');
    Object.freeze(this);
  }

  public get actorId(): string {
    return this._actorId;
  }
  public get actorName(): string {
    return this._actorName;
  }
  public get actorOfficeCode(): string {
    return this._actorOfficeCode;
  }
  public get action(): AuditAction {
    return this._action;
  }
  public get documentId(): string | null {
    return this._documentId;
  }
  public get trackingCode(): string | null {
    return this._trackingCode;
  }
  public get summary(): string {
    return this._summary;
  }
  public get deviceLabel(): string {
    return this._deviceLabel;
  }
}
