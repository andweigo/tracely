import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Inbox,
  MapPin,
  Search,
  Send,
  X,
} from 'lucide-react';
import { SlaBadge, TierBadge } from '../components/Badges';
import { CustodyJourneyRoad } from '../components/CustodyJourneyRoad';
import { Folder, FolderObjectItem } from '../components/Folder';
import { IdentityWalletCard } from '../components/IdentityWalletCard';
import { paginateList, PaginationBar } from '../components/PaginationBar';
import {
  buildLocalSentContributions,
  SentContributionGraph,
} from '../components/SentContributionGraph';
import { DocumentRecord, SentContributionReport } from '../domain/types';
import { useWebApp } from '../state/WebAppContext';
import { sortDocumentRecords } from '../utils/inboxFilter';
import { isPendingReceiptForActor, isPendingSentByActor } from '../utils/sentFilter';

type RoutingScopeFilter = 'user' | 'office';
type FolderGroupingMode = 'stage' | 'category';
type LedgerPeriodFilter = 'all' | 'today' | '7d' | '30d' | 'archive';
type LedgerFormatFilter = 'all' | 'soft' | 'hard';

const FOLDERS_PER_SHELF = 4;
const LEDGER_ITEMS_PER_PAGE = 15;

export function formatCompactCount(count: number): string {
  if (count >= 1_000_000) {
    const val = count / 1_000_000;
    return `${val >= 10 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    const val = count / 1_000;
    return `${val >= 100 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(count);
}

interface FolderSheetItem extends FolderObjectItem {
  readonly docId?: string;
  readonly isOverflowSheet?: boolean;
  readonly bucketId?: string;
}

interface OrganizerFolderBucket {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly subtitle: string;
  readonly color: string;
  readonly totalCount: number;
  readonly overflowCount: number;
  readonly allDocs: ReadonlyArray<DocumentRecord>;
  readonly items: ReadonlyArray<FolderSheetItem>;
}

const FOLDER_PALETTE = ['#0ea5e9', '#f59e0b', '#6366f1', '#10b981', '#ec4899', '#8b5cf6'];

function getDocumentTimestampMs(doc: DocumentRecord): number {
  const latestTx = doc.transactions[doc.transactions.length - 1];
  const raw = latestTx?.receivedAt ?? latestTx?.sentAt ?? doc.createdAt;
  if (!raw) return 0;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export const DashboardPage: React.FC = () => {
  const {
    actor,
    documents,
    categories,
    folderAppearance,
    getSentContributions,
    openDocument,
    navigate,
  } = useWebApp();

  const [flowScope, setFlowScope] = useState<RoutingScopeFilter>('office');
  const [selectedJourneyDocId, setSelectedJourneyDocId] = useState<string | null>(null);
  const [serverContributions, setServerContributions] = useState<SentContributionReport | null>(
    null,
  );

  const localContributions = useMemo(
    () => buildLocalSentContributions(documents, actor),
    [documents, actor],
  );

  const actorId = actor?.id ?? null;
  useEffect(() => {
    if (!actorId) {
      setServerContributions(null);
      return;
    }
    let cancelled = false;
    getSentContributions()
      .then((report) => {
        if (!cancelled) setServerContributions(report);
      })
      .catch(() => {
        // Keep local fallback cleanly when offline
      });
    return () => {
      cancelled = true;
    };
  }, [actorId, documents.length, getSentContributions]);

  const contributionReport = serverContributions ?? localContributions;

  const [folderGroupMode, setFolderGroupMode] = useState<FolderGroupingMode>('stage');
  const [selectedFolderDoc, setSelectedFolderDoc] = useState<DocumentRecord | null>(null);

  // High-scale shelf pagination & searchable folder ledger state
  const [shelfPage, setShelfPage] = useState(1);
  const [categoryShelfQuery, setCategoryShelfQuery] = useState('');
  const [activeLedgerBucketId, setActiveLedgerBucketId] = useState<string | null>(null);
  const [ledgerQuery, setLedgerQuery] = useState('');
  const [ledgerPeriod, setLedgerPeriod] = useState<LedgerPeriodFilter>('all');
  const [ledgerFormat, setLedgerFormat] = useState<LedgerFormatFilter>('all');
  const [ledgerPage, setLedgerPage] = useState(1);

  // Per-user ("My Sent") vs Per-office ("My Office") sent dispatches — never All Offices
  const myUserSentDocs = useMemo(() => {
    if (!actor) return [];
    return documents.filter(
      (doc) =>
        doc.originUserId === actor.id ||
        doc.transactions.some(
          (tx) => tx.fromUserId === actor.id || tx.fromUserName === actor.fullName,
        ),
    );
  }, [documents, actor]);

  const myOfficeSentDocs = useMemo(() => {
    if (!actor) return [];
    return documents.filter(
      (doc) =>
        doc.originOffice.id === actor.office.id ||
        doc.transactions.some((tx) => tx.fromOffice.id === actor.office.id),
    );
  }, [documents, actor]);

  const scopedDocuments = flowScope === 'user' ? myUserSentDocs : myOfficeSentDocs;

  const journeyDocuments = useMemo(
    () =>
      [...scopedDocuments]
        .sort((a, b) => getDocumentTimestampMs(b) - getDocumentTimestampMs(a))
        .slice(0, 5),
    [scopedDocuments],
  );

  const activeJourneyDoc = useMemo(() => {
    if (journeyDocuments.length === 0) return null;
    if (selectedJourneyDocId) {
      const found = journeyDocuments.find((d) => d.id === selectedJourneyDocId);
      if (found) return found;
    }
    return journeyDocuments[0];
  }, [journeyDocuments, selectedJourneyDocId]);

  // Build High-Scale 3D Folder Organizer buckets:
  // - Sorts by SLA urgency so the top physical sheets inside each 3D folder are the highest-priority records
  // - Caps physical 3D DOM sheets at 6: if a folder holds >6 documents (up to 100,000+),
  //   Sheets 1-5 are the top 5 priority documents and Sheet 6 is an interactive "+N more records" overflow sheet
  const allFolderBuckets = useMemo<ReadonlyArray<OrganizerFolderBucket>>(() => {
    const buildBucket = (params: {
      id: string;
      code: string;
      subtitle: string;
      color: string;
      docs: ReadonlyArray<DocumentRecord>;
    }): OrganizerFolderBucket => {
      const sortedDocs = sortDocumentRecords([...params.docs], 'sla_urgent');
      const totalCount = sortedDocs.length;
      const hasOverflow = totalCount > 6;
      const previewDocs = hasOverflow ? sortedDocs.slice(0, 5) : sortedDocs.slice(0, 6);
      const overflowCount = hasOverflow ? totalCount - 5 : 0;

      const docItems: FolderSheetItem[] = previewDocs.map((doc) => ({
        id: doc.id,
        docId: doc.id,
        bucketId: params.id,
        title: doc.isSealed ? `Sealed · ${doc.trackingCode}` : doc.title,
        description: `${doc.trackingCode} · ${doc.currentOffice.code} · ${
          doc.copyFormat === 'hard_copy' ? 'Hard Copy' : 'Soft Copy'
        }`,
      }));

      if (hasOverflow) {
        docItems.push({
          id: `${params.id}-overflow`,
          bucketId: params.id,
          isOverflowSheet: true,
          title: `+${overflowCount.toLocaleString()} more records`,
          description: 'Click to open searchable & paginated folder ledger →',
        });
      }

      if (docItems.length === 0) {
        docItems.push({
          id: `${params.id}-empty`,
          bucketId: params.id,
          title: `0 in ${params.code}`,
          description: params.subtitle,
        });
      }

      return {
        id: params.id,
        code: params.code,
        label: `${params.code} (${formatCompactCount(totalCount)})`,
        subtitle: params.subtitle,
        color: params.color,
        totalCount,
        overflowCount,
        allDocs: sortedDocs,
        items: docItems,
      };
    };

    if (folderGroupMode === 'category') {
      const byCategory = new Map<
        string,
        { code: string; name: string; docs: DocumentRecord[] }
      >();
      for (const cat of categories) {
        byCategory.set(cat.id, { code: cat.code, name: cat.name, docs: [] });
      }
      for (const doc of documents) {
        let group = byCategory.get(doc.categoryId);
        if (!group) {
          group = {
            code: doc.categoryName.slice(0, 8).toUpperCase(),
            name: doc.categoryName,
            docs: [],
          };
          byCategory.set(doc.categoryId, group);
        }
        group.docs.push(doc);
      }

      const q = categoryShelfQuery.trim().toLowerCase();
      return Array.from(byCategory.entries())
        .filter(([, group]) => {
          if (!q) return true;
          return (
            group.code.toLowerCase().includes(q) || group.name.toLowerCase().includes(q)
          );
        })
        .sort((a, b) => b[1].docs.length - a[1].docs.length)
        .map(([catId, group], idx) =>
          buildBucket({
            id: `cat-${catId}`,
            code: group.code,
            subtitle: group.name,
            color: FOLDER_PALETTE[idx % FOLDER_PALETTE.length],
            docs: group.docs,
          }),
        );
    }

    const incomingDocs = actor
      ? documents.filter((d) => isPendingReceiptForActor(d, actor))
      : [];
    const activeDeskDocs = actor
      ? documents.filter(
          (d) =>
            d.currentOffice.id === actor.office.id &&
            !isPendingReceiptForActor(d, actor) &&
            !isPendingSentByActor(d, actor) &&
            d.lifecycleStatus !== 'approved' &&
            d.lifecycleStatus !== 'archived',
        )
      : documents.filter(
          (d) => d.lifecycleStatus !== 'approved' && d.lifecycleStatus !== 'archived',
        );
    const sentTransitDocs = actor
      ? documents.filter(
          (d) =>
            d.originOffice.id === actor.office.id || isPendingSentByActor(d, actor),
        )
      : [];
    const completedDocs = documents.filter(
      (d) => d.lifecycleStatus === 'approved' || d.lifecycleStatus === 'archived',
    );

    const stages = [
      {
        id: 'stage-incoming',
        code: 'Incoming',
        subtitle: 'Awaiting receipt',
        color: '#f59e0b',
        docs: incomingDocs,
      },
      {
        id: 'stage-desk',
        code: 'On My Desk',
        subtitle: 'In review',
        color: '#0ea5e9',
        docs: activeDeskDocs,
      },
      {
        id: 'stage-sent',
        code: 'Dispatched',
        subtitle: 'Sent by office',
        color: '#6366f1',
        docs: sentTransitDocs,
      },
      {
        id: 'stage-completed',
        code: 'Completed',
        subtitle: 'Done',
        color: '#10b981',
        docs: completedDocs,
      },
    ];

    return stages.map((st) => buildBucket(st));
  }, [actor, categories, documents, folderGroupMode, categoryShelfQuery]);

  // Paginate the 3D Folder Shelf so at most 4 3D <Folder /> components are mounted at once
  const pagedShelf = useMemo(
    () => paginateList(allFolderBuckets, shelfPage, FOLDERS_PER_SHELF),
    [allFolderBuckets, shelfPage],
  );

  // Active Folder Contents Ledger (Searchable + Date-Partitioned + Paginated for 100K+ scale)
  const activeLedgerBucket = useMemo(() => {
    if (!activeLedgerBucketId) return null;
    return allFolderBuckets.find((b) => b.id === activeLedgerBucketId) ?? null;
  }, [allFolderBuckets, activeLedgerBucketId]);

  const filteredLedgerDocs = useMemo(() => {
    if (!activeLedgerBucket) return [];
    const q = ledgerQuery.trim().toLowerCase();
    const nowMs = Date.now();
    const dayMs = 86_400_000;

    return activeLedgerBucket.allDocs.filter((doc) => {
      if (ledgerFormat === 'soft' && doc.copyFormat === 'hard_copy') return false;
      if (ledgerFormat === 'hard' && doc.copyFormat !== 'hard_copy') return false;

      if (ledgerPeriod !== 'all') {
        const docMs = getDocumentTimestampMs(doc);
        if (docMs > 0) {
          const ageMs = Math.max(0, nowMs - docMs);
          if (ledgerPeriod === 'today' && ageMs > dayMs) return false;
          if (ledgerPeriod === '7d' && ageMs > 7 * dayMs) return false;
          if (ledgerPeriod === '30d' && ageMs > 30 * dayMs) return false;
          if (ledgerPeriod === 'archive' && ageMs <= 30 * dayMs) return false;
        }
      }

      if (!q) return true;
      const visibleTitle = doc.isSealed ? 'sealed transfer' : doc.title.toLowerCase();
      return (
        doc.trackingCode.toLowerCase().includes(q) ||
        visibleTitle.includes(q) ||
        doc.categoryName.toLowerCase().includes(q) ||
        doc.currentOffice.code.toLowerCase().includes(q) ||
        doc.currentOffice.name.toLowerCase().includes(q)
      );
    });
  }, [activeLedgerBucket, ledgerQuery, ledgerPeriod, ledgerFormat]);

  const pagedLedgerDocs = useMemo(
    () => paginateList(filteredLedgerDocs, ledgerPage, LEDGER_ITEMS_PER_PAGE),
    [filteredLedgerDocs, ledgerPage],
  );

  const openFolderLedger = (bucketId: string) => {
    setActiveLedgerBucketId(bucketId);
    setLedgerQuery('');
    setLedgerPeriod('all');
    setLedgerFormat('all');
    setLedgerPage(1);
  };

  const activeCustodyCount = useMemo(
    () =>
      documents.filter(
        (d) => d.lifecycleStatus !== 'approved' && d.lifecycleStatus !== 'archived',
      ).length,
    [documents],
  );
  const completedCustodyCount = useMemo(
    () =>
      documents.filter(
        (d) => d.lifecycleStatus === 'approved' || d.lifecycleStatus === 'archived',
      ).length,
    [documents],
  );

  return (
    <div
      className="dashboard-screen"
      data-testid="web-dashboard-page"
      style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '4px 0 24px' }}
    >
      {/* SECTION 0: User Identity & Desk Pass */}
      <section
        style={{
          paddingBottom: 18,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <IdentityWalletCard
          testId="web-dashboard-wallet-card"
          fullName={actor?.fullName ?? 'Tracely Operator'}
          employeeId={actor?.employeeId ?? 'EMP-2026-0001'}
          position={actor?.position ?? 'Records Officer'}
          officeCode={actor?.office.code ?? 'RECORDS'}
          officeName={actor?.office.name ?? 'Records & Registry'}
          roleLabel={actor?.roleLabel ?? 'Records Officer'}
          email={actor?.email}
          accentColor={actor?.avatarColor}
          activeDocsCount={activeCustodyCount}
          completedDocsCount={completedCustodyCount}
          actionLabel="Send Document"
          onActionClick={() => navigate('send')}
          defaultMasked={true}
          lanyardHeight={260}
        />
      </section>

      {/* SECTION 1: Top 5 Recent Document Tracking */}
      <section
        data-testid="web-routing-flow-analytics"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          paddingBottom: 18,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--text-main)',
            }}
          >
            Recent Tracking
          </h3>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: 3,
              borderRadius: 10,
              border: '1px solid var(--border)',
            }}
          >
            <button
              type="button"
              data-testid="flow-scope-user"
              onClick={() => {
                setFlowScope('user');
                setSelectedJourneyDocId(null);
              }}
              style={{
                border: 'none',
                borderRadius: 7,
                padding: '5px 11px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: flowScope === 'user' ? 'var(--text-main)' : 'transparent',
                color: flowScope === 'user' ? 'var(--bg-surface)' : 'var(--text-muted)',
              }}
            >
              My Sent ({formatCompactCount(myUserSentDocs.length)})
            </button>
            <button
              type="button"
              data-testid="flow-scope-office"
              onClick={() => {
                setFlowScope('office');
                setSelectedJourneyDocId(null);
              }}
              style={{
                border: 'none',
                borderRadius: 7,
                padding: '5px 11px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: flowScope === 'office' ? 'var(--text-main)' : 'transparent',
                color: flowScope === 'office' ? 'var(--bg-surface)' : 'var(--text-muted)',
              }}
            >
              My Office ({formatCompactCount(myOfficeSentDocs.length)})
            </button>
          </div>
        </div>

        {journeyDocuments.length > 0 ? (
          <div className="custody-doc-strip" role="tablist" aria-label="Select recent document">
            {journeyDocuments.map((doc) => {
              const isSelected = activeJourneyDoc?.id === doc.id;
              const isCompleted =
                doc.lifecycleStatus === 'approved' || doc.lifecycleStatus === 'archived';
              const hasPending = doc.transactions.some((tx) => tx.status === 'pending');
              const dotColor = isCompleted
                ? '#059669'
                : hasPending || doc.lifecycleStatus === 'in_transit'
                  ? '#D97706'
                  : doc.lifecycleStatus === 'returned_for_revision'
                    ? '#E11D48'
                    : '#0284C7';
              const pillLabel = doc.isSealed ? 'Sealed Document' : doc.title;
              return (
                <button
                  key={doc.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  data-testid={`custody-doc-pill-${doc.id}`}
                  className={`custody-doc-pill ${isSelected ? 'is-active' : ''}`}
                  onClick={() => setSelectedJourneyDocId(doc.id)}
                  title={pillLabel}
                >
                  <span className="custody-doc-pill-dot" style={{ background: dotColor }} />
                  <span className="custody-doc-pill-title">{pillLabel}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {!activeJourneyDoc ? (
          <div
            style={{
              padding: '32px 12px',
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--text-muted)',
            }}
          >
            {flowScope === 'user'
              ? 'No documents sent by you yet.'
              : 'No documents sent by your office yet.'}
          </div>
        ) : (
          <CustodyJourneyRoad document={activeJourneyDoc} onOpenDocument={openDocument} />
        )}
      </section>

      {/* SECTION 1B: Daily Sent Contributions Graph (GitHub-style) */}
      <section
        style={{
          paddingBottom: 18,
          borderBottom: '1px solid var(--border)',
        }}
      >
        <SentContributionGraph
          report={contributionReport}
          scope={flowScope}
          onScopeChange={(next) => {
            setFlowScope(next);
            setSelectedJourneyDocId(null);
          }}
          testId="web-dashboard-sent-contributions"
        />
      </section>

      {/* SECTION 2: Folders */}
      <section
        data-testid="web-folder-organizer"
        style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--text-main)',
              }}
            >
              Folders
            </h3>
            <button
              type="button"
              onClick={() => navigate('settings')}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: '3px 8px',
                fontSize: 11,
                fontWeight: 600,
                background: 'var(--surface)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Style
            </button>
          </div>

          {/* Grouping Control (Appearance options now live in Settings) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                padding: 3,
                borderRadius: 9,
                border: '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                data-testid="folder-group-stage"
                onClick={() => {
                  setFolderGroupMode('stage');
                  setShelfPage(1);
                }}
                style={{
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: folderGroupMode === 'stage' ? 'var(--text-main)' : 'transparent',
                  color: folderGroupMode === 'stage' ? 'var(--bg-surface)' : 'var(--text-muted)',
                }}
              >
                By Stage
              </button>
              <button
                type="button"
                data-testid="folder-group-category"
                onClick={() => {
                  setFolderGroupMode('category');
                  setShelfPage(1);
                }}
                style={{
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: folderGroupMode === 'category' ? 'var(--text-main)' : 'transparent',
                  color:
                    folderGroupMode === 'category' ? 'var(--bg-surface)' : 'var(--text-muted)',
                }}
              >
                By Category ({categories.length})
              </button>
            </div>
          </div>
        </div>

        {/* Category Shelf Filter & Shelf Pagination Bar (when browsing many categories) */}
        {folderGroupMode === 'category' || allFolderBuckets.length > FOLDERS_PER_SHELF ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            {folderGroupMode === 'category' ? (
              <div className="search-box" style={{ maxWidth: 280, minHeight: 34 }}>
                <Search size={14} />
                <input
                  className="search-input"
                  value={categoryShelfQuery}
                  onChange={(e) => {
                    setCategoryShelfQuery(e.target.value);
                    setShelfPage(1);
                  }}
                  placeholder="Filter category folders..."
                  aria-label="Filter category folders"
                />
              </div>
            ) : (
              <span />
            )}

            {pagedShelf.totalPages > 1 ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  Folder Shelf {pagedShelf.safePage} / {pagedShelf.totalPages}
                </span>
                <button
                  type="button"
                  className="btn btn-soft"
                  style={{ minHeight: 30, padding: '3px 8px' }}
                  disabled={pagedShelf.safePage <= 1}
                  onClick={() => setShelfPage((p) => Math.max(1, p - 1))}
                  aria-label="Previous folder shelf"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  className="btn btn-soft"
                  style={{ minHeight: 30, padding: '3px 8px' }}
                  disabled={pagedShelf.safePage >= pagedShelf.totalPages}
                  onClick={() => setShelfPage((p) => Math.min(pagedShelf.totalPages, p + 1))}
                  aria-label="Next folder shelf"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Selected Document Quick Action Bar when a user clicks a page inside any folder */}
        {selectedFolderDoc ? (
          <div
            data-testid="web-folder-selected-doc"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                  {selectedFolderDoc.isSealed
                    ? 'Sealed Document'
                    : selectedFolderDoc.title}
                </div>
                <div
                  style={{
                    fontSize: 11.5,
                    color: 'var(--text-muted)',
                  }}
                >
                  {selectedFolderDoc.categoryName} · {selectedFolderDoc.currentOffice.name}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ minHeight: 32, padding: '4px 12px', fontSize: 12 }}
                onClick={() => openDocument(selectedFolderDoc.id)}
              >
                View <ArrowUpRight size={13} />
              </button>
              <button
                type="button"
                className="btn btn-soft"
                style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
                onClick={() => setSelectedFolderDoc(null)}
              >
                Close
              </button>
            </div>
          </div>
        ) : null}

        {/* Folders Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(236px, 1fr))',
            gap: 40,
            padding: '42px 16px 28px',
            justifyItems: 'center',
          }}
        >
          {pagedShelf.pageItems.map((bucket) => {
            const isLedgerActive = activeLedgerBucket?.id === bucket.id;
            return (
              <div
                key={bucket.id}
                data-testid={`organizer-folder-${bucket.id}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <Folder
                  label={bucket.label}
                  color={bucket.color}
                  mode={folderAppearance.mode}
                  variant={folderAppearance.variant}
                  layout={folderAppearance.layout}
                  size={0.86}
                  theme="light"
                  intro={false}
                  items={bucket.items}
                  onItemClick={(item) => {
                    if (item && typeof item === 'object') {
                      if ('isOverflowSheet' in item && item.isOverflowSheet) {
                        openFolderLedger(bucket.id);
                        return;
                      }
                      if ('docId' in item && item.docId) {
                        const matched = documents.find((d) => d.id === item.docId) ?? null;
                        setSelectedFolderDoc(matched);
                      }
                    }
                  }}
                />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                    {bucket.code} ({bucket.totalCount.toLocaleString()})
                  </div>
                  <button
                    type="button"
                    data-testid={`open-folder-ledger-${bucket.id}`}
                    onClick={() =>
                      isLedgerActive ? setActiveLedgerBucketId(null) : openFolderLedger(bucket.id)
                    }
                    style={{
                      marginTop: 4,
                      background: 'none',
                      border: 'none',
                      padding: '2px 6px',
                      fontSize: 11.5,
                      fontWeight: 700,
                      color: isLedgerActive ? '#0ea5e9' : 'var(--primary)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <FolderOpen size={12} />
                    {isLedgerActive
                      ? 'Hide list'
                      : `View all (${formatCompactCount(bucket.totalCount)})`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* High-Scale Searchable, Time-Partitioned & Paginated Folder Contents Ledger */}
        {activeLedgerBucket ? (
          <div
            data-testid="web-folder-ledger"
            style={{
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#0ea5e9',
                  }}
                >
                  <FolderOpen size={13} />
                  <span>Folder Contents Ledger</span>
                  <span>·</span>
                  <span>{activeLedgerBucket.totalCount.toLocaleString()} Total Records</span>
                </div>
                <h4
                  style={{
                    margin: '2px 0 0',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--text-main)',
                  }}
                >
                  {activeLedgerBucket.code} — {activeLedgerBucket.subtitle}
                </h4>
              </div>

              <button
                type="button"
                className="btn btn-soft"
                style={{ minHeight: 30, padding: '4px 10px', fontSize: 11.5 }}
                onClick={() => setActiveLedgerBucketId(null)}
              >
                <X size={13} /> Close Ledger
              </button>
            </div>

            {/* Scoped Search + Time-Period Partition Chips + Format Filter */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div className="search-box" style={{ flex: '1 1 240px', maxWidth: 360, minHeight: 34 }}>
                <Search size={14} />
                <input
                  className="search-input"
                  aria-label="Search folder ledger"
                  value={ledgerQuery}
                  onChange={(e) => {
                    setLedgerQuery(e.target.value);
                    setLedgerPage(1);
                  }}
                  placeholder={`Search inside ${activeLedgerBucket.code} by code, title, or office...`}
                />
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                {(
                  [
                    { id: 'all', label: 'All Time' },
                    { id: 'today', label: 'Today' },
                    { id: '7d', label: 'Last 7 Days' },
                    { id: '30d', label: 'Last 30 Days' },
                    { id: 'archive', label: 'Older Archive (>30d)' },
                  ] as const
                ).map((period) => (
                  <button
                    key={period.id}
                    type="button"
                    className={`sub-chip ${ledgerPeriod === period.id ? 'sub-chip-active' : ''}`}
                    onClick={() => {
                      setLedgerPeriod(period.id);
                      setLedgerPage(1);
                    }}
                  >
                    {period.label}
                  </button>
                ))}

                {(
                  [
                    { id: 'all', label: 'All Formats' },
                    { id: 'soft', label: 'Soft Copy' },
                    { id: 'hard', label: 'Hard Copy' },
                  ] as const
                ).map((fmt) => (
                  <button
                    key={fmt.id}
                    type="button"
                    className={`sub-chip ${ledgerFormat === fmt.id ? 'sub-chip-active' : ''}`}
                    onClick={() => {
                      setLedgerFormat(fmt.id);
                      setLedgerPage(1);
                    }}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Paginated Hairline Document Table (15 rows max in DOM) */}
            {pagedLedgerDocs.pageItems.length === 0 ? (
              <div
                style={{
                  padding: '18px 0',
                  fontSize: 12.5,
                  color: 'var(--text-muted)',
                  borderTop: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                No records in this folder match the active search or date partition.
              </div>
            ) : (
              <div style={{ borderTop: '1px solid var(--border)' }}>
                {pagedLedgerDocs.pageItems.map((doc) => (
                  <div
                    key={doc.id}
                    role="button"
                    tabIndex={0}
                    data-testid={`folder-ledger-row-${doc.id}`}
                    onClick={() => openDocument(doc.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openDocument(doc.id);
                      }
                    }}
                    style={{
                      padding: '9px 4px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {doc.isSealed
                          ? 'Sealed Transfer (Protected Until Receipt)'
                          : doc.title}
                      </div>
                      <div
                        style={{
                          fontSize: 11.5,
                          fontFamily: 'monospace',
                          color: 'var(--text-muted)',
                          marginTop: 2,
                        }}
                      >
                        {doc.trackingCode} · {doc.categoryName} · Desk: {doc.currentOffice.code}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <TierBadge tier={doc.confidentialityTier} />
                      <SlaBadge state={doc.slaState} />
                      <span
                        style={{
                          fontSize: 11,
                          fontFamily: 'monospace',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {doc.copyFormat === 'hard_copy' ? 'Hard Copy' : 'Soft Copy'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <PaginationBar
              totalItems={filteredLedgerDocs.length}
              page={pagedLedgerDocs.safePage}
              pageSize={LEDGER_ITEMS_PER_PAGE}
              itemLabel="folder documents"
              onPageChange={setLedgerPage}
              testId="web-folder-ledger-pagination"
            />
          </div>
        ) : null}

        {/* Footer Quick Navigation Actions */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 8,
            paddingTop: 14,
            borderTop: '1px solid var(--border)',
          }}
        >
          <button
            type="button"
            className="btn btn-soft"
            style={{ minHeight: 34, padding: '4px 12px', fontSize: 12 }}
            onClick={() => navigate('inbox')}
          >
            <Inbox size={13} /> Inbox
          </button>
          <button
            type="button"
            className="btn btn-soft"
            style={{ minHeight: 34, padding: '4px 12px', fontSize: 12 }}
            onClick={() => navigate('track')}
          >
            <MapPin size={13} /> Track Docs
          </button>
          <button
            type="button"
            className="btn btn-amber"
            style={{ minHeight: 34, padding: '4px 12px', fontSize: 12 }}
            onClick={() => navigate('send')}
          >
            <Send size={13} /> Send
          </button>
        </div>
      </section>
    </div>
  );
};
