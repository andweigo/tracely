import React, { useEffect, useRef, useState } from 'react';
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
  Sparkles,
  Unlock,
} from 'lucide-react';
import { QrMatrixSvg } from './QrMatrixSvg';

type FormatMode = 'hard_copy' | 'digital';

interface VestigeStage {
  readonly id: number;
  readonly key: string;
  readonly stepCode: string;
  readonly office: string;
  readonly shortOffice: string;
  readonly custodian: string;
  readonly roleTitle: string;
  readonly timestamp: string;
  readonly statusPill: string;
  readonly statusTone: 'sky' | 'amber' | 'teal' | 'emerald';
  readonly accentHex: string;
  readonly glowRgba: string;
  readonly slaLabel: string;
  readonly headline: string;
  readonly detailHardCopy: string;
  readonly detailDigital: string;
  readonly securityNote: string;
  readonly nextActionLabel: string;
  readonly sealed: boolean;
  // Exact anchor coordinates along the 1000x300 SVG energy road
  readonly cx: number;
  readonly cy: number;
  readonly pathFraction: number;
}

// Sinuous sweeping "One For All" energy road curving through all 4 office vestiges
const MAIN_ROAD_PATH =
  'M 110 212 C 215 212, 265 92, 370 98 C 475 104, 525 218, 635 206 C 745 194, 795 92, 892 98';
const UPPER_FILAMENT_PATH =
  'M 110 202 C 218 186, 260 76, 370 88 C 482 100, 522 204, 635 192 C 748 180, 792 78, 892 89';
const LOWER_FILAMENT_PATH =
  'M 110 222 C 212 234, 270 112, 370 110 C 468 108, 528 232, 635 218 C 742 204, 798 108, 892 108';

const AMBIENT_SPARKS = [
  { cx: 168, cy: 142, r: 1.8, delay: '0s' },
  { cx: 245, cy: 64, r: 2.2, delay: '0.6s' },
  { cx: 312, cy: 168, r: 1.5, delay: '1.1s' },
  { cx: 458, cy: 76, r: 2.0, delay: '0.3s' },
  { cx: 518, cy: 248, r: 1.9, delay: '1.5s' },
  { cx: 695, cy: 132, r: 2.3, delay: '0.9s' },
  { cx: 778, cy: 224, r: 1.6, delay: '1.8s' },
  { cx: 842, cy: 52, r: 2.1, delay: '0.4s' },
  { cx: 944, cy: 160, r: 1.7, delay: '1.3s' },
  { cx: 68, cy: 112, r: 1.5, delay: '0.8s' },
] as const;

