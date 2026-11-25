import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Calendar,
  Download,
  FileText,
  FolderKanban,
  Pencil,
  Printer,
  QrCode,
  Search,
  Send,
} from 'lucide-react';
import { DocumentRecord } from '../domain/types';
import { useWebApp } from '../state/WebAppContext';
import { SlaBadge, TierBadge } from '../components/Badges';
import FuseButton from '../components/FuseButton';
import { BatchTransmittalModal, EditDocumentModal, OpaqueQrModal } from '../components/Modals';
import { PaginationBar } from '../components/PaginationBar';
import { buildSentCsv, downloadCsvFile } from '../utils/exportCsv';
import { formatClockTime, formatCompactDate, formatRelativeTime } from '../utils/formatters';
import {
  filterAndSortSentDocuments,
  paginateSentItems,
  selectSentDocuments,
  SentDateFilter,
  SentSortMode,
  SentStatusFilter,
} from '../utils/sentFilter';

const STATUS_META: Record<
  Exclude<SentStatusFilter, 'all'>,
  { label: string; pillClass: string }
> = {
  pending: { label: 'Sent · Awaiting Recipient Scan', pillClass: 'pill pill-amber' },
  acknowledged: { label: 'Received', pillClass: 'pill pill-emerald' },
  returned: { label: 'Returned / Declined', pillClass: 'pill pill-rose' },
  recalled: { label: 'Recalled', pillClass: 'pill pill-slate' },
  local: { label: 'Held Locally', pillClass: 'pill pill-sky' },
};

