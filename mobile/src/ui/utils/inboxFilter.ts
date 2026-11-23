import { Document } from '../../domain/entities/Document';
import { DocumentCopyFormat, SlaState } from '../../domain/enums/DomainEnums';

export type InboxSortMode = 'sla_urgent' | 'newest' | 'oldest';
export type InboxFormatFilter = 'all' | 'soft_copy' | 'hard_copy';

export interface SlaRiskSummary {
  readonly overdueCount: number;
  readonly atRiskCount: number;
  readonly totalRiskCount: number;
}

const SLA_RANK: Record<SlaState, number> = {
  [SlaState.OVERDUE]: 0,
  [SlaState.AT_RISK]: 1,
  [SlaState.ON_TRACK]: 2,
};

export function countSlaRisks(docs: ReadonlyArray<Document>): SlaRiskSummary {
  let overdueCount = 0;
  let atRiskCount = 0;
  for (const doc of docs) {
    if (doc.slaState === SlaState.OVERDUE) overdueCount += 1;
    else if (doc.slaState === SlaState.AT_RISK) atRiskCount += 1;
  }
  return {
    overdueCount,
    atRiskCount,
    totalRiskCount: overdueCount + atRiskCount,
  };
}

export function matchesFormatFilter(doc: Document, format: InboxFormatFilter): boolean {
  if (format === 'all') return true;
  const isHard = doc.copyFormat === DocumentCopyFormat.HARD_COPY || !doc.hasDigitalFile;
  return format === 'hard_copy' ? isHard : !isHard;
}

export function sortDocuments(
  docs: ReadonlyArray<Document>,
  sortMode: InboxSortMode,
): ReadonlyArray<Document> {
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