const VESTIGE_STAGES: ReadonlyArray<VestigeStage> = [
  {
    id: 0,
    key: 'records',
    stepCode: '01',
    office: 'Records Unit',
    shortOffice: 'Records',
    custodian: 'Elena Santos',
    roleTitle: 'Records Officer',
    timestamp: '09:04 AM',
    statusPill: 'Origin Sealed',
    statusTone: 'sky',
    accentHex: '#60A5FA',
    glowRgba: 'rgba(96, 165, 250, 0.52)',
    slaLabel: 'SLA · 24h Window Started',
    headline: 'First spark ignited — Document registered & QR token forged',
    detailHardCopy:
      'Printable QR transmittal slip generated and fastened to the physical folder (14 pages). Custody chain anchored at Records Unit.',
    detailDigital:
      '3 PDF attachments bundled under one tracking code with cryptographic SHA-256 fingerprint verified at intake.',
    securityNote: 'Opaque QR token issued · Zero sensitive metadata encoded in plain QR text',
    nextActionLabel: 'Pass Torch to Finance →',
    sealed: false,
    cx: 110,
    cy: 212,
    pathFraction: 0,
  },
  {
    id: 1,
    key: 'finance',
    stepCode: '02',
    office: 'Finance & Budget',
    shortOffice: 'Finance',
    custodian: 'Marco Villanueva',
    roleTitle: 'Budget Officer',
    timestamp: '09:18 AM',
    statusPill: 'Sealed in Transit',
    statusTone: 'amber',
    accentHex: '#F3B32A',
    glowRgba: 'rgba(243, 179, 42, 0.56)',
    slaLabel: 'SLA · 23h 46m Remaining',
    headline: 'Transfer surging in transit — Sealed until destination scans QR',
    detailHardCopy:
      'Physical folder dispatched along the routing chain. Custody stays locked until Finance scans the QR slip with Android or USB scanner.',
    detailDigital:
      'Digital bundle sealed in transit. Attachment previews stay locked until Finance scans QR or enters the 6-char unlock code.',
    securityNote: 'Sender self-receipt blocked at API layer · Destination verification enforced',
    nextActionLabel: 'Scan QR & Route to Legal →',
    sealed: true,
    cx: 370,
    cy: 98,
    pathFraction: 0.335,
  },
  {
    id: 2,
    key: 'legal',
    stepCode: '03',
    office: 'Legal & Compliance',
    shortOffice: 'Legal',
    custodian: 'Atty. Daniel Cruz',
    roleTitle: 'Compliance Reviewer',
    timestamp: '10:32 AM',
    statusPill: 'Custody Verified',
    statusTone: 'teal',
    accentHex: '#2DD4BF',
    glowRgba: 'rgba(45, 212, 191, 0.54)',
    slaLabel: 'On Track · 22h 32m Left',
    headline: 'QR unlocked & verified — Review logged with full integrity proof',
    detailHardCopy:
      'QR receipt confirmed with EXIF-stripped proof photo. Prior custodian notified automatically and compliance remarks appended.',
    detailDigital:
      'Unlocked via mobile QR scan and mirrored to desktop browser. SHA-256 integrity verified with zero alteration across hops.',
    securityNote: 'Immutable audit milestone written · Lock-screen-safe alert dispatched',
    nextActionLabel: 'Pass to Executive Office →',
    sealed: false,
    cx: 635,
    cy: 206,
    pathFraction: 0.67,
  },
  {
    id: 3,
    key: 'executive',
    stepCode: '04',
    office: 'Executive Office',
    shortOffice: 'Executive',
    custodian: 'Clara Reyes',
    roleTitle: 'Division Director',
    timestamp: '11:45 AM',
    statusPill: 'Approved & Archived',
    statusTone: 'emerald',
    accentHex: '#34D399',
    glowRgba: 'rgba(52, 211, 153, 0.56)',
    slaLabel: 'Completed in 2h 41m',
    headline: 'Full custody constellation lit — Signed, archived & verifiable',
    detailHardCopy:
      'Final executive approval recorded. Complete physical handoff trail archived for A4 executive SLA reports and audit exports.',
    detailDigital:
      'Final digital approval sealed with full version history, cryptographic integrity pass, and privacy-safe public QR verification.',
    securityNote: 'All 4 custody links verified · Public QR authenticity badge active',
    nextActionLabel: 'Replay Custody Road',
    sealed: false,
    cx: 892,
    cy: 98,
    pathFraction: 1,
  },
];