const DATE_OPTIONS: ReadonlyArray<{ id: SentDateFilter; label: string }> = [
  { id: 'all', label: 'All Dates' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
];

const SORT_OPTIONS: ReadonlyArray<{ id: SentSortMode; label: string }> = [
  { id: 'newest', label: 'Newest Sent' },
  { id: 'oldest', label: 'Oldest Sent' },
  { id: 'status_pending', label: 'Status (Pending First)' },
  { id: 'title_asc', label: 'Title (A–Z)' },
  { id: 'title_desc', label: 'Title (Z–A)' },
  { id: 'tracking_code', label: 'Tracking Code' },
];

const SENT_ITEMS_PER_PAGE = 15;

export const SentPage: React.FC = () => {
  const {
    actor,
    documents,
    categories,
    openDocument,
    navigate,
    recallTransfer,
    updateDocumentDetails,
    notify,
    isBusy,
  } = useWebApp();

  const [statusFilter, setStatusFilter] = useState<SentStatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<SentDateFilter>('all');
  const [sortMode, setSortMode] = useState<SentSortMode>('newest');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [qrDoc, setQrDoc] = useState<DocumentRecord | null>(null);
  const [editDoc, setEditDoc] = useState<DocumentRecord | null>(null);
  const [transmittalOpen, setTransmittalOpen] = useState(false);

  const allSent = useMemo(() => selectSentDocuments(documents, actor), [documents, actor]);

  const counts = useMemo(() => {
    let pending = 0;
    let acknowledged = 0;
    let returned = 0;
    let recalled = 0;
    let local = 0;
    for (const item of allSent) {
      if (item.status === 'pending') pending += 1;
      else if (item.status === 'acknowledged') acknowledged += 1;
      else if (item.status === 'returned') returned += 1;
      else if (item.status === 'recalled') recalled += 1;
      else if (item.status === 'local') local += 1;
    }
    return { total: allSent.length, pending, acknowledged, returned, recalled, local };
  }, [allSent]);

  const filteredAndSorted = useMemo(
    () =>
      filterAndSortSentDocuments(allSent, {
        statusFilter,
        dateFilter,
        query,
        sortMode,
      }),
    [allSent, statusFilter, dateFilter, query, sortMode],
  );

  const handleExportCsv = () => {
    if (filteredAndSorted.length === 0) {
      notify('info', 'No sent records match the current filters to export.');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsvFile(`tracely-sent-${stamp}.csv`, buildSentCsv(filteredAndSorted));
    notify('success', `Exported ${filteredAndSorted.length} sent record(s) to CSV.`);
  };

  const pagination = useMemo(
    () => paginateSentItems(filteredAndSorted, page, SENT_ITEMS_PER_PAGE),
    [filteredAndSorted, page],
  );

  const statusTabs: ReadonlyArray<{ id: SentStatusFilter; label: string; count: number }> = [
    { id: 'all', label: 'All Sent', count: counts.total },
    { id: 'pending', label: 'Awaiting Receipt', count: counts.pending },
    { id: 'acknowledged', label: 'Received', count: counts.acknowledged },
    { id: 'returned', label: 'Returned', count: counts.returned },
    { id: 'recalled', label: 'Recalled', count: counts.recalled },
    { id: 'local', label: 'Held Locally', count: counts.local },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="sent-stats-strip">
        <div className="sent-stat-card">
          <span className="sent-stat-label">Total Sent</span>
          <strong className="sent-stat-val tabular">{counts.total}</strong>
        </div>
        <div className="sent-stat-card">
          <span className="sent-stat-label">Awaiting Receipt</span>
          <strong className="sent-stat-val tabular" style={{ color: 'var(--amber-text)' }}>
            {counts.pending}
          </strong>
        </div>
        <div className="sent-stat-card">
          <span className="sent-stat-label">Received</span>
          <strong className="sent-stat-val tabular" style={{ color: 'var(--emerald-text)' }}>
            {counts.acknowledged}
          </strong>
        </div>
        <div className="sent-stat-card">
          <span className="sent-stat-label">Returned</span>
          <strong className="sent-stat-val tabular" style={{ color: 'var(--rose-text)' }}>
            {counts.returned}
          </strong>
        </div>
      </div>

      <div className="sent-controls-row">
        <div className="search-box" style={{ flex: 1, minWidth: 240 }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            aria-label="Search sent documents"
            className="search-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by code, title, file name, or recipient..."
          />
        </div>

        <label className="sent-select-wrap">
          <ArrowUpDown size={14} color="var(--text-secondary)" />
          <span className="sent-select-label">Sort</span>
          <select
            aria-label="Sort sent documents"
            className="sent-select"
            value={sortMode}
            onChange={(e) => {
              setSortMode(e.target.value as SentSortMode);
              setPage(1);
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="btn btn-outline"
          disabled={filteredAndSorted.length === 0}
          onClick={() => setTransmittalOpen(true)}
        >
          <Printer size={14} /> Transmittal Sheet
        </button>

        <button
          type="button"
          className="btn btn-outline"
          disabled={filteredAndSorted.length === 0}
          onClick={handleExportCsv}
        >
          <Download size={14} /> Export CSV
        </button>

        <button type="button" className="btn btn-primary" onClick={() => navigate('send')}>
          <Send size={14} /> New Dispatch
        </button>
      </div>

      <div className="sent-date-row" role="group" aria-label="Sent date range filter">
        <span className="sent-select-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Calendar size={13} color="var(--text-muted)" /> Date
        </span>
        {DATE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`sub-chip ${dateFilter === opt.id ? 'sub-chip-active' : ''}`}
            onClick={() => {
              setDateFilter(opt.id);
              setPage(1);
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="tab-scroll-row" role="tablist" aria-label="Sent status filter">
        {statusTabs.map((tab) => {
          const active = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`tab-pill ${active ? 'tab-pill-active' : ''}`}
              onClick={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
            >
              <span>{tab.label}</span>
              <span className="queue-pill-count tabular">{tab.count}</span>
            </button>
          );
        })}
      </div>

      {pagination.pageItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrap">
            <Send size={22} />
          </div>
          <h4 className="empty-title">
            {query.trim() || statusFilter !== 'all' || dateFilter !== 'all'
              ? 'No matching sent files'
              : 'No sent documents yet'}
          </h4>
          <p className="empty-desc">
            {query.trim() || statusFilter !== 'all' || dateFilter !== 'all'
              ? 'Try a different search or filter.'
              : 'Documents you send appear here.'}
          </p>
          <button type="button" className="btn btn-amber" onClick={() => navigate('send')}>
            Send Document
          </button>
        </div>
      ) : (
        <div className="card-list" data-testid="web-sent-list">
          {pagination.pageItems.map((item) => {
            const { doc, status, statusSummary, sentAt, recipientLabel, canRecall } = item;
            const statusMeta = STATUS_META[status];
            const latestVersion = doc.versions[doc.versions.length - 1] ?? null;

            return (
              <div
                key={doc.id}
                className="doc-card"
                style={{ cursor: 'default' }}
                data-testid={`sent-row-${doc.id}`}
              >
                <div className="doc-card-top">
                  <span className="mono doc-tracking-code">{doc.trackingCode}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className={statusMeta.pillClass}>{statusMeta.label}</span>
                    <TierBadge tier={doc.confidentialityTier} />
                    <SlaBadge state={doc.slaState} suffix={formatRelativeTime(doc.slaDueAt)} />
                  </div>
                </div>

                <h4 className="doc-title" style={{ marginTop: 2 }}>
                  {doc.title}
                </h4>

                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--navy)' }}>
                  {statusSummary}
                </div>

                <div className="doc-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
                  <span>
                    To: <strong>{recipientLabel}</strong>
                  </span>
                  <span>
                    {doc.categoryName} · {doc.copyFormat === 'hard_copy' ? 'Hard Copy' : 'Soft Copy'}
                  </span>
                  <span className="tabular">
                    {formatCompactDate(sentAt)} {formatClockTime(sentAt)}
                  </span>
                </div>

                {latestVersion ? (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <FileText size={13} color="var(--navy)" />
                    <span>{latestVersion.fileName}</span>
                    {doc.versions.length > 1 ? (
                      <span className="pill pill-slate" style={{ fontSize: 10 }}>
                        {doc.versions.length} versions
                      </span>
                    ) : null}
                  </div>
                ) : doc.physicalReference || doc.physicalPageCount ? (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    <FolderKanban size={13} color="var(--amber-text)" />
                    <span>
                      {[
                        doc.physicalReference,
                        doc.physicalPageCount ? `${doc.physicalPageCount} pages` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </div>
                ) : null}

                <div className="doc-actions" style={{ marginTop: 4 }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => openDocument(doc.id)}
                  >
                    Open
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setQrDoc(doc)}
                  >
                    <QrCode size={14} /> QR Slip
                  </button>
                  {canRecall ? (
                    <FuseButton
                      label="Recall"
                      undoLabel="Undo"
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
                      title="Pull back this pending transfer before the recipient scans the QR or confirms receipt. Click Undo (or press Escape) while the fuse burns to cancel."
                      testId={`sent-recall-fuse-${doc.id}`}
                      onCommit={() => {
                        void recallTransfer(doc.id);
                      }}
                      onUndo={() =>
                        notify('info', 'Recall cancelled — pending transfer remains active.')
                      }
                    />
                  ) : null}
                  {!canRecall &&
                  actor &&
                  doc.currentOffice.id === actor.office.id &&
                  (status === 'recalled' || status === 'returned' || status === 'local') ? (
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={isBusy}
                      onClick={() => setEditDoc(doc)}
                    >
                      <Pencil size={14} /> Edit Details
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PaginationBar
        totalItems={pagination.totalItems}
        page={pagination.safePage}
        pageSize={SENT_ITEMS_PER_PAGE}
        itemLabel="sent files"
        onPageChange={setPage}
        testId="web-sent-pagination"
      />

      {qrDoc ? (
        <OpaqueQrModal
          open={Boolean(qrDoc)}
          trackingCode={qrDoc.trackingCode}
          qrToken={qrDoc.qrToken}
          title={qrDoc.title}
          document={qrDoc}
          onClose={() => setQrDoc(null)}
        />
      ) : null}

      <BatchTransmittalModal
        open={transmittalOpen && filteredAndSorted.length > 0}
        documents={filteredAndSorted.map((item) => item.doc)}
        originLabel={actor ? `${actor.office.code} — ${actor.office.name}` : undefined}
        preparedBy={actor?.fullName}
        onClose={() => setTransmittalOpen(false)}
      />

      <EditDocumentModal
        open={Boolean(editDoc)}
        document={editDoc}
        categories={categories}
        isBusy={isBusy}
        onSave={async (patch) => {
          if (!editDoc) return;
          await updateDocumentDetails(editDoc.id, patch);
        }}
        onOpenRevisionUpload={() => {
          if (editDoc) openDocument(editDoc.id);
        }}
        onClose={() => setEditDoc(null)}
      />
    </div>
  );
};
