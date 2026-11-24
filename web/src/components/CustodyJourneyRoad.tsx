import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { DocumentRecord } from '../domain/types';
import { formatClockTime, formatCompactDate } from '../utils/formatters';

export type CustodyHopState = 'reached' | 'active' | 'completed' | 'pending' | 'unreached';

export interface CustodyJourneyHop {
  readonly id: string;
  readonly code: string;
  readonly officeCode: string;
  readonly officeName: string;
  readonly statusLine: string;
  readonly state: CustodyHopState;
  readonly accentHex: string;
  readonly glowRgba: string;
  readonly cx: number;
  readonly cy: number;
  readonly labelSide: 'left' | 'right';
}

interface PathSample {
  readonly len: number;
  readonly x: number;
  readonly y: number;
}

interface BuiltJourney {
  readonly hops: ReadonlyArray<CustodyJourneyHop>;
  readonly viewHeight: number;
  readonly firstY: number;
  readonly lastY: number;
  readonly maxTruthProgress: number;
  readonly mainPath: string;
  readonly leftFilamentPath: string;
  readonly rightFilamentPath: string;
  readonly samples: ReadonlyArray<PathSample>;
  readonly totalLength: number;
  readonly statusSummary: string;
  readonly statusTone: 'amber' | 'teal' | 'emerald' | 'rose' | 'sky';
}

const VIEW_WIDTH = 500;
const TOP_PAD = 84;
const BOTTOM_PAD = 88;
const STEP_Y = 224;
const FOCUS_VIEWPORT_RATIO = 0.54;

const HOP_ACCENTS = [
  { hex: '#60A5FA', glow: 'rgba(96, 165, 250, 0.54)' },
  { hex: '#F3B32A', glow: 'rgba(243, 179, 42, 0.58)' },
  { hex: '#2DD4BF', glow: 'rgba(45, 212, 191, 0.56)' },
  { hex: '#34D399', glow: 'rgba(52, 211, 153, 0.58)' },
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function cubicPoint(
  t: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): { x: number; y: number } {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * x0 + 3 * uu * t * x1 + 3 * u * tt * x2 + ttt * x3,
    y: uuu * y0 + 3 * uu * t * y1 + 3 * u * tt * y2 + ttt * y3,
  };
}

function formatShortHopTime(iso?: string | null): string {
  if (!iso) return '';
  const datePart = formatCompactDate(iso);
  const timePart = formatClockTime(iso);
  if (datePart && timePart) return `${datePart} · ${timePart}`;
  return timePart || datePart || '';
}