export const HeroCustodyDemo: React.FC = () => {
  const [format, setFormat] = useState<FormatMode>('hard_copy');
  const [stageIndex, setStageIndex] = useState<number>(1);
  const [autoPlay, setAutoPlay] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(VESTIGE_STAGES[1].pathFraction);
  const [cometPos, setCometPos] = useState<{ x: number; y: number }>({
    x: VESTIGE_STAGES[1].cx,
    y: VESTIGE_STAGES[1].cy,
  });
  const [isTraveling, setIsTraveling] = useState<boolean>(false);
  const [pulseStageId, setPulseStageId] = useState<number>(1);

  const mainPathRef = useRef<SVGPathElement | null>(null);
  const pathLengthRef = useRef<number>(1000);
  const currentProgressRef = useRef<number>(VESTIGE_STAGES[1].pathFraction);

  // Measure SVG path length once mounted
  useEffect(() => {
    const pathEl = mainPathRef.current;
    if (!pathEl) return;
    try {
      const len = pathEl.getTotalLength();
      if (len > 0) {
        pathLengthRef.current = len;
        const pt = pathEl.getPointAtLength(currentProgressRef.current * len);
        setCometPos({ x: pt.x, y: pt.y });
      }
    } catch {
      // Fallback safely in non-SVG environments
    }
  }, []);

  // Animate the blazing document comet smoothly along the sinuous SVG energy road
  useEffect(() => {
    const targetStage = VESTIGE_STAGES[stageIndex];
    const targetFrac = targetStage.pathFraction;
    const startFrac = currentProgressRef.current;

    // Respect reduced motion preference
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || Math.abs(targetFrac - startFrac) < 0.001) {
      currentProgressRef.current = targetFrac;
      setProgress(targetFrac);
      setCometPos({ x: targetStage.cx, y: targetStage.cy });
      setPulseStageId(stageIndex);
      setIsTraveling(false);
      return;
    }

    // If replaying from end -> start, reset cleanly to stage 0 spark
    if (targetFrac < startFrac && stageIndex === 0) {
      currentProgressRef.current = 0;
      setProgress(0);
      setCometPos({ x: targetStage.cx, y: targetStage.cy });
      setPulseStageId(0);
      setIsTraveling(false);
      return;
    }

    let rafId = 0;
    const durationMs = 920;
    const startTime = performance.now();
    setIsTraveling(true);

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const rawT = Math.min(1, elapsed / durationMs);
      // Smooth anime-style ease-out quintic surge
      const eased = 1 - Math.pow(1 - rawT, 3.2);
      const frac = startFrac + (targetFrac - startFrac) * eased;
      currentProgressRef.current = frac;
      setProgress(frac);

      const pathEl = mainPathRef.current;
      if (pathEl && pathLengthRef.current > 0) {
        try {
          const pt = pathEl.getPointAtLength(frac * pathLengthRef.current);
          setCometPos({ x: pt.x, y: pt.y });
        } catch {
          setCometPos({ x: targetStage.cx, y: targetStage.cy });
        }
      } else {
        setCometPos({ x: targetStage.cx, y: targetStage.cy });
      }

      if (rawT < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        setIsTraveling(false);
        setPulseStageId(stageIndex);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [stageIndex]);

  // Automatic cinematic presentation cadence
  useEffect(() => {
    if (!autoPlay) return;
    const timer = window.setInterval(() => {
      setStageIndex((prev) => (prev + 1) % VESTIGE_STAGES.length);
    }, 3800);
    return () => window.clearInterval(timer);
  }, [autoPlay]);

  const current = VESTIGE_STAGES[stageIndex];
  const trackingCode = format === 'hard_copy' ? 'TRC-2026-00418' : 'TRC-2026-00419';
  const docTitle =
    format === 'hard_copy'
      ? 'Q4 Infrastructure & Operations Budget Request'
      : 'Vendor Procurement Specification Bundle (3 PDFs)';

  const totalLen = pathLengthRef.current;
  const activeDashOffset = Math.max(0, totalLen * (1 - progress));

  const handleSelectStage = (idx: number) => {
    setAutoPlay(false);
    setStageIndex(idx);
  };

  const handleAdvance = () => {
    setAutoPlay(false);
    setStageIndex((prev) => (prev + 1) % VESTIGE_STAGES.length);
  };

  return (
    <div
      className="vestige-cinema"
      aria-label="Interactive Tracely document custody visual presentation"
    >
      {/* Top Cinema HUD Bar */}
      <div className="vestige-topbar">
        <div className="vestige-topbar-left">
          <span className="vestige-live-beacon" aria-hidden="true" />
          <div className="vestige-doc-ident">
            <div className="vestige-code-row">
              <span className="vestige-code">{trackingCode}</span>
              <span className={`vestige-status tone-${current.statusTone}`}>
                {current.sealed ? <Lock size={11} /> : <CheckCircle2 size={11} />}
                {current.statusPill}
              </span>
            </div>
            <h3 className="vestige-doc-title">{docTitle}</h3>
          </div>
        </div>

        <div className="vestige-topbar-right">
          <div className="vestige-format-toggle" role="tablist" aria-label="Document format">
            <button
              type="button"
              role="tab"
              aria-selected={format === 'hard_copy'}
              className={`vestige-format-btn ${format === 'hard_copy' ? 'is-active' : ''}`}
              onClick={() => setFormat('hard_copy')}
            >
              <FolderClosed size={13} />
              <span>Hard Copy</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={format === 'digital'}
              className={`vestige-format-btn ${format === 'digital' ? 'is-active' : ''}`}
              onClick={() => setFormat('digital')}
            >
              <FileStack size={13} />
              <span>Digital Bundle</span>
            </button>
          </div>
        </div>
      </div>

      {/* Widescreen "One For All Vestiges" Luminous Energy Road Stage */}
      <div className="vestige-stage">
        <div className="vestige-nebula" aria-hidden="true" />

        <svg
          className="vestige-svg"
          viewBox="0 0 1000 300"
          role="img"
          aria-label={`Document ${trackingCode} energy path currently at ${current.office}`}
        >
          <defs>
            {/* Multi-office luminous energy gradient (Sky -> Amber Gold -> Teal -> Emerald) */}
            <linearGradient id="vestigeRoadGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="35%" stopColor="#F3B32A" />
              <stop offset="70%" stopColor="#2DD4BF" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>

            <linearGradient id="vestigeFilamentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(96, 165, 250, 0.85)" />
              <stop offset="40%" stopColor="rgba(243, 179, 42, 0.95)" />
              <stop offset="75%" stopColor="rgba(45, 212, 191, 0.9)" />
              <stop offset="100%" stopColor="rgba(52, 211, 153, 0.95)" />
            </linearGradient>

            <radialGradient id="cometGlowGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="35%" stopColor="#FDE68A" stopOpacity="0.95" />
              <stop offset="70%" stopColor="#F3B32A" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#F3B32A" stopOpacity="0" />
            </radialGradient>

            <filter id="vestigeGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="vestigeSoftGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="11" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <clipPath id="vestigeProgressClip">
              <rect x="0" y="0" width={Math.max(0, cometPos.x + 8)} height="300" />
            </clipPath>
          </defs>

          {/* Subtle drifting cosmic motes */}
          {AMBIENT_SPARKS.map((sp, i) => (
            <circle
              key={i}
              cx={sp.cx}
              cy={sp.cy}
              r={sp.r}
              fill={i % 2 === 0 ? '#F3B32A' : '#5EEAD4'}
              className="vestige-spark"
              style={{ animationDelay: sp.delay }}
            />
          ))}

          {/* Dormant unlit custody road track */}
          <path
            d={MAIN_ROAD_PATH}
            fill="none"
            stroke="rgba(148, 163, 184, 0.2)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d={MAIN_ROAD_PATH}
            fill="none"
            stroke="rgba(148, 163, 184, 0.34)"
            strokeWidth="2"
            strokeDasharray="6 8"
            strokeLinecap="round"
          />

          {/* Broad soft aura beneath ignited energy road */}
          <path
            d={MAIN_ROAD_PATH}
            fill="none"
            stroke="url(#vestigeRoadGrad)"
            strokeWidth="16"
            strokeLinecap="round"
            opacity="0.28"
            filter="url(#vestigeSoftGlow)"
            strokeDasharray={totalLen}
            strokeDashoffset={activeDashOffset}
          />

          {/* Intertwined braided energy filaments (One For All light-strands!) */}
          <path
            d={UPPER_FILAMENT_PATH}
            fill="none"
            stroke="url(#vestigeFilamentGrad)"
            strokeWidth="2.1"
            strokeLinecap="round"
            opacity="0.72"
            filter="url(#vestigeGlow)"
            strokeDasharray={totalLen + 40}
            strokeDashoffset={activeDashOffset}
          />
          <path
            d={LOWER_FILAMENT_PATH}
            fill="none"
            stroke="url(#vestigeFilamentGrad)"
            strokeWidth="1.9"
            strokeLinecap="round"
            opacity="0.62"
            filter="url(#vestigeGlow)"
            strokeDasharray={totalLen + 40}
            strokeDashoffset={activeDashOffset}
          />

          {/* Core blazing road filament (measured via ref for exact comet path) */}
          <path
            ref={mainPathRef}
            d={MAIN_ROAD_PATH}
            fill="none"
            stroke="url(#vestigeRoadGrad)"
            strokeWidth="5"
            strokeLinecap="round"
            filter="url(#vestigeGlow)"
            strokeDasharray={totalLen}
            strokeDashoffset={activeDashOffset}
          />

          {/* High-velocity flowing light stream inside ignited road */}
          <path
            d={MAIN_ROAD_PATH}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeDasharray="16 26"
            clipPath="url(#vestigeProgressClip)"
            className="vestige-energy-stream"
            style={{
              opacity: progress > 0.02 ? 0.78 : 0,
            }}
          />

          {/* 4 Office Vestige Orbs along the road */}
          {VESTIGE_STAGES.map((stage, idx) => {
            const isLit = idx <= stageIndex;
            const isCurrent = idx === stageIndex;
            const isPulsing = idx === pulseStageId && !isTraveling;
            const labelAbove = stage.cy > 150;

            return (
              <g
                key={stage.key}
                className={`vestige-node ${isLit ? 'is-lit' : ''} ${isCurrent ? 'is-current' : ''}`}
                onClick={() => handleSelectStage(idx)}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label={`Jump to stage ${stage.stepCode}: ${stage.office}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectStage(idx);
                  }
                }}
              >
                {/* Expanding shockwave burst when the document torch awakens this office */}
                {isPulsing ? (
                  <>
                    <circle
                      cx={stage.cx}
                      cy={stage.cy}
                      r="26"
                      fill="none"
                      stroke={stage.accentHex}
                      strokeWidth="2.5"
                      className="vestige-shockwave"
                    />
                    <circle
                      cx={stage.cx}
                      cy={stage.cy}
                      r="22"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="1.5"
                      className="vestige-shockwave delayed"
                    />
                  </>
                ) : null}

                {/* Outer soft aura glow */}
                {isLit ? (
                  <circle
                    cx={stage.cx}
                    cy={stage.cy}
                    r={isCurrent ? 38 : 28}
                    fill={stage.glowRgba}
                    opacity={isCurrent ? 0.36 : 0.2}
                    filter="url(#vestigeSoftGlow)"
                  />
                ) : null}

                {/* Concentric orbital ring */}
                <circle
                  cx={stage.cx}
                  cy={stage.cy}
                  r={isCurrent ? 27 : 21}
                  fill="none"
                  stroke={isLit ? stage.accentHex : 'rgba(148, 163, 184, 0.32)'}
                  strokeWidth={isCurrent ? 2 : 1.3}
                  strokeDasharray={stage.sealed && isCurrent ? '5 4' : 'none'}
                  className={isCurrent ? 'vestige-orbit-ring' : undefined}
                />

                {/* Core glowing vestige sphere */}
                <circle
                  cx={stage.cx}
                  cy={stage.cy}
                  r={isCurrent ? 18 : 15}
                  fill={isLit ? stage.accentHex : '#0F254A'}
                  stroke={isLit ? '#FFFFFF' : 'rgba(148, 163, 184, 0.4)'}
                  strokeWidth={isCurrent ? 2.4 : 1.5}
                  filter={isLit ? 'url(#vestigeGlow)' : undefined}
                />

                {/* Step code inside orb */}
                <text
                  x={stage.cx}
                  y={stage.cy + 4}
                  textAnchor="middle"
                  className="vestige-orb-code"
                  fill={isLit ? '#06142E' : '#94A3B8'}
                >
                  {stage.stepCode}
                </text>

                {/* Office Name & Timestamp Floating Label */}
                <text
                  x={stage.cx}
                  y={labelAbove ? stage.cy - 44 : stage.cy + 46}
                  textAnchor="middle"
                  className="vestige-node-title"
                  fill={isLit ? '#FFFFFF' : '#94A3B8'}
                >
                  {stage.office}
                </text>
                <text
                  x={stage.cx}
                  y={labelAbove ? stage.cy - 28 : stage.cy + 62}
                  textAnchor="middle"
                  className="vestige-node-sub"
                  fill={isCurrent ? stage.accentHex : '#94A3B8'}
                >
                  {idx <= stageIndex ? `${stage.timestamp} · ${stage.statusPill}` : 'Awaiting Torch'}
                </text>
              </g>
            );
          })}

          {/* Blazing Traveling Document Torch Comet moving along the SVG road */}
          <g transform={`translate(${cometPos.x}, ${cometPos.y})`} className="vestige-comet">
            <circle r={isTraveling ? 30 : 22} fill="url(#cometGlowGrad)" />
            <circle
              r={isTraveling ? 10 : 7}
              fill="#FFFFFF"
              stroke="#F3B32A"
              strokeWidth="2.5"
              filter="url(#vestigeGlow)"
            />
          </g>
        </svg>

        {/* Interactive Stage Stepper Pills underneath the road */}
        <div className="vestige-step-pills" role="list" aria-label="Office custody stops">
          {VESTIGE_STAGES.map((stage, idx) => {
            const isLit = idx <= stageIndex;
            const isCurrent = idx === stageIndex;
            return (
              <button
                key={stage.key}
                type="button"
                role="listitem"
                aria-current={isCurrent ? 'step' : undefined}
                className={`vestige-pill-btn ${isLit ? 'is-lit' : ''} ${isCurrent ? 'is-current' : ''}`}
                onClick={() => handleSelectStage(idx)}
              >
                <span
                  className="vestige-pill-dot"
                  style={{ background: isLit ? stage.accentHex : 'rgba(148,163,184,0.4)' }}
                />
                <span className="vestige-pill-text">
                  <strong>{stage.shortOffice}</strong>
                  <span>{idx <= stageIndex ? stage.timestamp : 'Pending'}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Cinematic Custody Story + QR Token + Playback Bar */}
      <div className="vestige-hud-bottom">
        <div className="vestige-story">
          <div className="vestige-story-kicker">
            <Sparkles size={13} style={{ color: current.accentHex }} />
            <span style={{ color: current.accentHex }}>
              STOP {current.stepCode} · {current.office.toUpperCase()}
            </span>
            <span className="vestige-sep">·</span>
            <span className="vestige-sla-inline">
              <Clock size={12} /> {current.slaLabel}
            </span>
          </div>
          <h4>{current.headline}</h4>
          <p>{format === 'hard_copy' ? current.detailHardCopy : current.detailDigital}</p>
          <div className="vestige-story-meta">
            <span className="vestige-custodian-chip">
              {current.sealed ? <Lock size={12} /> : stageIndex === 3 ? <FileCheck2 size={12} /> : <Unlock size={12} />}
              {current.custodian} · {current.roleTitle}
            </span>
            <span className="vestige-sec-chip">
              <ShieldCheck size={12} />
              {current.securityNote}
            </span>
          </div>
        </div>

        <div className="vestige-controls-col">
          <div className="vestige-qr-mini">
            <QrMatrixSvg
              value={`https://tracely-web.up.railway.app/#/verify/${trackingCode}`}
              size={64}
              label={`QR custody token for ${trackingCode}`}
            />
            <div className="vestige-qr-meta">
              <span className="vestige-qr-tag">
                <QrCode size={11} /> Opaque QR
              </span>
              <span className="vestige-qr-hash">
                {format === 'hard_copy' ? '14 physical pages' : 'SHA-256 · e3b0c4…9a1f'}
              </span>
            </div>
          </div>

          <div className="vestige-action-row">
            <button
              type="button"
              className="vestige-btn-secondary"
              onClick={() => setAutoPlay((v) => !v)}
              aria-pressed={autoPlay}
            >
              {autoPlay ? <Pause size={13} /> : <Play size={13} />}
              <span>{autoPlay ? 'Pause Tour' : 'Auto-Play'}</span>
            </button>
            <button type="button" className="vestige-btn-primary" onClick={handleAdvance}>
              {stageIndex === VESTIGE_STAGES.length - 1 ? (
                <RotateCcw size={14} />
              ) : (
                <ScanLine size={14} />
              )}
              <span>{current.nextActionLabel}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
