import React, { useEffect, useRef, useState } from 'react';

interface OfficeNode {
  readonly id: number;
  readonly code: string;
  readonly label: string;
  readonly sub: string;
  readonly cx: number;
  readonly cy: number;
  readonly labelSide: 'left' | 'right';
}

interface PathSample {
  readonly len: number;
  readonly x: number;
  readonly y: number;
}

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 820;
const FIRST_NODE_Y = 92;
const LAST_NODE_Y = 728;
const NODE_SPAN_Y = LAST_NODE_Y - FIRST_NODE_Y;
const FOCUS_VIEWPORT_RATIO = 0.54;

const MAIN_ROAD_PATH =
  'M 180 92 C 180 202, 380 202, 380 304 C 380 414, 180 414, 180 516 C 180 626, 380 626, 380 728';

const OFFICE_NODES: ReadonlyArray<OfficeNode> = [
  {
    id: 0,
    code: '01',
    label: 'Records Office',
    sub: 'QR slip printed & logged',
    cx: 180,
    cy: 92,
    labelSide: 'right',
  },
  {
    id: 1,
    code: '02',
    label: 'Finance & Budget',
    sub: 'Scanned & received on desk',
    cx: 380,
    cy: 304,
    labelSide: 'left',
  },
  {
    id: 2,
    code: '03',
    label: 'Legal Review',
    sub: 'Remarks & revision attached',
    cx: 180,
    cy: 516,
    labelSide: 'right',
  },
  {
    id: 3,
    code: '04',
    label: 'Executive Sign-Off',
    sub: 'Approved & archived',
    cx: 380,
    cy: 728,
    labelSide: 'left',
  },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sampleByTargetY(samples: ReadonlyArray<PathSample>, targetY: number): PathSample {
  if (samples.length === 0) {
    return { len: 0, x: OFFICE_NODES[0].cx, y: FIRST_NODE_Y };
  }
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

export const HeroCustodyDemo: React.FC = () => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const mainPathRef = useRef<SVGPathElement | null>(null);
  const pathLengthRef = useRef<number>(980);
  const pathSamplesRef = useRef<PathSample[]>([]);

  const targetProgressRef = useRef<number>(0);
  const displayProgressRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);

  const [progress, setProgress] = useState<number>(0);
  const [activeLength, setActiveLength] = useState<number>(0);
  const [markerPos, setMarkerPos] = useState<{ x: number; y: number }>({
    x: OFFICE_NODES[0].cx,
    y: OFFICE_NODES[0].cy,
  });

  useEffect(() => {
    const pathEl = mainPathRef.current;
    if (!pathEl) return;

    try {
      const totalLen = pathEl.getTotalLength();
      if (totalLen > 0) {
        pathLengthRef.current = totalLen;
        const steps = 240;
        const samples: PathSample[] = [];
        for (let i = 0; i <= steps; i += 1) {
          const len = (totalLen * i) / steps;
          const pt = pathEl.getPointAtLength(len);
          samples.push({ len, x: pt.x, y: pt.y });
        }
        pathSamplesRef.current = samples;
      }
    } catch {
      // Fallback if SVG geometry API is unavailable
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const applyVisualState = (p: number) => {
      const targetY = FIRST_NODE_Y + p * NODE_SPAN_Y;
      const sample = sampleByTargetY(pathSamplesRef.current, targetY);
      setProgress(p);
      setActiveLength(sample.len);
      setMarkerPos({ x: sample.x, y: sample.y });
    };

    const computeScrollProgress = (): number => {
      const svgEl = svgRef.current;
      if (!svgEl) return 0;
      const rect = svgEl.getBoundingClientRect();
      if (rect.height <= 0) return 0;

      const firstNodeScreenY = rect.top + rect.height * (FIRST_NODE_Y / VIEW_HEIGHT);
      const lastNodeScreenY = rect.top + rect.height * (LAST_NODE_Y / VIEW_HEIGHT);
      const trackSpan = Math.max(1, lastNodeScreenY - firstNodeScreenY);
      const focusY = window.innerHeight * FOCUS_VIEWPORT_RATIO;

      return clamp((focusY - firstNodeScreenY) / trackSpan, 0, 1);
    };

    const step = (now: number) => {
      const dt =
        lastFrameRef.current > 0 ? Math.min(0.05, (now - lastFrameRef.current) / 1000) : 1 / 60;
      lastFrameRef.current = now;

      const target = targetProgressRef.current;
      const current = displayProgressRef.current;
      const diff = target - current;

      if (Math.abs(diff) < 0.0005) {
        displayProgressRef.current = target;
        applyVisualState(target);
        rafIdRef.current = null;
        lastFrameRef.current = 0;
        return;
      }

      const factor = 1 - Math.exp(-dt * 12);
      const next = current + diff * factor;
      displayProgressRef.current = next;
      applyVisualState(next);

      rafIdRef.current = window.requestAnimationFrame(step);
    };

    const syncFromScroll = (immediate = false) => {
      const nextTarget = computeScrollProgress();
      targetProgressRef.current = nextTarget;

      if (prefersReduced || immediate) {
        if (rafIdRef.current !== null) {
          window.cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        displayProgressRef.current = nextTarget;
        applyVisualState(nextTarget);
        return;
      }

      if (rafIdRef.current === null) {
        lastFrameRef.current = 0;
        rafIdRef.current = window.requestAnimationFrame(step);
      }
    };

    const onScroll = () => syncFromScroll(false);
    const onResize = () => syncFromScroll(true);

    syncFromScroll(true);

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
  }, []);

  const handleSelectStage = (node: OfficeNode) => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const rect = svgEl.getBoundingClientRect();
    const nodeDocY = window.scrollY + rect.top + rect.height * (node.cy / VIEW_HEIGHT);
    const targetScrollY = Math.max(0, nodeDocY - window.innerHeight * FOCUS_VIEWPORT_RATIO);

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    window.scrollTo({
      top: targetScrollY,
      behavior: prefersReduced ? 'auto' : 'smooth',
    });
  };

  let activeIndex = 0;
  for (let i = OFFICE_NODES.length - 1; i >= 0; i -= 1) {
    const nodeFrac = (OFFICE_NODES[i].cy - FIRST_NODE_Y) / NODE_SPAN_Y;
    if (progress >= nodeFrac - 0.025) {
      activeIndex = i;
      break;
    }
  }

  const currentNode = OFFICE_NODES[activeIndex];
  const totalLen = pathLengthRef.current;
  const activeDashOffset = Math.max(0, totalLen - activeLength);

  return (
    <div
      className="route-sheet"
      aria-label="Scroll-tracked document routing map from Records Office to Executive Sign-Off"
    >
      <div className="route-sheet-bar">
        <span className="route-sheet-code">TRAIL · TRC-2026-0418</span>
        <span className="route-sheet-status">
          Stage {currentNode.code} of 04 — {currentNode.label}
        </span>
      </div>

      <div className="route-sheet-stage">
        <svg
          ref={svgRef}
          className="route-svg"
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          role="img"
          aria-label={`Document routing path currently at ${currentNode.label}`}
        >
          {/* Architectural unvisited dashed track */}
          <path
            d={MAIN_ROAD_PATH}
            fill="none"
            stroke="#D6D1C7"
            strokeWidth="2"
            strokeDasharray="4 6"
            strokeLinecap="round"
          />

          {/* Solid ink traced custody path */}
          <path
            ref={mainPathRef}
            d={MAIN_ROAD_PATH}
            fill="none"
            stroke="#0D3472"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={totalLen}
            strokeDashoffset={activeDashOffset}
          />

          {/* Four architectural office checkpoints */}
          {OFFICE_NODES.map((node, idx) => {
            const nodeFrac = (node.cy - FIRST_NODE_Y) / NODE_SPAN_Y;
            const isLit = idx === 0 || progress >= nodeFrac - 0.025;
            const isCurrent = idx === activeIndex;
            const labelX = node.labelSide === 'right' ? node.cx + 38 : node.cx - 38;
            const labelAnchor = node.labelSide === 'right' ? 'start' : 'end';

            return (
              <g
                key={node.code}
                className="route-node"
                onClick={() => handleSelectStage(node)}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label={`Jump to ${node.label}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectStage(node);
                  }
                }}
              >
                {/* Outer drafting crosshair ring for current station */}
                {isCurrent ? (
                  <circle
                    cx={node.cx}
                    cy={node.cy}
                    r="26"
                    fill="none"
                    stroke="#0D3472"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.45"
                  />
                ) : null}

                {/* Station circle */}
                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r="18"
                  fill={isLit ? '#0D3472' : '#FFFFFF'}
                  stroke={isLit ? '#0D3472' : '#B9B2A5'}
                  strokeWidth="1.5"
                />

                <text
                  x={node.cx}
                  y={node.cy + 4}
                  textAnchor="middle"
                  className="route-node-code"
                  fill={isLit ? '#FFFFFF' : '#6B7280'}
                >
                  {node.code}
                </text>

                <text
                  x={labelX}
                  y={node.cy - 2}
                  textAnchor={labelAnchor}
                  className="route-node-title"
                  fill={isLit ? '#0F1B33' : '#78716C'}
                >
                  {node.label}
                </text>

                <text
                  x={labelX}
                  y={node.cy + 16}
                  textAnchor={labelAnchor}
                  className="route-node-sub"
                  fill={isLit ? '#4B5563' : '#9CA3AF'}
                >
                  {node.sub}
                </text>
              </g>
            );
          })}

          {/* Crisp ink document marker traveling along the track */}
          <g transform={`translate(${markerPos.x}, ${markerPos.y})`} className="route-marker">
            <circle r="7" fill="#FFFFFF" stroke="#0D3472" strokeWidth="2.5" />
            <circle r="2.5" fill="#0D3472" />
          </g>
        </svg>
      </div>
    </div>
  );
};
