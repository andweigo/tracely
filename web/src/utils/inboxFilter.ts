import { DocumentRecord, SlaState } from '../domain/types';

export type InboxSortMode = 'sla_urgent' | 'newest' | 'oldest';
export type InboxFormatFilter = 'all' | 'soft_copy' | 'hard_copy';

export interface SlaRiskSummary {
  readonly overdueCount: number;
  readonly atRiskCount: number;
  readonly totalRiskCount: number;
}

const SLA_RANK: Record<SlaState, number> = {
  overdue: 0,
  at_risk: 1,
  on_track: 2,
};

export function countSlaRisks(docs: ReadonlyArray<DocumentRecord>): SlaRiskSummary {
  let overdueCount = 0;
  let atRiskCount = 0;
  for (const doc of docs) {
    if (doc.slaState === 'overdue') overdueCount += 1;
    else if (doc.slaState === 'at_risk') atRiskCount += 1;
  }
  return {
    overdueCount,
    atRiskCount,
    totalRiskCount: overdueCount + atRiskCount,
  };
}

export function matchesFormatFilter(
  doc: DocumentRecord,
  format: InboxFormatFilter,
): boolean {
  if (format === 'all') return true;
  const isHard = doc.copyFormat === 'hard_copy' || doc.versions.length === 0;
  return format === 'hard_copy' ? isHard : !isHard;
}

export function sortDocumentRecords(
  docs: ReadonlyArray<DocumentRecord>,
  sortMode: InboxSortMode,
): ReadonlyArray<DocumentRecord> {
  if (docs.length <= 1) return docs;
  return [...docs].sort((a, b) => {
    if (sortMode === 'sla_urgent') {
      const rankDiff = SLA_RANK[a.slaState] - SLA_RANK[b.slaState];
      if (rankDiff !== 0) return rankDiff;
      const aDue = a.slaDueAt ? Date.parse(a.slaDueAt) : Number.MAX_SAFE_INTEGER;
      const bDue = b.slaDueAt ? Date.parse(b.slaDueAt) : Number.MAX_SAFE_INTEGER;
      if (aDue !== bDue) return aDue - bDue;
    }
    const aCreated = Date.parse(a.createdAt) || 0;
    const bCreated = Date.parse(b.createdAt) || 0;
    return sortMode === 'oldest' ? aCreated - bCreated : bCreated - aCreated;
  });
}
