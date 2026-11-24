import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';

interface OfficeNode {
  readonly id: number;
  readonly code: string;
  readonly label: string;
  readonly accentHex: string;
  readonly glowRgba: string;
  readonly cx: number;
  readonly cy: number;
  readonly pathFraction: number;
}

const MAIN_ROAD_PATH =
  'M 110 218 C 215 218, 265 96, 370 102 C 475 108, 525 224, 635 212 C 745 200, 795 96, 892 102';
const UPPER_FILAMENT_PATH =
  'M 110 208 C 218 192, 260 80, 370 92 C 482 104, 522 210, 635 198 C 748 186, 792 82, 892 93';
const LOWER_FILAMENT_PATH =
  'M 110 228 C 212 240, 270 116, 370 114 C 468 112, 528 238, 635 224 C 742 210, 798 112, 892 112';

const AMBIENT_SPARKS = [
  { cx: 168, cy: 144, r: 1.7, delay: '0s' },
  { cx: 245, cy: 66, r: 2.1, delay: '0.6s' },
  { cx: 312, cy: 174, r: 1.4, delay: '1.1s' },
  { cx: 458, cy: 78, r: 1.9, delay: '0.3s' },
  { cx: 518, cy: 254, r: 1.8, delay: '1.5s' },
  { cx: 695, cy: 136, r: 2.1, delay: '0.9s' },
  { cx: 778, cy: 230, r: 1.5, delay: '1.8s' },
  { cx: 842, cy: 56, r: 2.0, delay: '0.4s' },
  { cx: 940, cy: 166, r: 1.6, delay: '1.3s' },
] as const;

const OFFICE_NODES: ReadonlyArray<OfficeNode> = [
  {
    id: 0,
    code: '01',
    label: 'Office 1',
    accentHex: '#60A5FA',
    glowRgba: 'rgba(96, 165, 250, 0.52)',
    cx: 110,
    cy: 218,
    pathFraction: 0,
  },
  {
    id: 1,
    code: '02',
    label: 'Office 2',
    accentHex: '#F3B32A',
    glowRgba: 'rgba(243, 179, 42, 0.56)',
    cx: 370,
    cy: 102,
    pathFraction: 0.335,
  },
  {
    id: 2,
    code: '03',
    label: 'Office 3',
    accentHex: '#2DD4BF',
    glowRgba: 'rgba(45, 212, 191, 0.54)',
    cx: 635,
    cy: 212,
    pathFraction: 0.67,
  },
  {
    id: 3,
    code: '04',
    label: 'Office 4',
    accentHex: '#34D399',
    glowRgba: 'rgba(52, 211, 153, 0.56)',
    cx: 892,
    cy: 102,
    pathFraction: 1,
  },
];

