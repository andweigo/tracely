import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileCheck2,
  FileStack,
  FolderClosed,
  Lock,
  Pause,
  Play,
  QrCode,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Unlock,
} from 'lucide-react';
import { QrMatrixSvg } from './QrMatrixSvg';

type FormatMode = 'hard_copy' | 'digital';

interface DemoStage {
  readonly id: number;
  readonly key: string;
  readonly label: string;
  readonly office: string;
  readonly custodian: string;
  readonly timestamp: string;
  readonly statusPill: string;
  readonly statusTone: 'navy' | 'amber' | 'teal' | 'emerald';
  readonly slaLabel: string;
  readonly detailHardCopy: string;
  readonly detailDigital: string;
  readonly securityNote: string;
  readonly nextActionLabel: string;
  readonly sealed: boolean;
}

const DEMO_STAGES: ReadonlyArray<DemoStage> = [
  {
    id: 0,
    key: 'registered',
    label: 'Registered & Sealed',
    office: 'Records Unit',
    custodian: 'Elena Santos · Records Officer',
    timestamp: '09:04 AM',
    statusPill: 'Registered',
    statusTone: 'navy',
    slaLabel: 'SLA · 24h Window',
    detailHardCopy:
      'Printable QR routing slip attached to physical folder (14 pages). Tracking ID locked to Records Unit.',
    detailDigital:
      '3 PDF attachments bundled under one tracking ID with SHA-256 fingerprint verified on upload.',
    securityNote: 'Opaque QR token issued · Zero PII embedded in QR code',
    nextActionLabel: 'Dispatch to Finance →',
    sealed: false,
  },
  {
    id: 1,
    key: 'in_transit',
    label: 'In Transit (Sealed)',
    office: 'Records → Finance & Budget',
    custodian: 'Awaiting Finance scan to unlock',
    timestamp: '09:12 AM',
    statusPill: 'Sealed in Transit',
    statusTone: 'amber',
    slaLabel: 'SLA · 23h 52m Left',
    detailHardCopy:
      'Folder dispatched to Finance & Budget. Transfer remains sealed until destination scans the slip QR.',
    detailDigital:
      'Digital bundle sealed in transit. File viewing stays locked until recipient scans QR or enters 6-char unlock code.',
    securityNote: 'Sender self-receipt blocked · Destination verification required',
    nextActionLabel: 'Simulate QR Scan Unlock →',
    sealed: true,
  },
  {
    id: 2,
    key: 'received',
    label: 'Received & Reviewing',
    office: 'Finance & Budget Unit',
    custodian: 'Marco Villanueva · Budget Officer',
    timestamp: '09:28 AM',
    statusPill: 'Custody Verified',
    statusTone: 'teal',
    slaLabel: 'On Track · 22h Left',
    detailHardCopy:
      'Scanned via Android camera with optional EXIF-stripped proof photo. Custody officially transferred.',
    detailDigital:
      'Unlocked via QR scan on mobile & synced instantly to desktop browser workspace. Integrity intact.',
    securityNote: 'Timestamped audit log written · Previous office notified',
    nextActionLabel: 'Approve & Archive →',
    sealed: false,
  },
  {
    id: 3,
    key: 'approved',
    label: 'Approved & Archived',
    office: 'Executive Office',
    custodian: 'Clara Reyes · Division Director',
    timestamp: '11:45 AM',
    statusPill: 'Completed · Verified',
    statusTone: 'emerald',
    slaLabel: 'Completed in 2h 41m',
    detailHardCopy:
      'Final sign-off recorded. Complete physical handoff trail preserved for A4 executive reports & audits.',
    detailDigital:
      'Final approval sealed with full version history, immutable audit trail, and public QR verification badge.',
    securityNote: 'SHA-256 integrity passed · Public verification active',
    nextActionLabel: 'Replay Custody Chain',
    sealed: false,
  },
];

