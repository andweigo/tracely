import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  Download,
  Inbox,
  Keyboard,
  MapPin,
  Printer,
  Search,
  Send,
  SlidersHorizontal,
  Smartphone,
  Square,
} from 'lucide-react';
import { ConfidentialityTier, DocumentRecord, SlaState } from '../domain/types';
import { useWebApp } from '../state/WebAppContext';
import { SlaBadge, TierBadge } from '../components/Badges';
import { ForwardModal, TextReasonModal } from '../components/Modals';
import { paginateList, PaginationBar } from '../components/PaginationBar';
import { SealedQrCard } from '../components/SealedQrCard';
import { TrackingLocationCard } from '../components/TrackingLocationCard';
import { buildDocumentsCsv, buildTrackedCsv, downloadCsvFile } from '../utils/exportCsv';
import { formatRelativeTime } from '../utils/formatters';
import {
  countSlaRisks,
  InboxFormatFilter,
  InboxSortMode,
  matchesFormatFilter,
  sortDocumentRecords,
} from '../utils/inboxFilter';
import {
  formatHumanInboxStatus,
  isPendingReceiptForActor,
  isPendingSentByActor,
} from '../utils/sentFilter';

type QueueTab = 'all' | 'incoming' | 'in_progress' | 'returned' | 'tracked';
type FilterChip = 'all' | 'sla_risk' | 'protected' | 'school_tagged';
const INBOX_ITEMS_PER_PAGE = 15;
const INBOX_TRACKED_PER_PAGE = 10;

