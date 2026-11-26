import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Archive,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  History,
  Keyboard,
  Lock,
  Maximize2,
  Minimize2,
  Pencil,
  Printer,
  Search,
  Server,
  ShieldCheck,
  Timer,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  AuditLogEntry,
  ConfidentialityTier,
  DISPOSITION_REMARK_PRESETS,
  DocumentCategory,
  DocumentRecord,
  DocumentTrackingSnapshot,
  DocumentUpdatePayload,
  Personnel,
  PresignedDownloadGrant,
  VersionChangeType,
} from '../domain/types';
import { buildAuditLogsCsv, downloadCsvFile } from '../utils/exportCsv';
import {
  computeFileSha256,
  formatBytes,
  formatClockTime,
  formatCompactDate,
  formatDisplayFileName,
  normalizeUploadFileName,
} from '../utils/formatters';
import { printRoutingSlipElement } from '../utils/printRoutingSlip';
import { paginateList, PaginationBar } from './PaginationBar';
import { QrCodeGraphic } from './QrCodeGraphic';
import { TrackingLocationCard } from './TrackingLocationCard';

interface ModalDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly subtitle?: string;
  readonly wide?: boolean;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
}

export const ModalDialog: React.FC<ModalDialogProps> = ({
  open,
  title,
  subtitle,
  wide = false,
  onClose,
  children,
}) => {
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className={`modal-card${wide ? ' modal-card-wide' : ''}`}>
        <div className="modal-head no-print">
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 className="modal-title" style={{ overflowWrap: 'anywhere' }}>
              {title}
            </h3>
            {subtitle ? <p className="modal-sub">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="icon-circle-btn"
            style={{ flexShrink: 0 }}
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const FORMAT_LABELS: Record<DocumentRecord['copyFormat'], string> = {
  digital: 'Soft Copy',
  hard_copy: 'Hard Copy',
  hybrid: 'Hybrid (Hard + Scan)',
};

const TIER_LABELS: Record<DocumentRecord['confidentialityTier'], string> = {
  standard_internal: 'Standard Internal',
  restricted: 'Restricted',
  confidential: 'Confidential (Restricted)',
};

const MultiOfficeRoutingLog: React.FC<{
  readonly docRecord?: DocumentRecord | null;
  readonly rowCount: number;
  readonly compact?: boolean;
}> = ({ docRecord, rowCount, compact = false }) => {
  const acknowledgedHops = (docRecord?.transactions ?? []).filter(
    (tx) => tx.status === 'acknowledged',
  );
  const totalRows = Math.max(rowCount, acknowledgedHops.length + (compact ? 3 : 4));

  return (
    <div
      className={`qr-slip-receipt-box${compact ? ' qr-slip-receipt-box-compact' : ''}`}
      data-testid="routing-slip-receipt-lines"
    >
      <div className="qr-slip-receipt-header">
        <span>RECEIVING OFFICE ACKNOWLEDGMENT &amp; MULTI-OFFICE ROUTING LOG (HARD-COPY)</span>
        <span className="qr-slip-receipt-subnote">{totalRows} office stops</span>
      </div>

      <div className="qr-slip-log-scroll">
        <table className="qr-slip-log-table">
          <thead>
            <tr>
              <th style={{ width: '5%' }}>#</th>
              <th style={{ width: '16%' }}>Receiving Office / Unit</th>
              <th style={{ width: '16%' }}>Date &amp; Time Received</th>
              <th style={{ width: '23%' }}>Received By (Name &amp; Signature)</th>
              <th style={{ width: '40%' }}>Receiving Office Remarks / Action Taken</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: totalRows }, (_, idx) => {
              const recorded = acknowledgedHops[idx];
              const stepNum = idx + 1;
              return (
                <tr key={stepNum} data-testid={`routing-slip-office-row-${stepNum}`}>
                  <td className="qr-slip-log-step mono">{stepNum}</td>
                  <td className="qr-slip-log-cell">
                    {recorded ? (
                      <div className="qr-slip-log-prefill">
                        <strong>{recorded.toOffice.code}</strong>
                        <span>{recorded.toOffice.name}</span>
                      </div>
                    ) : (
                      <div className="qr-slip-cell-lines">
                        <div className="qr-slip-write-line" />
                      </div>
                    )}
                  </td>
                  <td className="qr-slip-log-cell">
                    {recorded?.receivedAt ? (
                      <div className="qr-slip-log-prefill mono">
                        <span>{formatCompactDate(recorded.receivedAt)}</span>
                        <span>{formatClockTime(recorded.receivedAt)}</span>
                      </div>
                    ) : (
                      <div className="qr-slip-cell-lines">
                        <div className="qr-slip-write-line" />
                      </div>
                    )}
                  </td>
                  <td className="qr-slip-log-cell">
                    {recorded?.receivedByName ? (
                      <div className="qr-slip-log-prefill">
                        <strong>{recorded.receivedByName}</strong>
                        <span>Verified via Tracely</span>
                      </div>
                    ) : (
                      <div className="qr-slip-cell-lines">
                        <div className="qr-slip-write-line" />
                      </div>
                    )}
                  </td>
                  <td className="qr-slip-log-cell">
                    {recorded?.remarks ? (
                      <div className="qr-slip-log-prefill">
                        <span>{recorded.remarks}</span>
                      </div>
                    ) : (
                      <div className="qr-slip-cell-lines">
                        <div className="qr-slip-write-line" />
                        {!compact ? <div className="qr-slip-write-line" /> : null}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const OpaqueQrModal: React.FC<{
  open: boolean;
  trackingCode: string;
  qrToken: string;
  title: string;
  subtitle?: string;
  document?: DocumentRecord | null;
  onClose: () => void;
}> = ({ open, trackingCode, qrToken, title, subtitle, document: docRecord, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [officeRows, setOfficeRows] = useState<6 | 8 | 10>(6);
  const slipRef = useRef<HTMLDivElement | null>(null);
  const payload = `TRC-QR:DOC:${qrToken}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(trackingCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard restricted
    }
  };

  const handlePrintSlip = () => {
    printRoutingSlipElement(slipRef.current);
  };

  const handleDownloadQrPng = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(payload, {
        width: 512,
        margin: 2,
        color: { dark: '#0D1B3E', light: '#FFFFFF' },
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `Tracely-QR-${trackingCode}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      // Ignore canvas/download errors in restricted environments
    }
  };

  const isConfidential = docRecord?.confidentialityTier === 'confidential';
  const issuedDate = docRecord?.createdAt ? formatCompactDate(docRecord.createdAt) : formatCompactDate(new Date().toISOString());
  const formatLabel = docRecord ? FORMAT_LABELS[docRecord.copyFormat] : 'Tracked Record';
  const tierLabel = docRecord ? TIER_LABELS[docRecord.confidentialityTier] : 'Standard Internal';

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      wide
      title="Routing Slip QR"
      subtitle={subtitle ?? 'Print and attach to your physical folder — includes multi-office routing & remarks lines'}
    >
      <div ref={slipRef} className="qr-print-slip" data-testid="routing-print-slip">
        <div className="qr-slip-masthead">
          <div className="qr-slip-republic">Tracely · Document Custody &amp; QR Tracking</div>
          <div className="qr-slip-agency">Tracely Official Routing Slip</div>
          <div className="qr-slip-banner-row">
            <span className="qr-slip-doc-tag">OFFICIAL DOCUMENT ROUTING SLIP</span>
            <span className="qr-slip-date">{issuedDate}</span>
          </div>
        </div>

        <div className="qr-slip-body">
          <div className="qr-slip-qr-col">
            <div className="qr-slip-qr-frame">
              <QrCodeGraphic value={payload} size={140} />
            </div>
            <div className="qr-slip-code-label">Tracking Code</div>
            <div className="mono qr-slip-code-value">{trackingCode}</div>
          </div>

          <div className="qr-slip-info-col">
            <div className="qr-slip-field">
              <span className="qr-slip-field-label">Document Title</span>
              <strong className="qr-slip-field-title">
                {isConfidential ? 'Confidential Record — Scan QR to Verify' : title}
              </strong>
            </div>

            <div className="qr-slip-meta-grid">
              {docRecord?.categoryName ? (
                <div className="qr-slip-field">
                  <span className="qr-slip-field-label">Category</span>
                  <span className="qr-slip-field-value">{docRecord.categoryName}</span>
                </div>
              ) : null}
              <div className="qr-slip-field">
                <span className="qr-slip-field-label">Copy Format</span>
                <span className="qr-slip-field-value">{formatLabel}</span>
              </div>
              {docRecord?.originOffice ? (
                <div className="qr-slip-field">
                  <span className="qr-slip-field-label">Origin Unit</span>
                  <span className="qr-slip-field-value">
                    {docRecord.originOffice.code} — {docRecord.originOffice.name}
                  </span>
                </div>
              ) : null}
              {docRecord?.currentOffice ? (
                <div className="qr-slip-field">
                  <span className="qr-slip-field-label">Routed / Current Desk</span>
                  <span className="qr-slip-field-value">
                    {docRecord.currentOffice.code} — {docRecord.currentOffice.name}
                  </span>
                </div>
              ) : null}
              <div className="qr-slip-field">
                <span className="qr-slip-field-label">Classification</span>
                <span className="qr-slip-field-value">{tierLabel}</span>
              </div>
              {docRecord?.physicalReference || docRecord?.physicalPageCount ? (
                <div className="qr-slip-field">
                  <span className="qr-slip-field-label">Physical Folder</span>
                  <span className="qr-slip-field-value">
                    {[
                      docRecord.physicalReference,
                      docRecord.physicalPageCount ? `${docRecord.physicalPageCount} pages` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <MultiOfficeRoutingLog docRecord={docRecord} rowCount={officeRows} />

        <div className="qr-slip-footer">
          <span>Scan QR inside Tracely to verify desk custody &amp; log digital handoff at every office.</span>
          <span>Zero PII encoded in QR</span>
        </div>
      </div>

      <div
        className="no-print card-soft"
        style={{
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          background: 'var(--sky-soft)',
          borderColor: 'var(--sky-border)',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
          Sealed QR-First Custody — Share or attach this QR slip
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          The recipient receives a sealed QR card only — title, notes, and attached files stay
          hidden until they scan this QR code (or upload the QR PNG / enter{' '}
          <strong className="mono">{trackingCode}</strong> from this slip).
        </div>
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: 'var(--text-muted)',
            wordBreak: 'break-all',
            marginTop: 2,
          }}
        >
          {payload}
        </div>
      </div>

      <div
        className="no-print"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
            Routing Rows:
          </span>
          {([6, 8, 10] as const).map((count) => (
            <button
              key={count}
              type="button"
              className={`pill ${officeRows === count ? 'pill-navy' : 'pill-slate'}`}
              style={{ cursor: 'pointer', padding: '4px 10px' }}
              onClick={() => setOfficeRows(count)}
            >
              {count} Offices
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" className="btn btn-outline" onClick={() => void handleDownloadQrPng()}>
            <Download size={15} /> Download QR PNG
          </button>
          <button type="button" className="btn btn-outline" onClick={() => void handleCopy()}>
            <Copy size={15} /> {copied ? 'Copied' : 'Copy Code'}
          </button>
          <button type="button" className="btn btn-outline" onClick={handlePrintSlip}>
            <Printer size={15} /> Print Slip
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </ModalDialog>
  );
};

export const BatchQrSlipsModal: React.FC<{
  open: boolean;
  documents: ReadonlyArray<DocumentRecord>;
  onClose: () => void;
}> = ({ open, documents, onClose }) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);

  const handlePrintAll = () => {
    printRoutingSlipElement(sheetRef.current);
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      wide
      title={`Batch Routing Slips (${documents.length})`}
      subtitle="Prints 2 official QR routing slips per A4 sheet with cut guides (zero app chrome)"
    >
      <div ref={sheetRef} className="batch-slip-sheet" data-testid="batch-routing-slips-sheet">
        {documents.map((docRecord, idx) => {
          const payload = `TRC-QR:DOC:${docRecord.qrToken}`;
          const isConfidential = docRecord.confidentialityTier === 'confidential';
          const issuedDate = docRecord.createdAt
            ? formatCompactDate(docRecord.createdAt)
            : formatCompactDate(new Date().toISOString());
          const formatLabel = FORMAT_LABELS[docRecord.copyFormat];
          const tierLabel = TIER_LABELS[docRecord.confidentialityTier];

          return (
            <React.Fragment key={docRecord.id}>
              <div className="qr-print-slip">
                <div className="qr-slip-masthead">
                  <div className="qr-slip-republic">
                    Tracely · Document Custody &amp; QR Tracking
                  </div>
                  <div className="qr-slip-agency">Tracely Official Routing Slip</div>
                  <div className="qr-slip-banner-row">
                    <span className="qr-slip-doc-tag">
                      OFFICIAL DOCUMENT ROUTING SLIP · {idx + 1} OF {documents.length}
                    </span>
                    <span className="qr-slip-date">{issuedDate}</span>
                  </div>
                </div>

                <div className="qr-slip-body">
                  <div className="qr-slip-qr-col">
                    <div className="qr-slip-qr-frame">
                      <QrCodeGraphic value={payload} size={132} />
                    </div>
                    <div className="qr-slip-code-label">Tracking Code</div>
                    <div className="mono qr-slip-code-value">{docRecord.trackingCode}</div>
                  </div>

                  <div className="qr-slip-info-col">
                    <div className="qr-slip-field">
                      <span className="qr-slip-field-label">Document Title</span>
                      <strong className="qr-slip-field-title">
                        {isConfidential ? 'Confidential Record — Scan QR to Verify' : docRecord.title}
                      </strong>
                    </div>

                    <div className="qr-slip-meta-grid">
                      <div className="qr-slip-field">
                        <span className="qr-slip-field-label">Category</span>
                        <span className="qr-slip-field-value">{docRecord.categoryName}</span>
                      </div>
                      <div className="qr-slip-field">
                        <span className="qr-slip-field-label">Copy Format</span>
                        <span className="qr-slip-field-value">{formatLabel}</span>
                      </div>
                      <div className="qr-slip-field">
                        <span className="qr-slip-field-label">Origin Unit</span>
                        <span className="qr-slip-field-value">
                          {docRecord.originOffice.code} — {docRecord.originOffice.name}
                        </span>
                      </div>
                      <div className="qr-slip-field">
                        <span className="qr-slip-field-label">Routed / Current Desk</span>
                        <span className="qr-slip-field-value">
                          {docRecord.currentOffice.code} — {docRecord.currentOffice.name}
                        </span>
                      </div>
                      <div className="qr-slip-field">
                        <span className="qr-slip-field-label">Classification</span>
                        <span className="qr-slip-field-value">{tierLabel}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <MultiOfficeRoutingLog docRecord={docRecord} rowCount={4} compact />

                <div className="qr-slip-footer">
                  <span>Scan QR inside Tracely to verify desk custody &amp; confirm receipt.</span>
                  <span>Zero PII encoded in QR</span>
                </div>
              </div>
              {idx < documents.length - 1 ? (
                <div
                  className={`batch-slip-cutline ${idx % 2 === 1 ? 'batch-slip-page-break' : ''}`}
                  aria-hidden="true"
                >
                  <span>✂ Cut along dashed line</span>
                </div>
              ) : null}
            </React.Fragment>
          );
        })}
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-amber" onClick={handlePrintAll}>
          <Printer size={15} /> Print All Slips ({documents.length})
        </button>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </ModalDialog>
  );
};

export const BatchTransmittalModal: React.FC<{
  open: boolean;
  documents: ReadonlyArray<DocumentRecord>;
  originLabel?: string;
  preparedBy?: string;
  onClose: () => void;
}> = ({ open, documents, originLabel, preparedBy, onClose }) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  if (!open || documents.length === 0) return null;

  const issuedDate = formatCompactDate(new Date().toISOString());
  const refCode = `TR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(documents.length).padStart(2, '0')}`;
  const verifyPayload = `TRC-QR:VERIFY:${documents[0].qrToken}`;

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      wide
      title={`Official A4 Transmittal Sheet (${documents.length})`}
      subtitle="Printable A4 batch manifest with signature lines & verification QR"
    >
      <div
        ref={sheetRef}
        className="transmittal-sheet"
        data-testid="web-batch-transmittal-sheet"
      >
        <div className="qr-slip-masthead">
          <div className="qr-slip-republic">
            Tracely · Document Custody &amp; QR Tracking
          </div>
          <div className="qr-slip-agency">Tracely Official Transmittal Manifest</div>
          <div className="qr-slip-banner-row">
            <span className="qr-slip-doc-tag">OFFICIAL DOCUMENT TRANSMITTAL SHEET</span>
            <span className="qr-slip-date">
              Ref: {refCode} · {issuedDate}
            </span>
          </div>
        </div>

        <div className="transmittal-meta-strip">
          <div>
            <span className="qr-slip-field-label">Transmitting Unit</span>
            <div className="qr-slip-field-value">
              {originLabel ||
                `${documents[0].originOffice.code} — ${documents[0].originOffice.name}`}
            </div>
          </div>
          <div>
            <span className="qr-slip-field-label">Prepared By</span>
            <div className="qr-slip-field-value">{preparedBy || 'Records / Desk Officer'}</div>
          </div>
          <div>
            <span className="qr-slip-field-label">Total Items</span>
            <div className="qr-slip-field-value">{documents.length} document(s)</div>
          </div>
          <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
            <div className="qr-slip-qr-frame" style={{ padding: 4 }}>
              <QrCodeGraphic value={verifyPayload} size={64} />
            </div>
            <div style={{ fontSize: 8.5, fontWeight: 700, color: '#64748b', marginTop: 2 }}>
              VERIFY BATCH
            </div>
          </div>
        </div>

        <table className="transmittal-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}>#</th>
              <th style={{ width: 145 }}>Tracking Code</th>
              <th>Document Title / Subject</th>
              <th style={{ width: 96 }}>Format / Pages</th>
              <th style={{ width: 112 }}>Destination</th>
              <th style={{ width: 132 }}>Received By &amp; Date</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc, idx) => {
              const latestTx = doc.transactions[doc.transactions.length - 1];
              const destLabel = latestTx
                ? `${latestTx.toOffice.code} (${latestTx.recipientName})`
                : `${doc.currentOffice.code}`;
              const displayTitle =
                doc.confidentialityTier === 'confidential'
                  ? 'Confidential Record — Verify via Tracely QR'
                  : doc.title;
              const formatInfo =
                doc.copyFormat === 'hard_copy'
                  ? doc.physicalPageCount
                    ? `Hard Copy (${doc.physicalPageCount}p)`
                    : 'Hard Copy'
                  : doc.copyFormat === 'hybrid'
                    ? 'Hybrid'
                    : `Soft Copy (${doc.versions.length}v)`;

              return (
                <tr key={doc.id}>
                  <td className="tabular">{idx + 1}</td>
                  <td className="mono" style={{ fontWeight: 700, fontSize: 10.5 }}>
                    {doc.trackingCode}
                  </td>
                  <td>
                    <div style={{ fontWeight: 700 }}>{displayTitle}</div>
                    <div style={{ fontSize: 9.5, color: '#475569' }}>{doc.categoryName}</div>
                  </td>
                  <td>{formatInfo}</td>
                  <td>{destLabel}</td>
                  <td className="transmittal-sign-cell">
                    {latestTx?.receivedByName
                      ? `${latestTx.receivedByName} · ${latestTx.receivedAt ? formatCompactDate(latestTx.receivedAt) : ''}`
                      : '______________________'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="transmittal-signatories">
          <div className="transmittal-sig-box">
            <div className="qr-slip-field-label">Released / Transmitted By</div>
            <div className="transmittal-sig-line">{preparedBy || '________________________'}</div>
            <div style={{ fontSize: 9.5, color: '#64748b' }}>Signature over Printed Name &amp; Date</div>
          </div>
          <div className="transmittal-sig-box">
            <div className="qr-slip-field-label">Received Complete &amp; Verified By</div>
            <div className="transmittal-sig-line">________________________</div>
            <div style={{ fontSize: 9.5, color: '#64748b' }}>Receiving Officer · Date &amp; Time</div>
          </div>
        </div>

        <div className="qr-slip-footer">
          <span>Tracely · Official Custody Manifest</span>
          <span>Privacy-Safe Custody Printout</span>
        </div>
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-amber"
          onClick={() => printRoutingSlipElement(sheetRef.current)}
        >
          <Printer size={15} /> Print A4 Transmittal Sheet
        </button>
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </ModalDialog>
  );
};

export const QrTokenEntryModal: React.FC<{
  open: boolean;
  isBusy?: boolean;
  expectedTrackingCode?: string | null;
  onClose: () => void;
  onSubmitToken: (rawValue: string) => Promise<void>;
}> = ({ open, isBusy = false, expectedTrackingCode, onClose, onSubmitToken }) => {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = token.trim();
    if (!clean || isBusy) return;
    setError(null);
    try {
      await onSubmitToken(clean);
      setToken('');
      setError(null);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to verify this code. Check the tracking code or QR token and try again.',
      );
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Enter QR Token / Code"
      subtitle={
        expectedTrackingCode
          ? `Enter the Tracking Code or QR token from the sender's routing slip to verify and unlock access`
          : 'Enter a Tracking Code (e.g. TRC-2026-000142) or opaque Tracely QR token to verify custody and unlock access'
      }
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field-group">
          <label className="field-label" htmlFor="manual-qr-input">
            Opaque QR Payload or Tracking Code
          </label>
          <input
            id="manual-qr-input"
            className="input mono"
            autoFocus
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              if (error) setError(null);
            }}
            placeholder="e.g. TRC-2026-000142 or TRC-QR:DOC:..."
          />
          <span className="field-hint">
            Accepts Tracking Code (<span className="mono">TRC-2026-000142</span>), full QR
            payload (<span className="mono">TRC-QR:DOC:...</span>), or raw QR token.
          </span>
        </div>

        {error ? (
          <div
            role="alert"
            className="card-soft"
            style={{
              background: 'var(--rose-soft)',
              borderColor: 'var(--rose-border)',
              color: 'var(--rose-text)',
              fontSize: 12,
              fontWeight: 600,
              padding: '9px 12px',
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-amber" disabled={!token.trim() || isBusy}>
            <Keyboard size={15} /> {isBusy ? 'Verifying...' : 'Verify & Resolve'}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
};

export const ServerEndpointModal: React.FC<{
  open: boolean;
  currentUrl: string;
  onSave: (url: string) => void;
  onClose: () => void;
}> = ({ open, currentUrl, onSave, onClose }) => {
  const [draft, setDraft] = useState(currentUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(currentUrl);
      setError(null);
    }
  }, [open, currentUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError(null);
      onSave(draft);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid API URL.');
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Backend API Endpoint"
      subtitle="Configure your Tracely API v1 server URL"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field-group">
          <label className="field-label" htmlFor="server-url-input">
            API Base URL
          </label>
          <input
            id="server-url-input"
            className="input mono"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="http://127.0.0.1:8000/api/v1"
          />
          {error ? <span style={{ fontSize: 12, color: 'var(--rose-text)' }}>{error}</span> : null}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button
            type="button"
            className="btn btn-soft"
            style={{ fontSize: 12 }}
            onClick={() => setDraft('http://127.0.0.1:8000/api/v1')}
          >
            Local Laravel (127.0.0.1:8000)
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            <Server size={15} /> Save Endpoint
          </button>
        </div>
      </form>
    </ModalDialog>
  );
};

export const TrackDocumentModal: React.FC<{
  open: boolean;
  snapshots: ReadonlyArray<DocumentTrackingSnapshot>;
  onLookupCode: (code: string) => Promise<DocumentTrackingSnapshot | null>;
  onOpenDocument: (documentId: string) => void;
  onClose: () => void;
}> = ({ open, snapshots, onLookupCode, onOpenDocument, onClose }) => {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [lookupResult, setLookupResult] = useState<DocumentTrackingSnapshot | null>(null);

  const filtered = snapshots.filter((snap) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      snap.trackingCode.toLowerCase().includes(q) ||
      snap.displayTitle.toLowerCase().includes(q) ||
      snap.currentOffice.code.toLowerCase().includes(q) ||
      snap.currentOffice.name.toLowerCase().includes(q)
    );
  });

  const pagedSnapshots = paginateList(filtered, page, 6);

  const handleServerLookup = async () => {
    if (!query.trim()) return;
    const found = await onLookupCode(query.trim());
    if (found) setLookupResult(found);
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Track Document Location"
      subtitle="See where any originated or forwarded record currently rests"
    >
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="search-box" style={{ flex: 1 }}>
          <Search size={15} />
          <input
            className="search-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Filter office docs or type tracking code..."
          />
        </div>
        <button type="button" className="btn btn-primary" onClick={handleServerLookup}>
          Lookup
        </button>
      </div>

      {lookupResult ? (
        <TrackingLocationCard
          snapshot={lookupResult}
          defaultExpanded
          onOpenDocument={(id) => {
            onClose();
            onOpenDocument(id);
          }}
        />
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
          Active Routing ({filtered.length})
        </span>
        {filtered.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
            Once connected to your Tracely server, documents originated or sent by your office appear
            here with live timestamps.
          </p>
        ) : (
          <>
            {pagedSnapshots.pageItems.map((snap) => (
              <TrackingLocationCard
                key={snap.documentId}
                snapshot={snap}
                onOpenDocument={(id) => {
                  onClose();
                  onOpenDocument(id);
                }}
              />
            ))}
            <PaginationBar
              totalItems={filtered.length}
              page={pagedSnapshots.safePage}
              pageSize={6}
              itemLabel="tracked docs"
              onPageChange={setPage}
              testId="web-track-modal-pagination"
              compact
            />
          </>
        )}
      </div>
    </ModalDialog>
  );
};

export const AcknowledgeModal: React.FC<{
  open: boolean;
  document: DocumentRecord | null;
  onConfirm: (
    documentId: string,
    remarks: string,
    proofPhoto?: { file: File; sha256Checksum: string } | null,
  ) => Promise<void>;
  onClose: () => void;
}> = ({ open, document, onConfirm, onClose }) => {
  const [remarks, setRemarks] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (proofPreviewUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
        try {
          URL.revokeObjectURL(proofPreviewUrl);
        } catch {
          // Ignore cleanup failure
        }
      }
    };
  }, [proofPreviewUrl]);

  if (!document) return null;

  const isHardCopy = document.copyFormat === 'hard_copy' || document.copyFormat === 'hybrid';

  const clearProof = () => {
    if (proofPreviewUrl && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      try {
        URL.revokeObjectURL(proofPreviewUrl);
      } catch {
        // Ignore
      }
    }
    setProofFile(null);
    setProofPreviewUrl(null);
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={isHardCopy ? 'Confirm Physical Custody Receipt' : 'Confirm Custody Receipt'}
      subtitle={`${document.trackingCode} · ${document.title}`}
    >
      <div className="field-group">
        <label className="field-label" htmlFor="ack-remarks">
          Receipt Remarks (Optional)
        </label>
        <input
          id="ack-remarks"
          className="input"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Verified physical folder with 6 signed pages"
        />
      </div>

      <div className="field-group">
        <div className="field-label-row">
          <span className="field-label">Receive-Proof Photo (Stamped Folder / Slip)</span>
          <span className={`pill ${isHardCopy ? 'pill-amber' : 'pill-slate'}`} style={{ fontSize: 10 }}>
            {isHardCopy ? 'Recommended · Optional' : 'Optional'}
          </span>
        </div>

        {proofFile ? (
          <div
            className="card-soft"
            style={{
              padding: '8px 10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
              {proofPreviewUrl ? (
                <img
                  src={proofPreviewUrl}
                  alt="Receive proof preview"
                  className="staged-file-thumb"
                  style={{ flexShrink: 0 }}
                />
              ) : null}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  title={formatDisplayFileName(proofFile.name)}
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatDisplayFileName(proofFile.name)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--emerald-text)', fontWeight: 600 }}>
                  {formatBytes(proofFile.size)} · SHA-256 verified on upload
                </div>
              </div>
            </div>
            <button
              type="button"
              className="icon-circle-btn"
              style={{ flexShrink: 0 }}
              aria-label="Remove proof photo"
              onClick={clearProof}
            >
              <Trash2 size={14} color="var(--rose-text)" />
            </button>
          </div>
        ) : (
          <label className="file-drop-zone" style={{ padding: '10px 12px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Camera size={16} color="var(--navy)" />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700 }}>Attach stamped-slip photo</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Optional visual proof linked to this custody hop
                </div>
              </div>
            </div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="Attach receive-proof photo"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (!f) return;
                clearProof();
                setProofFile(f);
                if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                  try {
                    setProofPreviewUrl(URL.createObjectURL(f));
                  } catch {
                    setProofPreviewUrl(null);
                  }
                }
                e.target.value = '';
              }}
            />
            <span className="btn btn-outline" style={{ pointerEvents: 'none', minHeight: 30, fontSize: 11 }}>
              Choose Photo
            </span>
          </label>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-amber"
          disabled={submitting}
          onClick={async () => {
            setSubmitting(true);
            try {
              const proofPayload = proofFile
                ? { file: proofFile, sha256Checksum: await computeFileSha256(proofFile) }
                : null;
              await onConfirm(document.id, remarks.trim(), proofPayload);
              setRemarks('');
              clearProof();
              onClose();
            } finally {
              setSubmitting(false);
            }
          }}
        >
          <Check size={15} /> {submitting ? 'Confirming...' : 'Confirm Receipt'}
        </button>
      </div>
    </ModalDialog>
  );
};

export const CompleteDocumentModal: React.FC<{
  open: boolean;
  document: DocumentRecord | null;
  isBusy?: boolean;
  onComplete: (documentId: string, status: 'approved' | 'archived', remarks: string) => Promise<void>;
  onClose: () => void;
}> = ({ open, document, isBusy = false, onComplete, onClose }) => {
  const [targetStatus, setTargetStatus] = useState<'approved' | 'archived'>('approved');
  const [remarks, setRemarks] = useState('');

  if (!document) return null;

  const presets = ['Approved & Released', 'Signed by SDS', 'Filed for Reference', 'Archived / Completed'];

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Finalize Document Disposition"
      subtitle={`${document.trackingCode} · ${document.title}`}
    >
      <div className="segmented-control" role="tablist" aria-label="Final disposition status">
        <button
          type="button"
          role="tab"
          aria-selected={targetStatus === 'approved'}
          className={`segment-btn ${targetStatus === 'approved' ? 'segment-btn-active' : ''}`}
          onClick={() => setTargetStatus('approved')}
        >
          <CheckCircle2 size={14} /> Approved &amp; Released
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={targetStatus === 'archived'}
          className={`segment-btn ${targetStatus === 'archived' ? 'segment-btn-active' : ''}`}
          onClick={() => setTargetStatus('archived')}
        >
          <Archive size={14} /> Archive / Close
        </button>
      </div>

      <div className="card-soft" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        {targetStatus === 'approved' ? (
          <>
            <strong>Approved &amp; Released:</strong> Moves this document out of active Inbox into{' '}
            <strong>Completed</strong>. If you need to return a signed/approved PDF to the requesting
            office, you can still use <strong>Upload Revision</strong> + <strong>Release / Send Back</strong>.
          </>
        ) : (
          <>
            <strong>Archive / Close:</strong> Permanently ends routing at this office and moves the
            document to <strong>Completed</strong>. Archived documents cannot be forwarded further.
          </>
        )}
      </div>

      <div className="field-group">
        <span className="field-label">Quick Disposition Presets</span>
        <div className="chip-row">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`sub-chip ${remarks === preset ? 'sub-chip-active' : ''}`}
              onClick={() => setRemarks(preset)}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div className="field-group">
        <label className="field-label" htmlFor="complete-remarks">
          Final Disposition Remarks (Optional)
        </label>
        <textarea
          id="complete-remarks"
          className="textarea"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="e.g. Approved & released to requesting school head..."
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={isBusy}
          onClick={async () => {
            await onComplete(document.id, targetStatus, remarks.trim());
            setRemarks('');
            onClose();
          }}
        >
          {targetStatus === 'approved' ? 'Mark Approved & Released' : 'Archive Document'}
        </button>
      </div>
    </ModalDialog>
  );
};

export const ForwardModal: React.FC<{
  open: boolean;
  document?: DocumentRecord | null;
  documents?: ReadonlyArray<DocumentRecord>;
  personnel: ReadonlyArray<Personnel>;
  actorId?: string;
  onForward?: (documentId: string, recipientUserId: string, remarks: string) => Promise<void>;
  onForwardBatch?: (
    documentIds: ReadonlyArray<string>,
    recipientUserId: string,
    remarks: string,
  ) => Promise<void>;
  onClose: () => void;
}> = ({ open, document, documents, personnel, actorId, onForward, onForwardBatch, onClose }) => {
  const candidates = personnel.filter((p) => p.id !== actorId);
  const [recipientId, setRecipientId] = useState(candidates[0]?.id ?? '');
  const [remarks, setRemarks] = useState('');
  const [verified, setVerified] = useState(false);

  const targetDocs =
    documents && documents.length > 0 ? documents : document ? [document] : [];
  if (targetDocs.length === 0) return null;
  const effectiveRecipientId = recipientId || candidates[0]?.id || '';
  const chosenRecipient = candidates.find((p) => p.id === effectiveRecipientId) ?? null;
  const blockedDoc = targetDocs.find((d) => {
    const latest = d.transactions[d.transactions.length - 1];
    return d.lifecycleStatus === 'archived' || latest?.status === 'pending';
  });
  const blockReason = blockedDoc
    ? blockedDoc.lifecycleStatus === 'archived'
      ? `${blockedDoc.trackingCode} is archived and closed — it can no longer be forwarded.`
      : `${blockedDoc.trackingCode} is still waiting for the recipient to scan the QR. It must be received first before it can be forwarded again.`
    : null;
  const modalTitle =
    targetDocs.length > 1 ? `Forward ${targetDocs.length} Documents` : 'Forward Document';
  const modalSubtitle =
    targetDocs.length > 1
      ? targetDocs.map((d) => d.trackingCode).join(', ')
      : `${targetDocs[0].trackingCode} · ${targetDocs[0].title}`;

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
    >
      <div className="field-group">
        <label className="field-label" htmlFor="forward-recipient">
          Destination Unit / Officer
        </label>
        <select
          id="forward-recipient"
          className="select"
          value={effectiveRecipientId}
          onChange={(e) => setRecipientId(e.target.value)}
        >
          {candidates.length === 0 ? (
            <option value="">No directory recipients loaded yet</option>
          ) : (
            candidates.map((person) => (
              <option key={person.id} value={person.id}>
                {person.office.code} — {person.fullName} ({person.position})
              </option>
            ))
          )}
        </select>
      </div>
      <div className="field-group">
        <label className="field-label" htmlFor="forward-remarks">
          Routing Remarks
        </label>
        <div className="chip-row" style={{ marginBottom: 4 }}>
          {DISPOSITION_REMARK_PRESETS.slice(0, 5).map((preset) => (
            <button
              key={preset}
              type="button"
              className={`sub-chip ${remarks === preset ? 'sub-chip-active' : ''}`}
              onClick={() => setRemarks(preset)}
            >
              {preset}
            </button>
          ))}
        </div>
        <textarea
          id="forward-remarks"
          className="textarea"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Instructions or endorsement note..."
        />
      </div>
      {blockReason ? (
        <div className="card-soft" role="alert" style={{ background: 'var(--rose-soft)', borderColor: 'var(--rose-border)', color: 'var(--rose-text)', fontSize: 12, fontWeight: 600 }}>
          {blockReason}
        </div>
      ) : (
        <div className="card-soft" style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>
            <strong>Review before dispatch:</strong> {targetDocs.length} document(s) →{' '}
            <strong>
              {chosenRecipient ? `${chosenRecipient.office.code} · ${chosenRecipient.fullName}` : '—'}
            </strong>
            . The recipient only gets a QR notice and must scan the QR / enter the code to receive it.
            You can Recall it until they do.
          </div>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              aria-label="Confirm recipient and attachments are correct"
            />
            <span>I confirm the recipient is correct and the document (and any attachments / hard copy) is complete.</span>
          </label>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!effectiveRecipientId || !verified || Boolean(blockReason)}
          onClick={async () => {
            if (targetDocs.length > 1 && onForwardBatch) {
              await onForwardBatch(
                targetDocs.map((d) => d.id),
                effectiveRecipientId,
                remarks.trim(),
              );
            } else if (onForward) {
              await onForward(targetDocs[0].id, effectiveRecipientId, remarks.trim());
            }
            setRemarks('');
            setVerified(false);
            onClose();
          }}
        >
          Dispatch Forward
        </button>
      </div>
    </ModalDialog>
  );
};

export const TextReasonModal: React.FC<{
  open: boolean;
  title: string;
  subtitle: string;
  actionLabel: string;
  onSubmit: (text: string) => Promise<void>;
  onClose: () => void;
}> = ({ open, title, subtitle, actionLabel, onSubmit, onClose }) => {
  const [text, setText] = useState('');
  return (
    <ModalDialog open={open} onClose={onClose} title={title} subtitle={subtitle}>
      <textarea
        className="textarea"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter mandatory custody remarks..."
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-danger-outline"
          disabled={!text.trim()}
          onClick={async () => {
            await onSubmit(text.trim());
            setText('');
            onClose();
          }}
        >
          {actionLabel}
        </button>
      </div>
    </ModalDialog>
  );
};

const VERSION_CHANGE_TYPE_OPTIONS: ReadonlyArray<{
  readonly id: VersionChangeType;
  readonly label: string;
  readonly defaultNote: string;
}> = [
  { id: 'signed', label: 'Signed / Countersigned', defaultNote: 'Countersigned and attached updated copy' },
  { id: 'revised', label: 'Revised Copy', defaultNote: 'Revised document content per remarks' },
  { id: 'endorsed', label: 'Endorsed / Stamped', defaultNote: 'Endorsed and stamped by office' },
  { id: 'supporting_attachment', label: 'Supporting File', defaultNote: 'Attached supporting document' },
];

export const RevisionUploadModal: React.FC<{
  open: boolean;
  document: DocumentRecord | null;
  onUpload: (
    file: File,
    sha256: string,
    note: string,
    fileName?: string,
    changeType?: VersionChangeType,
  ) => Promise<void>;
  onClose: () => void;
}> = ({ open, document, onUpload, onClose }) => {
  const [file, setFile] = useState<File | null>(null);
  const [customFileName, setCustomFileName] = useState('');
  const [changeType, setChangeType] = useState<VersionChangeType>('signed');
  const [note, setNote] = useState('');
  const [hashing, setHashing] = useState(false);

  useEffect(() => {
    if (!open || !document) return;
    if (document.versions.length === 0) {
      setChangeType('initial');
    } else if (document.lifecycleStatus === 'returned_for_revision') {
      setChangeType('revised');
    } else {
      setChangeType('signed');
    }
  }, [open, document]);

  if (!document) return null;
  const isFirstDigital = document.versions.length === 0;
  const nextVersionNumber =
    document.versions.reduce((max, v) => Math.max(max, v.versionNumber), 0) + 1;
  const resolvedName = file ? normalizeUploadFileName(customFileName, file.name) : '';

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={
        isFirstDigital
          ? 'Attach Scanned Soft Copy (v1)'
          : `Attach Signed / Updated File (v${nextVersionNumber})`
      }
      subtitle={`${document.trackingCode} · ${document.title}`}
    >
      {!isFirstDigital ? (
        <div
          className="card-soft"
          style={{
            padding: '10px 12px',
            fontSize: 12,
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            background: 'var(--sky-soft)',
            borderColor: 'var(--sky-border)',
          }}
        >
          <strong style={{ color: 'var(--navy-ink)' }}>Non-destructive version history:</strong>{' '}
          Earlier versions (e.g. v1) remain permanently preserved read-only in Change History. This
          file becomes the active <strong>v{nextVersionNumber} (Latest)</strong> for the next
          office.
        </div>
      ) : null}

      {!isFirstDigital ? (
        <div className="field-group">
          <span className="field-label">What changed in this file?</span>
          <div className="chip-row" style={{ flexWrap: 'wrap' }}>
            {VERSION_CHANGE_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                data-testid={`web-version-change-type-${opt.id}`}
                className={`sub-chip ${changeType === opt.id ? 'sub-chip-active' : ''}`}
                onClick={() => {
                  setChangeType(opt.id);
                  if (!note.trim()) {
                    setNote(opt.defaultNote);
                  }
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="field-group">
        <label className="field-label" htmlFor="rev-file-input">
          Select PDF or Scanned Image
        </label>
        <input
          id="rev-file-input"
          type="file"
          accept=".pdf,image/*"
          className="input"
          onChange={(e) => {
            const chosen = e.target.files?.[0] ?? null;
            setFile(chosen);
            setCustomFileName(chosen ? formatDisplayFileName(chosen.name) : '');
          }}
        />
        {file ? (
          <span
            className="field-hint"
            style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}
          >
            {resolvedName} · {formatBytes(file.size)}
          </span>
        ) : null}
      </div>
      {file ? (
        <div className="field-group">
          <label className="field-label" htmlFor="rev-filename-input">
            <Pencil size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
            File Name
          </label>
          <input
            id="rev-filename-input"
            className="input"
            maxLength={180}
            value={customFileName}
            onChange={(e) => setCustomFileName(e.target.value)}
            placeholder={file.name}
          />
        </div>
      ) : null}
      <div className="field-group">
        <label className="field-label" htmlFor="rev-note-input">
          Change Summary / Version Note
        </label>
        <input
          id="rev-note-input"
          className="input"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Countersigned by Budget Officer; added approval stamp"
        />
        {!isFirstDigital ? (
          <div className="chip-row" style={{ flexWrap: 'wrap', marginTop: 4 }}>
            {VERSION_CHANGE_TYPE_OPTIONS.map((opt) => (
              <button
                key={`preset-${opt.id}`}
                type="button"
                className="sub-chip"
                style={{ fontSize: 11 }}
                onClick={() => {
                  setChangeType(opt.id);
                  setNote(opt.defaultNote);
                }}
              >
                {opt.defaultNote}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          data-testid="web-upload-version-submit"
          disabled={!file || !note.trim() || hashing}
          onClick={async () => {
            if (!file) return;
            setHashing(true);
            try {
              const sha256 = await computeFileSha256(file);
              await onUpload(
                file,
                sha256,
                note.trim(),
                resolvedName,
                isFirstDigital ? 'initial' : changeType,
              );
              setFile(null);
              setCustomFileName('');
              setNote('');
              onClose();
            } finally {
              setHashing(false);
            }
          }}
        >
          <Upload size={15} />{' '}
          {hashing
            ? 'Hashing SHA-256...'
            : isFirstDigital
              ? 'Attach Scan (v1)'
              : `Attach File (v${nextVersionNumber})`}
        </button>
      </div>
    </ModalDialog>
  );
};

function detectPreviewKind(mimeType: string, fileName: string): 'image' | 'pdf' | 'other' {
  const mime = mimeType.toLowerCase();
  const lowerName = fileName.toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(lowerName)) {
    return 'image';
  }
  if (mime === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return 'pdf';
  }
  return 'other';
}

export const PresignedViewerModal: React.FC<{
  grant: PresignedDownloadGrant | null;
  requireSessionLock?: boolean;
  actorName?: string;
  onClose: () => void;
}> = ({ grant, requireSessionLock = false, actorName, onClose }) => {
  const [unlockedGrant, setUnlockedGrant] = useState<PresignedDownloadGrant | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [zoomed, setZoomed] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!grant) {
      setUnlockedGrant(null);
      return;
    }
    setSecondsLeft(grant.ttlSeconds);
    setZoomed(false);
    setPreviewError(false);
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [grant]);

  if (!grant) return null;

  const unlocked = !requireSessionLock || unlockedGrant === grant;
  const previewKind = detectPreviewKind(grant.version.mimeType, grant.version.fileName);
  const expired = secondsLeft === 0;
  const watermarkStamp = `${actorName || 'Authorized Viewer'} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · TRACELY PROTECTED`;

  const handleDownload = async () => {
    if (!unlocked || expired || downloading) return;
    setDownloading(true);
    try {
      const response = await fetch(grant.url, { cache: 'no-store' });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = grant.version.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch {
      window.open(grant.url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <ModalDialog
      open={Boolean(grant)}
      wide
      onClose={onClose}
      title={`${formatDisplayFileName(grant.version.fileName)} · v${grant.version.versionNumber}`}
      subtitle="In-app secure document viewer · Policy verified & audit logged"
    >
      <div className="viewer-meta-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="pill pill-emerald">
            <Lock size={11} /> Signed Access
          </span>
          <span className="pill pill-slate">
            <Timer size={11} /> {expired ? 'Expired' : `${secondsLeft}s TTL`}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>
            {formatBytes(grant.version.sizeBytes)}
          </span>
        </div>
        <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          SHA-256: {grant.version.sha256Checksum.slice(0, 20)}...
        </div>
      </div>

      {!unlocked ? (
        <div
          className="card-soft"
          style={{
            background: 'var(--amber-soft)',
            borderColor: 'var(--amber-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--amber-text)' }}>
            Session Verification Required
          </div>
          <div style={{ fontSize: 12, color: 'var(--amber-text)' }}>
            Device Lock for Confidential Docs is enabled. Confirm your active session before opening
            the signed file viewer.
          </div>
          <button type="button" className="btn btn-amber" onClick={() => setUnlockedGrant(grant)}>
            <ShieldCheck size={15} /> Confirm Access{actorName ? ` as ${actorName}` : ''}
          </button>
        </div>
      ) : expired ? (
        <div className="viewer-stage viewer-stage-empty" data-testid="viewer-expired-notice">
          <Lock size={22} color="var(--text-muted)" />
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            Signed access link expired
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Close this viewer and click View again to issue a fresh 60-second signed link.
          </div>
        </div>
      ) : previewKind === 'image' && !previewError ? (
        <div className={`viewer-stage${zoomed ? ' viewer-stage-zoomed' : ''}`}>
          <div className="viewer-toolbar">
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>
              Image Preview
            </span>
            <button
              type="button"
              className="btn btn-outline"
              style={{ minHeight: 28, padding: '2px 10px', fontSize: 11 }}
              onClick={() => setZoomed((prev) => !prev)}
            >
              {zoomed ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              {zoomed ? 'Fit' : 'Zoom 100%'}
            </button>
          </div>
          <div className="viewer-image-wrap" style={{ position: 'relative' }}>
            <img
              src={grant.url}
              alt={grant.version.fileName}
              className={zoomed ? 'viewer-image viewer-image-zoomed' : 'viewer-image'}
              onError={() => setPreviewError(true)}
            />
            {requireSessionLock ? (
              <div className="viewer-watermark-overlay" data-testid="web-viewer-watermark" aria-hidden="true">
                <span>{watermarkStamp}</span>
                <span>{watermarkStamp}</span>
                <span>{watermarkStamp}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : previewKind === 'pdf' && !previewError ? (
        <div className="viewer-stage" style={{ position: 'relative' }}>
          <iframe
            src={grant.url}
            title={`Document preview for ${grant.version.fileName}`}
            className="viewer-iframe"
            data-testid="web-pdf-viewer-iframe"
          />
          {requireSessionLock ? (
            <div className="viewer-watermark-overlay" data-testid="web-viewer-watermark" aria-hidden="true">
              <span>{watermarkStamp}</span>
              <span>{watermarkStamp}</span>
              <span>{watermarkStamp}</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="viewer-stage viewer-stage-empty">
          <FileText size={24} color="var(--navy)" />
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
            {previewError
              ? 'Inline preview could not be loaded for this file.'
              : 'Inline preview is unavailable for this format.'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Use Download or Open in New Tab below to inspect {grant.version.fileName}.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-outline" onClick={onClose}>
          Close
        </button>
        {unlocked && !expired ? (
          <>
            <button
              type="button"
              className="btn btn-outline"
              disabled={downloading}
              onClick={() => void handleDownload()}
            >
              <Download size={15} /> {downloading ? 'Saving...' : 'Download'}
            </button>
            <a
              href={grant.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ textDecoration: 'none' }}
            >
              <ExternalLink size={15} /> Open File
            </a>
          </>
        ) : null}
      </div>
    </ModalDialog>
  );
};

export const AuditTrailModal: React.FC<{
  open: boolean;
  logs: ReadonlyArray<AuditLogEntry>;
  onClose: () => void;
}> = ({ open, logs, onClose }) => {
  const [page, setPage] = useState(1);
  const pagedLogs = paginateList(logs, page, 10);

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title="Document Audit Trail"
      subtitle="Immutable custody, scan, and download log"
    >
      {logs.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0' }}>
          No audit entries loaded for this record yet.
        </div>
      ) : (
        <>
          <div className="no-print" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-outline"
              style={{ minHeight: 34, padding: '4px 12px', fontSize: 12 }}
              onClick={() =>
                downloadCsvFile(
                  `tracely-audit-${new Date().toISOString().slice(0, 10)}.csv`,
                  buildAuditLogsCsv(logs),
                )
              }
            >
              <Download size={14} /> Export CSV
            </button>
            <button
              type="button"
              className="btn btn-outline"
              style={{ minHeight: 34, padding: '4px 12px', fontSize: 12 }}
              onClick={() => window.print?.()}
            >
              <Printer size={14} /> Print Log
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pagedLogs.pageItems.map((entry) => (
              <div key={entry.id} className="card-soft" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <strong style={{ color: 'var(--navy)' }}>
                    <History size={12} style={{ marginRight: 5 }} />
                    {entry.action}
                  </strong>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {formatCompactDate(entry.createdAt)} {formatClockTime(entry.createdAt)}
                  </span>
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{entry.summary}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {entry.actorName} ({entry.officeCode})
                </div>
              </div>
            ))}
          </div>
          <PaginationBar
            totalItems={logs.length}
            page={pagedLogs.safePage}
            pageSize={10}
            itemLabel="audit events"
            onPageChange={setPage}
            testId="web-audit-modal-pagination"
            compact
          />
        </>
      )}
    </ModalDialog>
  );
};

export const EditDocumentModal: React.FC<{
  open: boolean;
  document: DocumentRecord | null;
  categories: ReadonlyArray<DocumentCategory>;
  isBusy?: boolean;
  onSave: (patch: DocumentUpdatePayload) => Promise<void>;
  onOpenRevisionUpload?: () => void;
  onClose: () => void;
}> = ({ open, document: docRecord, categories, isBusy, onSave, onOpenRevisionUpload, onClose }) => {
  const [title, setTitle] = useState(docRecord?.title ?? '');
  const [categoryId, setCategoryId] = useState(docRecord?.categoryId ?? '');
  const [tier, setTier] = useState<ConfidentialityTier>(
    docRecord?.confidentialityTier ?? 'standard_internal',
  );
  const [physicalRef, setPhysicalRef] = useState(docRecord?.physicalReference ?? '');
  const [pageCount, setPageCount] = useState(
    docRecord?.physicalPageCount ? String(docRecord.physicalPageCount) : '',
  );

  useEffect(() => {
    if (!docRecord) return;
    setTitle(docRecord.title);
    setCategoryId(docRecord.categoryId);
    setTier(docRecord.confidentialityTier);
    setPhysicalRef(docRecord.physicalReference ?? '');
    setPageCount(docRecord.physicalPageCount ? String(docRecord.physicalPageCount) : '');
  }, [docRecord]);

  if (!docRecord) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPages = pageCount.trim() ? Number.parseInt(pageCount.trim(), 10) : null;
    await onSave({
      title: title.trim(),
      categoryId,
      confidentialityTier: tier,
      physicalReference: physicalRef.trim() || null,
      physicalPageCount:
        parsedPages && !Number.isNaN(parsedPages) && parsedPages > 0 ? parsedPages : null,
    });
    onClose();
  };

  return (
    <ModalDialog
      open={open}
      onClose={onClose}
      title={`Edit Document · ${docRecord.trackingCode}`}
      subtitle="Update title, category, confidentiality, or physical folder info after recall or return before re-sending"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label className="field-label" htmlFor="edit-doc-title">
            Document Title / Subject
          </label>
          <input
            id="edit-doc-title"
            aria-label="Edit Document Title"
            className="input"
            value={title}
            maxLength={240}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <div>
            <label className="field-label" htmlFor="edit-doc-category">
              Category
            </label>
            <select
              id="edit-doc-category"
              aria-label="Edit Document Category"
              className="select"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.code} — {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="edit-doc-tier">
              Confidentiality Tier
            </label>
            <select
              id="edit-doc-tier"
              aria-label="Edit Confidentiality Tier"
              className="select"
              value={tier}
              onChange={(e) => setTier(e.target.value as ConfidentialityTier)}
            >
              <option value="standard_internal">Standard Internal</option>
              <option value="restricted">Restricted</option>
              <option value="confidential">Confidential (Restricted)</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
          <div>
            <label className="field-label" htmlFor="edit-doc-phys-ref">
              Physical Folder / Envelope Reference
            </label>
            <input
              id="edit-doc-phys-ref"
              aria-label="Edit Physical Folder Reference"
              className="input"
              value={physicalRef}
              maxLength={120}
              onChange={(e) => setPhysicalRef(e.target.value)}
              placeholder="e.g. Folder #12-B"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="edit-doc-pages">
              Page Count
            </label>
            <input
              id="edit-doc-pages"
              aria-label="Edit Physical Page Count"
              type="number"
              min={1}
              max={5000}
              className="input"
              value={pageCount}
              onChange={(e) => setPageCount(e.target.value)}
              placeholder="Pages"
            />
          </div>
        </div>

        {onOpenRevisionUpload ? (
          <div
            className="card-soft"
            style={{
              padding: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Need to replace or attach a corrected PDF / scanned image file?
            </span>
            <button
              type="button"
              className="btn btn-outline"
              style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
              onClick={() => {
                onClose();
                onOpenRevisionUpload();
              }}
            >
              <Upload size={13} /> Upload Revised File
            </button>
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isBusy || title.trim().length < 3}
          >
            <Check size={14} /> Save Changes
          </button>
        </div>
      </form>
    </ModalDialog>
  );
};
