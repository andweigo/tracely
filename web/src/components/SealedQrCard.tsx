import React from 'react';
import { ChevronRight, Lock, QrCode } from 'lucide-react';
import { DocumentRecord } from '../domain/types';
import { formatElapsedTime, formatRelativeTime } from '../utils/formatters';
import { SlaBadge } from './Badges';

interface SealedQrCardProps {
  readonly doc: DocumentRecord;
  readonly compact?: boolean;
  readonly onScan: (doc: DocumentRecord) => void;
  readonly onDecline?: (doc: DocumentRecord) => void;
}

const FORMAT_TEXT: Record<DocumentRecord['copyFormat'], string> = {
  digital: 'Soft Copy',
  hard_copy: 'Hard Copy',
  hybrid: 'Hybrid',
};

const TIER_TEXT: Record<DocumentRecord['confidentialityTier'], string | null> = {
  standard_internal: null,
  restricted: 'Restricted',
  confidential: 'Confidential',
};

function maskTrackingCodeDisplay(code: string): string {
  const clean = code.trim();
  if (!clean) return 'TRC-••••••';
  if (clean.includes('•')) return clean;
  const lastDash = clean.lastIndexOf('-');
  if (lastDash > 0) {
    return `${clean.slice(0, lastDash + 1)}••••••`;
  }
  return `${clean.slice(0, 4)}••••`;
}

/**
 * Clean decorative locked QR icon (never encodes real qr_token or tracking code).
 * Clicking it redirects the recipient straight to the QR Scanner.
 */
export const SealedQrGlyph: React.FC<{ readonly size?: number }> = ({ size = 64 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 80 80"
    fill="none"
    aria-hidden="true"
    style={{ display: 'block' }}
  >
    {/* Top-left finder */}
    <rect x="6" y="6" width="21" height="21" rx="4" stroke="#0D3472" strokeWidth="3.2" />
    <rect x="12.5" y="12.5" width="8" height="8" rx="1.8" fill="#0D3472" />
    {/* Top-right finder */}
    <rect x="53" y="6" width="21" height="21" rx="4" stroke="#0D3472" strokeWidth="3.2" />
    <rect x="59.5" y="12.5" width="8" height="8" rx="1.8" fill="#0D3472" />
    {/* Bottom-left finder */}
    <rect x="6" y="53" width="21" height="21" rx="4" stroke="#0D3472" strokeWidth="3.2" />
    <rect x="12.5" y="59.5" width="8" height="8" rx="1.8" fill="#0D3472" />
    {/* Subtle quiet data modules */}
    <g fill="#94A3B8" opacity="0.45">
      <rect x="34" y="8" width="5" height="5" rx="1.2" />
      <rect x="42" y="16" width="5" height="5" rx="1.2" />
      <rect x="8" y="35" width="5" height="5" rx="1.2" />
      <rect x="17" y="42" width="5" height="5" rx="1.2" />
      <rect x="60" y="35" width="5" height="5" rx="1.2" />
      <rect x="68" y="43" width="5" height="5" rx="1.2" />
      <rect x="34" y="62" width="5" height="5" rx="1.2" />
      <rect x="54" y="54" width="6" height="6" rx="1.5" />
      <rect x="66" y="54" width="6" height="6" rx="1.5" />
      <rect x="54" y="66" width="6" height="6" rx="1.5" />
      <rect x="66" y="66" width="6" height="6" rx="1.5" />
    </g>
    {/* Center lock seal */}
    <circle cx="40" cy="40" r="14.5" fill="#FFFFFF" />
    <circle cx="40" cy="40" r="12" fill="#F3B32A" />
    <rect x="34.8" y="39" width="10.4" height="8" rx="2" fill="#0D1B3E" />
    <path
      d="M37.2 39V36.5C37.2 34.9 38.4 33.7 40 33.7C41.6 33.7 42.8 34.9 42.8 36.5V39"
      stroke="#0D1B3E"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Clean sealed QR envelope card for pending incoming transfers.
 * Clicking the QR tile or card redirects directly to the QR Scanner.
 */
export const SealedQrCard: React.FC<SealedQrCardProps> = ({
  doc,
  compact = false,
  onScan,
  onDecline,
}) => {
  const latest = doc.transactions[doc.transactions.length - 1] ?? null;
  const fromOffice = latest?.fromOffice ?? doc.originOffice;
  const fromUser = latest?.fromUserName ?? doc.originUserName;
  const sentElapsed = latest?.sentAt ? formatElapsedTime(latest.sentAt) : '';
  const sealedFilesCount =
    typeof doc.attachmentCount === 'number' ? doc.attachmentCount : doc.versions.length;
  const maskedCode = maskTrackingCodeDisplay(doc.trackingCode);
  const tierNote = TIER_TEXT[doc.confidentialityTier];

  const metaLine = [
    `From ${fromOffice.code}${fromUser ? ` · ${fromUser}` : ''}`,
    sentElapsed || null,
    sealedFilesCount > 0
      ? `${sealedFilesCount} ${sealedFilesCount === 1 ? 'file' : 'files'}`
      : FORMAT_TEXT[doc.copyFormat],
    !compact && tierNote ? tierNote : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const isSoftCopy = doc.copyFormat === 'digital';
  const primaryLabel = isSoftCopy ? 'Show Unlock QR' : 'Receive Hard Copy';
  const compactHint = isSoftCopy ? 'Click to show Unlock QR' : 'Click to receive Hard Copy';

  return (
    <div
      data-testid={`sealed-qr-card-${doc.id}`}
      role="button"
      tabIndex={0}
      className={`doc-card sealed-qr-card${compact ? ' sealed-qr-card-compact' : ''}`}
      onClick={() => onScan(doc)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onScan(doc);
        }
      }}
    >
      <div className="sealed-qr-layout">
        <button
          type="button"
          className="sealed-qr-tile"
          data-testid={`sealed-qr-trigger-${doc.id}`}
          aria-label={
            isSoftCopy
              ? `Show unlock QR for soft copy from ${fromOffice.code}`
              : `Receive hard copy transfer from ${fromOffice.code}`
          }
          onClick={(e) => {
            e.stopPropagation();
            onScan(doc);
          }}
        >
          <SealedQrGlyph size={compact ? 52 : 64} />
        </button>

        <div className="sealed-qr-body">
          <div className="sealed-qr-top">
            <span className="mono sealed-qr-code">
              <Lock size={11} />
              <span>{maskedCode}</span>
            </span>
            <SlaBadge state={doc.slaState} suffix={formatRelativeTime(doc.slaDueAt)} />
          </div>

          <h4 className="doc-title sealed-qr-title">Sealed Incoming Document</h4>
          <p className="doc-meta sealed-qr-meta">{metaLine}</p>

          {!compact ? (
            <div className="sealed-qr-footer no-print" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="btn btn-amber sealed-qr-scan-btn"
                onClick={() => onScan(doc)}
              >
                <QrCode size={14} /> {primaryLabel}
              </button>
              {onDecline ? (
                <button
                  type="button"
                  className="sealed-qr-decline-link"
                  onClick={() => onDecline(doc)}
                >
                  Misrouted
                </button>
              ) : null}
            </div>
          ) : (
            <div className="sealed-qr-compact-footer no-print" onClick={(e) => e.stopPropagation()}>
              <span className="sealed-qr-tap-hint">
                {compactHint} <ChevronRight size={13} />
              </span>
              {onDecline ? (
                <button
                  type="button"
                  className="sealed-qr-decline-link"
                  onClick={() => onDecline(doc)}
                >
                  Misrouted
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
