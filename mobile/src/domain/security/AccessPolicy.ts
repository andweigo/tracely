import { DomainRuleError } from '../base/DomainRuleError';
import { Document, ExternalMilestone } from '../entities/Document';
import { OfficeSummary, Personnel } from '../entities/Personnel';
import {
  ConfidentialityTier,
  DocumentCopyFormat,
  DocumentLifecycleStatus,
  ReceiptStatus,
  RoutingScope,
  SlaState,
  SystemRole,
} from '../enums/DomainEnums';

export interface PolicyDecision {
  readonly allowed: boolean;
  readonly code: string;
  readonly reason: string;
}

export type DocumentVisibilityLevel = 'full_custody' | 'location_only' | 'denied';

export interface TrackingTimelineEvent {
  readonly id: string;
  readonly label: string;
  readonly officeName: string;
  readonly occurredAt: string;
  readonly state: 'completed' | 'active' | 'pending';
  readonly isInternal: boolean;
}

export interface DocumentTrackingSnapshot {
  readonly visibility: Exclude<DocumentVisibilityLevel, 'denied'>;
  readonly documentId: string;
  readonly trackingCode: string;
  readonly displayTitle: string;
  readonly categoryName: string;
  readonly confidentialityTier: ConfidentialityTier;
  readonly lifecycleStatus: DocumentLifecycleStatus;
  readonly copyFormat: DocumentCopyFormat;
  readonly hasDigitalFile: boolean;
  readonly physicalSummary: string | null;
  readonly slaState: SlaState;
  readonly slaDueAt: string;
  readonly originOffice: OfficeSummary;
  readonly currentOffice: OfficeSummary;
  readonly originTimestamp: string;
  readonly receivedAt: string | null;
  readonly lastUpdatedAt: string;
  readonly isInternalOfficeStage: boolean;
  readonly currentHolderName: string | null;
  readonly canOpenFullRecord: boolean;
  readonly sentByActorOffice: boolean;
  readonly pendingForActorOffice: boolean;
  readonly latestReceiptStatus: ReceiptStatus | null;
  readonly externalMilestones: ReadonlyArray<ExternalMilestone>;
  readonly timelineEvents: ReadonlyArray<TrackingTimelineEvent>;
}

/**
 * Abstract security policy contract enforcing deny-by-default authorization (Abstraction).
 */
export abstract class AccessPolicy<TResource> {
  public abstract authorize(actor: Personnel, resource: TResource): PolicyDecision;

  public enforce(actor: Personnel, resource: TResource): void {
    const decision = this.authorize(actor, resource);
    if (!decision.allowed) {
      throw new DomainRuleError(decision.code, decision.reason);
    }
  }

  protected allow(reason = 'Authorized under policy.'): PolicyDecision {
    return Object.freeze({ allowed: true, code: 'AUTHORIZED', reason });
  }

  protected deny(code: string, reason: string): PolicyDecision {
    return Object.freeze({ allowed: false, code, reason });
  }
}

/**
 * Full custody & file/action authorization policy (Inheritance).
 */
export class DocumentAccessPolicy extends AccessPolicy<Document> {
  public authorize(actor: Personnel, document: Document): PolicyDecision {
    if (!actor.isActive) {
      return this.deny('ACCOUNT_INACTIVE', 'Deactivated accounts cannot access documents.');
    }

    switch (document.confidentialityTier) {
      case ConfidentialityTier.CONFIDENTIAL:
        return document.isParticipant(actor.id)
          ? this.allow('Authorized as explicit participant of Confidential document.')
          : this.deny(
              'CONFIDENTIAL_CUSTODY_DENIED',
              'Confidential records are strictly limited to explicitly named custodians and participants.',
            );

      case ConfidentialityTier.RESTRICTED:
        if (
          document.isParticipant(actor.id) ||
          (actor.role === SystemRole.UNIT_HEAD && document.involvesOffice(actor.office.id))
        ) {
          return this.allow('Authorized for Restricted document.');
        }
        return this.deny(
          'RESTRICTED_SCOPE_DENIED',
          'Restricted documents require direct assignment or Unit Head custody in an involved office.',
        );

      case ConfidentialityTier.STANDARD_INTERNAL:
        if (
          document.involvesOffice(actor.office.id) ||
          actor.role === SystemRole.RECORDS_OFFICER
        ) {
          return this.allow('Authorized under Standard Internal office/records scope.');
        }
        return this.deny(
          'OFFICE_SCOPE_DENIED',
          'Document is outside your office routing chain.',
        );
    }
  }
}

