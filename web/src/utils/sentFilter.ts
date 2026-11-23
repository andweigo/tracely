import { DocumentRecord, Personnel, RoutingTransaction } from '../domain/types';
import { formatClockTime, formatElapsedTime } from './formatters';

export type SentStatusFilter =
  | 'all'
  | 'pending'
  | 'acknowledged'
  | 'returned'
  | 'recalled'
  | 'local';

export type SentDateFilter = 'all' | 'today' | 'week' | 'month';

export type SentSortMode =
  | 'newest'
  | 'oldest'
  | 'title_asc'
  | 'title_desc'
  | 'status_pending'
  | 'tracking_code';

export interface SentDocumentItem {
  readonly doc: DocumentRecord;
  readonly latestOutboundTx: RoutingTransaction | null;
  readonly sentAt: string;
  readonly status: Exclude<SentStatusFilter, 'all'>;
  readonly statusSummary: string;
  readonly recipientLabel: string;
  readonly canRecall: boolean;
}

export interface PaginatedResult<T> {
  readonly pageItems: ReadonlyArray<T>;
  readonly safePage: number;
  readonly totalPages: number;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly totalItems: number;
}

/**
 * Returns true only when the document has a pending transfer targeting the actor's office
 * AND the actor is NOT the sender of that pending transfer (blocks self-receipt).
 */
export function isPendingReceiptForActor(
  doc: DocumentRecord,
  actor: Personnel | null,
): boolean {
  if (!actor) return false;
  const latest = doc.transactions[doc.transactions.length - 1];
  if (!latest || latest.status !== 'pending') return false;
  if (doc.currentOffice.id !== actor.office.id) return false;
  if (latest.fromUserId && latest.fromUserId === actor.id) return false;
  return true;
}

/**
 * Returns true when the latest transaction is still pending and was sent by the current actor.
 */
export function isPendingSentByActor(
  doc: DocumentRecord,
  actor: Personnel | null,
): boolean {
  if (!actor) return false;
  const latest = doc.transactions[doc.transactions.length - 1];
  if (!latest || latest.status !== 'pending') return false;
  return Boolean(latest.fromUserId && latest.fromUserId === actor.id);
}

const STATUS_PRIORITY: Record<Exclude<SentStatusFilter, 'all'>, number> = {
  pending: 0,
  returned: 1,
  local: 2,
  recalled: 3,
  acknowledged: 4,
};

function deriveSentStatus(
  doc: DocumentRecord,
  outboundTx: RoutingTransaction | null,
): Exclude<SentStatusFilter, 'all'> {
  if (!outboundTx) {
    if (doc.lifecycleStatus === 'returned_for_revision') return 'returned';
    return 'local';
  }
  if (outboundTx.status === 'pending') return 'pending';
  if (outboundTx.status === 'acknowledged') return 'acknowledged';
  if (outboundTx.status === 'recalled') return 'recalled';
  return 'returned';
}

function buildHumanSentSummary(
  doc: DocumentRecord,
  outboundTx: RoutingTransaction | null,
  status: Exclude<SentStatusFilter, 'all'>,
  sentAt: string,
): string {
  const elapsed = formatElapsedTime(sentAt);
  switch (status) {
    case 'pending': {
      const target = outboundTx?.toOffice.code ?? doc.currentOffice.code;
      return elapsed ? `Waiting for ${target} · ${elapsed}` : `Waiting for ${target}`;
    }
    case 'acknowledged': {
      const receiver = outboundTx?.receivedByName ?? outboundTx?.recipientName ?? doc.currentOffice.code;
      const clock = outboundTx?.receivedAt ? formatClockTime(outboundTx.receivedAt) : '';
      return clock ? `Received by ${receiver} · ${clock}` : `Received by ${receiver}`;
    }
    case 'returned':
      return outboundTx?.status === 'declined_misrouted'
        ? 'Declined · Flagged as Misrouted'
        : 'Returned · Needs Revision';
    case 'recalled':
      return `Recalled · Back at ${doc.currentOffice.code}`;
    case 'local':
    default:
      return elapsed
        ? `Held locally in ${doc.currentOffice.code} · ${elapsed}`
        : `Held locally in ${doc.currentOffice.code}`;
  }
}

/**
 * Human-friendly status line with time-in-office indicator for Inbox document cards.
 */
export function formatHumanInboxStatus(
  doc: DocumentRecord,
  actor: Personnel | null,
  nowMs = Date.now(),
): string {
  const latest = doc.transactions[doc.transactions.length - 1] ?? null;
  if (doc.lifecycleStatus === 'returned_for_revision') {
    const elapsed = formatElapsedTime(latest?.sentAt ?? doc.createdAt, nowMs);
    return elapsed ? `Returned · Needs Revision · ${elapsed}` : 'Returned · Needs Revision';
  }
  if (isPendingReceiptForActor(doc, actor)) {
    const fromCode = latest?.fromOffice.code ?? doc.originOffice.code;
    const elapsed = formatElapsedTime(latest?.sentAt ?? doc.createdAt, nowMs);
    return elapsed
      ? `Waiting for your receipt · From ${fromCode} · ${elapsed}`
      : `Waiting for your receipt · From ${fromCode}`;
  }
  if (isPendingSentByActor(doc, actor)) {
    const toCode = latest?.toOffice.code ?? doc.currentOffice.code;
    const elapsed = formatElapsedTime(latest?.sentAt ?? doc.createdAt, nowMs);
    return elapsed ? `Waiting for ${toCode} · ${elapsed}` : `Waiting for ${toCode}`;
  }
  if (latest?.status === 'acknowledged') {
    const elapsed = formatElapsedTime(latest.receivedAt ?? latest.sentAt, nowMs);
    const holder = latest.receivedByName ? ` · ${latest.receivedByName}` : '';
    return elapsed
      ? `In ${doc.currentOffice.code}${holder} · ${elapsed}`
      : `In ${doc.currentOffice.code}${holder}`;
  }
  const elapsed = formatElapsedTime(doc.createdAt, nowMs);
  return elapsed
    ? `At ${doc.currentOffice.code} · From ${latest?.fromOffice.code ?? doc.originOffice.code} · ${elapsed}`
    : `At ${doc.currentOffice.code} · From ${latest?.fromOffice.code ?? doc.originOffice.code}`;
}