export const InboxPage: React.FC = () => {
  const {
    actor,
    documents,
    trackedSnapshots,
    categories,
    personnelDirectory,
    openDocument,
    openSealedDocumentAction,
    openBatchUsbReceive,
    navigate,
    declineMisrouted,
    forwardDocument,
    batchForwardDocuments,
    isBusy,
  } = useWebApp();

  const [queueTab, setQueueTab] = useState<QueueTab>('all');
  const [chip, setChip] = useState<FilterChip>('all');
  const [formatFilter, setFormatFilter] = useState<InboxFormatFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<InboxSortMode>('sla_urgent');
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlyArray<string>>([]);
  const [declineTarget, setDeclineTarget] = useState<DocumentRecord | null>(null);
  const [forwardTargets, setForwardTargets] = useState<ReadonlyArray<DocumentRecord> | null>(null);

  const counts = useMemo(() => {
    if (!actor) {
      return { all: 0, incoming: 0, inProgress: 0, returned: 0, tracked: trackedSnapshots.length };
    }
    const incoming = documents.filter((d) => isPendingReceiptForActor(d, actor)).length;
    const inProgress = documents.filter(
      (d) =>
        d.currentOffice.id === actor.office.id &&
        !isPendingReceiptForActor(d, actor) &&
        !isPendingSentByActor(d, actor) &&
        d.lifecycleStatus === 'in_review',
    ).length;
    const returned = documents.filter((d) => d.lifecycleStatus === 'returned_for_revision').length;
    return {
      all: documents.filter(
        (d) => d.lifecycleStatus !== 'approved' && d.lifecycleStatus !== 'archived',
      ).length,
      incoming,
      inProgress,
      returned,
      tracked: trackedSnapshots.length,
    };
  }, [actor, documents, trackedSnapshots]);

  const slaRisks = useMemo(() => countSlaRisks(documents), [documents]);

  const filteredDocs = useMemo(() => {
    if (!actor || queueTab === 'tracked') return [];
    const q = query.trim().toLowerCase();

    const matched = documents.filter((doc) => {
      if (doc.lifecycleStatus === 'approved' || doc.lifecycleStatus === 'archived') return false;
      const pendingAtMyOffice = isPendingReceiptForActor(doc, actor);
      const pendingSentByMe = isPendingSentByActor(doc, actor);

      if (queueTab === 'incoming' && !pendingAtMyOffice) return false;
      if (
        queueTab === 'in_progress' &&
        !(
          doc.currentOffice.id === actor.office.id &&
          !pendingAtMyOffice &&
          !pendingSentByMe &&
          doc.lifecycleStatus === 'in_review'
        )
      ) {
        return false;
      }
      if (queueTab === 'returned' && doc.lifecycleStatus !== 'returned_for_revision') return false;
      if (chip === 'sla_risk' && !(['at_risk', 'overdue'] as SlaState[]).includes(doc.slaState)) {
        return false;
      }
      if (
        chip === 'protected' &&
        (['standard_internal'] as ConfidentialityTier[]).includes(doc.confidentialityTier)
      ) {
        return false;
      }
      if (chip === 'school_tagged' && !doc.submittedSchoolName) return false;
      if (!matchesFormatFilter(doc, formatFilter)) return false;
      if (categoryFilter !== 'all' && doc.categoryId !== categoryFilter) return false;
      if (!q) return true;
      return (
        doc.trackingCode.toLowerCase().includes(q) ||
        doc.title.toLowerCase().includes(q) ||
        doc.categoryName.toLowerCase().includes(q) ||
        doc.currentOffice.name.toLowerCase().includes(q)
      );
    });

    return sortDocumentRecords(matched, sortMode);
  }, [actor, documents, queueTab, chip, formatFilter, categoryFilter, sortMode, query]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedDocs = useMemo(
    () => filteredDocs.filter((d) => selectedIdSet.has(d.id)),
    [filteredDocs, selectedIdSet],
  );
  const selectableCustodyDocs = useMemo(
    () =>
      actor
        ? filteredDocs.filter(
            (d) =>
              d.currentOffice.id === actor.office.id &&
              !isPendingReceiptForActor(d, actor) &&
              !isPendingSentByActor(d, actor),
          )
        : [],
    [actor, filteredDocs],
  );
  const selectedCustodyDocs = useMemo(
    () =>
      actor
        ? selectedDocs.filter(
            (d) =>
              d.currentOffice.id === actor.office.id &&
              !isPendingReceiptForActor(d, actor) &&
              !isPendingSentByActor(d, actor),
          )
        : [],
    [actor, selectedDocs],
  );

  const toggleDocSelected = (docId: string) => {
    setSelectedIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId],
    );
  };

  const filteredTracked = useMemo(() => {
    if (queueTab !== 'tracked') return [];
    const q = query.trim().toLowerCase();
    return trackedSnapshots.filter((snap) => {
      if (!q) return true;
      return (
        snap.trackingCode.toLowerCase().includes(q) ||
        snap.displayTitle.toLowerCase().includes(q) ||
        snap.currentOffice.name.toLowerCase().includes(q) ||
        snap.currentOffice.code.toLowerCase().includes(q)
      );
    });
  }, [trackedSnapshots, queueTab, query]);

  const pagedDocs = useMemo(
    () => paginateList(filteredDocs, page, INBOX_ITEMS_PER_PAGE),
    [filteredDocs, page],
  );
  const pagedTracked = useMemo(
    () => paginateList(filteredTracked, page, INBOX_TRACKED_PER_PAGE),
    [filteredTracked, page],
  );

  return (
    <div className="dashboard-grid">
      <div className="dashboard-left">
        <div className="search-filter-row">
          <div className="search-box">
            <Search size={16} />
            <input
              className="search-input"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search code, title, or office"
            />
          </div>
          <button
            type="button"
            className={`filter-circle-btn ${showFilters ? 'filter-circle-btn-active' : ''}`}
            aria-label="Toggle document filters"
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal size={16} />
            <span className="filter-circle-btn-label">Filters</span>
          </button>
        </div>

        {showFilters ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="chip-row">
              {(
                [
                  { id: 'all', label: 'All items' },
                  { id: 'sla_risk', label: 'SLA due / overdue' },
                  { id: 'protected', label: 'Restricted & Confidential' },
                  { id: 'school_tagged', label: 'School-tagged' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`sub-chip ${chip === item.id ? 'sub-chip-active' : ''}`}
                  onClick={() => {
                    setChip(item.id);
                    setPage(1);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="chip-row">
              {(
                [
                  { id: 'all', label: 'All Formats' },
                  { id: 'soft_copy', label: 'Soft Copy' },
                  { id: 'hard_copy', label: 'Hard Copy' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`sub-chip ${formatFilter === item.id ? 'sub-chip-active' : ''}`}
                  onClick={() => {
                    setFormatFilter(item.id);
                    setPage(1);
                  }}
                >
                  {item.label}
                </button>
              ))}

              {(
                [
                  { id: 'sla_urgent', label: 'Sort: SLA Urgent' },
                  { id: 'newest', label: 'Sort: Newest' },
                  { id: 'oldest', label: 'Sort: Oldest' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`sub-chip ${sortMode === item.id ? 'sub-chip-active' : ''}`}
                  onClick={() => {
                    setSortMode(item.id);
                    setPage(1);
                  }}
                >
                  {item.label}
                </button>
              ))}

              {categories.length > 0 ? (
                <select
                  aria-label="Filter by category"
                  className="select"
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  style={{ width: 'auto', minHeight: 30, padding: '4px 10px', fontSize: 11 }}
                >
                  <option value="all">All Categories</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.code} — {cat.name}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>
          </div>
        ) : null}

        {actor && slaRisks.totalRiskCount > 0 && chip !== 'sla_risk' ? (
          <div
            className="card-soft no-print"
            style={{
              background: 'var(--amber-soft)',
              borderColor: 'var(--amber-border)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 800, color: 'var(--amber-text)' }}>
              <AlertTriangle size={15} />
              <span>
                {slaRisks.overdueCount > 0 ? `${slaRisks.overdueCount} overdue` : ''}
                {slaRisks.overdueCount > 0 && slaRisks.atRiskCount > 0 ? ' · ' : ''}
                {slaRisks.atRiskCount > 0 ? `${slaRisks.atRiskCount} due soon` : ''}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-amber"
              style={{ minHeight: 30, padding: '4px 10px', fontSize: 11 }}
              onClick={() => {
                setQueueTab('all');
                setChip('sla_risk');
                setShowFilters(true);
                setPage(1);
              }}
            >
              Review SLA
            </button>
          </div>
        ) : null}

        <div className="tab-scroll-row">
          {(
            [
              { id: 'all', label: `All (${counts.all})` },
              { id: 'incoming', label: `Incoming (${counts.incoming})` },
              { id: 'in_progress', label: 'In progress' },
              { id: 'returned', label: 'Returned' },
              { id: 'tracked', label: `Tracked (${counts.tracked})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-pill ${queueTab === tab.id ? 'tab-pill-active' : ''}`}
              onClick={() => {
                setQueueTab(tab.id);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="section-header-row">
          <h3 className="section-title">
            {queueTab === 'tracked' ? 'Where your office docs are' : 'Needs your action'}
          </h3>
          <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {queueTab !== 'tracked' && filteredDocs.length > 0 ? (
              <button
                type="button"
                className={`btn ${selectMode ? 'btn-primary' : 'btn-soft'}`}
                style={{ minHeight: 34, padding: '4px 12px', fontSize: 12 }}
                onClick={() => {
                  setSelectMode((v) => !v);
                  setSelectedIds([]);
                }}
              >
                {selectMode ? 'Done' : 'Select'}
              </button>
            ) : null}
            {(queueTab === 'tracked' ? filteredTracked.length > 0 : filteredDocs.length > 0) ? (
              <>
                <button
                  type="button"
                  className="btn btn-soft"
                  style={{ minHeight: 34, padding: '4px 12px', fontSize: 12 }}
                  onClick={() => {
                    const datePart = new Date().toISOString().slice(0, 10);
                    if (queueTab === 'tracked') {
                      downloadCsvFile(`tracely-tracked-${datePart}.csv`, buildTrackedCsv(filteredTracked));
                    } else {
                      downloadCsvFile(`tracely-transmittal-${datePart}.csv`, buildDocumentsCsv(filteredDocs));
                    }
                  }}
                >
                  <Download size={13} /> Export CSV
                </button>
                <button
                  type="button"
                  className="btn btn-soft"
                  style={{ minHeight: 34, padding: '4px 12px', fontSize: 12 }}
                  onClick={() => window.print?.()}
                >
                  <Printer size={13} /> Print Log
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="btn btn-soft"
              style={{ minHeight: 34, padding: '4px 12px', fontSize: 12 }}
              onClick={() => setQueueTab('all')}
            >
              See all
            </button>
          </div>
        </div>

        {selectMode && queueTab !== 'tracked' && filteredDocs.length > 0 ? (
          <div
            className="card-soft no-print"
            style={{
              background: 'var(--sky-soft)',
              borderColor: 'var(--sky-border)',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              className="btn btn-soft"
              style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
              onClick={() =>
                setSelectedIds(
                  selectedIds.length === selectableCustodyDocs.length
                    ? []
                    : selectableCustodyDocs.map((d) => d.id),
                )
              }
            >
              {selectedIds.length === selectableCustodyDocs.length && selectableCustodyDocs.length > 0
                ? 'Clear All'
                : 'Select Unlocked'}{' '}
              ({selectedIds.length})
            </button>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {counts.incoming > 0 ? (
                <button
                  type="button"
                  className="btn btn-amber"
                  style={{ minHeight: 32, padding: '4px 12px', fontSize: 12 }}
                  onClick={() => {
                    setQueueTab('incoming');
                    setSelectMode(false);
                    setSelectedIds([]);
                    setPage(1);
                  }}
                >
                  <Smartphone size={13} /> Sealed Incoming ({counts.incoming})
                </button>
              ) : null}
              {selectedCustodyDocs.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ minHeight: 32, padding: '4px 12px', fontSize: 12 }}
                  disabled={isBusy}
                  onClick={() => setForwardTargets(selectedCustodyDocs)}
                >
                  Forward ({selectedCustodyDocs.length})
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {queueTab === 'tracked' ? (
          filteredTracked.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-wrap">
                <MapPin size={22} />
              </div>
              <h4 className="empty-title">
                {actor ? 'No tracked office documents' : 'Track Any Document Location'}
              </h4>
              <p className="empty-desc">
                {actor
                  ? 'Documents originated or forwarded by your office appear here with live office custody status.'
                  : 'Enter a document tracking code to check which office currently holds it.'}
              </p>
              <button type="button" className="btn btn-primary" onClick={() => navigate('track')}>
                Track by Code
              </button>
            </div>
          ) : (
            <div className="card-list">
              {pagedTracked.pageItems.map((snap) => (
                <TrackingLocationCard
                  key={snap.documentId}
                  snapshot={snap}
                  onOpenDocument={openDocument}
                />
              ))}
            </div>
          )
        ) : filteredDocs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon-wrap">
              <Inbox size={22} />
            </div>
            <h4 className="empty-title">
              {actor ? 'No documents in this view' : 'Ready for Tracely Server Connection'}
            </h4>
            <p className="empty-desc">
              {actor
                ? 'Only documents permitted by your office custody and confidentiality policy appear here.'
                : 'Login is deferred while the Laravel API backend is being connected. Explore Send Document, Inline QR Scanner, Shared Categories, and Profile settings.'}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" className="btn btn-amber" onClick={() => navigate('send')}>
                Send Document
              </button>
              {!actor ? (
                <button type="button" className="btn btn-outline" onClick={() => navigate('profile')}>
                  Server & Profile
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="card-list">
            {pagedDocs.pageItems.map((doc) => {
              const pendingMyReceipt = isPendingReceiptForActor(doc, actor) || Boolean(doc.isSealed);
              const pendingSentByMe = isPendingSentByActor(doc, actor);

              if (pendingMyReceipt) {
                return (
                  <SealedQrCard
                    key={doc.id}
                    doc={doc}
                    onScan={(target) => openSealedDocumentAction(target)}
                    onDecline={(target) => setDeclineTarget(target)}
                  />
                );
              }

              const inMyCustody =
                Boolean(actor) &&
                doc.currentOffice.id === actor?.office.id &&
                !pendingSentByMe;
              const isSelected = selectedIdSet.has(doc.id);

              return (
                <div
                  key={doc.id}
                  role="button"
                  tabIndex={0}
                  className={`doc-card ${selectMode && isSelected ? 'doc-card-selected' : ''}`}
                  onClick={() => (selectMode ? toggleDocSelected(doc.id) : openDocument(doc.id))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      if (selectMode) toggleDocSelected(doc.id);
                      else openDocument(doc.id);
                    }
                  }}
                >
                  <div className="doc-card-top">
                    <span className="mono doc-tracking-code">
                      {selectMode ? (isSelected ? <CheckSquare size={14} color="var(--navy)" /> : <Square size={14} />) : null}
                      {doc.trackingCode}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <TierBadge tier={doc.confidentialityTier} />
                      <SlaBadge state={doc.slaState} suffix={formatRelativeTime(doc.slaDueAt)} />
                    </div>
                  </div>

                  <h4 className="doc-title">{doc.title}</h4>
                  <p className="doc-meta">
                    {formatHumanInboxStatus(doc, actor)}
                  </p>
                  {pendingSentByMe ? (
                    <div
                      data-testid={`inbox-forwarded-badge-${doc.id}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11.5,
                        fontWeight: 700,
                        color: 'var(--sky-text)',
                        background: 'var(--sky-soft)',
                        border: '1px solid var(--sky-border)',
                        borderRadius: 999,
                        padding: '3px 10px',
                        alignSelf: 'flex-start',
                      }}
                    >
                      Forwarded to {doc.currentOffice.code} · Awaiting Recipient QR Scan
                    </div>
                  ) : null}

                  {!selectMode ? (
                    <div
                      className="doc-actions no-print"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {inMyCustody ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-amber doc-actions-primary"
                            style={{ minHeight: 38 }}
                            onClick={() => setForwardTargets([doc])}
                          >
                            Forward
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{ minHeight: 38 }}
                            onClick={() => openDocument(doc.id)}
                          >
                            Open
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ minHeight: 38 }}
                          onClick={() => openDocument(doc.id)}
                        >
                          Track Status
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <PaginationBar
          totalItems={queueTab === 'tracked' ? filteredTracked.length : filteredDocs.length}
          page={queueTab === 'tracked' ? pagedTracked.safePage : pagedDocs.safePage}
          pageSize={queueTab === 'tracked' ? INBOX_TRACKED_PER_PAGE : INBOX_ITEMS_PER_PAGE}
          itemLabel={queueTab === 'tracked' ? 'tracked documents' : 'documents'}
          onPageChange={setPage}
          testId="web-inbox-pagination"
        />
      </div>

      <aside className="dashboard-right">
        <div className="card no-print" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="section-header-row">
            <h4 className="section-title" style={{ fontSize: 14 }}>
              Desk Queue Overview
            </h4>
            <span className="field-hint">{actor ? actor.office.code : 'Pre-Auth'}</span>
          </div>
          <div className="workload-grid">
            <button
              type="button"
              className="workload-tile"
              onClick={() => {
                setQueueTab('incoming');
                setChip('all');
                setPage(1);
              }}
            >
              <span className="workload-value">{counts.incoming}</span>
              <span className="workload-label">Awaiting Receipt</span>
            </button>
            <button
              type="button"
              className="workload-tile"
              onClick={() => {
                setQueueTab('in_progress');
                setChip('all');
                setPage(1);
              }}
            >
              <span className="workload-value">{counts.inProgress}</span>
              <span className="workload-label">In Progress</span>
            </button>
            <button
              type="button"
              className="workload-tile"
              onClick={() => {
                setQueueTab('returned');
                setChip('all');
                setPage(1);
              }}
            >
              <span className="workload-value">{counts.returned}</span>
              <span className="workload-label">Returned</span>
            </button>
            <button
              type="button"
              className="workload-tile"
              onClick={() => {
                setQueueTab('tracked');
                setChip('all');
                setPage(1);
              }}
            >
              <span className="workload-value">{counts.tracked}</span>
              <span className="workload-label">Tracked Docs</span>
            </button>
          </div>
        </div>

        <div className="card mobile-companion-card no-print" data-testid="web-mobile-companion-card">
          <div className="mobile-companion-head">
            <span className="hard-copy-sync-icon">
              <Smartphone size={16} />
            </span>
            <div>
              <h4 className="section-title" style={{ fontSize: 14 }}>
                Tracely Mobile Sync
              </h4>
              <p className="doc-meta" style={{ margin: 0, fontSize: 12 }}>
                Scan Soft Copy unlock QRs and printed slips with Tracely Mobile — Web updates live.
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-amber"
              style={{ flex: 1, minHeight: 36, fontSize: 12.5 }}
              onClick={() => navigate('send')}
            >
              <Send size={13} /> Send Document
            </button>
            <button
              type="button"
              className="btn btn-outline"
              style={{ flex: 1, minHeight: 36, fontSize: 12.5 }}
              onClick={() => navigate('track')}
            >
              <MapPin size={13} /> Track Docs
            </button>
          </div>
          {actor ? (
            <button
              type="button"
              className="btn btn-soft"
              data-testid="web-open-usb-batch-btn"
              style={{ width: '100%', minHeight: 34, fontSize: 12 }}
              onClick={openBatchUsbReceive}
            >
              <Keyboard size={13} /> USB Batch Receive (Hard Copies)
            </button>
          ) : null}
        </div>
      </aside>

      <TextReasonModal
        open={Boolean(declineTarget)}
        title="Flag Misrouted Transfer"
        subtitle="Return this sealed transfer to the sending office without unlocking its contents."
        actionLabel="Flag as Misrouted"
        onSubmit={async (reason) => {
          if (!declineTarget) return;
          await declineMisrouted(declineTarget.id, reason);
        }}
        onClose={() => setDeclineTarget(null)}
      />

      <ForwardModal
        open={Boolean(forwardTargets)}
        documents={forwardTargets ?? undefined}
        personnel={personnelDirectory}
        actorId={actor?.id}
        onForward={async (docId, recId, remarks) => {
          await forwardDocument(docId, recId, remarks);
          setSelectedIds([]);
          setSelectMode(false);
        }}
        onForwardBatch={async (docIds, recId, remarks) => {
          await batchForwardDocuments(docIds, recId, remarks);
          setSelectedIds([]);
          setSelectMode(false);
        }}
        onClose={() => setForwardTargets(null)}
      />
    </div>
  );
};
