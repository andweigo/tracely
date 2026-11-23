import React, { useMemo, useState } from 'react';
import { Archive, CheckCircle2, Search } from 'lucide-react';
import { DocumentRecord } from '../domain/types';
import { useWebApp } from '../state/WebAppContext';
import { CopyFormatBadge, TierBadge } from '../components/Badges';
import { paginateList, PaginationBar } from '../components/PaginationBar';
import { formatClockTime, formatCompactDate } from '../utils/formatters';

type CompletedFilter = 'all' | 'approved' | 'archived';
const COMPLETED_PER_PAGE = 15;

export function isCompletedDocument(doc: DocumentRecord): boolean {
  return doc.lifecycleStatus === 'approved' || doc.lifecycleStatus === 'archived';
}

export const CompletedPage: React.FC = () => {
  const { documents, openDocument } = useWebApp();
  const [filter, setFilter] = useState<CompletedFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const completed = useMemo(() => documents.filter(isCompletedDocument), [documents]);
  const counts = useMemo(
    () => ({
      all: completed.length,
      approved: completed.filter((d) => d.lifecycleStatus === 'approved').length,
      archived: completed.filter((d) => d.lifecycleStatus === 'archived').length,
    }),
    [completed],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return completed
      .filter((d) => filter === 'all' || d.lifecycleStatus === filter)
      .filter(
        (d) =>
          !q ||
          d.trackingCode.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          d.categoryName.toLowerCase().includes(q),
      );
  }, [completed, filter, query]);

  const paged = paginateList(filtered, page, COMPLETED_PER_PAGE);

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }} data-testid="web-completed-page">
      <div className="segmented-control" role="tablist" aria-label="Completed filter">
        {(
          [
            { id: 'all', label: `All (${counts.all})` },
            { id: 'approved', label: `Approved & Released (${counts.approved})` },
            { id: 'archived', label: `Archived (${counts.archived})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            className={`segment-btn ${filter === tab.id ? 'segment-btn-active' : ''}`}
            onClick={() => {
              setFilter(tab.id);
              setPage(1);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="search-wrap" style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
        <input
          className="input"
          style={{ paddingLeft: 34 }}
          aria-label="Search completed documents"
          placeholder="Search tracking code, title, or category"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrap">
            <CheckCircle2 size={22} />
          </div>
          <h4 className="empty-title">No completed documents yet</h4>
          <p className="empty-desc">
            Documents marked Approved &amp; Released or Archived move here automatically and leave your Inbox.
          </p>
        </div>
      ) : (
        <div className="card-list">
          {paged.pageItems.map((doc) => {
            const lastTx = doc.transactions[doc.transactions.length - 1];
            const when = lastTx?.receivedAt ?? lastTx?.sentAt ?? doc.createdAt;
            const approved = doc.lifecycleStatus === 'approved';
            return (
              <div
                key={doc.id}
                role="button"
                tabIndex={0}
                className="doc-card"
                data-testid={`completed-row-${doc.id}`}
                onClick={() => openDocument(doc.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') openDocument(doc.id);
                }}
              >
                <div className="doc-card-top">
                  <span className="mono doc-tracking-code">{doc.trackingCode}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className={approved ? 'pill pill-emerald' : 'pill pill-slate'}>
                      {approved ? <CheckCircle2 size={11} /> : <Archive size={11} />}
                      <span>{approved ? 'Approved & Released' : 'Archived · Closed'}</span>
                    </span>
                    <CopyFormatBadge format={doc.copyFormat} />
                    <TierBadge tier={doc.confidentialityTier} />
                  </div>
                </div>
                <h4 className="doc-title">{doc.title}</h4>
                <p className="doc-meta">
                  {doc.categoryName} · Finalized at {doc.currentOffice.code} · {formatCompactDate(when)}{' '}
                  {formatClockTime(when)}
                </p>
              </div>
            );
          })}
        </div>
      )}

      <PaginationBar
        totalItems={filtered.length}
        page={paged.safePage}
        pageSize={COMPLETED_PER_PAGE}
        itemLabel="completed documents"
        onPageChange={setPage}
        testId="web-completed-pagination"
      />
    </div>
  );
};