export const HeroCustodyDemo: React.FC = () => {
  const [stageIndex, setStageIndex] = useState<number>(1);
  const [autoPlay, setAutoPlay] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(OFFICE_NODES[1].pathFraction);
  const [cometPos, setCometPos] = useState<{ x: number; y: number }>({
    x: OFFICE_NODES[1].cx,
    y: OFFICE_NODES[1].cy,
  });
  const [isTraveling, setIsTraveling] = useState<boolean>(false);
  const [pulseStageId, setPulseStageId] = useState<number>(1);

  const mainPathRef = useRef<SVGPathElement | null>(null);
  const pathLengthRef = useRef<number>(1000);
  const currentProgressRef = useRef<number>(OFFICE_NODES[1].pathFraction);

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
      // Fallback safely
    }
  }, []);

  useEffect(() => {
    const targetNode = OFFICE_NODES[stageIndex];
    const targetFrac = targetNode.pathFraction;
    const startFrac = currentProgressRef.current;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || Math.abs(targetFrac - startFrac) < 0.001) {
      currentProgressRef.current = targetFrac;
      setProgress(targetFrac);
      setCometPos({ x: targetNode.cx, y: targetNode.cy });
      setPulseStageId(stageIndex);
      setIsTraveling(false);
      return;
    }

    if (targetFrac < startFrac && stageIndex === 0) {
      currentProgressRef.current = 0;
      setProgress(0);
      setCometPos({ x: targetNode.cx, y: targetNode.cy });
      setPulseStageId(0);
      setIsTraveling(false);
      return;
    }

    let rafId = 0;
    const durationMs = 950;
    const startTime = performance.now();
    setIsTraveling(true);

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const rawT = Math.min(1, elapsed / durationMs);
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
          setCometPos({ x: targetNode.cx, y: targetNode.cy });
        }
      } else {
        setCometPos({ x: targetNode.cx, y: targetNode.cy });
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

  useEffect(() => {
    if (!autoPlay) return;
    const timer = window.setInterval(() => {
      setStageIndex((prev) => (prev + 1) % OFFICE_NODES.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, [autoPlay]);

  const current = OFFICE_NODES[stageIndex];
  const totalLen = pathLengthRef.current;
  const activeDashOffset = Math.max(0, totalLen * (1 - progress));

  const handleSelectStage = (idx: number) => {
    setAutoPlay(false);
    setStageIndex(idx);
  };

  return (
    <div
      className="vestige-cinema"
      aria-label="Document custody road simulation across Office 1 through Office 4"
    >
      <div className="vestige-stage">
        <div className="vestige-nebula" aria-hidden="true" />

        <button
          type="button"
          className="vestige-play-fab"
          onClick={() => setAutoPlay((v) => !v)}
          aria-label={autoPlay ? 'Pause simulation' : 'Play simulation'}
          aria-pressed={autoPlay}
        >
          {autoPlay ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <svg
          className="vestige-svg"
          viewBox="0 0 1000 320"
          role="img"
          aria-label={`Document currently at ${current.label}`}
        >
          <defs>
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
              <rect x="0" y="0" width={Math.max(0, cometPos.x + 8)} height="320" />
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

          {/* Dormant unlit custody road */}
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
            stroke="url(#vestigeRoadGrad)"
            strokeWidth="16"
            strokeLinecap="round"
            opacity="0.28"
            filter="url(#vestigeSoftGlow)"
            strokeDasharray={totalLen}
            strokeDashoffset={activeDashOffset}
          />

          {/* Braided energy strands */}
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

          {/* Core luminous road */}
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

          {/* Flowing white core stream inside ignited portion */}
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

          {/* 4 Minimal Office Vestige Orbs */}
          {OFFICE_NODES.map((node, idx) => {
            const isLit = idx <= stageIndex;
            const isCurrent = idx === stageIndex;
            const isPulsing = idx === pulseStageId && !isTraveling;
            const labelAbove = node.cy > 160;

            return (
              <g
                key={node.code}
                className={`vestige-node ${isLit ? 'is-lit' : ''} ${isCurrent ? 'is-current' : ''}`}
                onClick={() => handleSelectStage(idx)}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                aria-label={node.label}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectStage(idx);
                  }
                }}
              >
                {isPulsing ? (
                  <>
                    <circle
                      cx={node.cx}
                      cy={node.cy}
                      r="26"
                      fill="none"
                      stroke={node.accentHex}
                      strokeWidth="2.4"
                      className="vestige-shockwave"
                    />
                    <circle
                      cx={node.cx}
                      cy={node.cy}
                      r="22"
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
                    r={isCurrent ? 40 : 28}
                    fill={node.glowRgba}
                    opacity={isCurrent ? 0.36 : 0.2}
                    filter="url(#vestigeSoftGlow)"
                  />
                ) : null}

                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={isCurrent ? 27 : 21}
                  fill="none"
                  stroke={isLit ? node.accentHex : 'rgba(148, 163, 184, 0.3)'}
                  strokeWidth={isCurrent ? 2 : 1.3}
                  className={isCurrent ? 'vestige-orbit-ring' : undefined}
                />

                <circle
                  cx={node.cx}
                  cy={node.cy}
                  r={isCurrent ? 18 : 15}
                  fill={isLit ? node.accentHex : '#0F254A'}
                  stroke={isLit ? '#FFFFFF' : 'rgba(148, 163, 184, 0.38)'}
                  strokeWidth={isCurrent ? 2.4 : 1.5}
                  filter={isLit ? 'url(#vestigeGlow)' : undefined}
                />

                <text
                  x={node.cx}
                  y={node.cy + 4}
                  textAnchor="middle"
                  className="vestige-orb-code"
                  fill={isLit ? '#06142E' : '#94A3B8'}
                >
                  {node.code}
                </text>

                <text
                  x={node.cx}
                  y={labelAbove ? node.cy - 38 : node.cy + 48}
                  textAnchor="middle"
                  className="vestige-node-title"
                  fill={isLit ? '#FFFFFF' : '#94A3B8'}
                >
                  {node.label}
                </text>
              </g>
            );
          })}

          {/* Traveling light torch */}
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
      </div>
    </div>
  );
};