export const HeroCustodyDemo: React.FC = () => {
  const [format, setFormat] = useState<FormatMode>('hard_copy');
  const [stageIndex, setStageIndex] = useState<number>(1);
  const [autoPlay, setAutoPlay] = useState<boolean>(false);

  useEffect(() => {
    if (!autoPlay) return;
    const timer = window.setInterval(() => {
      setStageIndex((prev) => (prev + 1) % DEMO_STAGES.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [autoPlay]);

  const current = DEMO_STAGES[stageIndex];
  const trackingCode = format === 'hard_copy' ? 'TRC-2026-00418' : 'TRC-2026-00419';
  const docTitle =
    format === 'hard_copy'
      ? 'Q4 Infrastructure & Operations Budget Request'
      : 'Vendor Procurement Specification Bundle (3 PDFs)';

  const handleAdvance = () => {
    setAutoPlay(false);
    setStageIndex((prev) => (prev + 1) % DEMO_STAGES.length);
  };

  return (
    <div className="hero-demo-card" aria-label="Interactive Tracely document custody demonstration">
      <div className="demo-topbar">
        <div className="demo-topbar-left">
          <span className="live-dot" aria-hidden="true" />
          <span className="demo-topbar-label">Live Custody Simulator</span>
        </div>
        <div className="demo-format-toggle" role="tablist" aria-label="Document format">
          <button
            type="button"
            role="tab"
            aria-selected={format === 'hard_copy'}
            className={`demo-tab ${format === 'hard_copy' ? 'is-active' : ''}`}
            onClick={() => setFormat('hard_copy')}
          >
            <FolderClosed size={13} />
            Hard Copy
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={format === 'digital'}
            className={`demo-tab ${format === 'digital' ? 'is-active' : ''}`}
            onClick={() => setFormat('digital')}
          >
            <FileStack size={13} />
            Digital Bundle
          </button>
        </div>
      </div>

      <div className="demo-doc-header">
        <div className="demo-doc-meta">
          <div className="demo-code-row">
            <span className="mono-chip">{trackingCode}</span>
            <span className={`status-pill tone-${current.statusTone}`}>
              {current.sealed ? <Lock size={11} /> : <CheckCircle2 size={11} />}
              {current.statusPill}
            </span>
          </div>
          <h3 className="demo-doc-title">{docTitle}</h3>
          <div className="demo-submeta">
            <span>
              <Clock size={12} /> {current.slaLabel}
            </span>
            <span className="meta-dot">·</span>
            <span className="mono-inline">
              {format === 'hard_copy' ? '14 physical pages' : 'SHA-256 · e3b0c4…9a1f'}
            </span>
          </div>
        </div>
        <div className="demo-mini-qr" title="Opaque QR Custody Token">
          <QrMatrixSvg
            value={`https://tracely-web.up.railway.app/#/verify/${trackingCode}`}
            size={62}
            label={`QR code for ${trackingCode}`}
          />
          <span className="demo-qr-caption">
            <QrCode size={10} /> QR Token
          </span>
        </div>
      </div>

      {/* Interactive 4-step Custody Timeline */}
      <div className="demo-timeline" role="list" aria-label="Document custody stages">
        {DEMO_STAGES.map((stage, idx) => {
          const isCompleted = idx < stageIndex;
          const isCurrent = idx === stageIndex;
          return (
            <button
              key={stage.key}
              type="button"
              role="listitem"
              aria-current={isCurrent ? 'step' : undefined}
              className={`timeline-step ${isCurrent ? 'is-current' : ''} ${isCompleted ? 'is-done' : ''}`}
              onClick={() => {
                setAutoPlay(false);
                setStageIndex(idx);
              }}
            >
              <span className="step-node">
                {isCompleted ? (
                  <CheckCircle2 size={14} />
                ) : isCurrent && stage.sealed ? (
                  <Lock size={13} />
                ) : isCurrent ? (
                  <ScanLine size={13} />
                ) : (
                  <span className="step-num">{idx + 1}</span>
                )}
              </span>
              <span className="step-body">
                <span className="step-head">
                  <strong>{stage.label}</strong>
                  <span className="step-time">{idx <= stageIndex ? stage.timestamp : 'Pending'}</span>
                </span>
                <span className="step-office">
                  {stage.office} · {stage.custodian}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Contextual Custody Event Inspector */}
      <div className={`demo-inspector ${current.sealed ? 'is-sealed' : ''}`}>
        <div className="inspector-head">
          {current.sealed ? (
            <Lock size={14} className="inspector-icon amber" />
          ) : stageIndex === 3 ? (
            <FileCheck2 size={14} className="inspector-icon emerald" />
          ) : (
            <Unlock size={14} className="inspector-icon teal" />
          )}
          <span>{format === 'hard_copy' ? current.detailHardCopy : current.detailDigital}</span>
        </div>
        <div className="inspector-security">
          <ShieldCheck size={13} />
          <span>{current.securityNote}</span>
        </div>
      </div>

      <div className="demo-footer">
        <button
          type="button"
          className="demo-autoplay-btn"
          onClick={() => setAutoPlay((v) => !v)}
          aria-pressed={autoPlay}
        >
          {autoPlay ? <Pause size={13} /> : <Play size={13} />}
          {autoPlay ? 'Pause Tour' : 'Auto-Play'}
        </button>
        <button type="button" className="demo-action-btn" onClick={handleAdvance}>
          {stageIndex === DEMO_STAGES.length - 1 ? <RotateCcw size={14} /> : <ScanLine size={14} />}
          <span>{current.nextActionLabel}</span>
        </button>
      </div>
    </div>
  );
};
