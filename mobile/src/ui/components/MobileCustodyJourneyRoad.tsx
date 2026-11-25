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
  Defs,
  G,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { Document } from '../../domain/entities/Document';
import {
  DocumentLifecycleStatus,
  ReceiptStatus,
} from '../../domain/enums/DomainEnums';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';
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
  readonly displayOffice: string;
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
  readonly samples: ReadonlyArray<PathSample>;
  readonly totalLength: number;
  readonly statusSummary: string;
  readonly statusColor: string;
  readonly statusBg: string;
}

const VIEW_WIDTH = 420;
const TOP_PAD = 50;
const BOTTOM_PAD = 54;
const STEP_Y = 136;

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

function sampleByTargetY(samples: ReadonlyArray<PathSample>, targetY: number): PathSample {
  if (samples.length === 0) return { len: 0, x: 132, y: TOP_PAD };
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
  if (d && t) return `${d}, ${t}`;
  return t || d || '';
}

export function buildMobileDocumentJourney(doc: Document): BuiltMobileJourney {
  const rawNodes: Array<{
    id: string;
    officeCode: string;
    officeName: string;
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
    officeName: doc.originOffice.name || doc.originOffice.code,
    statusLine:
      sortedTxs.length > 0
        ? `Sent${originTime ? ` · ${originTime}` : ''}`
        : `Created${originTime ? ` · ${originTime}` : ''}`,
    state: sortedTxs.length > 0 ? 'reached' : 'active',
    accentHex: '#0D3472',
  });

  const isCompletedLifecycle =
    doc.lifecycleStatus === DocumentLifecycleStatus.APPROVED ||
    doc.lifecycleStatus === DocumentLifecycleStatus.ARCHIVED;

  sortedTxs.forEach((tx, idx) => {
    const isLast = idx === sortedTxs.length - 1;
    const ts = formatShortTime(tx.acknowledgedAt ?? tx.sentAt);

    let state: MobileCustodyHopState = 'reached';
    let statusLine = `Received${ts ? ` · ${ts}` : ''}`;
    let accentHex = '#0D3472';

    if (tx.receiptStatus === ReceiptStatus.PENDING) {
      state = 'pending';
      statusLine = 'In Transit';
      accentHex = '#D97706';
    } else if (
      tx.receiptStatus === ReceiptStatus.RETURNED_FOR_REVISION ||
      tx.receiptStatus === ReceiptStatus.DECLINED_MISROUTED
    ) {
      state = isLast ? 'active' : 'reached';
      statusLine = `${tx.receiptStatus === ReceiptStatus.DECLINED_MISROUTED ? 'Declined' : 'Returned'}${ts ? ` · ${ts}` : ''}`;
      accentHex = '#E11D48';
    } else if (tx.receiptStatus === ReceiptStatus.RECALLED) {
      state = isLast ? 'active' : 'reached';
      statusLine = `Recalled${ts ? ` · ${ts}` : ''}`;
      accentHex = '#64748B';
    } else if (isLast && isCompletedLifecycle) {
      state = 'completed';
      statusLine = `${doc.lifecycleStatus === DocumentLifecycleStatus.ARCHIVED ? 'Archived' : 'Approved'}${ts ? ` · ${ts}` : ''}`;
      accentHex = '#059669';
    } else if (isLast) {
      state = 'active';
      statusLine = `${doc.lifecycleStatus === DocumentLifecycleStatus.IN_REVIEW ? 'In Review' : 'Received'}${ts ? ` · ${ts}` : ''}`;
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

  const hops: MobileCustodyHop[] = trimmed.map((item, idx) => {
    const isLeft = idx % 2 === 0;
    const readable =
      item.officeName && item.officeName.toLowerCase() !== item.officeCode.toLowerCase()
        ? truncateLabel(item.officeName, 20)
        : item.officeCode;
    return {
      ...item,
      displayOffice: readable,
      code: String(idx + 1),
      cx: isLeft ? 130 : 290,
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
  let statusColor = '#0369A1';
  let statusBg = '#E0F2FE';

  if (lastHop.state === 'unreached') {
    maxTruthProgress = 0;
    statusSummary = `At ${hops[0].displayOffice}`;
    statusColor = '#1D4ED8';
    statusBg = '#DBEAFE';
  } else if (lastHop.state === 'pending') {
    maxTruthProgress = clamp((segCount - 1 + 0.68) / segCount, 0.15, 0.92);
    statusSummary = `In Transit to ${lastHop.displayOffice}`;
    statusColor = '#B45309';
    statusBg = '#FEF3C7';
  } else if (lastHop.state === 'completed') {
    maxTruthProgress = 1;
    statusSummary =
      doc.lifecycleStatus === DocumentLifecycleStatus.ARCHIVED ? 'Archived' : 'Approved';
    statusColor = '#047857';
    statusBg = '#D1FAE5';
  } else if (doc.lifecycleStatus === DocumentLifecycleStatus.RETURNED_FOR_REVISION) {
    maxTruthProgress = 1;
    statusSummary = `Returned · ${lastHop.displayOffice}`;
    statusColor = '#BE123C';
    statusBg = '#FFE4E6';
  }

  let mainPath = `M ${hops[0].cx} ${hops[0].cy}`;
  const samples: PathSample[] = [];
  let accumLen = 0;
  let prevX = hops[0].cx;
  let prevY = hops[0].cy;
  samples.push({ len: 0, x: prevX, y: prevY });

  const stepsPerSeg = 48;
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
    statusColor,
    statusBg,
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
  const [svgWidth, setSvgWidth] = useState<number>(324);
  const [svgOffsetInCardY, setSvgOffsetInCardY] = useState<number>(50);

  const isJest = typeof jest !== 'undefined';
  const [progress, setProgress] = useState<number>(journey.maxTruthProgress);

  const targetRef = useRef<number>(journey.maxTruthProgress);
  const displayRef = useRef<number>(journey.maxTruthProgress);

  const svgHeightPx = Math.round((svgWidth / VIEW_WIDTH) * journey.viewHeight);

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

  useEffect(() => {
    if (isJest) {
      displayRef.current = journey.maxTruthProgress;
      setProgress(journey.maxTruthProgress);
      return;
    }
    displayRef.current = 0;
    setProgress(0);
  }, [doc.id, isJest, journey.maxTruthProgress]);

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

  const handleHopPress = (hop: MobileCustodyHop) => {
    if (!onRequestScrollToY || viewportHeight <= 0) return;
    const absNodeY =
      sectionOffsetY + svgOffsetInCardY + svgHeightPx * (hop.cy / journey.viewHeight);
    onRequestScrollToY(Math.max(0, absNodeY - viewportHeight * 0.56));
  };

  const displayTitle = doc.isSealed ? 'Sealed Document' : doc.title;

  return (
    <View testID="mobile-custody-journey-road" style={styles.stageCard}>
      <View style={styles.topBar}>
        <View style={styles.titleBlock}>
          <Text testID="mobile-custody-road-title" numberOfLines={1} style={styles.docTitle}>
            {displayTitle}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: journey.statusBg }]}>
            <View style={[styles.statusDot, { backgroundColor: journey.statusColor }]} />
            <Text numberOfLines={1} style={[styles.statusText, { color: journey.statusColor }]}>
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
            <Text style={styles.openBtnText}>View</Text>
            <ArrowUpRight size={13} color={SDO_COLORS.navy} />
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
              <Stop offset="0%" stopColor="#0D3472" />
              <Stop offset="55%" stopColor="#0284C7" />
              <Stop offset="100%" stopColor="#059669" />
            </LinearGradient>
          </Defs>

          {/* Dormant track */}
          <Path
            d={journey.mainPath}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth={6}
            strokeLinecap="round"
          />
          <Path
            d={journey.mainPath}
            fill="none"
            stroke="#CBD5E1"
            strokeWidth={1.5}
            strokeDasharray="5 6"
            strokeLinecap="round"
          />

          {/* Truth-capped active progress line */}
          <Path
            d={journey.mainPath}
            fill="none"
            stroke="url(#mcrRoadGrad)"
            strokeWidth={4.5}
            strokeLinecap="round"
            strokeDasharray={[journey.totalLength, journey.totalLength]}
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
            const labelX = hop.labelSide === 'right' ? hop.cx + 30 : hop.cx - 30;
            const labelAnchor = hop.labelSide === 'right' ? 'start' : 'end';

            return (
              <G key={hop.id} onPress={() => handleHopPress(hop)}>
                {isCurrent ? (
                  <Circle
                    cx={hop.cx}
                    cy={hop.cy}
                    r={22}
                    fill={hop.accentHex}
                    opacity={0.14}
                  />
                ) : null}

                <Circle
                  cx={hop.cx}
                  cy={hop.cy}
                  r={isCurrent ? 15.5 : 13.5}
                  fill={isLit ? hop.accentHex : '#FFFFFF'}
                  stroke={
                    isLit
                      ? '#FFFFFF'
                      : hop.state === 'pending'
                        ? '#D97706'
                        : '#CBD5E1'
                  }
                  strokeWidth={isLit ? 2.4 : 2}
                  strokeDasharray={hop.state === 'pending' ? '4 3' : undefined}
                />

                <SvgText
                  x={hop.cx}
                  y={hop.cy + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight="800"
                  fill={isLit ? '#FFFFFF' : hop.state === 'pending' ? '#B45309' : '#64748B'}
                >
                  {hop.code}
                </SvgText>

                <SvgText
                  x={labelX}
                  y={hop.cy - 2}
                  textAnchor={labelAnchor}
                  fontSize={13.5}
                  fontWeight="700"
                  fill={isLit ? '#0F172A' : hop.state === 'pending' ? '#92400E' : '#64748B'}
                >
                  {hop.displayOffice}
                </SvgText>
                <SvgText
                  x={labelX}
                  y={hop.cy + 14}
                  textAnchor={labelAnchor}
                  fontSize={10.5}
                  fontWeight="500"
                  fill={isLit ? '#475569' : '#94A3B8'}
                >
                  {hop.statusLine}
                </SvgText>
              </G>
            );
          })}

          {/* Scroll-following marker */}
          <G x={markerSample.x} y={markerSample.y}>
            <Circle
              r={10.5}
              fill={lastHopIsPending ? '#F59E0B' : '#0284C7'}
              opacity={0.22}
            />
            <Circle
              r={5.2}
              fill={lastHopIsPending ? '#D97706' : '#0D3472'}
              stroke="#FFFFFF"
              strokeWidth={2}
            />
          </G>
        </Svg>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  stageCard: {
    borderRadius: 16,
    backgroundColor: SDO_COLORS.surface,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
  },
  titleBlock: {
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  docTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13.5,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
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
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  openBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  svgWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 4,
  },
});

export default MobileCustodyJourneyRoad;
