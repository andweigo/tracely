import { DomainRuleError } from '../domain/base/DomainRuleError';
import { Document } from '../domain/entities/Document';
import { OfficeSummary, Personnel } from '../domain/entities/Personnel';
import {
  DocumentCopyFormat,
  DocumentLifecycleStatus,
  ReceiptStatus,
} from '../domain/enums/DomainEnums';
import {
  DocumentAccessPolicy,
  DocumentTrackingPolicy,
  DocumentTrackingSnapshot,
} from '../domain/security/AccessPolicy';
import type {
  AcknowledgePayload,
  CreateDigitalDocumentPayload,
  ForwardDocumentPayload,
  IDocumentRepository,
  PresignedDownloadGrant,
  RegisterHardCopyPayload,
  UploadRevisionPayload,
} from '../repositories/contracts/IDocumentRepository';

export class DocumentRoutingService {
  private readonly _docRepo: IDocumentRepository;
  private readonly _policy: DocumentAccessPolicy;
  private readonly _trackingPolicy: DocumentTrackingPolicy;

  constructor(
    docRepo: IDocumentRepository,
    policy: DocumentAccessPolicy = new DocumentAccessPolicy(),
    trackingPolicy?: DocumentTrackingPolicy,
  ) {
    this._docRepo = docRepo;
    this._policy = policy;
    this._trackingPolicy = trackingPolicy ?? new DocumentTrackingPolicy(policy);
  }

  public async listOffices(): Promise<ReadonlyArray<OfficeSummary>> {
    return this._docRepo.listOffices();
  }

  public async listPersonnel(): Promise<ReadonlyArray<Personnel>> {
    return this._docRepo.listPersonnel();
  }

  public async listAccessibleDocuments(actor: Personnel): Promise<ReadonlyArray<Document>> {
    const docs = await this._docRepo.listDocuments();
    return docs.filter((doc) => this._policy.authorize(actor, doc).allowed);
  }

  /**
   * Lists all office-involved documents visible to the actor (full custody for authorized roles,
   * location-only redacted snapshots for restricted office records).
   */
  public async listTrackedDocuments(
    actor: Personnel,
  ): Promise<ReadonlyArray<DocumentTrackingSnapshot>> {
    const [summaries, fullDocs] = await Promise.all([
      this._docRepo.listTrackedSummaries().catch(() => []),
      this._docRepo.listDocuments().catch(() => []),
    ]);

    const byDocId = new Map<string, DocumentTrackingSnapshot>();
    for (const summary of summaries) {
      byDocId.set(summary.documentId, summary);
    }
    for (const doc of fullDocs) {
      if (!doc.involvesOffice(actor.office.id)) continue;
      const snapshot = this._trackingPolicy.toTrackingSnapshot(actor, doc);
      if (snapshot) {
        byDocId.set(snapshot.documentId, snapshot);
      }
    }
    return [...byDocId.values()];
  }

  public async trackDocumentByCode(trackingCode: string): Promise<DocumentTrackingSnapshot> {
    const clean = trackingCode.trim().toUpperCase();
    if (!clean) {
      throw new DomainRuleError('EMPTY_TRACKING_CODE', 'Enter a document tracking code to look up.');
    }
    const found = await this._docRepo.trackByCode(clean);
    if (!found) {
      throw new DomainRuleError(
        'TRACKING_NOT_VISIBLE',
        'No matching document found, or you are outside its authorized custody scope.',
      );
    }
    return found;
  }

  public async refreshDocument(actor: Personnel, documentId: string): Promise<Document> {
    const doc = await this._docRepo.getDocumentById(documentId);
    this._policy.enforce(actor, doc);
    return doc;
  }

  public async issuePresignedViewGrant(
    actor: Personnel,
    document: Document,
    versionNumber: number,
  ): Promise<PresignedDownloadGrant> {
    this._policy.enforce(actor, document);
    if (document.latestTransaction?.canBeAcknowledgedBy(actor)) {
      throw new DomainRuleError(
        'RECEIPT_REQUIRED_BEFORE_ACCESS',
        'Scan the routing QR code or enter the tracking code to confirm receipt before viewing this document.',
      );
    }
    return this._docRepo.issuePresignedViewGrant(document.id, versionNumber);
  }

  public async createDigitalDocument(
    actor: Personnel,
    payload: CreateDigitalDocumentPayload,
    directory: ReadonlyArray<Personnel>,
  ): Promise<Document> {
    const cleanTitle = this._validateOriginMetadata(
      actor,
      payload.title,
      payload.categoryId,
      payload.recipientUserId,
      payload.routeToDelegateIfOnLeave,
      directory,
    );
    if (!payload.fileUri.trim() || !payload.fileName.trim()) {
      throw new DomainRuleError('MISSING_SOFT_COPY_FILE', 'Select a PDF or image file to upload.');
    }
    if (!/^[0-9a-f]{64}$/i.test(payload.sha256Checksum.trim())) {
      throw new DomainRuleError(
        'INVALID_CHECKSUM',
        'Valid SHA-256 checksum is required before uploading a document.',
      );
    }
    return this._docRepo.createDigitalDocument({
      ...payload,
      title: cleanTitle,
      fileName: payload.fileName.trim(),
    });
  }

