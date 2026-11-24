import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Eye,
  FileText,
  FolderKanban,
  History,
  Keyboard,
  Lock,
  MessageSquare,
  Pencil,
  Plus,
  QrCode,
  RotateCcw,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { CommentVisibility, DocumentComment, PresignedDownloadGrant } from '../domain/types';
import { useWebApp } from '../state/WebAppContext';
import { CopyFormatBadge, SlaBadge, TierBadge } from '../components/Badges';
import FuseButton from '../components/FuseButton';
import {
  AcknowledgeModal,
  AuditTrailModal,
  CompleteDocumentModal,
  EditDocumentModal,
  ForwardModal,
  OpaqueQrModal,
  PresignedViewerModal,
  QrTokenEntryModal,
  RevisionUploadModal,
  TextReasonModal,
} from '../components/Modals';
import { paginateList, PaginationBar } from '../components/PaginationBar';
import { SealedQrGlyph } from '../components/SealedQrCard';
import { formatBytes, formatClockTime, formatCompactDate, formatRelativeTime } from '../utils/formatters';
import { isPendingReceiptForActor, isPendingSentByActor } from '../utils/sentFilter';

const TIMELINE_PER_PAGE = 10;
const COMMENTS_PER_PAGE = 8;
const VERSIONS_PER_PAGE = 6;

