import React, { useMemo, useState } from 'react';
import { ArrowLeft, Download, MapPin, Printer, Search, X } from 'lucide-react';
import { DocumentLifecycleStatus, DocumentTrackingSnapshot } from '../domain/types';
import { useWebApp } from '../state/WebAppContext';
import { paginateList, PaginationBar } from '../components/PaginationBar';
import { TrackingLocationCard } from '../components/TrackingLocationCard';
import { buildTrackedCsv, downloadCsvFile } from '../utils/exportCsv';

type TrackScope = 'all' | 'active' | 'completed';

const COMPLETED_STATUSES: ReadonlySet<DocumentLifecycleStatus> = new Set(['approved', 'archived']);
const TRACK_ITEMS_PER_PAGE = 10;

export const TrackPage: React.FC = () => {
  const { actor, trackedSnapshots, trackByCode, openDocument, navigate, isBusy } = useWebApp();

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<TrackScope>('all');
  const [page, setPage] = useState(1);
  const [lookupResult, setLookupResult] = useState<DocumentTrackingSnapshot | null>(null);

  const activeCount = useMemo(
    () => trackedSnapshots.filter((s) => !COMPLETED_STATUSES.has(s.lifecycleStatus)).length,
    [trackedSnapshots],
  );
  const completedCount = useMemo(
    () => trackedSnapshots.filter((s) => COMPLETED_STATUSES.has(s.lifecycleStatus)).length,
    [trackedSnapshots],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trackedSnapshots.filter((snap) => {
      const completed = COMPLETED_STATUSES.has(snap.lifecycleStatus);
      if (scope === 'active' && completed) return false;
      if (scope === 'completed' && !completed) return false;
      if (!q) return true;
      return (
        snap.trackingCode.toLowerCase().includes(q) ||
        snap.displayTitle.toLowerCase().includes(q) ||
        snap.currentOffice.code.toLowerCase().includes(q) ||
        snap.currentOffice.name.toLowerCase().includes(q)
      );
    });
  }, [trackedSnapshots, scope, query]);

  const pagedTracked = useMemo(
    () => paginateList(filtered, page, TRACK_ITEMS_PER_PAGE),
    [filtered, page],
  );

  const handleServerLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || isBusy) return;
    const found = await trackByCode(trimmed);
    if (found) {
      setLookupResult(found);
    }
  };

  const officeCode = actor?.office.code ?? 'Your Office';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <form className="search-filter-row" onSubmit={handleServerLookup}>
        <div className="search-box" style={{ flex: 1 }}>
          <Search size={16} />
          <input
            className="search-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Filter office dispatches or enter tracking code..."
            aria-label="Search tracking code or title"
          />
          {query ? (
            <button
              type="button"
              className="btn-icon-inline"
              aria-label="Clear search"
              onClick={() => {
                setQuery('');
                setPage(1);
              }}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'inline-flex',
                padding: 4,
              }}
            >
              <X size={15} />
            </button>
          ) : null}
        </div>
        <button type="submit" className="btn btn-primary" disabled={isBusy}>
          Lookup Code
        </button>
      </form>

      <div className="tab-scroll-row" role="tablist" aria-label="Tracking stage filter">
        <button
          type="button"
          className={`tab-pill ${scope === 'all' ? 'tab-pill-active' : ''}`}
          onClick={() => {
            setScope('all');
            setPage(1);
          }}
        >
          All Office Docs <span className="tab-count">{trackedSnapshots.length}</span>
        </button>
        <button
          type="button"
          className={`tab-pill ${scope === 'active' ? 'tab-pill-active' : ''}`}
          onClick={() => {
            setScope('active');
            setPage(1);
          }}
        >
          Active Routing <span className="tab-count">{activeCount}</span>
        </button>
        <button
          type="button"
          className={`tab-pill ${scope === 'completed' ? 'tab-pill-active' : ''}`}
          onClick={() => {
            setScope('completed');
            setPage(1);
          }}
        >
          Completed <span className="tab-count">{completedCount}</span>
        </button>
      </div>

      {lookupResult ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="section-header-row">
            <h3 className="section-title">Live Server Lookup</h3>
            <button
              type="button"
              className="btn btn-soft"
              style={{ minHeight: 34, padding: '4px 12px', fontSize: 12 }}
              onClick={() => setLookupResult(null)}
            >
              <ArrowLeft size={13} /> Back to {officeCode} list
            </button>
          </div>
          <TrackingLocationCard
            snapshot={lookupResult}
            defaultExpanded
            onOpenDocument={openDocument}
          />
        </div>
      ) : (
        <>
          <div className="section-header-row">
            <h3 className="section-title">
              Where {officeCode} docs are ({filtered.length})
            </h3>
            {filtered.length > 0 ? (
              <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-soft"
                  style={{ minHeight: 34, padding: '4px 12px', fontSize: 12 }}
                  onClick={() => {
                    const datePart = new Date().toISOString().slice(0, 10);
                    downloadCsvFile(`tracely-tracked-${datePart}.csv`, buildTrackedCsv(filtered));
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
              </div>
            ) : null}
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon-wrap">
                <MapPin size={22} />
              </div>
              <h4 className="empty-title">
                {query.trim()
                  ? `No matches for "${query.trim()}"`
                  : actor
                    ? 'No tracked office documents yet'
                    : 'Track Any Document Location'}
              </h4>
              <p className="empty-desc">
                {query.trim()
                  ? 'Click Lookup Code above to query the live Tracely server for this exact tracking code.'
                  : actor
                    ? 'Documents originated or forwarded by your office appear here with live timestamps.'
                    : 'Enter a document tracking code above to look up live custody status.'}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                {query.trim() ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => handleServerLookup()}
                  >
                    Lookup on Server
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-amber"
                    onClick={() => navigate('send')}
                  >
                    Send Document
                  </button>
                )}
              </div>
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
          )}

          <PaginationBar
            totalItems={filtered.length}
            page={pagedTracked.safePage}
            pageSize={TRACK_ITEMS_PER_PAGE}
            itemLabel="tracked documents"
            onPageChange={setPage}
            testId="web-track-pagination"
          />
        </>
      )}
    </div>
  );
};
