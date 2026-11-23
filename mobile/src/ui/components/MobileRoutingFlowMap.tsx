import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  LayoutChangeEvent,
  StyleSheet,
  View,
} from 'react-native';
import Svg, { Circle, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { SDO_COLORS } from '../theme/tokens';

export interface MobileFlowCorridorInput {
  readonly officeId: string;
  readonly officeCode: string;
  readonly officeName: string;
  readonly sentCount: number;
  readonly softRatio: number;
}

interface MobileRoutingFlowMapProps {
  readonly corridors: ReadonlyArray<MobileFlowCorridorInput>;
  readonly activeOfficeId: string | null;
  readonly originCode: string;
  readonly originSubLabel: string;
  readonly totalSentLabel: string;
  readonly formatCount: (count: number) => string;
  readonly onSelectOffice: (officeId: string) => void;
}

const VIEW_W = 360;
const VIEW_H = 224;
const START_X = 74;
const START_Y = 112;
const END_X = 214;
const ROW_Y = [24, 68, 112, 156, 200];
const SAMPLE_COUNT = 21;
const SAMPLE_T = Array.from({ length: SAMPLE_COUNT }, (_, i) => i / (SAMPLE_COUNT - 1));

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

function cubicTangentDeg(
  t: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): number {
  const u = 1 - t;
  const dx = 3 * u * u * (x1 - x0) + 6 * u * t * (x2 - x1) + 3 * t * t * (x3 - x2);
  const dy = 3 * u * u * (y1 - y0) + 6 * u * t * (y2 - y1) + 3 * t * t * (y3 - y2);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

interface CapsuleSpec {
  readonly key: string;
  readonly isSoft: boolean;
  readonly isSelected: boolean;
  readonly outX: number[];
  readonly outY: number[];
  readonly outDeg: string[];
  readonly outOpacity: number[];
}

/**
 * 60/120fps native-driver animated Sankey flow map:
 * - Static vector curves + clean minimalist office rows render once (no JS re-renders on tick)
 * - Moving Soft Copy (cyan) and Hard Copy (amber) capsules run strictly on the native UI thread
 *   via `useNativeDriver: true` pre-sampled Bezier keyframe interpolations.
 */
export const MobileRoutingFlowMap: React.FC<MobileRoutingFlowMapProps> = memo(
  ({
    corridors,
    activeOfficeId,
    originCode,
    originSubLabel,
    totalSentLabel,
    formatCount,
    onSelectOffice,
  }) => {
    const [boxWidth, setBoxWidth] = useState<number>(336);
    const phaseAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (typeof jest !== 'undefined' || corridors.length === 0) return;
      phaseAnim.setValue(0);
      const loop = Animated.loop(
        Animated.timing(phaseAnim, {
          toValue: 1,
          duration: 2800,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      loop.start();
      return () => loop.stop();
    }, [phaseAnim, corridors.length]);

    const handleLayout = (ev: LayoutChangeEvent) => {
      const nextW = Math.round(ev.nativeEvent.layout.width);
      if (nextW > 40 && Math.abs(nextW - boxWidth) > 2) {
        setBoxWidth(nextW);
      }
    };

    const maxSent = useMemo(
      () => Math.max(1, ...corridors.map((c) => c.sentCount)),
      [corridors],
    );

    const scaleX = boxWidth / VIEW_W;
    const scaleY = VIEW_H / VIEW_H;

    const capsules = useMemo<ReadonlyArray<CapsuleSpec>>(() => {
      const list: CapsuleSpec[] = [];
      const c1x = START_X + 60;
      const c2x = END_X - 60;

      corridors.forEach((corridor, idx) => {
        const y = ROW_Y[idx] ?? 24 + idx * 44;
        const ratio = corridor.sentCount / maxSent;
        const isSelected = activeOfficeId === corridor.officeId;
        const count = Math.max(1, Math.min(3, Math.round(ratio * 3)));

        for (let cIdx = 0; cIdx < count; cIdx++) {
          const offset = (cIdx / count + idx * 0.17) % 1;
          const isSoft = cIdx / count < corridor.softRatio;
          const outX: number[] = [];
          const outY: number[] = [];
          const outDeg: string[] = [];
          const outOpacity: number[] = [];

          for (let s = 0; s < SAMPLE_COUNT; s++) {
            const rawT = (SAMPLE_T[s] + offset) % 1;
            const pt = cubicPoint(rawT, START_X, START_Y, c1x, START_Y, c2x, y, END_X, y);
            const deg = cubicTangentDeg(rawT, START_X, START_Y, c1x, START_Y, c2x, y, END_X, y);
            outX.push(Number((pt.x * scaleX - 5).toFixed(2)));
            outY.push(Number((pt.y * scaleY - 2.25).toFixed(2)));
            outDeg.push(`${deg.toFixed(1)}deg`);

            const edgeFade =
              rawT < 0.08 ? rawT / 0.08 : rawT > 0.9 ? (1 - rawT) / 0.1 : 1;
            const maxAlpha = isSelected ? 1 : 0.78;
            outOpacity.push(Number(Math.max(0, Math.min(1, edgeFade * maxAlpha)).toFixed(2)));
          }

          list.push({
            key: `${corridor.officeId}-${cIdx}`,
            isSoft,
            isSelected,
            outX,
            outY,
            outDeg,
            outOpacity,
          });
        }
      });

      return list;
    }, [corridors, activeOfficeId, maxSent, scaleX, scaleY]);

    return (
      <View onLayout={handleLayout} style={styles.stageWrap}>
        <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
          {corridors.map((corridor, idx) => {
            const isSelected = activeOfficeId === corridor.officeId;
            const y = ROW_Y[idx] ?? 24 + idx * 44;
            const ratio = corridor.sentCount / maxSent;
            const trackWidth = Math.round(3 + ratio * 8.5);
            const c1x = START_X + 60;
            const c2x = END_X - 60;
            const d = `M ${START_X} ${START_Y} C ${c1x} ${START_Y}, ${c2x} ${y}, ${END_X} ${y}`;

            return (
              <G
                key={corridor.officeId}
                testID={`mobile-flow-corridor-${corridor.officeCode}`}
                onPress={() => onSelectOffice(corridor.officeId)}
              >
                {/* Wide tap target over the right-side office row */}
                <Rect x={END_X} y={y - 20} width={VIEW_W - END_X} height={40} fill="transparent" />

                {/* Weighted Sankey Corridor Ribbon */}
                <Path
                  d={d}
                  fill="none"
                  stroke={isSelected ? '#0EA5E9' : SDO_COLORS.navyInk}
                  strokeOpacity={isSelected ? 0.22 : 0.09}
                  strokeWidth={trackWidth}
                  strokeLinecap="round"
                />

                {/* Clean Dashed Center Guide Line */}
                <Path
                  d={d}
                  fill="none"
                  stroke={isSelected ? '#0EA5E9' : SDO_COLORS.navyInk}
                  strokeOpacity={isSelected ? 0.8 : 0.24}
                  strokeWidth={1.1}
                  strokeDasharray="4 6"
                />

                {/* Uncrowded Minimalist Destination Office Row (Code + Count + Bar Only) */}
                <G transform={`translate(${END_X + 10}, ${y - 11})`}>
                  <Circle
                    cx={0}
                    cy={11}
                    r={isSelected ? 3.4 : 2.2}
                    fill={isSelected ? '#0EA5E9' : SDO_COLORS.navyInk}
                    opacity={isSelected ? 1 : 0.4}
                  />
                  <SvgText
                    x={11}
                    y={10}
                    fill={isSelected ? '#0EA5E9' : SDO_COLORS.navyInk}
                    fontSize={11}
                    fontWeight="800"
                  >
                    {corridor.officeCode.slice(0, 10)}
                  </SvgText>

                  <SvgText
                    x={132}
                    y={10}
                    textAnchor="end"
                    fill={SDO_COLORS.navyInk}
                    fontSize={11.5}
                    fontWeight="800"
                  >
                    {formatCount(corridor.sentCount)}
                  </SvgText>

                  <Line
                    x1={11}
                    y1={19}
                    x2={132}
                    y2={19}
                    stroke={SDO_COLORS.navyInk}
                    strokeOpacity={0.11}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                  <Line
                    x1={11}
                    y1={19}
                    x2={11 + Math.round(ratio * 121)}
                    y2={19}
                    stroke={isSelected ? '#0EA5E9' : SDO_COLORS.navyInk}
                    strokeOpacity={isSelected ? 0.92 : 0.42}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                </G>
              </G>
            );
          })}

          {/* Clean Background-Free Origin Node */}
          <G transform={`translate(2, ${START_Y - 20})`}>
            <Circle cx={6} cy={10} r={3.4} fill="#0EA5E9" />
            <SvgText x={15} y={13} fill={SDO_COLORS.navyInk} fontSize={10.5} fontWeight="800">
              {originCode.slice(0, 8)}
            </SvgText>
            <SvgText x={2} y={26} fill={SDO_COLORS.navyInk} opacity={0.55} fontSize={9}>
              {originSubLabel}
            </SvgText>
            <SvgText x={2} y={39} fill={SDO_COLORS.navyInk} fontSize={10} fontWeight="800">
              {totalSentLabel}
            </SvgText>
          </G>
        </Svg>

        {/* Native-Driver 60fps Animated Capsule Overlay (Zero React Re-Renders) */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {capsules.map((cap) => {
            const tx = phaseAnim.interpolate({
              inputRange: SAMPLE_T,
              outputRange: cap.outX,
            });
            const ty = phaseAnim.interpolate({
              inputRange: SAMPLE_T,
              outputRange: cap.outY,
            });
            const rot = phaseAnim.interpolate({
              inputRange: SAMPLE_T,
              outputRange: cap.outDeg,
            });
            const alpha = phaseAnim.interpolate({
              inputRange: SAMPLE_T,
              outputRange: cap.outOpacity,
            });

            return (
              <Animated.View
                key={cap.key}
                style={[
                  styles.capsulePill,
                  cap.isSoft ? styles.capsuleSoft : styles.capsuleHard,
                  {
                    opacity: alpha,
                    transform: [
                      { translateX: tx },
                      { translateY: ty },
                      { rotate: rot },
                    ],
                  },
                ]}
              />
            );
          })}
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  stageWrap: {
    width: '100%',
    height: VIEW_H,
    position: 'relative',
  },
  capsulePill: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 10,
    height: 4.5,
    borderRadius: 3,
  },
  capsuleSoft: {
    backgroundColor: '#0EA5E9',
  },
  capsuleHard: {
    backgroundColor: '#F59E0B',
  },
});

export default MobileRoutingFlowMap;