function sampleByTargetY(samples: ReadonlyArray<PathSample>, targetY: number): PathSample {
  if (samples.length === 0) return { len: 0, x: 148, y: TOP_PAD };
  if (targetY <= samples[0].y) return samples[0];
  const last = samples[samples.length - 1];
  if (targetY >= last.y) return last;

  let lo = 0;
  let hi = samples.length - 1;
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].y <= targetY) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  const a = samples[lo];
  const b = samples[hi];
  const span = b.y - a.y;
  const t = span > 0.0001 ? clamp((targetY - a.y) / span, 0, 1) : 0;
  return {
    len: a.len + (b.len - a.len) * t,
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

export function buildDocumentJourney(doc: DocumentRecord): BuiltJourney {
  const rawNodes: Array<{
    id: string;
    officeCode: string;
    officeName: string;
    statusLine: string;
    state: CustodyHopState;
    accentHex: string;
    glowRgba: string;
  }> = [];

  const sortedTxs = [...doc.transactions].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  );

  const originTime = formatShortHopTime(sortedTxs[0]?.sentAt ?? doc.createdAt);
  rawNodes.push({
    id: `origin-${doc.originOffice.id}`,
    officeCode: doc.originOffice.code,
    officeName: doc.originOffice.name,
    statusLine:
      sortedTxs.length > 0
        ? `Dispatched${originTime ? ` · ${originTime}` : ''}`
        : `Registered${originTime ? ` · ${originTime}` : ''}`,
    state: sortedTxs.length > 0 ? 'reached' : 'active',
    accentHex: HOP_ACCENTS[0].hex,
    glowRgba: HOP_ACCENTS[0].glow,
  });

  sortedTxs.forEach((tx, idx) => {
    const isLast = idx === sortedTxs.length - 1;
    const isCompletedLifecycle =
      doc.lifecycleStatus === 'approved' || doc.lifecycleStatus === 'archived';
    const ts = formatShortHopTime(tx.receivedAt ?? tx.sentAt);

    let state: CustodyHopState = 'reached';
    let statusLine = `Received${ts ? ` · ${ts}` : ''}`;
    let accent: { readonly hex: string; readonly glow: string } =
      HOP_ACCENTS[(idx + 1) % HOP_ACCENTS.length];

    if (tx.status === 'pending') {
      state = 'pending';
      statusLine = `In Transit · Awaiting receipt`;
      accent = { hex: '#F3B32A', glow: 'rgba(243, 179, 42, 0.58)' };
    } else if (tx.status === 'returned_for_revision' || tx.status === 'declined_misrouted') {
      state = isLast ? 'active' : 'reached';
      statusLine = `${tx.status === 'declined_misrouted' ? 'Flagged' : 'Returned'}${ts ? ` · ${ts}` : ''}`;
      accent = { hex: '#FB7185', glow: 'rgba(251, 113, 133, 0.54)' };
    } else if (tx.status === 'recalled') {
      state = isLast ? 'active' : 'reached';
      statusLine = `Recalled${ts ? ` · ${ts}` : ''}`;
      accent = { hex: '#94A3B8', glow: 'rgba(148, 163, 184, 0.45)' };
    } else if (isLast && isCompletedLifecycle) {
      state = 'completed';
      statusLine = `${doc.lifecycleStatus === 'archived' ? 'Archived' : 'Approved'}${ts ? ` · ${ts}` : ''}`;
      accent = { hex: '#34D399', glow: 'rgba(52, 211, 153, 0.6)' };
    } else if (isLast) {
      state = 'active';
      statusLine = `${doc.lifecycleStatus === 'in_review' ? 'In Review' : 'At Desk'}${ts ? ` · ${ts}` : ''}`;
      accent = { hex: '#2DD4BF', glow: 'rgba(45, 212, 191, 0.58)' };
    }

    const prev = rawNodes[rawNodes.length - 1];
    if (
      prev &&
      prev.officeCode === tx.toOffice.code &&
      !isLast &&
      prev.state === 'reached' &&
      state === 'reached'
    ) {
      return;
    }

    rawNodes.push({
      id: `tx-${tx.id}`,
      officeCode: tx.toOffice.code,
      officeName: tx.toOffice.name,
      statusLine,
      state,
      accentHex: accent.hex,
      glowRgba: accent.glow,
    });
  });

  // Cap very long histories to Origin + 5 latest hops so the dashboard road stays readable
  const trimmed =
    rawNodes.length > 6 ? [rawNodes[0], ...rawNodes.slice(rawNodes.length - 5)] : rawNodes;

  // Single-hop newly registered document gets a dormant next-step orb below it
  if (trimmed.length === 1) {
    trimmed.push({
      id: 'next-unrouted',
      officeCode: 'NEXT',
      officeName: 'Next Office',
      statusLine: 'Ready to route',
      state: 'unreached',
      accentHex: '#94A3B8',
      glowRgba: 'rgba(148, 163, 184, 0.35)',
    });
  }

  const hops: CustodyJourneyHop[] = trimmed.map((item, idx) => {
    const isLeft = idx % 2 === 0;
    return {
      ...item,
      code: String(idx + 1).padStart(2, '0'),
      cx: isLeft ? 148 : 352,
      cy: TOP_PAD + idx * STEP_Y,
      labelSide: isLeft ? 'right' : 'left',
    };
  });

  const firstY = hops[0].cy;
  const lastY = hops[hops.length - 1].cy;
  const viewHeight = lastY + BOTTOM_PAD;
  const segCount = Math.max(1, hops.length - 1);

  const lastHop = hops[hops.length - 1];
  let maxTruthProgress = 1;
  let statusSummary = `At ${lastHop.officeCode}`;
  let statusTone: BuiltJourney['statusTone'] = 'teal';

  if (lastHop.state === 'unreached') {
    maxTruthProgress = 0;
    statusSummary = `Registered · ${hops[0].officeCode}`;
    statusTone = 'sky';
  } else if (lastHop.state === 'pending') {
    // Truth-capped: energy stops in transit along the final curve before unacknowledged destination
    maxTruthProgress = clamp((segCount - 1 + 0.72) / segCount, 0.15, 0.94);
    statusSummary = `In Transit → ${lastHop.officeCode}`;
    statusTone = 'amber';
  } else if (lastHop.state === 'completed') {
    maxTruthProgress = 1;
    statusSummary = `${doc.lifecycleStatus === 'archived' ? 'Archived' : 'Approved'} · ${lastHop.officeCode}`;
    statusTone = 'emerald';
  } else if (doc.lifecycleStatus === 'returned_for_revision') {
    maxTruthProgress = 1;
    statusSummary = `Returned · ${lastHop.officeCode}`;
    statusTone = 'rose';
  }

  let mainPath = `M ${hops[0].cx} ${hops[0].cy}`;
  let leftFilamentPath = `M ${hops[0].cx} ${hops[0].cy}`;
  let rightFilamentPath = `M ${hops[0].cx} ${hops[0].cy}`;

  const samples: PathSample[] = [];
  let accumLen = 0;
  let prevX = hops[0].cx;
  let prevY = hops[0].cy;
  samples.push({ len: 0, x: prevX, y: prevY });

  const stepsPerSeg = 64;
  for (let i = 0; i < hops.length - 1; i += 1) {
    const a = hops[i];
    const b = hops[i + 1];
    const midY = (a.cy + b.cy) / 2;

    mainPath += ` C ${a.cx} ${midY}, ${b.cx} ${midY}, ${b.cx} ${b.cy}`;
    leftFilamentPath += ` C ${a.cx - 24} ${midY - 8}, ${b.cx - 18} ${midY + 12}, ${b.cx} ${b.cy}`;
    rightFilamentPath += ` C ${a.cx + 24} ${midY + 8}, ${b.cx + 18} ${midY - 12}, ${b.cx} ${b.cy}`;

    for (let s = 1; s <= stepsPerSeg; s += 1) {
      const t = s / stepsPerSeg;
      const pt = cubicPoint(t, a.cx, a.cy, a.cx, midY, b.cx, midY, b.cx, b.cy);
      accumLen += Math.hypot(pt.x - prevX, pt.y - prevY);
      samples.push({ len: accumLen, x: pt.x, y: pt.y });
      prevX = pt.x;
      prevY = pt.y;
    }
  }

  return {
    hops,
    viewHeight,
    firstY,
    lastY,
    maxTruthProgress,
    mainPath,
    leftFilamentPath,
    rightFilamentPath,
    samples,
    totalLength: Math.max(1, accumLen),
    statusSummary,
    statusTone,
  };
}

