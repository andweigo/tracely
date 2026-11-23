import { Document } from '../../domain/entities/Document';
import { Personnel } from '../../domain/entities/Personnel';
import { RoutingTransaction } from '../../domain/entities/RoutingTransaction';
import { DocumentLifecycleStatus, ReceiptStatus } from '../../domain/enums/DomainEnums';
import { formatClockTime, formatRelativeTime } from './formatters';

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
  readonly doc: Document;
  readonly latestOutboundTx: RoutingTransaction | null;
  readonly sentAt: string;
  readonly status: Exclude<SentStatusFilter, 'all'>;
  readonly statusSummary: string;
  readonly recipientLabel: string;
  readonly canRecall: boolean;
}

export interface PaginatedSentResult<T> {
  readonly pageItems: ReadonlyArray<T>;
  readonly safePage: number;
  readonly totalPages: number;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly totalItems: number;
}

const STATUS_PRIORITY: Record<Exclude<SentStatusFilter, 'all'>, number> = {
  pending: 0,
  returned: 1,
  local: 2,
  recalled: 3,
  acknowledged: 4,
};

function deriveSentStatus(
  doc: Document,
  outboundTx: RoutingTransaction | null,
): Exclude<SentStatusFilter, 'all'> {
  if (!outboundTx) {
    if (doc.lifecycleStatus === DocumentLifecycleStatus.RETURNED_FOR_REVISION) {
      return 'returned';
    }
    return 'local';
  }
  if (outboundTx.receiptStatus === ReceiptStatus.PENDING) return 'pending';
  if (outboundTx.receiptStatus === ReceiptStatus.ACKNOWLEDGED) return 'acknowledged';
  if (outboundTx.receiptStatus === ReceiptStatus.RECALLED) return 'recalled';
  return 'returned';
}

function buildHumanSentSummary(
  doc: Document,
  outboundTx: RoutingTransaction | null,
  status: Exclude<SentStatusFilter, 'all'>,
  sentAt: string,
): string {
  const elapsed = formatRelativeTime(sentAt);
  switch (status) {
    case 'pending': {
      const target = outboundTx?.toOffice.code ?? doc.currentOffice.code;
      return `Waiting for ${target} · ${elapsed}`;
    }
    case 'acknowledged': {
      const receiver =
        outboundTx?.acknowledgedByName ?? outboundTx?.toUserName ?? doc.currentOffice.code;
      const clock = outboundTx?.acknowledgedAt ? formatClockTime(outboundTx.acknowledgedAt) : '';
      return clock ? `Received by ${receiver} · ${clock}` : `Received by ${receiver}`;
    }
    case 'returned':
      return outboundTx?.receiptStatus === ReceiptStatus.DECLINED_MISROUTED
        ? 'Declined · Flagged as Misrouted'
        : 'Returned · Needs Revision';
    case 'recalled':
      return `Recalled · Back at ${doc.currentOffice.code}`;
    case 'local':
    default:
      return `Held locally in ${doc.currentOffice.code} · ${elapsed}`;
  }
}

export function formatHumanInboxStatus(doc: Document, actor: Personnel | null): string {
  const latest = doc.latestTransaction;
  if (doc.lifecycleStatus === DocumentLifecycleStatus.RETURNED_FOR_REVISION) {
    return `Returned · Needs Revision · ${formatRelativeTime(latest?.sentAt ?? doc.createdAt)}`;
  }
  if (actor && latest?.canBeAcknowledgedBy(actor)) {
    const fromCode = latest.fromOffice.code;
    return `Waiting for your receipt · From ${fromCode} · ${formatRelativeTime(latest.sentAt)}`;
  }
  if (actor && latest?.isPendingSentBy(actor.id)) {
    return `Waiting for ${latest.toOffice.code} · ${formatRelativeTime(latest.sentAt)}`;
  }
  if (latest?.receiptStatus === ReceiptStatus.ACKNOWLEDGED) {
    const holder = latest.acknowledgedByName ? ` · ${latest.acknowledgedByName}` : '';
    const refTime = latest.acknowledgedAt ?? latest.sentAt;
    return `In ${doc.currentOffice.code}${holder} · ${formatRelativeTime(refTime)}`;
  }
  return `At ${doc.currentOffice.code} · From ${latest?.fromOffice.code ?? doc.originOffice.code} · ${formatRelativeTime(doc.createdAt)}`;
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

export function selectSentDocuments(
  documents: ReadonlyArray<Document>,
  actor: Personnel | null,
): ReadonlyArray<SentDocumentItem> {
  if (!actor) return [];

  const items: SentDocumentItem[] = [];
  for (const doc of documents) {
    const actorTxs = doc.transactions.filter((tx) => tx.fromUserId === actor.id);
    const originatedByActor = doc.originUserId === actor.id;
    if (!originatedByActor && actorTxs.length === 0) {
      continue;
    }

    const latestOutboundTx =
      actorTxs.length > 0 ? actorTxs[actorTxs.length - 1] : doc.latestTransaction ?? null;
    const latestTx = doc.latestTransaction ?? null;
    const canRecall = Boolean(latestTx?.canBeRecalledBy(actor.id));
    const status = deriveSentStatus(doc, latestOutboundTx);
    const sentAt = latestOutboundTx?.sentAt ?? doc.createdAt;
    const statusSummary = buildHumanSentSummary(doc, latestOutboundTx, status, sentAt);
    const recipientLabel = latestOutboundTx
      ? `${latestOutboundTx.toOffice.code} · ${latestOutboundTx.toUserName}`
      : `Held locally (${doc.currentOffice.code})`;

    items.push({
      doc,
      latestOutboundTx,
      sentAt,
      status,
      statusSummary,
      recipientLabel,
      canRecall,
    });
  }

  return items;
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
): PaginatedSentResult<T> {
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
