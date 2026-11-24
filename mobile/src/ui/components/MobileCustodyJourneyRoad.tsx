import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { Document } from '../../domain/entities/Document';
import {
  DocumentLifecycleStatus,
  ReceiptStatus,
} from '../../domain/enums/DomainEnums';
import { SDO_FONTS } from '../theme/tokens';
import { formatClockTime, formatCompactDate } from '../utils/formatters';

export type MobileCustodyHopState =
  | 'reached'
  | 'active'
  | 'completed'
  | 'pending'
  | 'unreached';

export interface MobileCustodyHop {
  readonly id: string;
  readonly code: string;
  readonly officeCode: string;
  readonly statusLine: string;
  readonly state: MobileCustodyHopState;
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

interface BuiltMobileJourney {
  readonly hops: ReadonlyArray<MobileCustodyHop>;
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
  readonly statusColor: string;
}

const VIEW_WIDTH = 440;
const TOP_PAD = 76;
const BOTTOM_PAD = 80;
const STEP_Y = 204;

const HOP_ACCENTS = ['#60A5FA', '#F3B32A', '#2DD4BF', '#34D399'] as const;

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

function sampleByTargetY(samples: ReadonlyArray<PathSample>, targetY: number): PathSample {
  if (samples.length === 0) return { len: 0, x: 128, y: TOP_PAD };
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

function formatShortTime(iso?: string | null): string {
  if (!iso) return '';
  const d = formatCompactDate(iso);
  const t = formatClockTime(iso);
  if (d && t) return `${d} · ${t}`;
  return t || d || '';
}

export function buildMobileDocumentJourney(doc: Document): BuiltMobileJourney {
  const rawNodes: Array<{
    id: string;
    officeCode: string;
    statusLine: string;
    state: MobileCustodyHopState;
    accentHex: string;
  }> = [];

  const sortedTxs = [...doc.transactions].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  );

  const originTime = formatShortTime(sortedTxs[0]?.sentAt ?? doc.createdAt);
  rawNodes.push({
    id: `origin-${doc.originOffice.id}`,
    officeCode: doc.originOffice.code,
    statusLine:
      sortedTxs.length > 0
        ? `Dispatched${originTime ? ` · ${originTime}` : ''}`
        : `Registered${originTime ? ` · ${originTime}` : ''}`,
    state: sortedTxs.length > 0 ? 'reached' : 'active',
    accentHex: HOP_ACCENTS[0],
  });

  const isCompletedLifecycle =
    doc.lifecycleStatus === DocumentLifecycleStatus.APPROVED ||
    doc.lifecycleStatus === DocumentLifecycleStatus.ARCHIVED;

  sortedTxs.forEach((tx, idx) => {
    const isLast = idx === sortedTxs.length - 1;
    const ts = formatShortTime(tx.acknowledgedAt ?? tx.sentAt);

    let state: MobileCustodyHopState = 'reached';
    let statusLine = `Received${ts ? ` · ${ts}` : ''}`;
    let accentHex: string = HOP_ACCENTS[(idx + 1) % HOP_ACCENTS.length];

    if (tx.receiptStatus === ReceiptStatus.PENDING) {
      state = 'pending';
      statusLine = 'In Transit · Awaiting receipt';
      accentHex = '#F3B32A';
    } else if (
      tx.receiptStatus === ReceiptStatus.RETURNED_FOR_REVISION ||
      tx.receiptStatus === ReceiptStatus.DECLINED_MISROUTED
    ) {
      state = isLast ? 'active' : 'reached';
      statusLine = `${tx.receiptStatus === ReceiptStatus.DECLINED_MISROUTED ? 'Flagged' : 'Returned'}${ts ? ` · ${ts}` : ''}`;
      accentHex = '#FB7185';
    } else if (tx.receiptStatus === ReceiptStatus.RECALLED) {
      state = isLast ? 'active' : 'reached';
      statusLine = `Recalled${ts ? ` · ${ts}` : ''}`;
      accentHex = '#94A3B8';
    } else if (isLast && isCompletedLifecycle) {
      state = 'completed';
      statusLine = `${doc.lifecycleStatus === DocumentLifecycleStatus.ARCHIVED ? 'Archived' : 'Approved'}${ts ? ` · ${ts}` : ''}`;
      accentHex = '#34D399';
    } else if (isLast) {
      state = 'active';
      statusLine = `${doc.lifecycleStatus === DocumentLifecycleStatus.IN_REVIEW ? 'In Review' : 'At Desk'}${ts ? ` · ${ts}` : ''}`;
      accentHex = '#2DD4BF';
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
      statusLine: 'Ready to route',
      state: 'unreached',
      accentHex: '#94A3B8',
    });
  }

  const hops: MobileCustodyHop[] = trimmed.map((item, idx) => {
    const isLeft = idx % 2 === 0;
    return {
      ...item,
      code: String(idx + 1).padStart(2, '0'),
      cx: isLeft ? 124 : 316,
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
  let statusColor = '#5EEAD4';

  if (lastHop.state === 'unreached') {
    maxTruthProgress = 0;
    statusSummary = `Registered · ${hops[0].officeCode}`;
    statusColor = '#93C5FD';
  } else if (lastHop.state === 'pending') {
    maxTruthProgress = clamp((segCount - 1 + 0.72) / segCount, 0.15, 0.94);
    statusSummary = `In Transit → ${lastHop.officeCode}`;
    statusColor = '#FDE68A';
  } else if (lastHop.state === 'completed') {
    maxTruthProgress = 1;
    statusSummary = `${doc.lifecycleStatus === DocumentLifecycleStatus.ARCHIVED ? 'Archived' : 'Approved'} · ${lastHop.officeCode}`;
    statusColor = '#6EE7B7';
  } else if (doc.lifecycleStatus === DocumentLifecycleStatus.RETURNED_FOR_REVISION) {
    maxTruthProgress = 1;
    statusSummary = `Returned · ${lastHop.officeCode}`;
    statusColor = '#FDA4AF';
  }

  let mainPath = `M ${hops[0].cx} ${hops[0].cy}`;
  let leftFilamentPath = `M ${hops[0].cx} ${hops[0].cy}`;
  let rightFilamentPath = `M ${hops[0].cx} ${hops[0].cy}`;

  const samples: PathSample[] = [];
  let accumLen = 0;
  let prevX = hops[0].cx;
  let prevY = hops[0].cy;
  samples.push({ len: 0, x: prevX, y: prevY });

  const stepsPerSeg = 52;
  for (let i = 0; i < hops.length - 1; i += 1) {
    const a = hops[i];
    const b = hops[i + 1];
    const midY = (a.cy + b.cy) / 2;

    mainPath += ` C ${a.cx} ${midY}, ${b.cx} ${midY}, ${b.cx} ${b.cy}`;
    leftFilamentPath += ` C ${a.cx - 22} ${midY - 8}, ${b.cx - 16} ${midY + 12}, ${b.cx} ${b.cy}`;
    rightFilamentPath += ` C ${a.cx + 22} ${midY + 8}, ${b.cx + 16} ${midY - 12}, ${b.cx} ${b.cy}`;

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
    statusColor,
  };
}

interface MobileCustodyJourneyRoadProps {
  readonly document: Document;
  readonly scrollY: number;
  readonly viewportHeight: number;
  readonly sectionOffsetY: number;
  readonly onOpenDocument?: (documentId: string) => void;
  readonly onRequestScrollToY?: (targetY: number) => void;
}

export const MobileCustodyJourneyRoad: React.FC<MobileCustodyJourneyRoadProps> = ({
  document: doc,
  scrollY,
  viewportHeight,
  sectionOffsetY,
  onOpenDocument,
  onRequestScrollToY,
}) => {
  const journey = useMemo(() => buildMobileDocumentJourney(doc), [doc]);
  const [svgWidth, setSvgWidth] = useState<number>(332);
  const [svgOffsetInCardY, setSvgOffsetInCardY] = useState<number>(52);

  const isJest = typeof jest !== 'undefined';
  const [progress, setProgress] = useState<number>(journey.maxTruthProgress);
  const [pulsePhase, setPulsePhase] = useState<number>(0);

  const targetRef = useRef<number>(journey.maxTruthProgress);
  const displayRef = useRef<number>(journey.maxTruthProgress);

  const svgHeightPx = Math.round((svgWidth / VIEW_WIDTH) * journey.viewHeight);

  // Compute truth-capped scroll progress from parent ScrollView position
  useEffect(() => {
    if (isJest || viewportHeight <= 0 || svgHeightPx <= 0) {
      targetRef.current = journey.maxTruthProgress;
      displayRef.current = journey.maxTruthProgress;
      setProgress(journey.maxTruthProgress);
      return;
    }

    const absSvgTop = sectionOffsetY + svgOffsetInCardY;
    const firstNodeAbsY = absSvgTop + svgHeightPx * (journey.firstY / journey.viewHeight);
    const lastNodeAbsY = absSvgTop + svgHeightPx * (journey.lastY / journey.viewHeight);
    const span = Math.max(1, lastNodeAbsY - firstNodeAbsY);
    const focusAbsY = scrollY + viewportHeight * 0.56;
    const rawScroll = clamp((focusAbsY - firstNodeAbsY) / span, 0, 1);

    targetRef.current = Math.min(rawScroll, journey.maxTruthProgress);
  }, [
    isJest,
    scrollY,
    viewportHeight,
    sectionOffsetY,
    svgOffsetInCardY,
    svgHeightPx,
    journey,
  ]);

  // Reset softly when switching documents
  useEffect(() => {
    if (isJest) {
      displayRef.current = journey.maxTruthProgress;
      setProgress(journey.maxTruthProgress);
      return;
    }
    displayRef.current = 0;
    setProgress(0);
  }, [doc.id, isJest, journey.maxTruthProgress]);

  // Lightweight 60fps spring-follow + subtle shockwave pulse loop
  useEffect(() => {
    if (isJest) return;
    let alive = true;
    let rafId = 0;
    let lastTs = 0;

    const tick = (now: number) => {
      if (!alive) return;
      const dt = lastTs > 0 ? Math.min(0.05, (now - lastTs) / 1000) : 1 / 60;
      lastTs = now;

      const diff = targetRef.current - displayRef.current;
      if (Math.abs(diff) > 0.0008) {
        const factor = 1 - Math.exp(-dt * 11);
        displayRef.current += diff * factor;
        setProgress(displayRef.current);
      }

      setPulsePhase((now % 2400) / 2400);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
    };
  }, [isJest]);

  const handleSvgLayout = (ev: LayoutChangeEvent) => {
    const { width, y } = ev.nativeEvent.layout;
    if (width > 80 && Math.abs(width - svgWidth) > 2) {
      setSvgWidth(Math.round(width));
    }
    if (Math.abs(y - svgOffsetInCardY) > 2) {
      setSvgOffsetInCardY(Math.round(y));
    }
  };

  const spanY = Math.max(1, journey.lastY - journey.firstY);
  const cometTargetY = journey.firstY + progress * spanY;
  const cometSample = sampleByTargetY(journey.samples, cometTargetY);
  const activeDashOffset = Math.max(0, journey.totalLength - cometSample.len);

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

  const rippleRadius = 22 + pulsePhase * 24;
  const rippleOpacity = Math.max(0, (1 - pulsePhase) * 0.72);
  const scrollBoost = Math.min(1, Math.abs(targetRef.current - progress) * 7);

  const sparks = useMemo(() => {
    const count = Math.max(6, journey.hops.length * 2 + 1);
    return Array.from({ length: count }, (_, i) => ({
      cx: i % 2 === 0 ? 48 + ((i * 29) % 66) : 326 + ((i * 31) % 72),
      cy: Math.round(((i + 0.5) / count) * journey.viewHeight),
      r: i % 3 === 0 ? 2 : 1.4,
    }));
  }, [journey.hops.length, journey.viewHeight]);

  const handleHopPress = (hop: MobileCustodyHop) => {
    if (!onRequestScrollToY || viewportHeight <= 0) return;
    const absNodeY =
      sectionOffsetY + svgOffsetInCardY + svgHeightPx * (hop.cy / journey.viewHeight);
    onRequestScrollToY(Math.max(0, absNodeY - viewportHeight * 0.56));
  };

  return (
    <View testID="mobile-custody-journey-road" style={styles.stageCard}>
      <View style={styles.topBar}>
        <View style={styles.metaRow}>
          <View style={styles.codePill}>
            <Text style={styles.codeText}>{doc.trackingCode}</Text>
          </View>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, { backgroundColor: journey.statusColor }]} />
            <Text style={[styles.statusText, { color: journey.statusColor }]}>
              {journey.statusSummary}
            </Text>
          </View>
        </View>

        {onOpenDocument ? (
          <Pressable
            testID="mobile-custody-road-open-doc"
            onPress={() => onOpenDocument(doc.id)}
            accessibilityRole="button"
            style={styles.openBtn}
          >
            <Text style={styles.openBtnText}>Open</Text>
            <ArrowUpRight size={13} color="#FFFFFF" />
          </Pressable>
        ) : null}
      </View>

      <View onLayout={handleSvgLayout} style={styles.svgWrap}>
        <Svg
          width={svgWidth}
          height={svgHeightPx}
          viewBox={`0 0 ${VIEW_WIDTH} ${journey.viewHeight}`}
        >
          <Defs>
            <LinearGradient id="mcrRoadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#60A5FA" />
              <Stop offset="38%" stopColor="#F3B32A" />
              <Stop offset="72%" stopColor="#2DD4BF" />
              <Stop offset="100%" stopColor="#34D399" />
            </LinearGradient>

            <LinearGradient id="mcrFilGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#60A5FA" stopOpacity={0.85} />
              <Stop offset="42%" stopColor="#F3B32A" stopOpacity={0.95} />
              <Stop offset="76%" stopColor="#2DD4BF" stopOpacity={0.9} />
              <Stop offset="100%" stopColor="#34D399" stopOpacity={0.95} />
            </LinearGradient>

            <RadialGradient id="mcrCometGrad" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset="38%" stopColor="#FDE68A" stopOpacity={0.94} />
              <Stop offset="74%" stopColor="#F3B32A" stopOpacity={0.44} />
              <Stop offset="100%" stopColor="#F3B32A" stopOpacity={0} />
            </RadialGradient>

            <ClipPath id="mcrProgressClip">
              <Rect x={0} y={0} width={VIEW_WIDTH} height={Math.max(0, cometSample.y + 4)} />
            </ClipPath>
          </Defs>

          {/* Subtle ambient motes */}
          {sparks.map((sp, i) => (
            <Circle
              key={i}
              cx={sp.cx}
              cy={sp.cy}
              r={sp.r}
              fill={i % 2 === 0 ? '#F3B32A' : '#5EEAD4'}
              opacity={0.48}
            />
          ))}

          {/* Dormant unlit road */}
          <Path
            d={journey.mainPath}
            fill="none"
            stroke="rgba(148, 163, 184, 0.17)"
            strokeWidth={11}
            strokeLinecap="round"
          />
          <Path
            d={journey.mainPath}
            fill="none"
            stroke="rgba(148, 163, 184, 0.34)"
            strokeWidth={1.7}
            strokeDasharray="6 8"
            strokeLinecap="round"
          />

          {/* Broad soft glow aura beneath lit path */}
          <Path
            d={journey.mainPath}
            fill="none"
            stroke="url(#mcrRoadGrad)"
            strokeWidth={16}
            strokeLinecap="round"
            opacity={0.26}
            strokeDasharray={[journey.totalLength, journey.totalLength]}
            strokeDashoffset={activeDashOffset}
          />

          {/* Braided energy filaments clipped to the traveling torch */}
          {progress > 0.008 ? (
            <G clipPath="url(#mcrProgressClip)">
              <Path
                d={journey.leftFilamentPath}
                fill="none"
                stroke="url(#mcrFilGrad)"
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.74}
              />
              <Path
                d={journey.rightFilamentPath}
                fill="none"
                stroke="url(#mcrFilGrad)"
                strokeWidth={1.8}
                strokeLinecap="round"
                opacity={0.62}
              />
            </G>
          ) : null}

          {/* Core luminous vertical track */}
          <Path
            d={journey.mainPath}
            fill="none"
            stroke="url(#mcrRoadGrad)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={[journey.totalLength, journey.totalLength]}
            strokeDashoffset={activeDashOffset}
          />

          {/* White-hot core dashes inside lit track */}
          {progress > 0.015 ? (
            <Path
              d={journey.mainPath}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeDasharray="14 24"
              opacity={0.78}
              clipPath="url(#mcrProgressClip)"
            />
          ) : null}

          {/* Real Office Orbs with minimalist labels */}
          {journey.hops.map((hop, idx) => {
            const hopFrac = (hop.cy - journey.firstY) / spanY;
            const isUnreached = hop.state === 'pending' || hop.state === 'unreached';
            const isLit = !isUnreached && (idx === 0 || progress >= hopFrac - 0.025);
            const isCurrent =
              (!lastHopIsPending && idx === currentLitIdx) ||
              (lastHopIsPending && idx === lastHopIdx && progress >= journey.maxTruthProgress - 0.05);
            const labelX = hop.labelSide === 'right' ? hop.cx + 42 : hop.cx - 42;
            const labelAnchor = hop.labelSide === 'right' ? 'start' : 'end';

            return (
              <G key={hop.id} onPress={() => handleHopPress(hop)}>
                {isCurrent ? (
                  <Circle
                    cx={hop.cx}
                    cy={hop.cy}
                    r={rippleRadius}
                    fill="none"
                    stroke={hop.accentHex}
                    strokeWidth={2}
                    opacity={rippleOpacity}
                  />
                ) : null}

                {isLit ? (
                  <Circle
                    cx={hop.cx}
                    cy={hop.cy}
                    r={isCurrent ? 34 : 25}
                    fill={hop.accentHex}
                    opacity={isCurrent ? 0.24 : 0.14}
                  />
                ) : null}

                <Circle
                  cx={hop.cx}
                  cy={hop.cy}
                  r={isCurrent ? 26 : 20}
                  fill="none"
                  stroke={
                    isLit
                      ? hop.accentHex
                      : hop.state === 'pending'
                        ? 'rgba(243, 179, 42, 0.58)'
                        : 'rgba(148, 163, 184, 0.3)'
                  }
                  strokeWidth={isCurrent ? 2 : 1.4}
                  strokeDasharray={hop.state === 'pending' ? '4 4' : undefined}
                />

                <Circle
                  cx={hop.cx}
                  cy={hop.cy}
                  r={isCurrent ? 18 : 14.5}
                  fill={isLit ? hop.accentHex : '#0F254A'}
                  stroke={
                    isLit
                      ? '#FFFFFF'
                      : hop.state === 'pending'
                        ? '#F3B32A'
                        : 'rgba(148, 163, 184, 0.4)'
                  }
                  strokeWidth={isCurrent ? 2.3 : 1.5}
                />

                <SvgText
                  x={hop.cx}
                  y={hop.cy + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight="800"
                  fill={isLit ? '#06142E' : hop.state === 'pending' ? '#FDE68A' : '#94A3B8'}
                >
                  {hop.code}
                </SvgText>

                <SvgText
                  x={labelX}
                  y={hop.cy - 2}
                  textAnchor={labelAnchor}
                  fontSize={15}
                  fontWeight="800"
                  fill={isLit ? '#FFFFFF' : hop.state === 'pending' ? '#FDE68A' : '#94A3B8'}
                >
                  {hop.officeCode}
                </SvgText>
                <SvgText
                  x={labelX}
                  y={hop.cy + 15}
                  textAnchor={labelAnchor}
                  fontSize={11}
                  fontWeight="600"
                  fill={isLit ? 'rgba(226, 232, 240, 0.84)' : 'rgba(148, 163, 184, 0.72)'}
                >
                  {hop.statusLine}
                </SvgText>
              </G>
            );
          })}

          {/* Blazing truth-capped scroll-following comet */}
          <G x={cometSample.x} y={cometSample.y}>
            <Circle r={20 + scrollBoost * 9} fill="url(#mcrCometGrad)" />
            <Circle
              r={6.8 + scrollBoost * 2.4}
              fill="#FFFFFF"
              stroke="#F3B32A"
              strokeWidth={2.2}
            />
          </G>
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  stageCard: {
    borderRadius: 22,
    backgroundColor: '#071A3C',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  metaRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  codePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  codeText: {
    fontFamily: SDO_FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(5, 15, 36, 0.45)',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
  },
  openBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  openBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  svgWrap: {
    width: '100%',
    alignItems: 'center',
  },
});