interface CustodyJourneyRoadProps {
  readonly document: DocumentRecord;
  readonly onOpenDocument?: (documentId: string) => void;
}

export const CustodyJourneyRoad: React.FC<CustodyJourneyRoadProps> = ({
  document: doc,
  onOpenDocument,
}) => {
  const journey = useMemo(() => buildDocumentJourney(doc), [doc]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const targetProgressRef = useRef<number>(journey.maxTruthProgress);
  const displayProgressRef = useRef<number>(journey.maxTruthProgress);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);

  const [progress, setProgress] = useState<number>(journey.maxTruthProgress);
  const [scrollEnergy, setScrollEnergy] = useState<number>(0);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const isTestEnv =
      typeof import.meta !== 'undefined' &&
      (import.meta as { env?: { MODE?: string } }).env?.MODE === 'test';

    const computeTruthCappedScrollProgress = (): number => {
      const svgEl = svgRef.current;
      if (!svgEl || isTestEnv) {
        return journey.maxTruthProgress;
      }
      const rect = svgEl.getBoundingClientRect();
      if (rect.height <= 0) {
        return journey.maxTruthProgress;
      }

      const firstNodeScreenY = rect.top + rect.height * (journey.firstY / journey.viewHeight);
      const lastNodeScreenY = rect.top + rect.height * (journey.lastY / journey.viewHeight);
      const span = Math.max(1, lastNodeScreenY - firstNodeScreenY);
      const focusY = window.innerHeight * FOCUS_VIEWPORT_RATIO;
      const rawScroll = clamp((focusY - firstNodeScreenY) / span, 0, 1);

      return Math.min(rawScroll, journey.maxTruthProgress);
    };

    const step = (now: number) => {
      const dt =
        lastFrameRef.current > 0
          ? Math.min(0.05, (now - lastFrameRef.current) / 1000)
          : 1 / 60;
      lastFrameRef.current = now;

      const target = targetProgressRef.current;
      const current = displayProgressRef.current;
      const diff = target - current;

      if (Math.abs(diff) < 0.0005) {
        displayProgressRef.current = target;
        setProgress(target);
        setScrollEnergy(0);
        rafIdRef.current = null;
        lastFrameRef.current = 0;
        return;
      }

      const factor = 1 - Math.exp(-dt * 12);
      const next = current + diff * factor;
      displayProgressRef.current = next;
      setProgress(next);
      setScrollEnergy(clamp(Math.abs(diff) * 7.5, 0, 1));
      rafIdRef.current = window.requestAnimationFrame(step);
    };

    const syncFromScroll = (immediate = false) => {
      const nextTarget = computeTruthCappedScrollProgress();
      targetProgressRef.current = nextTarget;

      if (prefersReduced || isTestEnv || immediate) {
        if (rafIdRef.current !== null) {
          window.cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        displayProgressRef.current = nextTarget;
        setProgress(nextTarget);
        setScrollEnergy(0);
        return;
      }

      if (rafIdRef.current === null) {
        lastFrameRef.current = 0;
        rafIdRef.current = window.requestAnimationFrame(step);
      }
    };

    const onScroll = () => syncFromScroll(false);
    const onResize = () => syncFromScroll(true);

    // On document change or mount, ease smoothly from top toward current scroll-capped truth
    if (!prefersReduced && !isTestEnv) {
      displayProgressRef.current = 0;
      setProgress(0);
      syncFromScroll(false);
    } else {
      syncFromScroll(true);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [journey]);

  const spanY = Math.max(1, journey.lastY - journey.firstY);
  const cometTargetY = journey.firstY + progress * spanY;
  const cometSample = sampleByTargetY(journey.samples, cometTargetY);
  const activeDashOffset = Math.max(0, journey.totalLength - cometSample.len);

  const cometHaloRadius = 21 + scrollEnergy * 10;
  const cometCoreRadius = 7 + scrollEnergy * 2.8;

  const lastHopIdx = journey.hops.length - 1;
  const lastHopIsPending = journey.hops[lastHopIdx]?.state === 'pending';

  let currentLitIdx = 0;
  for (let i = journey.hops.length - 1; i >= 0; i -= 1) {
    const hop = journey.hops[i];
    if (hop.state === 'pending' || hop.state === 'unreached') continue;
    const hopFrac = (hop.cy - journey.firstY) / spanY;
    if (progress >= hopFrac - 0.025) {
      currentLitIdx = i;
      break;
    }
  }

  const handleHopClick = (hop: CustodyJourneyHop) => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const rect = svgEl.getBoundingClientRect();
    const nodeDocY = window.scrollY + rect.top + rect.height * (hop.cy / journey.viewHeight);
    const targetScrollY = Math.max(0, nodeDocY - window.innerHeight * FOCUS_VIEWPORT_RATIO);
    window.scrollTo({ top: targetScrollY, behavior: 'smooth' });
  };

  const ambientSparks = useMemo(() => {
    const count = Math.max(6, journey.hops.length * 2 + 2);
    return Array.from({ length: count }, (_, i) => ({
      cx: i % 2 === 0 ? 64 + ((i * 37) % 90) : 346 + ((i * 41) % 94),
      cy: Math.round(((i + 0.5) / count) * journey.viewHeight),
      r: i % 3 === 0 ? 2.0 : 1.5,
      delay: `${(i * 0.35).toFixed(2)}s`,
    }));
  }, [journey.hops.length, journey.viewHeight]);

  const gradSuffix = doc.id.replace(/[^a-zA-Z0-9_-]/g, '');

  return (
    <div
      className="custody-road-stage"
      data-testid="web-custody-journey-road"
      aria-label={`Live vertical custody road for ${doc.trackingCode}`}
    >
      <div className="custody-road-nebula" aria-hidden="true" />

      {/* Minimalist floating header bar inside dark stage */}
      <div className="custody-road-topbar">
        <div className="custody-road-meta">
          <span className="custody-road-code mono">{doc.trackingCode}</span>
          <span className={`custody-road-status-pill tone-${journey.statusTone}`}>
            <span className="custody-road-status-dot" />
            {journey.statusSummary}
          </span>
        </div>

        {onOpenDocument ? (
          <button
            type="button"
            data-testid="web-custody-road-open-doc"
            className="custody-road-open-btn"
            onClick={() => onOpenDocument(doc.id)}
          >
            <span>Open</span>
            <ArrowUpRight size={13} />
          </button>
        ) : null}
      </div>

      <svg
        ref={svgRef}
        className="custody-road-svg"
        viewBox={`0 0 ${VIEW_WIDTH} ${journey.viewHeight}`}
        role="img"
        aria-label={`Vertical custody track for ${doc.trackingCode}: ${journey.statusSummary}`}
      >
        <defs>
          <linearGradient id={`crGrad-${gradSuffix}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" />
            <stop offset="38%" stopColor="#F3B32A" />
            <stop offset="72%" stopColor="#2DD4BF" />
            <stop offset="100%" stopColor="#34D399" />
          </linearGradient>

          <linearGradient id={`crFil-${gradSuffix}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(96, 165, 250, 0.88)" />
            <stop offset="40%" stopColor="rgba(243, 179, 42, 0.95)" />
            <stop offset="75%" stopColor="rgba(45, 212, 191, 0.92)" />
            <stop offset="100%" stopColor="rgba(52, 211, 153, 0.96)" />
          </linearGradient>

          <radialGradient id={`crComet-${gradSuffix}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="36%" stopColor="#FDE68A" stopOpacity="0.95" />
            <stop offset="72%" stopColor="#F3B32A" stopOpacity="0.46" />
            <stop offset="100%" stopColor="#F3B32A" stopOpacity="0" />
          </radialGradient>

          <filter id={`crGlow-${gradSuffix}`} x="-40%" y="-20%" width="180%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id={`crSoft-${gradSuffix}`} x="-50%" y="-25%" width="200%" height="150%">
            <feGaussianBlur stdDeviation="11" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <clipPath id={`crClip-${gradSuffix}`}>
            <rect
              x="0"
              y="0"
              width={VIEW_WIDTH}
              height={Math.max(0, cometSample.y + 4)}
            />
          </clipPath>
        </defs>

        {/* Ambient starlight motes */}
        {ambientSparks.map((sp, i) => (
          <circle
            key={i}
            cx={sp.cx}
            cy={sp.cy}
            r={sp.r}
            fill={i % 2 === 0 ? '#F3B32A' : '#5EEAD4'}
            className="custody-road-spark"
            style={{ animationDelay: sp.delay }}
          />
        ))}

        {/* Dormant unlit vertical track */}
        <path
          d={journey.mainPath}
          fill="none"
          stroke="rgba(148, 163, 184, 0.16)"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <path
          d={journey.mainPath}
          fill="none"
          stroke="rgba(148, 163, 184, 0.3)"
          strokeWidth="1.7"
          strokeDasharray="6 8"
          strokeLinecap="round"
        />

        {/* Soft glow aura beneath lit path */}
        <path
          d={journey.mainPath}
          fill="none"
          stroke={`url(#crGrad-${gradSuffix})`}
          strokeWidth="17"
          strokeLinecap="round"
          opacity="0.3"
          filter={`url(#crSoft-${gradSuffix})`}
          strokeDasharray={journey.totalLength}
          strokeDashoffset={activeDashOffset}
        />

        {/* Braided energy filaments clipped cleanly to the traveling torch */}
        <g clipPath={`url(#crClip-${gradSuffix})`} style={{ opacity: progress > 0.008 ? 1 : 0 }}>
          <path
            d={journey.leftFilamentPath}
            fill="none"
            stroke={`url(#crFil-${gradSuffix})`}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.72"
            filter={`url(#crGlow-${gradSuffix})`}
          />
          <path
            d={journey.rightFilamentPath}
            fill="none"
            stroke={`url(#crFil-${gradSuffix})`}
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity="0.62"
            filter={`url(#crGlow-${gradSuffix})`}
          />
        </g>

        {/* Core luminous road */}
        <path
          d={journey.mainPath}
          fill="none"
          stroke={`url(#crGrad-${gradSuffix})`}
          strokeWidth="5"
          strokeLinecap="round"
          filter={`url(#crGlow-${gradSuffix})`}
          strokeDasharray={journey.totalLength}
          strokeDashoffset={activeDashOffset}
        />

        {/* Flowing white core stream inside lit portion */}
        <path
          d={journey.mainPath}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="15 25"
          clipPath={`url(#crClip-${gradSuffix})`}
          className="custody-road-stream"
          style={{ opacity: progress > 0.015 ? 0.8 : 0 }}
        />

        {/* Real Office Vestige Orbs with minimalist labels */}
        {journey.hops.map((hop, idx) => {
          const hopFrac = (hop.cy - journey.firstY) / spanY;
          const isUnreached = hop.state === 'pending' || hop.state === 'unreached';
          const isLit = !isUnreached && (idx === 0 || progress >= hopFrac - 0.025);
          const isCurrent =
            (!lastHopIsPending && idx === currentLitIdx) ||
            (lastHopIsPending && idx === lastHopIdx && progress >= journey.maxTruthProgress - 0.05);
          const labelX = hop.labelSide === 'right' ? hop.cx + 44 : hop.cx - 44;
          const labelAnchor = hop.labelSide === 'right' ? 'start' : 'end';

          return (
            <g
              key={hop.id}
              data-testid={`custody-hop-${hop.officeCode}`}
              className={`custody-road-node ${isLit ? 'is-lit' : ''} ${isCurrent ? 'is-current' : ''}`}
              onClick={() => handleHopClick(hop)}
              style={{ cursor: 'pointer' }}
              role="button"
              tabIndex={0}
              aria-label={`${hop.officeCode} — ${hop.statusLine}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleHopClick(hop);
                }
              }}
            >
              {isCurrent ? (
                <>
                  <circle
                    cx={hop.cx}
                    cy={hop.cy}
                    r="27"
                    fill="none"
                    stroke={hop.accentHex}
                    strokeWidth="2.3"
                    className="custody-road-shockwave"
                  />
                  <circle
                    cx={hop.cx}
                    cy={hop.cy}
                    r="22"
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="1.3"
                    className="custody-road-shockwave delayed"
                  />
                </>
              ) : null}

              {isLit ? (
                <circle
                  cx={hop.cx}
                  cy={hop.cy}
                  r={isCurrent ? 42 : 28}
                  fill={hop.glowRgba}
                  opacity={isCurrent ? 0.38 : 0.22}
                  filter={`url(#crSoft-${gradSuffix})`}
                />
              ) : null}

              <circle
                cx={hop.cx}
                cy={hop.cy}
                r={isCurrent ? 28 : 21}
                fill="none"
                stroke={
                  isLit
                    ? hop.accentHex
                    : hop.state === 'pending'
                      ? 'rgba(243, 179, 42, 0.55)'
                      : 'rgba(148, 163, 184, 0.28)'
                }
                strokeWidth={isCurrent ? 2 : 1.4}
                strokeDasharray={hop.state === 'pending' ? '4 4' : undefined}
                className={isCurrent ? 'custody-road-orbit' : undefined}
              />

              <circle
                cx={hop.cx}
                cy={hop.cy}
                r={isCurrent ? 19 : 15.5}
                fill={isLit ? hop.accentHex : '#0F254A'}
                stroke={
                  isLit
                    ? '#FFFFFF'
                    : hop.state === 'pending'
                      ? '#F3B32A'
                      : 'rgba(148, 163, 184, 0.38)'
                }
                strokeWidth={isCurrent ? 2.4 : 1.5}
                filter={isLit ? `url(#crGlow-${gradSuffix})` : undefined}
              />

              <text
                x={hop.cx}
                y={hop.cy + 4}
                textAnchor="middle"
                className="custody-road-orb-code"
                fill={isLit ? '#06142E' : hop.state === 'pending' ? '#FDE68A' : '#94A3B8'}
              >
                {hop.code}
              </text>

              {/* Minimalist Label: Office Code + Status/Time */}
              <text
                x={labelX}
                y={hop.cy - 2}
                textAnchor={labelAnchor}
                className="custody-road-office"
                fill={isLit ? '#FFFFFF' : hop.state === 'pending' ? '#FDE68A' : '#94A3B8'}
              >
                {hop.officeCode}
              </text>
              <text
                x={labelX}
                y={hop.cy + 16}
                textAnchor={labelAnchor}
                className="custody-road-sub"
                fill={isLit ? 'rgba(226, 232, 240, 0.84)' : 'rgba(148, 163, 184, 0.72)'}
              >
                {hop.statusLine}
              </text>
            </g>
          );
        })}

        {/* Truth-capped scroll-following comet */}
        <g transform={`translate(${cometSample.x}, ${cometSample.y})`} className="custody-road-comet">
          <circle r={cometHaloRadius} fill={`url(#crComet-${gradSuffix})`} />
          <circle
            r={cometCoreRadius}
            fill="#FFFFFF"
            stroke="#F3B32A"
            strokeWidth="2.4"
            filter={`url(#crGlow-${gradSuffix})`}
          />
        </g>
      </svg>
    </div>
  );
};
