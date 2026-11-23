import { AuditLogEntry, DocumentRecord, DocumentTrackingSnapshot } from '../domain/types';
import type { SentDocumentItem } from './sentFilter';

/**
 * Neutralizes spreadsheet formula injection (=, +, -, @, tab, CR) and applies RFC 4180 CSV quoting.
 */
export function escapeCsvCell(raw: string | number | null | undefined): string {
  const str = raw === null || raw === undefined ? '' : String(raw);
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

function toCsvLines(headers: ReadonlyArray<string>, rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>): string {
  const headLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  return [headLine, ...dataLines].join('\r\n');
}

export function buildDocumentsCsv(docs: ReadonlyArray<DocumentRecord>): string {
  return toCsvLines(
    [
      'Tracking Code',
      'Title',
      'Copy Format',
      'Category',
      'Confidentiality',
      'Origin Office',
      'Current Office',
      'Lifecycle Status',
      'SLA State',
      'SLA Due At',
      'Physical Reference',
      'Created At',
    ],
    docs.map((doc) => [
      doc.trackingCode,
      doc.title,
      doc.copyFormat,
      doc.categoryName,
      doc.confidentialityTier,
      doc.originOffice.code,
      doc.currentOffice.code,
      doc.lifecycleStatus,
      doc.slaState,
      doc.slaDueAt ?? '',
      doc.physicalReference ?? '',
      doc.createdAt,
    ]),
  );
}

export function buildTrackedCsv(snapshots: ReadonlyArray<DocumentTrackingSnapshot>): string {
  return toCsvLines(
    [
      'Tracking Code',
      'Title',
      'Copy Format',
      'Current Office',
      'Current Holder',
      'Lifecycle Status',
      'SLA State',
      'Received At',
      'Last Updated',
    ],
    snapshots.map((snap) => [
      snap.trackingCode,
      snap.displayTitle,
      snap.copyFormat,
      `${snap.currentOffice.code} (${snap.currentOffice.name})`,
      snap.currentHolderName ?? '',
      snap.lifecycleStatus,
      snap.slaState,
      snap.receivedAt ?? '',
      snap.lastUpdatedAt,
    ]),
  );
}

export function buildSentCsv(items: ReadonlyArray<SentDocumentItem>): string {
  return toCsvLines(
    [
      'Tracking Code',
      'Title',
      'File Name',
      'Copy Format',
      'Category',
      'Confidentiality',
      'Recipient / Desk',
      'Receipt Status',
      'Status Summary',
      'Sent At',
    ],
    items.map((item) => {
      const latestVer = item.doc.versions[item.doc.versions.length - 1];
      return [
        item.doc.trackingCode,
        item.doc.title,
        latestVer?.fileName ?? item.doc.physicalReference ?? '',
        item.doc.copyFormat,
        item.doc.categoryName,
        item.doc.confidentialityTier,
        item.recipientLabel,
        item.status,
        item.statusSummary,
        item.sentAt,
      ];
    }),
  );
}

export function buildAuditLogsCsv(logs: ReadonlyArray<AuditLogEntry>): string {
  return toCsvLines(
    ['Audit ID', 'Action', 'Actor', 'Office', 'Summary', 'Created At'],
    logs.map((entry) => [
      entry.id,
      entry.action,
      entry.actorName,
      entry.officeCode,
      entry.summary,
      entry.createdAt,
    ]),
  );
}

export function downloadCsvFile(filename: string, csvContent: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return;
  }
  const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
