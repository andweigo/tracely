import React, { useEffect, useRef, useState } from 'react';

interface OfficeNode {
  readonly id: number;
  readonly code: string;
  readonly label: string;
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

const VIEW_WIDTH = 500;
const VIEW_HEIGHT = 1080;
const FIRST_NODE_Y = 105;
const LAST_NODE_Y = 975;
const NODE_SPAN_Y = LAST_NODE_Y - FIRST_NODE_Y;
const FOCUS_VIEWPORT_RATIO = 0.52;

// Vertical S-curve energy road connecting Office 1 -> Office 2 -> Office 3 -> Office 4
const MAIN_ROAD_PATH =
  'M 150 105 C 150 250, 350 250, 350 395 C 350 540, 150 540, 150 685 C 150 830, 350 830, 350 975';
const LEFT_FILAMENT_PATH =
  'M 150 105 C 122 242, 330 264, 350 395 C 374 534, 174 550, 150 685 C 126 822, 330 844, 350 975';
const RIGHT_FILAMENT_PATH =
  'M 150 105 C 176 258, 376 238, 350 395 C 324 548, 126 532, 150 685 C 174 836, 374 818, 350 975';

const AMBIENT_SPARKS = [
  { cx: 76, cy: 170, r: 1.7, delay: '0s' },
  { cx: 412, cy: 148, r: 2.0, delay: '0.6s' },
  { cx: 318, cy: 266, r: 1.5, delay: '1.1s' },
  { cx: 92, cy: 382, r: 1.9, delay: '0.3s' },
  { cx: 428, cy: 504, r: 1.8, delay: '1.5s' },
  { cx: 196, cy: 562, r: 1.4, delay: '0.9s' },
  { cx: 404, cy: 718, r: 2.0, delay: '1.8s' },
  { cx: 88, cy: 826, r: 1.7, delay: '0.4s' },
  { cx: 210, cy: 964, r: 1.6, delay: '1.3s' },
  { cx: 432, cy: 912, r: 1.9, delay: '0.7s' },
] as const;

const OFFICE_NODES: ReadonlyArray<OfficeNode> = [
  {
    id: 0,
    code: '01',
    label: 'Office 1',
    accentHex: '#60A5FA',
    glowRgba: 'rgba(96, 165, 250, 0.54)',
    cx: 150,
    cy: 105,
    labelSide: 'right',
  },
  {
    id: 1,
    code: '02',
    label: 'Office 2',
    accentHex: '#F3B32A',
    glowRgba: 'rgba(243, 179, 42, 0.58)',
    cx: 350,
    cy: 395,
    labelSide: 'left',
  },
  {
    id: 2,
    code: '03',
    label: 'Office 3',
    accentHex: '#2DD4BF',
    glowRgba: 'rgba(45, 212, 191, 0.56)',
    cx: 150,
    cy: 685,
    labelSide: 'right',
  },
  {
    id: 3,
    code: '04',
    label: 'Office 4',
    accentHex: '#34D399',
    glowRgba: 'rgba(52, 211, 153, 0.58)',
    cx: 350,
    cy: 975,
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
  const pathLengthRef = useRef<number>(1180);
  const pathSamplesRef = useRef<PathSample[]>([]);

  const targetProgressRef = useRef<number>(0);
  const displayProgressRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);

  const [progress, setProgress] = useState<number>(0);
  const [activeLength, setActiveLength] = useState<number>(0);
  const [cometPos, setCometPos] = useState<{ x: number; y: number }>({
    x: OFFICE_NODES[0].cx,
    y: OFFICE_NODES[0].cy,
  });
  const [scrollEnergy, setScrollEnergy] = useState<number>(0);

  useEffect(() => {
    const pathEl = mainPathRef.current;
    if (!pathEl) return;

    try {
      const totalLen = pathEl.getTotalLength();
      if (totalLen > 0) {
        pathLengthRef.current = totalLen;
        const steps = 280;
        const samples: PathSample[] = [];
        for (let i = 0; i <= steps; i += 1) {
          const len = (totalLen * i) / steps;
          const pt = pathEl.getPointAtLength(len);
          samples.push({ len, x: pt.x, y: pt.y });
        }
        pathSamplesRef.current = samples;
      }
    } catch {
      // Fallback safely if SVG geometry API is unavailable
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const applyVisualState = (p: number, energy: number) => {
      const targetY = FIRST_NODE_Y + p * NODE_SPAN_Y;
      const sample = sampleByTargetY(pathSamplesRef.current, targetY);
      setProgress(p);
      setActiveLength(sample.len);
      setCometPos({ x: sample.x, y: sample.y });
      setScrollEnergy(energy);
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
      const dt = lastFrameRef.current > 0 ? Math.min(0.05, (now - lastFrameRef.current) / 1000) : 1 / 60;
      lastFrameRef.current = now;

      const target = targetProgressRef.current;
      const current = displayProgressRef.current;
      const diff = target - current;

      if (Math.abs(diff) < 0.00045) {
        displayProgressRef.current = target;
        applyVisualState(target, 0);
        rafIdRef.current = null;
        lastFrameRef.current = 0;
        return;
      }

      // Frame-rate independent smooth follow so mouse-wheel ticks glide fluidly
      const factor = 1 - Math.exp(-dt * 12.5);
      const next = current + diff * factor;
      displayProgressRef.current = next;

      const energy = clamp(Math.abs(diff) * 7.5, 0, 1);
      applyVisualState(next, energy);

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
        applyVisualState(nextTarget, 0);
        return;
      }

      if (rafIdRef.current === null) {
        lastFrameRef.current = 0;
        rafIdRef.current = window.requestAnimationFrame(step);
      }
    };

    const onScroll = () => syncFromScroll(false);
    const onResize = () => syncFromScroll(true);

    // Sync initial position immediately on mount
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
  const cometHaloRadius = 23 + scrollEnergy * 11;
  const cometCoreRadius = 7.5 + scrollEnergy * 3.2;

  return (
    <div
      className="vestige-cinema vestige-cinema-vertical"
      aria-label="Vertical scroll-interactive document custody road across Office 1 through Office 4"
    >
      <div className="vestige-stage vestige-stage-vertical">
        <div className="vestige-nebula vestige-nebula-vertical" aria-hidden="true" />

        <svg
          ref={svgRef}
          className="vestige-svg vestige-svg-vertical"
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          role="img"
          aria-label={`Scroll-tracked custody road currently at ${currentNode.label}`}
        >
          <defs>
            <linearGradient id="vestigeRoadGradV" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="35%" stopColor="#F3B32A" />
              <stop offset="70%" stopColor="#2DD4BF" />
              <stop offset="100%" stopColor="#34D399" />
            </linearGradient>

            <linearGradient id="vestigeFilamentGradV" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(96, 165, 250, 0.88)" />
              <stop offset="40%" stopColor="rgba(243, 179, 42, 0.96)" />
              <stop offset="75%" stopColor="rgba(45, 212, 191, 0.92)" />
              <stop offset="100%" stopColor="rgba(52, 211, 153, 0.96)" />
            </linearGradient>

            <radialGradient id="cometGlowGradV" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <stop offset="36%" stopColor="#FDE68A" stopOpacity="0.95" />
              <stop offset="72%" stopColor="#F3B32A" stopOpacity="0.46" />
              <stop offset="100%" stopColor="#F3B32A" stopOpacity="0" />
            </radialGradient>

            <filter id="vestigeGlowV" x="-40%" y="-20%" width="180%" height="140%">
              <feGaussianBlur stdDeviation="5.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="vestigeSoftGlowV" x="-50%" y="-25%" width="200%" height="150%">
              <feGaussianBlur stdDeviation="12" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <clipPath id="vestigeProgressClipV">
              <rect
                x="0"
                y="0"
                width={VIEW_WIDTH}
                height={Math.max(0, cometPos.y + 4)}
              />
            </clipPath>
          </defs>

          {/* Subtle ambient motes */}
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

          {/* Dormant unlit vertical road */}
          <path
            d={MAIN_ROAD_PATH}
            fill="none"
            stroke="rgba(148, 163, 184, 0.16)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d={MAIN_ROAD_PATH}
            fill="none"
            stroke="rgba(148, 163, 184, 0.3)"
            strokeWidth="1.8"
            strokeDasharray="6 8"
            strokeLinecap="round"
          />

          {/* Broad soft aura beneath ignited energy road */}
          <path
            d={MAIN_ROAD_PATH}
            fill="none"
            stroke="url(#vestigeRoadGradV)"
            strokeWidth="18"
            strokeLinecap="round"
            opacity="0.3"
            filter="url(#vestigeSoftGlowV)"
            strokeDasharray={totalLen}
            strokeDashoffset={activeDashOffset}
          />

          {/* Braided energy filaments clipped cleanly to the traveling torch */}
          <g clipPath="url(#vestigeProgressClipV)" style={{ opacity: progress > 0.008 ? 1 : 0 }}>
            <path
              d={LEFT_FILAMENT_PATH}
              fill="none"
              stroke="url(#vestigeFilamentGradV)"
              strokeWidth="2.1"
              strokeLinecap="round"
              opacity="0.74"
              filter="url(#vestigeGlowV)"
            />
            <path
              d={RIGHT_FILAMENT_PATH}
              fill="none"
              stroke="url(#vestigeFilamentGradV)"
              strokeWidth="1.9"
              strokeLinecap="round"
              opacity="0.64"
              filter="url(#vestigeGlowV)"
            />
          </g>

          {/* Core luminous vertical road */}
          <path
            ref={mainPathRef}
            d={MAIN_ROAD_PATH}
            fill="none"
            stroke="url(#vestigeRoadGradV)"
            strokeWidth="5.2"
            strokeLinecap="round"
            filter="url(#vestigeGlowV)"
            strokeDasharray={totalLen}
            strokeDashoffset={activeDashOffset}
          />

          {/* Flowing white core stream inside ignited portion */}
          <path
            d={MAIN_ROAD_PATH}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeDasharray="16 26"
            clipPath="url(#vestigeProgressClipV)"
            className="vestige-energy-stream"
            style={{
              opacity: progress > 0.015 ? 0.82 : 0,
            }}
          />

          {/* 4 Minimal Vertical Office Vestige Orbs */}
          {OFFICE_NODES.map((node, idx) => {
            const nodeFrac = (node.cy - FIRST_NODE_Y) / NODE_SPAN_Y;
            const isLit = idx === 0 || progress >= nodeFrac - 0.025;
            const isCurrent = idx === activeIndex;
            const labelX = node.labelSide === 'right' ? node.cx + 46 : node.cx - 46;
            const labelAnchor = node.labelSide === 'right' ? 'start' : 'end';

            return (
              <g
                key={node.code}
                className={`vestige-node ${isLit ? 'is-lit' : ''} ${isCurrent ? 'is-current' : ''}`}
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
                {isCurrent ? (
                  <>
                    <circle
                      cx={node.cx}
                      cy={node.cy}
                      r="28"
                      fill="none"
                      stroke={node.accentHex}
                      strokeWidth="2.4"
                      className="vestige-shockwave"
                    />
                    <circle
                      cx={node.cx}
                      cy={node.cy}
                      r="23"
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="1.4"
                      className="vestige-shockwave delayed"
                    />
                  </>
                ) : null}

                {isLit ? (
                  <circle
                    cx={node.cx}
                    cy={node.cy}
                    r={isCurrent ? 44 : 30}
                    fill={node.glowRgba}
                    opacity={isCurrent ? 0.38 : 0.22}
                    filter="url(#vestigeSoftGlowV)"
                  />
                ) : null}

                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={isCurrent ? 29 : 22}
                  fill="none"
                  stroke={isLit ? node.accentHex : 'rgba(148, 163, 184, 0.32)'}
                  strokeWidth={isCurrent ? 2.1 : 1.4}
                  className={isCurrent ? 'vestige-orbit-ring' : undefined}
                />

                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={isCurrent ? 20 : 16}
                  fill={isLit ? node.accentHex : '#0F254A'}
                  stroke={isLit ? '#FFFFFF' : 'rgba(148, 163, 184, 0.4)'}
                  strokeWidth={isCurrent ? 2.5 : 1.6}
                  filter={isLit ? 'url(#vestigeGlowV)' : undefined}
                />

                <text
                  x={node.cx}
                  y={node.cy + 4.5}
                  textAnchor="middle"
                  className="vestige-orb-code"
                  fill={isLit ? '#06142E' : '#94A3B8'}
                >
                  {node.code}
                </text>

                <text
                  x={labelX}
                  y={node.cy + 6}
                  textAnchor={labelAnchor}
                  className="vestige-node-title vestige-node-title-vertical"
                  fill={isLit ? '#FFFFFF' : '#94A3B8'}
                >
                  {node.label}
                </text>
              </g>
            );
          })}

          {/* Scroll-following blazing light torch */}
          <g transform={`translate(${cometPos.x}, ${cometPos.y})`} className="vestige-comet">
            <circle r={cometHaloRadius} fill="url(#cometGlowGradV)" />
            <circle
              r={cometCoreRadius}
              fill="#FFFFFF"
              stroke="#F3B32A"
              strokeWidth="2.6"
              filter="url(#vestigeGlowV)"
            />
          </g>
        </svg>
      </div>
    </div>
  );
};