export function matchesSentDateFilter(
  isoString: string,
  dateFilter: SentDateFilter,
  nowMs = Date.now(),
): boolean {
  if (dateFilter === 'all') return true;
  const ts = Date.parse(isoString);
  if (Number.isNaN(ts)) return false;
  const now = new Date(nowMs);
  if (dateFilter === 'today') {
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return ts >= startOfDay;
  }
  if (dateFilter === 'week') {
    return nowMs - ts <= 7 * 24 * 60 * 60 * 1000;
  }
  return nowMs - ts <= 30 * 24 * 60 * 60 * 1000;
}

/**
 * Selects documents originated or dispatched by the signed-in actor.
 */
export function selectSentDocuments(
  documents: ReadonlyArray<DocumentRecord>,
  actor: Personnel | null,
): ReadonlyArray<SentDocumentItem> {
  if (!actor) return [];

  const result: SentDocumentItem[] = [];
  for (const doc of documents) {
    const actorTxs = doc.transactions.filter((tx) =>
      tx.fromUserId ? tx.fromUserId === actor.id : tx.fromOffice.id === actor.office.id,
    );
    const originatedByActor = doc.originUserId
      ? doc.originUserId === actor.id
      : doc.originOffice.id === actor.office.id;

    if (!originatedByActor && actorTxs.length === 0) {
      continue;
    }

    const latestOutboundTx =
      actorTxs.length > 0
        ? actorTxs[actorTxs.length - 1]
        : doc.transactions[doc.transactions.length - 1] ?? null;

    const latestTx = doc.transactions[doc.transactions.length - 1] ?? null;
    const canRecall = Boolean(
      latestTx &&
        latestTx.status === 'pending' &&
        (latestTx.fromUserId ? latestTx.fromUserId === actor.id : latestTx.fromOffice.id === actor.office.id),
    );

    const status = deriveSentStatus(doc, latestOutboundTx);
    const sentAt = latestOutboundTx?.sentAt ?? doc.createdAt;
    const statusSummary = buildHumanSentSummary(doc, latestOutboundTx, status, sentAt);
    const recipientLabel = latestOutboundTx
      ? `${latestOutboundTx.toOffice.code} · ${latestOutboundTx.recipientName}`
      : `Held locally (${doc.currentOffice.code})`;

    result.push({
      doc,
      latestOutboundTx,
      sentAt,
      status,
      statusSummary,
      recipientLabel,
      canRecall,
    });
  }

  return result;
}

export function filterAndSortSentDocuments(
  items: ReadonlyArray<SentDocumentItem>,
  options: {
    readonly statusFilter: SentStatusFilter;
    readonly dateFilter?: SentDateFilter;
    readonly query: string;
    readonly sortMode: SentSortMode;
    readonly nowMs?: number;
  },
): ReadonlyArray<SentDocumentItem> {
  const q = options.query.trim().toLowerCase();
  const dateFilter = options.dateFilter ?? 'all';
  const nowMs = options.nowMs ?? Date.now();

  const filtered = items.filter((item) => {
    if (options.statusFilter !== 'all' && item.status !== options.statusFilter) {
      return false;
    }
    if (!matchesSentDateFilter(item.sentAt, dateFilter, nowMs)) {
      return false;
    }
    if (!q) return true;
    const fileNames = item.doc.versions.map((v) => v.fileName.toLowerCase()).join(' ');
    return (
      item.doc.trackingCode.toLowerCase().includes(q) ||
      item.doc.title.toLowerCase().includes(q) ||
      item.doc.categoryName.toLowerCase().includes(q) ||
      item.recipientLabel.toLowerCase().includes(q) ||
      item.statusSummary.toLowerCase().includes(q) ||
      item.doc.currentOffice.name.toLowerCase().includes(q) ||
      fileNames.includes(q)
    );
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    switch (options.sortMode) {
      case 'oldest':
        return Date.parse(a.sentAt) - Date.parse(b.sentAt);
      case 'title_asc':
        return a.doc.title.localeCompare(b.doc.title);
      case 'title_desc':
        return b.doc.title.localeCompare(a.doc.title);
      case 'tracking_code':
        return a.doc.trackingCode.localeCompare(b.doc.trackingCode);
      case 'status_pending': {
        const diff = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
        return diff !== 0 ? diff : Date.parse(b.sentAt) - Date.parse(a.sentAt);
      }
      case 'newest':
      default:
        return Date.parse(b.sentAt) - Date.parse(a.sentAt);
    }
  });

  return sorted;
}

export function paginateSentItems<T>(
  items: ReadonlyArray<T>,
  requestedPage: number,
  pageSize: number,
): PaginatedResult<T> {
  const safeSize = Math.max(1, pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safeSize));
  const safePage = Math.min(Math.max(1, requestedPage), totalPages);
  const start = (safePage - 1) * safeSize;
  const pageItems = items.slice(start, start + safeSize);

  return {
    pageItems,
    safePage,
    totalPages,
    startIndex: totalItems === 0 ? 0 : start + 1,
    endIndex: totalItems === 0 ? 0 : start + pageItems.length,
    totalItems,
  };
}