/**
 * Polymorphic tracking policy that allows displaying *where* a document currently is
 * without disclosing restricted titles, remarks, custodian PII, or files to non-custodians.
 */
export class DocumentTrackingPolicy extends AccessPolicy<Document> {
  private readonly _fullCustodyPolicy: DocumentAccessPolicy;

  constructor(fullCustodyPolicy: DocumentAccessPolicy = new DocumentAccessPolicy()) {
    super();
    this._fullCustodyPolicy = fullCustodyPolicy;
  }

  public authorize(actor: Personnel, document: Document): PolicyDecision {
    const decision = this.resolveVisibility(actor, document);
    return decision.visibility === 'denied'
      ? this.deny(decision.code, decision.reason)
      : this.allow(decision.reason);
  }

  public resolveVisibility(
    actor: Personnel,
    document: Document,
  ): { readonly visibility: DocumentVisibilityLevel; readonly code: string; readonly reason: string } {
    if (!actor.isActive) {
      return {
        visibility: 'denied',
        code: 'ACCOUNT_INACTIVE',
        reason: 'Deactivated accounts cannot track documents.',
      };
    }

    const fullDecision = this._fullCustodyPolicy.authorize(actor, document);
    if (fullDecision.allowed) {
      return {
        visibility: 'full_custody',
        code: fullDecision.code,
        reason: fullDecision.reason,
      };
    }

    switch (document.confidentialityTier) {
      case ConfidentialityTier.CONFIDENTIAL:
        return {
          visibility: 'denied',
          code: 'CONFIDENTIAL_TRACKING_DENIED',
          reason: 'Confidential records cannot be tracked by non-participants.',
        };

      case ConfidentialityTier.RESTRICTED:
        return document.involvesOffice(actor.office.id)
          ? {
              visibility: 'location_only',
              code: 'OFFICE_LOCATION_ONLY',
              reason:
                'Office staff can see current office location; PDFs and details are limited to Unit Head or direct participants.',
            }
          : {
              visibility: 'denied',
              code: 'RESTRICTED_SCOPE_DENIED',
              reason: 'Restricted documents are not visible outside involved offices.',
            };

      case ConfidentialityTier.STANDARD_INTERNAL:
        return {
          visibility: 'location_only',
          code: 'INTERNAL_LOCATION_ONLY',
          reason: 'Active personnel can view current office location without opening document contents.',
        };
    }
  }

