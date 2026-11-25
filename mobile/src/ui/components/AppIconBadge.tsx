import React, { useCallback, useEffect, useId, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

export interface AppIconBadgeProps {
  readonly size?: number;
  readonly animated?: boolean;
  readonly interactive?: boolean;
  readonly showBackground?: boolean;
  readonly accessibilityLabel?: string;
}

interface DocumentBarSpec {
  readonly key: string;
  readonly y: number;
  readonly width: number;
}

interface RouteDotSpec {
  readonly key: string;
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly waveStart: number;
  readonly wavePeak: number;
  readonly waveEnd: number;
}

const DOC_BAR_SPECS: ReadonlyArray<DocumentBarSpec> = [
  { key: 'bar-1', y: 28, width: 18.5 },
  { key: 'bar-2', y: 34.5, width: 14.5 },
  { key: 'bar-3', y: 41, width: 11 },
];

const ROUTE_DOT_SPECS: ReadonlyArray<RouteDotSpec> = [
  { key: 'dot-1', cx: 45.2, cy: 70.0, r: 2.1, waveStart: 0.16, wavePeak: 0.28, waveEnd: 0.42 },
  { key: 'dot-2', cx: 50.8, cy: 68.5, r: 1.95, waveStart: 0.3, wavePeak: 0.42, waveEnd: 0.56 },
  { key: 'dot-3', cx: 55.8, cy: 66.2, r: 1.8, waveStart: 0.44, wavePeak: 0.56, waveEnd: 0.7 },
];

/**
 * Living vector Tracely icon.
 * Choreographs the document sheet, text lines, tracking breadcrumb route, and destination pin
 * gliding cleanly into place, followed by a calm route telemetry pulse.
 */
export function AppIconBadge({
  size = 48,
  animated = true,
  interactive = false,
  showBackground = true,
  accessibilityLabel = 'Tracely app icon',
}: AppIconBadgeProps): React.JSX.Element {
  const rawId = useId();
  const gradSuffix = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const tileGradId = `sdoTile_${gradSuffix}`;
  const paperGradId = `sdoPaper_${gradSuffix}`;
  const pinGradId = `sdoPin_${gradSuffix}`;

  const frameRadius = showBackground ? Math.round(size * 0.25) : 0;
  const scaleUnit = size / 100;

  const paperProg = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const line1Prog = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const line2Prog = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const line3Prog = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const dot0Prog = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const dot1Prog = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const dot2Prog = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const dot3Prog = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const pinProg = useRef(new Animated.Value(animated ? 0 : 1)).current;
  const impactRipple = useRef(new Animated.Value(0)).current;
  const routeWave = useRef(new Animated.Value(0)).current;
  const glossSweep = useRef(new Animated.Value(-1)).current;

  const sequenceRef = useRef<Animated.CompositeAnimation | null>(null);
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  const lineProgs = [line1Prog, line2Prog, line3Prog] as const;
  const dotProgs = [dot1Prog, dot2Prog, dot3Prog] as const;

  const stopAnimations = useCallback(() => {
    sequenceRef.current?.stop();
    loopRef.current?.stop();
  }, []);

  const playChoreography = useCallback(() => {
    stopAnimations();

    if (!animated) {
      paperProg.setValue(1);
      line1Prog.setValue(1);
      line2Prog.setValue(1);
      line3Prog.setValue(1);
      dot0Prog.setValue(1);
      dot1Prog.setValue(1);
      dot2Prog.setValue(1);
      dot3Prog.setValue(1);
      pinProg.setValue(1);
      impactRipple.setValue(0);
      routeWave.setValue(0);
      glossSweep.setValue(-1);
      return;
    }

    paperProg.setValue(0);
    line1Prog.setValue(0);
    line2Prog.setValue(0);
    line3Prog.setValue(0);
    dot0Prog.setValue(0);
    dot1Prog.setValue(0);
    dot2Prog.setValue(0);
    dot3Prog.setValue(0);
    pinProg.setValue(0);
    impactRipple.setValue(0);
    routeWave.setValue(0);
    glossSweep.setValue(-1);

    const easeOut = Easing.out(Easing.cubic);
    const popEase = Easing.out(Easing.back(1.8));

    const assembly = Animated.sequence([
      Animated.parallel([
        Animated.timing(paperProg, {
          toValue: 1,
          duration: 360,
          easing: easeOut,
          useNativeDriver: false,
        }),
        Animated.stagger(65, [
          Animated.timing(line1Prog, {
            toValue: 1,
            duration: 240,
            delay: 140,
            easing: easeOut,
            useNativeDriver: false,
          }),
          Animated.timing(line2Prog, {
            toValue: 1,
            duration: 240,
            easing: easeOut,
            useNativeDriver: false,
          }),
          Animated.timing(line3Prog, {
            toValue: 1,
            duration: 240,
            easing: easeOut,
            useNativeDriver: false,
          }),
        ]),
      ]),
      Animated.stagger(75, [
        Animated.timing(dot0Prog, {
          toValue: 1,
          duration: 220,
          easing: popEase,
          useNativeDriver: false,
        }),
        Animated.timing(dot1Prog, {
          toValue: 1,
          duration: 180,
          easing: popEase,
          useNativeDriver: false,
        }),
        Animated.timing(dot2Prog, {
          toValue: 1,
          duration: 180,
          easing: popEase,
          useNativeDriver: false,
        }),
        Animated.timing(dot3Prog, {
          toValue: 1,
          duration: 180,
          easing: popEase,
          useNativeDriver: false,
        }),
      ]),
      Animated.parallel([
        Animated.timing(pinProg, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: false,
        }),
        Animated.sequence([
          Animated.delay(250),
          Animated.timing(impactRipple, {
            toValue: 1,
            duration: 520,
            easing: easeOut,
            useNativeDriver: false,
          }),
        ]),
      ]),
    ]);

    sequenceRef.current = assembly;
    assembly.start();
  }, [
    animated,
    dot0Prog,
    dot1Prog,
    dot2Prog,
    dot3Prog,
    glossSweep,
    impactRipple,
    line1Prog,
    line2Prog,
    line3Prog,
    paperProg,
    pinProg,
    routeWave,
    stopAnimations,
  ]);

  useEffect(() => {
    playChoreography();
    return stopAnimations;
  }, [playChoreography, stopAnimations]);

  const paperTransform = {
    opacity: paperProg,
    transform: [
      {
        translateY: paperProg.interpolate({
          inputRange: [0, 1],
          outputRange: [12 * scaleUnit, 0],
        }),
      },
      {
        scale: paperProg.interpolate({
          inputRange: [0, 1],
          outputRange: [0.85, 1],
        }),
      },
    ],
  };

  const buildRouteStopStyle = (
    prog: Animated.Value,
    cx: number,
    cy: number,
    waveStart: number,
    wavePeak: number,
    waveEnd: number,
  ) => {
    const waveScale = routeWave.interpolate({
      inputRange: [0, waveStart, wavePeak, waveEnd, 1],
      outputRange: [1, 1, 1.32, 1, 1],
    });
    const entryScale = prog.interpolate({
      inputRange: [0, 1],
      outputRange: [0.25, 1],
    });
    return {
      opacity: prog,
      transform: [
        { translateX: (cx - 50) * scaleUnit },
        { translateY: (cy - 50) * scaleUnit },
        { scale: Animated.multiply(entryScale, waveScale) },
      ],
    };
  };

  const pinWaveScale = routeWave.interpolate({
    inputRange: [0, 0.58, 0.72, 0.88, 1],
    outputRange: [1, 1, 1.07, 1, 1],
  });

  const pinDropScale = pinProg.interpolate({
    inputRange: [0, 0.75, 1],
    outputRange: [0.82, 1.04, 1],
  });

  const pinStyle = {
    opacity: pinProg.interpolate({
      inputRange: [0, 0.25, 1],
      outputRange: [0, 1, 1],
    }),
    transform: [
      { translateX: 9 * scaleUnit },
      {
        translateY: pinProg.interpolate({
          inputRange: [0, 0.78, 1],
          outputRange: [-20 * scaleUnit, 2.2 * scaleUnit, 0.7 * scaleUnit],
        }),
      },
      {
        rotate: pinProg.interpolate({
          inputRange: [0, 0.75, 1],
          outputRange: ['-8deg', '2deg', '0deg'],
        }),
      },
      { scale: Animated.multiply(pinDropScale, pinWaveScale) },
    ],
  };

  const baseRingStyle = {
    opacity: pinProg.interpolate({
      inputRange: [0, 0.4, 1],
      outputRange: [0, 0.4, 1],
    }),
    transform: [
      { translateX: 9 * scaleUnit },
      { translateY: 11.5 * scaleUnit },
      {
        scale: pinProg.interpolate({
          inputRange: [0, 1],
          outputRange: [0.55, 1],
        }),
      },
    ],
  };

  const touchdownRippleStyle = {
    opacity: Animated.add(
      impactRipple.interpolate({
        inputRange: [0, 0.15, 1],
        outputRange: [0, 0.75, 0],
      }),
      routeWave.interpolate({
        inputRange: [0, 0.6, 0.76, 1],
        outputRange: [0, 0, 0.55, 0],
      }),
    ),
    transform: [
      { translateX: 9 * scaleUnit },
      { translateY: 11.5 * scaleUnit },
      {
        scale: Animated.add(
          impactRipple.interpolate({
            inputRange: [0, 1],
            outputRange: [0.8, 1.9],
          }),
          routeWave.interpolate({
            inputRange: [0, 0.6, 1],
            outputRange: [0, 0, 0.85],
          }),
        ),
      },
    ],
  };

  const sheenStyle = {
    opacity: glossSweep.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [0, 0.24, 0],
    }),
    transform: [
      {
        translateX: glossSweep.interpolate({
          inputRange: [-1, 1],
          outputRange: [-size * 1.2, size * 1.2],
        }),
      },
      { rotate: '-28deg' },
    ],
  };

  const iconBody = (
    <View
      accessible={!interactive}
      accessibilityRole={interactive ? undefined : 'image'}
      accessibilityLabel={interactive ? undefined : accessibilityLabel}
      style={[
        showBackground ? styles.frame : styles.frameBare,
        {
          width: size,
          height: size,
          borderRadius: frameRadius,
        },
      ]}
    >
      {showBackground ? (
        <>
          <Svg width={size} height={size} viewBox="0 0 100 100" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={tileGradId} x1="15%" y1="0%" x2="85%" y2="100%">
                <Stop offset="0%" stopColor="#A6D5FF" />
                <Stop offset="52%" stopColor="#65AAEE" />
                <Stop offset="100%" stopColor="#3580DC" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill={`url(#${tileGradId})`} />
          </Svg>

          <Animated.View
            pointerEvents="none"
            style={[
              styles.sheenBar,
              {
                width: Math.max(8, Math.round(size * 0.24)),
                height: size * 1.8,
                top: -size * 0.4,
                left: size * 0.35,
              },
              sheenStyle,
            ]}
          />
        </>
      ) : null}

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, paperTransform]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id={paperGradId} x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor="#FFFFFF" />
              <Stop offset="100%" stopColor="#EAF3FD" />
            </LinearGradient>
          </Defs>
          <Path
            d="M 27 30 A 9 9 0 0 1 36 21 L 60 21 L 73 34 L 73 74 A 9 9 0 0 1 64 83 L 36 83 A 9 9 0 0 1 27 74 Z"
            fill="#1D4E9E"
            fillOpacity={0.18}
          />
          <Path
            d="M 27 28 A 9 9 0 0 1 36 19 L 60 19 L 73 32 L 73 72 A 9 9 0 0 1 64 81 L 36 81 A 9 9 0 0 1 27 72 Z"
            fill={`url(#${paperGradId})`}
          />
          <Path d="M 60 19 L 60 28 A 4 4 0 0 0 64 32 L 73 32 Z" fill="#BDD8FA" />
        </Svg>
      </Animated.View>

      {DOC_BAR_SPECS.map((bar, idx) => {
        const prog = lineProgs[idx];
        return (
          <Animated.View
            key={bar.key}
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: prog,
                transform: [
                  {
                    translateX: prog.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-10 * scaleUnit, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Svg width={size} height={size} viewBox="0 0 100 100">
              <Rect x="33.5" y={bar.y} width={bar.width} height="3.4" rx="1.7" fill="#C7DDF6" />
            </Svg>
          </Animated.View>
        );
      })}

      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          buildRouteStopStyle(dot0Prog, 37.5, 72.5, 0.0, 0.14, 0.28),
        ]}
      >
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="4.6" fill="#1B8B71" />
          <Circle cx="50" cy="50" r="1.9" fill="#FFFFFF" />
        </Svg>
      </Animated.View>

      {ROUTE_DOT_SPECS.map((dot, idx) => (
        <Animated.View
          key={dot.key}
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            buildRouteStopStyle(
              dotProgs[idx],
              dot.cx,
              dot.cy,
              dot.waveStart,
              dot.wavePeak,
              dot.waveEnd,
            ),
          ]}
        >
          <Svg width={size} height={size} viewBox="0 0 100 100">
            <Circle cx="50" cy="50" r={dot.r} fill="#1B8B71" />
          </Svg>
        </Animated.View>
      ))}

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, baseRingStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Ellipse
            cx="50"
            cy="50"
            rx="6.2"
            ry="2.1"
            stroke="#F2A218"
            strokeWidth="1.6"
            fill="none"
          />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, touchdownRippleStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Ellipse
            cx="50"
            cy="50"
            rx="6.4"
            ry="2.2"
            stroke="#F6B93B"
            strokeWidth="1.4"
            fill="none"
          />
        </Svg>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, pinStyle]}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id={pinGradId} x1="50%" y1="0%" x2="50%" y2="100%">
              <Stop offset="0%" stopColor="#FFD24C" />
              <Stop offset="100%" stopColor="#F29816" />
            </LinearGradient>
          </Defs>
          <Path
            d="M 50 34.5 C 44.0 34.5 39.2 39.3 39.2 45.3 C 39.2 52.0 46.8 58.0 50 60.8 C 53.2 58.0 60.8 52.0 60.8 45.3 C 60.8 39.3 56.0 34.5 50 34.5 Z"
            fill={`url(#${pinGradId})`}
          />
          <Circle cx="50" cy="45.2" r="3.8" fill="#FFFFFF" />
        </Svg>
      </Animated.View>
    </View>
  );

  if (interactive) {
    return (
      <Pressable
        onPress={playChoreography}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Tap to replay icon assembly animation"
      >
        {iconBody}
      </Pressable>
    );
  }

  return iconBody;
}

const styles = StyleSheet.create({
  frame: {
    overflow: 'hidden',
    backgroundColor: '#65AAEE',
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  frameBare: {
    overflow: 'visible',
    backgroundColor: 'transparent',
  },
  sheenBar: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },
});