export const DocumentDetailPage: React.FC = () => {
  const {
    actor,
    documents,
    categories,
    selectedDocumentId,
    personnelDirectory,
    auditLogs,
    navigate,
    closeDocument,
    openSealedDocumentAction,
    acknowledgeReceipt,
    forwardDocument,
    returnForRevision,
    declineMisrouted,
    recallTransfer,
    updateDocumentDetails,
    completeDocument,
    listDocumentComments,
    addDocumentComment,
    uploadRevision,
    issuePresignedView,
    issueProofPhotoView,
    resolveQr,
    loadAuditLogs,
    notify,
    securityPrefs,
    realtimeTick,
    isBusy,
  } = useWebApp();

  const [showQrModal, setShowQrModal] = useState(false);
  const [showAckModal, setShowAckModal] = useState(false);
  const [showManualUnlockModal, setShowManualUnlockModal] = useState(false);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [reasonMode, setReasonMode] = useState<'return' | 'decline' | null>(null);
  const [viewerGrant, setViewerGrant] = useState<PresignedDownloadGrant | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [comments, setComments] = useState<ReadonlyArray<DocumentComment>>([]);
  const [commentBody, setCommentBody] = useState('');
  const [commentVisibility, setCommentVisibility] = useState<CommentVisibility>('cross_office');
  const [timelinePage, setTimelinePage] = useState(1);
  const [commentsPage, setCommentsPage] = useState(1);
  const [versionsPage, setVersionsPage] = useState(1);

  const doc = useMemo(
    () => documents.find((d) => d.id === selectedDocumentId) ?? documents[0] ?? null,
    [documents, selectedDocumentId],
  );

  const activeDocId = doc?.id ?? null;
  const activeActorId = actor?.id ?? null;
  const isDocSealedForActor = Boolean(
    doc && (isPendingReceiptForActor(doc, actor) || Boolean(doc.isSealed)),
  );

  useEffect(() => {
    setTimelinePage(1);
    setCommentsPage(1);
    setVersionsPage(1);
  }, [activeDocId]);

  useEffect(() => {
    let active = true;
    if (!activeDocId || !activeActorId || isDocSealedForActor) {
      setComments([]);
      return;
    }
    listDocumentComments(activeDocId)
      .then((items) => {
        if (active) setComments(items);
      })
      .catch(() => {
        if (active) setComments([]);
      });
    return () => {
      active = false;
    };
  }, [activeDocId, activeActorId, isDocSealedForActor, listDocumentComments, realtimeTick]);

  if (!doc) {
    return (
      <div className="empty-state">
        <div className="empty-icon-wrap">
          <FileText size={22} />
        </div>
        <h4 className="empty-title">No Document Selected</h4>
        <p className="empty-desc">
          Select a document from the Inbox, check Track Documents, or dispatch a Soft Copy / Hard
          Copy record first.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn btn-amber" onClick={() => navigate('send')}>
            Send Document
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate('track')}>
            Track Documents
          </button>
        </div>
      </div>
    );
  }

  const latestTx = doc.transactions[doc.transactions.length - 1] ?? null;
  const pendingSentByMe = isPendingSentByActor(doc, actor);
  const pendingAtMyOffice = isPendingReceiptForActor(doc, actor) || Boolean(doc.isSealed);
  const inMyCustody =
    Boolean(actor) &&
    doc.currentOffice.id === actor?.office.id &&
    !pendingAtMyOffice &&
    !pendingSentByMe;
  const canRecall =
    Boolean(actor) &&
    latestTx?.status === 'pending' &&
    (latestTx.fromUserId
      ? latestTx.fromUserId === actor?.id
      : latestTx.fromOffice.id === actor?.office.id);
  const hasDigitalFiles = doc.versions.length > 0;
  const isFinalized = doc.lifecycleStatus === 'approved' || doc.lifecycleStatus === 'archived';
  const pagedTimeline = paginateList(doc.transactions, timelinePage, TIMELINE_PER_PAGE);
  const pagedComments = paginateList(comments, commentsPage, COMMENTS_PER_PAGE);
  const pagedVersions = paginateList(doc.versions, versionsPage, VERSIONS_PER_PAGE);

  if (pendingAtMyOffice) {
    const fromOffice = latestTx?.fromOffice ?? doc.originOffice;
    const fromUser = latestTx?.fromUserName ?? doc.originUserName;
    const sealedFilesCount =
      typeof doc.attachmentCount === 'number' ? doc.attachmentCount : doc.versions.length;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline" onClick={closeDocument}>
            <ArrowLeft size={15} /> Back to Inbox
          </button>
        </div>

        <div className="card sealed-detail-gate" data-testid="web-qr-lock-gate">
          <button
            type="button"
            className="sealed-qr-tile sealed-qr-tile-lg"
            data-testid={`sealed-detail-qr-trigger-${doc.id}`}
            aria-label={
              doc.copyFormat === 'digital'
                ? `Show unlock QR for soft copy from ${fromOffice.code}`
                : `Receive hard copy transfer from ${fromOffice.code}`
            }
            onClick={() => openSealedDocumentAction(doc)}
          >
            <SealedQrGlyph size={100} />
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="pill pill-amber">
                <Lock size={11} /> Sealed Transfer
              </span>
              {doc.confidentialityTier !== 'standard_internal' ? (
                <TierBadge tier={doc.confidentialityTier} />
              ) : null}
              <SlaBadge state={doc.slaState} suffix={formatRelativeTime(doc.slaDueAt)} />
            </div>

            <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--text-primary)' }}>
              {doc.copyFormat === 'digital'
                ? 'Unlock with Tracely Mobile or Password'
                : 'Receive Physical Hard Copy'}
            </h3>

            <p
              data-testid="web-attachments-locked-card"
              style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}
            >
              From <strong>{fromOffice.code}</strong>
              {fromUser ? ` · ${fromUser}` : ''} ·{' '}
              {sealedFilesCount > 0
                ? `${sealedFilesCount} sealed ${sealedFilesCount === 1 ? 'file' : 'files'}`
                : 'Hard-copy transfer'}
              .{' '}
              {doc.copyFormat === 'digital'
                ? 'Display the live Unlock QR to scan with Tracely Mobile, or unlock with your account password.'
                : 'Scan the printed routing slip with Tracely Mobile, or enter the Tracking Code on desktop.'}
            </p>

            <div className="doc-actions" style={{ marginTop: 4 }}>
              <button
                type="button"
                className="btn btn-amber"
                disabled={isBusy}
                onClick={() => openSealedDocumentAction(doc)}
              >
                <QrCode size={15} />{' '}
                {doc.copyFormat === 'digital' ? 'Show Unlock QR' : 'Receive Hard Copy'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                disabled={isBusy}
                onClick={() => setShowManualUnlockModal(true)}
              >
                <Keyboard size={15} /> Enter Code Manually
              </button>
              <button
                type="button"
                className="sealed-qr-decline-link"
                disabled={isBusy}
                onClick={() => setReasonMode('decline')}
              >
                Misrouted
              </button>
            </div>
          </div>
        </div>

        <TextReasonModal
          open={reasonMode === 'decline'}
          title="Decline Misrouted Record"
          subtitle={`Incoming transfer from ${fromOffice.code}`}
          actionLabel="Decline Delivery"
          onSubmit={async (remarks) => {
            await declineMisrouted(doc.id, remarks);
            closeDocument();
          }}
          onClose={() => setReasonMode(null)}
        />

        <QrTokenEntryModal
          open={showManualUnlockModal}
          isBusy={isBusy}
          expectedTrackingCode={null}
          onClose={() => setShowManualUnlockModal(false)}
          onSubmitToken={async (raw) => {
            const resolved = await resolveQr(raw);
            if (resolved.kind === 'document_denied') {
              throw new Error(resolved.reason);
            }
            if (resolved.kind !== 'document_authorized') {
              throw new Error('Enter the Document Tracking Code or QR token from the sender\'s routing slip.');
            }
            if (resolved.document.id !== doc.id) {
              throw new Error('Entered code belongs to a different document than this sealed transfer.');
            }
            if (resolved.sentByActor) {
              throw new Error('Senders cannot confirm receipt of their own dispatch.');
            }
            await acknowledgeReceipt(
              doc.id,
              undefined,
              undefined,
              resolved.verificationCode ?? raw.trim(),
            );
          }}
        />
      </div>
    );
  }

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = commentBody.trim();
    if (!clean || isBusy) return;
    const created = await addDocumentComment(doc.id, clean, commentVisibility);
    setComments((prev) => [...prev, created]);
    setCommentBody('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-outline" onClick={closeDocument}>
          <ArrowLeft size={15} /> Back to Inbox
        </button>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!pendingAtMyOffice ? (
            <button type="button" className="btn btn-outline" onClick={() => setShowQrModal(true)}>
              <QrCode size={15} /> Routing QR Slip
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-outline"
            onClick={async () => {
              await loadAuditLogs(doc.id);
              setShowAuditModal(true);
            }}
          >
            <History size={15} /> Audit Trail
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="dashboard-left">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span className="mono doc-tracking-code">
                {doc.trackingCode}
              </span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <CopyFormatBadge format={doc.copyFormat} />
                <TierBadge tier={doc.confidentialityTier} />
                <SlaBadge state={doc.slaState} suffix={formatRelativeTime(doc.slaDueAt)} />
              </div>
            </div>

            <h3 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: 'var(--text-primary)' }}>{doc.title}</h3>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Category: <strong>{doc.categoryName}</strong> · Current Office:{' '}
              <strong>
                {doc.currentOffice.code} ({doc.currentOffice.name})
              </strong>
            </div>

            {doc.copyFormat === 'hard_copy' || doc.physicalReference || doc.physicalPageCount ? (
              <div className="card-soft" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <FolderKanban size={18} color="var(--amber-text)" />
                <div style={{ fontSize: 13 }}>
                  <strong>Physical Copy Tracking</strong>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {doc.physicalReference ?? 'No folder note specified'}
                    {doc.physicalPageCount ? ` · ${doc.physicalPageCount} pages` : ''}
                  </div>
                </div>
              </div>
            ) : null}

            {pendingSentByMe ? (
              <div
                className="card-soft"
                data-testid="self-sent-guard-banner"
                style={{
                  background: 'var(--amber-soft)',
                  borderColor: 'var(--amber-border)',
                  fontSize: 12,
                  color: 'var(--amber-text)',
                  fontWeight: 600,
                }}
              >
                Dispatched by you to <strong>{doc.currentOffice.code}</strong> — awaiting recipient
                confirmation. Senders cannot confirm receipt of their own dispatch.
              </div>
            ) : null}

            {isFinalized ? (
              <div
                className="card-soft"
                data-testid="doc-finalized-banner"
                style={{
                  background: 'var(--emerald-soft)',
                  borderColor: 'var(--emerald-border)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12.5,
                  color: 'var(--emerald-text)',
                  fontWeight: 700,
                }}
              >
                {doc.lifecycleStatus === 'approved' ? <CheckCircle2 size={16} /> : <Archive size={16} />}
                <span>
                  {doc.lifecycleStatus === 'approved'
                    ? `Approved & Released — Finalized at ${doc.currentOffice.code}`
                    : `Archived / Closed — Stored at ${doc.currentOffice.code}`}
                </span>
              </div>
            ) : null}

            {pendingAtMyOffice ? (
              <div
                className="card-soft"
                data-testid="web-qr-lock-gate"
                style={{
                  background: 'var(--amber-soft)',
                  borderColor: 'var(--amber-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 800,
                    color: 'var(--amber-text)',
                  }}
                >
                  <Lock size={15} />
                  <span>Document Locked — Scan Routing QR or Enter Code to Access</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Only the routing QR notice was delivered to your office. Scan the sender&apos;s
                  routing QR code or enter the code manually to confirm receipt and unlock attached
                  document files.
                </div>
              </div>
            ) : null}

            <div className="doc-actions" style={{ paddingTop: 6, borderTop: '1px solid var(--border)' }}>
              {pendingAtMyOffice ? (
                <>
                  <button
                    type="button"
                    className="btn btn-amber"
                    disabled={isBusy}
                    onClick={() => openSealedDocumentAction(doc)}
                  >
                    <QrCode size={15} />{' '}
                    {doc.copyFormat === 'digital' ? 'Show Unlock QR' : 'Receive Hard Copy'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={isBusy}
                    onClick={() => setShowManualUnlockModal(true)}
                  >
                    <Keyboard size={15} /> Enter Code Manually
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger-outline"
                    disabled={isBusy}
                    onClick={() => setReasonMode('decline')}
                  >
                    <ShieldAlert size={15} /> Misrouted
                  </button>
                </>
              ) : null}

              {inMyCustody && !isFinalized ? (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={isBusy}
                    onClick={() => setShowForwardModal(true)}
                  >
                    <Send size={15} /> Forward
                  </button>
                  <button
                    type="button"
                    className="btn btn-amber"
                    disabled={isBusy}
                    onClick={() => setShowCompleteModal(true)}
                  >
                    <CheckCircle2 size={15} /> Approve / Archive
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={isBusy}
                    onClick={() => setShowEditModal(true)}
                  >
                    <Pencil size={15} /> Edit Details
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    disabled={isBusy}
                    onClick={() => setShowRevisionModal(true)}
                  >
                    <Plus size={15} /> {hasDigitalFiles ? 'Upload Revision' : 'Attach Soft Copy (v1)'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger-outline"
                    disabled={isBusy}
                    onClick={() => setReasonMode('return')}
                  >
                    <RotateCcw size={15} /> Return
                  </button>
                </>
              ) : null}

              {inMyCustody && doc.lifecycleStatus === 'approved' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={isBusy}
                  onClick={() => setShowForwardModal(true)}
                  title="Send the approved/signed document back to the requesting office or onward for implementation"
                >
                  <Send size={15} /> Release / Send Back
                </button>
              ) : null}

              {canRecall ? (
                <FuseButton
                  label="Recall Transfer"
                  undoLabel="Undo Recall"
                  doneLabel="Recalled"
                  color="#F8FAFC"
                  background="#27272A"
                  fuseColor="#F3B32A"
                  size="sm"
                  radius={18}
                  undoWindow={4000}
                  fuse="outline"
                  fuseThickness={1.5}
                  crossfadeMs={200}
                  commitOn="fuseEnd"
                  pauseOnHover
                  settle="reset"
                  disabled={isBusy}
                  title="Pull back this pending transfer before the recipient scans the QR or confirms receipt. Click Undo Recall (or press Escape) while the fuse burns to cancel."
                  testId="detail-recall-fuse"
                  onCommit={() => {
                    void recallTransfer(doc.id);
                  }}
                  onUndo={() =>
                    notify('info', 'Recall cancelled — pending transfer remains active.')
                  }
                />
              ) : null}
            </div>
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h4 className="section-title" style={{ fontSize: 15 }}>
              Routing & Custody Timeline ({doc.transactions.length})
            </h4>
            {doc.transactions.length === 0 ? (
              <p className="field-hint" style={{ margin: 0 }}>
                Filed locally at originating unit ({doc.originOffice.code}). Forward when ready to
                dispatch.
              </p>
            ) : (
              <>
                <div className="tl-list" data-testid="doc-detail-connected-timeline">
                  {pagedTimeline.pageItems.map((tx, idx, arr) => {
                    const isFirst = idx === 0 && pagedTimeline.safePage === 1;
                    const isLast =
                      idx === arr.length - 1 && pagedTimeline.safePage === pagedTimeline.totalPages;
                    const isException =
                      tx.status === 'recalled' ||
                      tx.status === 'declined_misrouted' ||
                      tx.status === 'returned_for_revision';
                    const dotClass = isException
                      ? 'tl-dot-exception'
                      : tx.status === 'pending'
                        ? 'tl-dot-pending'
                        : isLast && isFinalized
                          ? 'tl-dot-completed'
                          : isLast
                            ? 'tl-dot-active'
                            : 'tl-dot-done';
                    const eventTime = tx.receivedAt ?? tx.sentAt;
                    return (
                      <div key={tx.id} className="tl-row">
                        <div className="tl-time">
                          <div className="tl-date tabular">{formatCompactDate(eventTime)}</div>
                          <div className="tl-clock mono">{formatClockTime(eventTime)}</div>
                        </div>

                        <div className="tl-axis" aria-hidden="true">
                          <div className={`tl-line-top${isFirst ? ' tl-line-hidden' : ''}`} />
                          <div className={`tl-dot ${dotClass}`} />
                          <div className={`tl-line-bottom${isLast ? ' tl-line-hidden' : ''}`} />
                        </div>

                        <div className="tl-body">
                          <div className="tl-time-inline mono">
                            {formatCompactDate(eventTime)} · {formatClockTime(eventTime)}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <div className="tl-label">
                              {tx.fromOffice.code} → {tx.toOffice.code}
                            </div>
                            <span
                              className={`pill ${
                                tx.status === 'acknowledged'
                                  ? 'pill-emerald'
                                  : tx.status === 'pending'
                                    ? 'pill-amber'
                                    : 'pill-rose'
                              }`}
                              style={{ fontSize: 10 }}
                            >
                              {tx.status === 'pending'
                                ? 'awaiting scan'
                                : tx.status === 'acknowledged'
                                  ? 'received'
                                  : tx.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <div className="tl-office">
                            <span className="tl-office-tag mono">{tx.toOffice.code}</span>
                            <span>
                              {tx.toOffice.name} · {tx.receivedByName ?? tx.recipientName}
                            </span>
                          </div>
                          {tx.remarks ? <div className="tl-remarks">{tx.remarks}</div> : null}
                          {tx.proofPhoto ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                              <span className="pill pill-emerald" style={{ fontSize: 10 }}>
                                <Camera size={11} /> Proof Photo Verified ({tx.proofPhoto.fileName})
                              </span>
                              <button
                                type="button"
                                className="btn btn-outline"
                                style={{ minHeight: 28, padding: '2px 10px', fontSize: 11 }}
                                onClick={async () => {
                                  const grant = await issueProofPhotoView(doc.id, tx.id);
                                  setViewerGrant(grant);
                                }}
                              >
                                <Eye size={12} /> View Proof Photo
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <PaginationBar
                  totalItems={doc.transactions.length}
                  page={pagedTimeline.safePage}
                  pageSize={TIMELINE_PER_PAGE}
                  itemLabel="routing hops"
                  onPageChange={setTimelinePage}
                  testId="web-doc-timeline-pagination"
                  compact
                />
              </>
            )}
          </div>

          <div
            className="card"
            data-testid="web-document-comments"
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={15} color="var(--navy)" />
                <h4 className="section-title" style={{ fontSize: 15 }}>
                  Document Notes &amp; Clarifications ({comments.length})
                </h4>
              </div>
            </div>

            {comments.length === 0 ? (
              <p className="field-hint" style={{ margin: 0 }}>
                Post follow-up clarifications or internal office checklist notes without returning the document.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pagedComments.pageItems.map((cmt) => {
                    const isInternal = cmt.visibility === 'internal_office';
                    return (
                      <div
                        key={cmt.id}
                        className={`comment-card ${isInternal ? 'comment-card-internal' : ''}`}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--text-primary)' }}>
                            {cmt.authorName}{' '}
                            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                              · {cmt.authorOfficeCode}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isInternal ? (
                              <span className="pill pill-amber" style={{ fontSize: 10 }}>
                                <Lock size={10} /> {cmt.authorOfficeCode} Only
                              </span>
                            ) : (
                              <span className="pill pill-sky" style={{ fontSize: 10 }}>
                                Cross-Office
                              </span>
                            )}
                            <span className="tabular" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {formatCompactDate(cmt.createdAt)} {formatClockTime(cmt.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text-primary)' }}>
                          {cmt.body}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <PaginationBar
                  totalItems={comments.length}
                  page={pagedComments.safePage}
                  pageSize={COMMENTS_PER_PAGE}
                  itemLabel="notes"
                  onPageChange={setCommentsPage}
                  testId="web-doc-comments-pagination"
                  compact
                />
              </>
            )}

            {actor ? (
              <form onSubmit={(e) => void handlePostComment(e)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="chip-row">
                  <button
                    type="button"
                    className={`sub-chip ${commentVisibility === 'cross_office' ? 'sub-chip-active' : ''}`}
                    onClick={() => setCommentVisibility('cross_office')}
                  >
                    Cross-Office Note
                  </button>
                  <button
                    type="button"
                    className={`sub-chip ${commentVisibility === 'internal_office' ? 'sub-chip-active' : ''}`}
                    onClick={() => setCommentVisibility('internal_office')}
                  >
                    <Lock size={11} /> Internal ({actor.office.code} Only)
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input"
                    aria-label="Add document note"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder={
                      commentVisibility === 'internal_office'
                        ? `Private note visible only to ${actor.office.code} staff...`
                        : 'Post a clarification note for participating offices...'
                    }
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={!commentBody.trim() || isBusy}
                  >
                    Post Note
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </div>

        <aside className="dashboard-right">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="section-header-row">
              <h4 className="section-title" style={{ fontSize: 15 }}>
                Digital Attachments ({doc.versions.length})
              </h4>
              {inMyCustody ? (
                <button
                  type="button"
                  className="btn btn-soft"
                  style={{ minHeight: 30, padding: '4px 10px', fontSize: 12 }}
                  onClick={() => setShowRevisionModal(true)}
                >
                  <Plus size={13} /> {hasDigitalFiles ? 'Add Version' : 'Attach Scan'}
                </button>
              ) : null}
            </div>

            {pendingAtMyOffice ? (
              <div
                className="card-soft"
                data-testid="web-attachments-locked-card"
                style={{
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  background: 'var(--amber-soft)',
                  borderColor: 'var(--amber-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 13, color: 'var(--amber-text)' }}>
                  <Lock size={15} />
                  <span>
                    {doc.versions.length > 0
                      ? `${doc.versions.length} Attached File${doc.versions.length === 1 ? '' : 's'} Locked`
                      : 'Custody Verification Required'}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Scan the routing QR slip or enter the code manually to confirm receipt and unlock
                  document viewing.
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-amber"
                    style={{ flex: 1, minHeight: 36, fontSize: 12 }}
                    onClick={() => openSealedDocumentAction(doc)}
                  >
                    <QrCode size={14} />{' '}
                    {doc.copyFormat === 'digital' ? 'Show Unlock QR' : 'Receive Hard Copy'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ flex: 1, minHeight: 36, fontSize: 12 }}
                    onClick={() => setShowManualUnlockModal(true)}
                  >
                    <Keyboard size={14} /> Enter Code
                  </button>
                </div>
              </div>
            ) : doc.versions.length === 0 ? (
              <div className="card-soft" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                No digital file uploaded yet (Hard Copy physical slip tracking only). Attach a PDF
                or scanned copy anytime to upgrade this record to Hybrid.
              </div>
            ) : (
              <>
                {pagedVersions.pageItems.map((ver) => (
                  <div key={ver.versionNumber} className="card-soft" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: 13 }}>
                        v{ver.versionNumber} · {ver.fileName}
                      </strong>
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ minHeight: 30, padding: '4px 10px', fontSize: 12 }}
                        onClick={async () => {
                          const grant = await issuePresignedView(doc.id, ver.versionNumber);
                          setViewerGrant(grant);
                        }}
                      >
                        <Eye size={13} /> View
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>
                      {formatBytes(ver.sizeBytes)} · {ver.uploadedByName}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                      SHA-256: {ver.sha256Checksum.slice(0, 16)}...
                    </div>
                  </div>
                ))}
                <PaginationBar
                  totalItems={doc.versions.length}
                  page={pagedVersions.safePage}
                  pageSize={VERSIONS_PER_PAGE}
                  itemLabel="versions"
                  onPageChange={setVersionsPage}
                  testId="web-doc-versions-pagination"
                  compact
                />
              </>
            )}
          </div>
        </aside>
      </div>

      <OpaqueQrModal
        open={showQrModal}
        trackingCode={doc.trackingCode}
        qrToken={doc.qrToken}
        title={doc.title}
        document={doc}
        onClose={() => setShowQrModal(false)}
      />

      <AcknowledgeModal
        open={showAckModal}
        document={doc}
        onConfirm={async (docId, remarks, proofPhoto) => {
          await acknowledgeReceipt(docId, remarks, proofPhoto);
        }}
        onClose={() => setShowAckModal(false)}
      />

      <CompleteDocumentModal
        open={showCompleteModal}
        document={doc}
        isBusy={isBusy}
        onComplete={async (docId, status, remarks) => {
          await completeDocument(docId, status, remarks);
        }}
        onClose={() => setShowCompleteModal(false)}
      />

      <ForwardModal
        open={showForwardModal}
        document={doc}
        personnel={personnelDirectory}
        actorId={actor?.id}
        onForward={async (docId, recId, remarks) => {
          await forwardDocument(docId, recId, remarks);
        }}
        onClose={() => setShowForwardModal(false)}
      />

      <RevisionUploadModal
        open={showRevisionModal}
        document={doc}
        onUpload={async (file, sha256Checksum, revisionNote, fileName) => {
          await uploadRevision({
            documentId: doc.id,
            file,
            fileName,
            sha256Checksum,
            revisionNote,
          });
        }}
        onClose={() => setShowRevisionModal(false)}
      />

      <TextReasonModal
        open={Boolean(reasonMode)}
        title={reasonMode === 'decline' ? 'Decline Misrouted Record' : 'Return for Revision'}
        subtitle={`${doc.trackingCode} · ${doc.title}`}
        actionLabel={reasonMode === 'decline' ? 'Decline Delivery' : 'Return Document'}
        onSubmit={async (remarks) => {
          if (reasonMode === 'decline') {
            await declineMisrouted(doc.id, remarks);
          } else {
            await returnForRevision(doc.id, remarks);
          }
        }}
        onClose={() => setReasonMode(null)}
      />

      <PresignedViewerModal
        grant={viewerGrant}
        requireSessionLock={
          securityPrefs.biometricLock && doc.confidentialityTier !== 'standard_internal'
        }
        actorName={actor?.fullName}
        onClose={() => setViewerGrant(null)}
      />

      <AuditTrailModal
        open={showAuditModal}
        logs={auditLogs}
        onClose={() => setShowAuditModal(false)}
      />

      <QrTokenEntryModal
        open={showManualUnlockModal}
        isBusy={isBusy}
        expectedTrackingCode={doc.trackingCode}
        onClose={() => setShowManualUnlockModal(false)}
        onSubmitToken={async (raw) => {
          const resolved = await resolveQr(raw);
          if (resolved.kind === 'document_denied') {
            throw new Error(resolved.reason);
          }
          if (resolved.kind !== 'document_authorized') {
            throw new Error('Enter the Document Tracking Code or QR token for this document.');
          }
          if (resolved.document.id !== doc.id) {
            throw new Error(
              `Entered code belongs to ${resolved.document.trackingCode}, not ${doc.trackingCode}.`,
            );
          }
          if (resolved.sentByActor) {
            throw new Error('Senders cannot confirm receipt of their own dispatch.');
          }
          await acknowledgeReceipt(
            doc.id,
            undefined,
            undefined,
            resolved.verificationCode ?? raw.trim(),
          );
        }}
      />

      <EditDocumentModal
        open={showEditModal}
        document={doc}
        categories={categories}
        isBusy={isBusy}
        onSave={async (patch) => {
          await updateDocumentDetails(doc.id, patch);
        }}
        onOpenRevisionUpload={() => setShowRevisionModal(true)}
        onClose={() => setShowEditModal(false)}
      />
    </div>
  );
};
