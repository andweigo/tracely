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
  readonly displayOffice: string;
  readonly statusLine: string;
  readonly state: CustodyHopState;
  readonly accentHex: string;
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
  readonly samples: ReadonlyArray<PathSample>;
  readonly totalLength: number;
  readonly statusSummary: string;
  readonly statusTone: 'amber' | 'teal' | 'emerald' | 'rose' | 'sky';
}

const VIEW_WIDTH = 500;
const TOP_PAD = 56;
const BOTTOM_PAD = 60;
const STEP_Y = 148;
const FOCUS_VIEWPORT_RATIO = 0.56;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function truncateLabel(text: string, maxLen: number): string {
  const clean = text.trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1).trimEnd()}…`;
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
  if (datePart && timePart) return `${datePart}, ${timePart}`;
  return timePart || datePart || '';
}

function sampleByTargetY(samples: ReadonlyArray<PathSample>, targetY: number): PathSample {
  if (samples.length === 0) return { len: 0, x: 158, y: TOP_PAD };
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
  }> = [];

  const sortedTxs = [...doc.transactions].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  );

  const originTime = formatShortHopTime(sortedTxs[0]?.sentAt ?? doc.createdAt);
  rawNodes.push({
    id: `origin-${doc.originOffice.id}`,
    officeCode: doc.originOffice.code,
    officeName: doc.originOffice.name || doc.originOffice.code,
    statusLine:
      sortedTxs.length > 0
        ? `Sent${originTime ? ` · ${originTime}` : ''}`
        : `Created${originTime ? ` · ${originTime}` : ''}`,
    state: sortedTxs.length > 0 ? 'reached' : 'active',
    accentHex: '#0D3472',
  });

  sortedTxs.forEach((tx, idx) => {
    const isLast = idx === sortedTxs.length - 1;
    const isCompletedLifecycle =
      doc.lifecycleStatus === 'approved' || doc.lifecycleStatus === 'archived';
    const ts = formatShortHopTime(tx.receivedAt ?? tx.sentAt);

    let state: CustodyHopState = 'reached';
    let statusLine = `Received${ts ? ` · ${ts}` : ''}`;
    let accentHex = '#0D3472';

    if (tx.status === 'pending') {
      state = 'pending';
      statusLine = 'In Transit';
      accentHex = '#D97706';
    } else if (tx.status === 'returned_for_revision' || tx.status === 'declined_misrouted') {
      state = isLast ? 'active' : 'reached';
      statusLine = `${tx.status === 'declined_misrouted' ? 'Declined' : 'Returned'}${ts ? ` · ${ts}` : ''}`;
      accentHex = '#E11D48';
    } else if (tx.status === 'recalled') {
      state = isLast ? 'active' : 'reached';
      statusLine = `Recalled${ts ? ` · ${ts}` : ''}`;
      accentHex = '#64748B';
    } else if (isLast && isCompletedLifecycle) {
      state = 'completed';
      statusLine = `${doc.lifecycleStatus === 'archived' ? 'Archived' : 'Approved'}${ts ? ` · ${ts}` : ''}`;
      accentHex = '#059669';
    } else if (isLast) {
      state = 'active';
      statusLine = `${doc.lifecycleStatus === 'in_review' ? 'In Review' : 'Received'}${ts ? ` · ${ts}` : ''}`;
      accentHex = '#0284C7';
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
      officeName: tx.toOffice.name || tx.toOffice.code,
      statusLine,
      state,
      accentHex,
    });
  });

  const trimmed =
    rawNodes.length > 6 ? [rawNodes[0], ...rawNodes.slice(rawNodes.length - 5)] : rawNodes;

  if (trimmed.length === 1) {
    trimmed.push({
      id: 'next-unrouted',
      officeCode: 'NEXT',
      officeName: 'Next Office',
      statusLine: 'Waiting to be sent',
      state: 'unreached',
      accentHex: '#94A3B8',
    });
  }

  const hops: CustodyJourneyHop[] = trimmed.map((item, idx) => {
    const isLeft = idx % 2 === 0;
    const readableName =
      item.officeName && item.officeName.toLowerCase() !== item.officeCode.toLowerCase()
        ? truncateLabel(item.officeName, 22)
        : item.officeCode;
    return {
      ...item,
      displayOffice: readableName,
      code: String(idx + 1),
      cx: isLeft ? 158 : 342,
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
  let statusSummary = `At ${lastHop.displayOffice}`;
  let statusTone: BuiltJourney['statusTone'] = 'teal';

  if (lastHop.state === 'unreached') {
    maxTruthProgress = 0;
    statusSummary = `At ${hops[0].displayOffice}`;
    statusTone = 'sky';
  } else if (lastHop.state === 'pending') {
    maxTruthProgress = clamp((segCount - 1 + 0.68) / segCount, 0.15, 0.92);
    statusSummary = `In Transit to ${lastHop.displayOffice}`;
    statusTone = 'amber';
  } else if (lastHop.state === 'completed') {
    maxTruthProgress = 1;
    statusSummary = doc.lifecycleStatus === 'archived' ? 'Archived' : 'Approved';
    statusTone = 'emerald';
  } else if (doc.lifecycleStatus === 'returned_for_revision') {
    maxTruthProgress = 1;
    statusSummary = `Returned · ${lastHop.displayOffice}`;
    statusTone = 'rose';
  }

  let mainPath = `M ${hops[0].cx} ${hops[0].cy}`;
  const samples: PathSample[] = [];
  let accumLen = 0;
  let prevX = hops[0].cx;
  let prevY = hops[0].cy;
  samples.push({ len: 0, x: prevX, y: prevY });

  const stepsPerSeg = 56;
  for (let i = 0; i < hops.length - 1; i += 1) {
    const a = hops[i];
    const b = hops[i + 1];
    const midY = (a.cy + b.cy) / 2;

    mainPath += ` C ${a.cx} ${midY}, ${b.cx} ${midY}, ${b.cx} ${b.cy}`;

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
        rafIdRef.current = null;
        lastFrameRef.current = 0;
        return;
      }

      const factor = 1 - Math.exp(-dt * 12);
      const next = current + diff * factor;
      displayProgressRef.current = next;
      setProgress(next);
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
        return;
      }

      if (rafIdRef.current === null) {
        lastFrameRef.current = 0;
        rafIdRef.current = window.requestAnimationFrame(step);
      }
    };

    const onScroll = () => syncFromScroll(false);
    const onResize = () => syncFromScroll(true);

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
  const markerTargetY = journey.firstY + progress * spanY;
  const markerSample = sampleByTargetY(journey.samples, markerTargetY);
  const activeDashOffset = Math.max(0, journey.totalLength - markerSample.len);

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

  const displayTitle = doc.isSealed ? 'Sealed Document' : doc.title;
  const gradSuffix = doc.id.replace(/[^a-zA-Z0-9_-]/g, '');

  return (
    <div
      className="custody-road-stage"
      data-testid="web-custody-journey-road"
      aria-label={`Document tracking for ${displayTitle}`}
    >
      {/* Clean Minimal Top Bar with Document Title + Status */}
      <div className="custody-road-topbar">
        <div className="custody-road-meta">
          <span className="custody-road-title" data-testid="web-custody-road-title">
            {displayTitle}
          </span>
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
            <span>View</span>
            <ArrowUpRight size={13} />
          </button>
        ) : null}
      </div>

      <svg
        ref={svgRef}
        className="custody-road-svg"
        viewBox={`0 0 ${VIEW_WIDTH} ${journey.viewHeight}`}
        role="img"
        aria-label={`Route for ${displayTitle}: ${journey.statusSummary}`}
      >
        <defs>
          <linearGradient id={`crGrad-${gradSuffix}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0D3472" />
            <stop offset="55%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
        </defs>

        {/* Dormant unreached track */}
        <path
          d={journey.mainPath}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d={journey.mainPath}
          fill="none"
          stroke="#CBD5E1"
          strokeWidth="1.5"
          strokeDasharray="5 6"
          strokeLinecap="round"
        />

        {/* Active truth-capped progress path */}
        <path
          d={journey.mainPath}
          fill="none"
          stroke={`url(#crGrad-${gradSuffix})`}
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeDasharray={journey.totalLength}
          strokeDashoffset={activeDashOffset}
        />

        {/* Office Stops */}
        {journey.hops.map((hop, idx) => {
          const hopFrac = (hop.cy - journey.firstY) / spanY;
          const isUnreached = hop.state === 'pending' || hop.state === 'unreached';
          const isLit = !isUnreached && (idx === 0 || progress >= hopFrac - 0.025);
          const isCurrent =
            (!lastHopIsPending && idx === currentLitIdx) ||
            (lastHopIsPending && idx === lastHopIdx && progress >= journey.maxTruthProgress - 0.05);
          const labelX = hop.labelSide === 'right' ? hop.cx + 34 : hop.cx - 34;
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
              aria-label={`${hop.displayOffice} — ${hop.statusLine}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleHopClick(hop);
                }
              }}
            >
              {isCurrent ? (
                <circle
                  cx={hop.cx}
                  cy={hop.cy}
                  r="23"
                  fill={hop.accentHex}
                  fillOpacity="0.12"
                />
              ) : null}

              <circle
                cx={hop.cx}
                cy={hop.cy}
                r={isCurrent ? 16 : 14}
                fill={isLit ? hop.accentHex : '#FFFFFF'}
                stroke={
                  isLit
                    ? '#FFFFFF'
                    : hop.state === 'pending'
                      ? '#D97706'
                      : '#CBD5E1'
                }
                strokeWidth={isLit ? 2.5 : 2}
                strokeDasharray={hop.state === 'pending' ? '4 3' : undefined}
              />

              <text
                x={hop.cx}
                y={hop.cy + 4}
                textAnchor="middle"
                className="custody-road-orb-code"
                fill={isLit ? '#FFFFFF' : hop.state === 'pending' ? '#B45309' : '#64748B'}
              >
                {hop.code}
              </text>

              {/* Clear Office Name + Everyday Status */}
              <text
                x={labelX}
                y={hop.cy - 2}
                textAnchor={labelAnchor}
                className="custody-road-office"
                fill={isLit ? '#0F172A' : hop.state === 'pending' ? '#92400E' : '#64748B'}
              >
                {hop.displayOffice}
              </text>
              <text
                x={labelX}
                y={hop.cy + 15}
                textAnchor={labelAnchor}
                className="custody-road-sub"
                fill={isLit ? '#475569' : '#94A3B8'}
              >
                {hop.statusLine}
              </text>
            </g>
          );
        })}

        {/* Clean Scroll-Following Marker */}
        <g transform={`translate(${markerSample.x}, ${markerSample.y})`} className="custody-road-comet">
          <circle r="11" fill={lastHopIsPending ? '#F59E0B' : '#0284C7'} fillOpacity="0.2" />
          <circle
            r="5.5"
            fill={lastHopIsPending ? '#D97706' : '#0D3472'}
            stroke="#FFFFFF"
            strokeWidth="2"
          />
        </g>
      </svg>
    </div>
  );
};