  public async registerHardCopyDocument(
    actor: Personnel,
    payload: RegisterHardCopyPayload,
    directory: ReadonlyArray<Personnel>,
  ): Promise<Document> {
    const cleanTitle = this._validateOriginMetadata(
      actor,
      payload.title,
      payload.categoryId,
      payload.recipientUserId,
      payload.routeToDelegateIfOnLeave,
      directory,
    );

    const cleanRef = payload.physicalReference?.trim() || null;
    if (cleanRef && cleanRef.length > 80) {
      throw new DomainRuleError(
        'INVALID_PHYSICAL_REF',
        'Physical slip/folder reference cannot exceed 80 characters.',
      );
    }

    const pageCount = payload.physicalPageCount ?? null;
    if (pageCount !== null && (!Number.isFinite(pageCount) || pageCount < 1 || pageCount > 5000)) {
      throw new DomainRuleError(
        'INVALID_PAGE_COUNT',
        'Physical page count must be between 1 and 5,000 pages.',
      );
    }

    return this._docRepo.registerHardCopyDocument({
      ...payload,
      title: cleanTitle,
      physicalReference: cleanRef,
      physicalPageCount: pageCount !== null ? Math.floor(pageCount) : null,
    });
  }

  private _validateOriginMetadata(
    actor: Personnel,
    rawTitle: string,
    categoryId: string,
    recipientUserId: string | null | undefined,
    routeToDelegateIfOnLeave: boolean | undefined,
    directory: ReadonlyArray<Personnel>,
  ): string {
    if (!actor.isActive) {
      throw new DomainRuleError(
        'ACCOUNT_INACTIVE',
        'Deactivated accounts cannot register documents.',
      );
    }
    const cleanTitle = rawTitle.trim();
    if (cleanTitle.length < 3 || cleanTitle.length > 140) {
      throw new DomainRuleError(
        'INVALID_DOCUMENT_TITLE',
        'Document title must be between 3 and 140 characters.',
      );
    }
    if (!categoryId.trim()) {
      throw new DomainRuleError('MISSING_CATEGORY', 'Select a document category.');
    }
    if (recipientUserId) {
      if (recipientUserId === actor.id) {
        throw new DomainRuleError(
          'SELF_DISPATCH_NOT_ALLOWED',
          'You cannot send a document to your own account. Leave recipient blank to hold it locally.',
        );
      }
      this._assertRecipientRoutable(recipientUserId, routeToDelegateIfOnLeave, directory);
    }
    return cleanTitle;
  }

  public async acknowledgeReceipt(
    actor: Personnel,
    document: Document,
    proofPhoto?: AcknowledgePayload['proofPhoto'],
    verificationCode?: string,
    password?: string,
  ): Promise<Document> {
    this._policy.enforce(actor, document);
    const latest = document.latestTransaction;
    if (latest?.isPendingSentBy(actor.id)) {
      throw new DomainRuleError(
        'SELF_RECEIPT_NOT_ALLOWED',
        'You cannot confirm receipt of a document you sent. Wait for the intended recipient to scan or confirm it.',
      );
    }
    if (!latest || !latest.canBeAcknowledgedBy(actor)) {
      throw new DomainRuleError(
        'NO_PENDING_RECEIPT',
        'There is no pending transfer to your office awaiting digital acknowledgment.',
      );
    }
    if (password !== undefined && password !== '' && document.copyFormat !== DocumentCopyFormat.DIGITAL) {
      throw new DomainRuleError(
        'PASSWORD_UNLOCK_NOT_ALLOWED',
        'Password unlock is only available for Soft Copy documents. Scan the physical routing QR slip instead.',
      );
    }

    return this._docRepo.acknowledgeReceipt({
      documentId: document.id,
      verificationCode,
      password,
      proofPhoto,
    });
  }

  public async forwardDocument(
    actor: Personnel,
    document: Document,
    payload: ForwardDocumentPayload,
    directory: ReadonlyArray<Personnel>,
  ): Promise<Document> {
    this._policy.enforce(actor, document);
    if (payload.recipientUserId === actor.id) {
      throw new DomainRuleError(
        'SELF_DISPATCH_NOT_ALLOWED',
        'You cannot forward a document to your own account.',
      );
    }
    this._assertRecipientRoutable(
      payload.recipientUserId,
      payload.routeToDelegateIfOnLeave,
      directory,
    );

    const latest = document.latestTransaction;
    if (latest && latest.receiptStatus === ReceiptStatus.PENDING) {
      if (latest.canBeAcknowledgedBy(actor)) {
        throw new DomainRuleError(
          'ACCEPT_BEFORE_FORWARD',
          'Confirm digital receipt of this incoming document before forwarding it onward.',
        );
      }
      throw new DomainRuleError(
        'IN_TRANSIT_LOCKED',
        'Document is currently in transit awaiting recipient acknowledgment.',
      );
    }

    return this._docRepo.forwardDocument(payload);
  }