  public toTrackingSnapshot(actor: Personnel, document: Document): DocumentTrackingSnapshot | null {
    const visibility = this.resolveVisibility(actor, document).visibility;
    if (visibility === 'denied') return null;

    const fullAccess = visibility === 'full_custody';
    const latest = document.latestTransaction;
    const isSealed = document.isSealed || Boolean(latest?.canBeAcknowledgedBy(actor));
    const canExposeDetails = fullAccess && !isSealed;
    const sentByActorOffice =
      document.originOffice.id === actor.office.id ||
      document.transactions.some((tx) => tx.fromOffice.id === actor.office.id);

    const lastAckTx = [...document.transactions]
      .reverse()
      .find((tx) => tx.receiptStatus === ReceiptStatus.ACKNOWLEDGED && Boolean(tx.acknowledgedAt));

    const isPendingTransfer = latest?.receiptStatus === ReceiptStatus.PENDING;
    const isInternalOfficeStage = Boolean(
      document.transactions.length === 0 ||
        latest?.routingScope === RoutingScope.INTERNAL_OFFICE ||
        (latest && latest.fromOffice.id === latest.toOffice.id),
    );

    const receivedAt = isPendingTransfer
      ? null
      : (latest?.acknowledgedAt ?? lastAckTx?.acknowledgedAt ?? document.createdAt);

    const lastUpdatedAt =
      latest?.acknowledgedAt ?? latest?.sentAt ?? document.createdAt;

    const timelineEvents: TrackingTimelineEvent[] = canExposeDetails
      ? this._buildFullTimeline(document)
      : isSealed
        ? []
        : document.externalMilestones.map((ms, idx, arr) => ({
            id: ms.id,
            label: ms.stageLabel,
            officeName: ms.officeName,
            occurredAt: ms.occurredAt,
            state:
              idx === arr.length - 1
                ? isPendingTransfer
                  ? 'pending'
                  : 'active'
                : 'completed',
            isInternal: false,
          }));

    return Object.freeze({
      visibility,
      documentId: document.id,
      trackingCode: document.trackingCode,
      displayTitle: isSealed
        ? 'Sealed Incoming Document'
        : canExposeDetails
          ? document.title
          : `${
              document.confidentialityTier === ConfidentialityTier.RESTRICTED
                ? 'Restricted'
                : 'HQ'
            } Document (${document.originOffice.code})`,
      categoryName: isSealed
        ? 'Scan routing QR to reveal'
        : canExposeDetails
          ? document.categoryName
          : 'Details masked under custody policy',
      confidentialityTier: document.confidentialityTier,
      lifecycleStatus: document.lifecycleStatus,
      copyFormat: document.copyFormat,
      hasDigitalFile: document.hasDigitalFile,
      physicalSummary: canExposeDetails ? document.physicalSummary : null,
      slaState: document.slaState,
      slaDueAt: document.slaDueAt,
      originOffice: document.originOffice,
      currentOffice: document.currentOffice,
      originTimestamp: document.createdAt,
      receivedAt,
      lastUpdatedAt,
      isInternalOfficeStage,
      currentHolderName: canExposeDetails ? document.currentHolderName : null,
      canOpenFullRecord: canExposeDetails,
      sentByActorOffice,
      pendingForActorOffice: fullAccess && Boolean(latest?.canBeAcknowledgedBy(actor)),
      latestReceiptStatus: latest?.receiptStatus ?? null,
      externalMilestones: isSealed ? [] : [...document.externalMilestones],
      timelineEvents: Object.freeze(timelineEvents),
    });
  }

  private _buildFullTimeline(document: Document): TrackingTimelineEvent[] {
    const events: TrackingTimelineEvent[] = [
      {
        id: `reg-${document.id}`,
        label: `Registered at ${document.originOffice.code}`,
        officeName: document.originOffice.name,
        occurredAt: document.createdAt,
        state: document.transactions.length === 0 ? 'active' : 'completed',
        isInternal: false,
      },
    ];

    document.transactions.forEach((tx, idx) => {
      const isLastTx = idx === document.transactions.length - 1;
      const isInternal =
        tx.routingScope === RoutingScope.INTERNAL_OFFICE ||
        tx.fromOffice.id === tx.toOffice.id;

      events.push({
        id: `send-${tx.id}`,
        label: isInternal
          ? `Internal Desk · ${tx.toOffice.code}`
          : `Forwarded to ${tx.toOffice.code}`,
        officeName: tx.toOffice.name,
        occurredAt: tx.sentAt,
        state: isLastTx && tx.receiptStatus === ReceiptStatus.PENDING ? 'pending' : 'completed',
        isInternal,
      });

      if (tx.acknowledgedAt && tx.receiptStatus === ReceiptStatus.ACKNOWLEDGED) {
        events.push({
          id: `ack-${tx.id}`,
          label: isInternal
            ? `Received Internally (${tx.toOffice.code})`
            : `Received by ${tx.toOffice.code}`,
          officeName: tx.toOffice.name,
          occurredAt: tx.acknowledgedAt,
          state: isLastTx ? 'active' : 'completed',
          isInternal,
        });
      }
    });

    return events;
  }
}