  private _assertRecipientRoutable(
    recipientUserId: string,
    routeToDelegateIfOnLeave: boolean | undefined,
    directory: ReadonlyArray<Personnel>,
  ): void {
    const recipient = directory.find((p) => p.id === recipientUserId);
    if (!recipient) {
      throw new DomainRuleError('RECIPIENT_NOT_FOUND', 'Selected recipient was not found.');
    }
    if (!recipient.canReceiveDirectRouting()) {
      if (!routeToDelegateIfOnLeave || !recipient.delegateId) {
        throw new DomainRuleError(
          'RECIPIENT_ON_LEAVE',
          `${recipient.fullName} is currently On Leave and cannot receive direct routing.`,
        );
      }
      const delegate = directory.find((p) => p.id === recipient.delegateId);
      if (!delegate || !delegate.canReceiveDirectRouting()) {
        throw new DomainRuleError(
          'DELEGATE_UNAVAILABLE',
          `${recipient.fullName} has no available delegate.`,
        );
      }
    }
  }

  public async recallLatestTransfer(actor: Personnel, document: Document): Promise<Document> {
    this._policy.enforce(actor, document);
    const latest = document.latestTransaction;
    if (!latest || !latest.canBeRecalledBy(actor.id)) {
      throw new DomainRuleError(
        'RECALL_NOT_ALLOWED',
        'Cannot recall a document after the recipient has acknowledged or acted on it.',
      );
    }
    return this._docRepo.recallLatestTransfer(document.id);
  }

  public async declineMisrouted(
    actor: Personnel,
    document: Document,
    reason: string,
  ): Promise<Document> {
    this._policy.enforce(actor, document);
    const cleanReason = reason.trim();
    if (!cleanReason) {
      throw new DomainRuleError('EMPTY_REASON', 'Decline reason must not be empty.');
    }
    const latest = document.latestTransaction;
    if (!latest || !latest.isPendingForOffice(actor.office.id)) {
      throw new DomainRuleError(
        'NO_PENDING_TRANSFER',
        'Only pending incoming transfers to your office can be declined.',
      );
    }
    return this._docRepo.declineMisrouted(document.id, cleanReason);
  }

  public async returnForRevision(
    actor: Personnel,
    document: Document,
    remarks: string,
  ): Promise<Document> {
    this._policy.enforce(actor, document);
    const cleanRemarks = remarks.trim();
    if (!cleanRemarks) {
      throw new DomainRuleError('EMPTY_REMARKS', 'Revision remarks must not be empty.');
    }
    return this._docRepo.returnForRevision(document.id, cleanRemarks);
  }

  public async uploadRevisionVersion(
    actor: Personnel,
    document: Document,
    payload: UploadRevisionPayload,
  ): Promise<Document> {
    this._policy.enforce(actor, document);
    const latestTx = document.latestTransaction;
    if (document.isSealed || latestTx?.canBeAcknowledgedBy(actor)) {
      throw new DomainRuleError(
        'RECEIPT_REQUIRED_BEFORE_ACCESS',
        'Unlock and confirm receipt of this document before attaching a signed or updated file.',
      );
    }
    if (
      document.lifecycleStatus === DocumentLifecycleStatus.APPROVED ||
      document.lifecycleStatus === DocumentLifecycleStatus.ARCHIVED
    ) {
      throw new DomainRuleError(
        'DOCUMENT_ALREADY_FINALIZED',
        'Cannot attach a new file version to an approved or archived document.',
      );
    }
    if (latestTx && latestTx.receiptStatus === ReceiptStatus.PENDING) {
      throw new DomainRuleError(
        'DOCUMENT_IN_TRANSIT',
        'This document is in transit awaiting receipt. Wait until received or recall first.',
      );
    }
    const isHoldingCustody =
      actor.id === document.currentHolderId || actor.office.id === document.currentOffice.id;
    const isOriginRevision =
      document.lifecycleStatus === DocumentLifecycleStatus.RETURNED_FOR_REVISION &&
      actor.office.id === document.originOffice.id;

    if (document.versions.length === 0) {
      const canAttachInitial = isHoldingCustody || actor.office.id === document.originOffice.id;
      if (!canAttachInitial) {
        throw new DomainRuleError(
          'INITIAL_SCAN_NOT_ALLOWED',
          'Only the holding or originating office can attach the initial digital scan (v1).',
        );
      }
      return this._docRepo.uploadRevisionVersion(payload);
    }
    if (!isHoldingCustody && !isOriginRevision) {
      throw new DomainRuleError(
        'CUSTODY_REQUIRED',
        `Only the office currently holding custody (${document.currentOffice.code}) can attach a signed copy or updated version.`,
      );
    }
    return this._docRepo.uploadRevisionVersion(payload);
  }
}
