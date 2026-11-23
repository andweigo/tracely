import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Eye, EyeOff, Plus, Repeat } from 'lucide-react-native';

export interface MobileIdentityWalletCardProps {
  readonly fullName: string;
  readonly employeeId: string;
  readonly position: string;
  readonly officeCode: string;
  readonly officeName?: string;
  readonly roleLabel?: string;
  readonly email?: string;
  readonly accentColor?: string;
  readonly activeDocsCount?: number;
  readonly completedDocsCount?: number;
  readonly actionLabel?: string;
  readonly onActionPress?: () => void;
  readonly liveSyncBadge?: string;
  readonly defaultMasked?: boolean;
  readonly interactive?: boolean;
  readonly testID?: string;
}

interface WalletPalette {
  readonly strapColor: string;
  readonly backStack: string;
  readonly innerCard: string;
  readonly earTop: string;
  readonly earBottom: string;
  readonly pocketLight: string;
  readonly pocketBase: string;
  readonly pocketDeep: string;
  readonly pocketEdge: string;
  readonly stitchStroke: string;
  readonly backFace: string;
  readonly badge: string;
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return [87, 54, 228];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return [87, 54, 228];
  }
  return [r, g, b];
}

function mixHex(
  rgb: [number, number, number],
  target: [number, number, number],
  amount: number,
): string {
  const r = Math.max(0, Math.min(255, Math.round(rgb[0] + (target[0] - rgb[0]) * amount)));
  const g = Math.max(0, Math.min(255, Math.round(rgb[1] + (target[1] - rgb[1]) * amount)));
  const b = Math.max(0, Math.min(255, Math.round(rgb[2] + (target[2] - rgb[2]) * amount)));
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function deriveMobileWalletPalette(accentColor?: string): WalletPalette {
  const normalized = (accentColor ?? '').trim().toUpperCase();
  if (!normalized || normalized === '#5736E4') {
    return {
      strapColor: '#4C2FD3',
      backStack: '#7758E4',
      innerCard: '#AC9CF4',
      earTop: '#9478FC',
      earBottom: '#6B4CEB',
      pocketLight: '#7C5DFA',
      pocketBase: '#5736E4',
      pocketDeep: '#4324C7',
      pocketEdge: '#6345EE',
      stitchStroke: '#D8CCFF',
      backFace: '#3F21BD',
      badge: '#6347E8',
    };
  }
  const rgb = parseHexRgb(normalized);
  const white: [number, number, number] = [255, 255, 255];
  const black: [number, number, number] = [10, 14, 28];
  return {
    strapColor: mixHex(rgb, black, 0.16),
    backStack: mixHex(rgb, white, 0.24),
    innerCard: mixHex(rgb, white, 0.5),
    earTop: mixHex(rgb, white, 0.34),
    earBottom: mixHex(rgb, white, 0.12),
    pocketLight: mixHex(rgb, white, 0.2),
    pocketBase: mixHex(rgb, white, 0),
    pocketDeep: mixHex(rgb, black, 0.24),
    pocketEdge: mixHex(rgb, white, 0.1),
    stitchStroke: mixHex(rgb, white, 0.78),
    backFace: mixHex(rgb, black, 0.26),
    badge: mixHex(rgb, white, 0.04),
  };
}

function formatMaskedIdentifier(rawId: string, masked: boolean): string {
  const cleaned = rawId.trim() || 'EMP-2026-5678';
  if (!masked) {
    return cleaned;
  }
  const suffix = cleaned.slice(-4).padStart(4, '0');
  return `••••  ••••  ••••  ${suffix}`;
}

export const MobileIdentityWalletCard: React.FC<MobileIdentityWalletCardProps> = ({
  fullName,
  employeeId,
  position,
  officeCode,
  officeName,
  roleLabel,
  email,
  accentColor,
  activeDocsCount,
  completedDocsCount,
  actionLabel = 'Send Document',
  onActionPress,
  liveSyncBadge,
  defaultMasked = false,
  interactive = true,
  testID = 'mobile-identity-wallet-card',
}) => {
  const [masked, setMasked] = useState(defaultMasked);
  const [flipped, setFlipped] = useState(false);
  const rawUid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const pocketGradId = `mobilePocketGrad_${rawUid}`;
  const earGradId = `mobileEarGrad_${rawUid}`;
  const palette = useMemo(() => deriveMobileWalletPalette(accentColor), [accentColor]);

  const dragXY = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const flipAnim = useRef(new Animated.Value(0)).current;
  const breezeAnim = useRef(new Animated.Value(0)).current;
  const breezeLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const flippedRef = useRef(false);

  const startBreezeLoop = useMemo(
    () => () => {
      if (!interactive || typeof jest !== 'undefined') return;
      breezeLoopRef.current?.stop();
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(breezeAnim, {
            toValue: 1,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(breezeAnim, {
            toValue: -1,
            duration: 2400,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      );
      breezeLoopRef.current = loop;
      loop.start();
    },
    [breezeAnim, interactive],
  );

  useEffect(() => {
    startBreezeLoop();
    return () => {
      breezeLoopRef.current?.stop();
    };
  }, [startBreezeLoop]);

  const triggerFlip = () => {
    const next = !flippedRef.current;
    flippedRef.current = next;
    setFlipped(next);
    if (typeof jest !== 'undefined') {
      flipAnim.setValue(next ? 1 : 0);
      return;
    }
    Animated.spring(flipAnim, {
      toValue: next ? 1 : 0,
      stiffness: 180,
      damping: 16,
      mass: 0.85,
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          interactive && (Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5),
        onPanResponderGrant: () => {
          breezeLoopRef.current?.stop();
        },
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderMove: (_evt, gesture) => {
          const clampedX = Math.max(-76, Math.min(76, gesture.dx * 0.7));
          const clampedY = Math.max(-24, Math.min(70, gesture.dy * 0.6));
          dragXY.setValue({ x: clampedX, y: clampedY });
        },
        onPanResponderRelease: (_evt, gesture) => {
          Animated.spring(dragXY, {
            toValue: { x: 0, y: 0 },
            velocity: { x: gesture.vx * 0.35, y: gesture.vy * 0.35 },
            stiffness: 145,
            damping: 10.5,
            mass: 0.9,
            useNativeDriver: true,
          }).start(() => {
            startBreezeLoop();
          });
        },
        onPanResponderTerminate: () => {
          Animated.spring(dragXY, {
            toValue: { x: 0, y: 0 },
            stiffness: 150,
            damping: 12,
            mass: 0.9,
            useNativeDriver: true,
          }).start(() => {
            startBreezeLoop();
          });
        },
      }),
    [dragXY, interactive, startBreezeLoop],
  );

  const combinedSway = useMemo(
    () => Animated.add(dragXY.x, Animated.multiply(breezeAnim, 5)),
    [dragXY.x, breezeAnim],
  );
  const swingRotateZ = combinedSway.interpolate({
    inputRange: [-81, 0, 81],
    outputRange: ['15deg', '0deg', '-15deg'],
  });
  const dragTiltX = dragXY.y.interpolate({
    inputRange: [-24, 0, 70],
    outputRange: ['7deg', '0deg', '-11deg'],
    extrapolate: 'clamp',
  });
  const strapTranslateX = useMemo(() => Animated.multiply(dragXY.x, 0.35), [dragXY.x]);
  const strapStretchY = dragXY.y.interpolate({
    inputRange: [-24, 0, 70],
    outputRange: [0.84, 1, 1.85],
    extrapolate: 'clamp',
  });
  const strapSwingZ = combinedSway.interpolate({
    inputRange: [-81, 0, 81],
    outputRange: ['19deg', '0deg', '-19deg'],
  });

  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.49, 0.5, 1],
    outputRange: [0, 0, 1, 1],
  });

  const displayName = fullName.trim() || 'Your Full Name';
  const displayOfficeCode = officeCode.trim().toUpperCase() || 'OFFICE';
  const displayPosition = position.trim() || 'Position / Title';
  const displayRole = roleLabel?.trim() || 'Authorized Personnel';
  const displayId = formatMaskedIdentifier(employeeId, masked);
  const displayOfficeName = officeName?.trim() || displayOfficeCode;

  const pocketCaption =
    email && email.trim()
      ? `${displayRole} · ${
          masked ? '•••@' + (email.split('@')[1] || 'tracely.local') : email.trim()
        }`
      : displayOfficeName;

  return (
    <View testID={testID} style={styles.root}>
      {liveSyncBadge ? (
        <View style={styles.liveBadgeRow}>
          <View style={[styles.liveDot, { backgroundColor: palette.badge }]} />
          <Text style={[styles.liveBadgeText, { color: palette.badge }]}>
            {liveSyncBadge}
          </Text>
        </View>
      ) : null}

      {/* Interactive Woven Lanyard Strap + Metal Clamp & Ring */}
      <Animated.View
        style={[
          styles.lanyardHardwareWrap,
          {
            transform: [
              { translateX: strapTranslateX },
              { rotateZ: strapSwingZ },
            ],
          },
        ]}
      >
        <Animated.View
          testID={`${testID}-strap`}
          style={[
            styles.lanyardStrap,
            { backgroundColor: palette.strapColor, transform: [{ scaleY: strapStretchY }] },
          ]}
        >
          <View style={styles.lanyardStrapStitchLeft} />
          <View style={styles.lanyardStrapStitchRight} />
        </Animated.View>
        <View style={styles.lanyardClamp} />
        <View style={styles.lanyardRing} />
      </Animated.View>

      {/* Draggable & Flippable Hanging Wallet Card */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.cardStage,
          {
            transform: [
              { perspective: 1000 },
              { translateX: dragXY.x },
              { translateY: dragXY.y },
              { rotateX: dragTiltX },
              { rotateZ: swingRotateZ },
            ],
          },
        ]}
      >
        {/* FRONT FACE: Layered Stitched Wallet Pocket Card */}
        <Animated.View
          pointerEvents={flipped ? 'none' : 'auto'}
          style={[
            styles.faceLayer,
            {
              opacity: frontOpacity,
              transform: [{ perspective: 1000 }, { rotateY: frontRotateY }],
            },
          ]}
        >
          {/* 1. Top Back Card Peeking Behind */}
          <View style={[styles.backStackCard, { backgroundColor: palette.backStack }]} />

          {/* 2. Middle Inner Metallic Card (Tap to Flip) */}
          <Pressable
            testID={`${testID}-inner-card`}
            onPress={interactive ? triggerFlip : undefined}
            style={[styles.innerCard, { backgroundColor: palette.innerCard }]}
          >
            <View style={styles.innerCardTopRim} />
            <View style={styles.innerCardRow}>
              <View style={styles.innerLeftCopy}>
                <Text
                  testID={`${testID}-name`}
                  numberOfLines={1}
                  style={styles.innerNameText}
                >
                  {displayName}
                </Text>
                <Text
                  testID={`${testID}-employee-id`}
                  numberOfLines={1}
                  style={styles.innerIdText}
                >
                  {displayId}
                </Text>
              </View>

              <View style={styles.innerRightCopy}>
                <Text style={styles.brandMarkText}>TRACELY</Text>
                <Text
                  testID={`${testID}-office`}
                  numberOfLines={1}
                  style={styles.innerOfficeText}
                >
                  Unit: {displayOfficeCode}
                </Text>
              </View>
            </View>
          </Pressable>

          {/* 3. Front Stitched Wallet Pocket Sleeve */}
          <View style={styles.pocketLayer}>
            <View style={styles.pocketSvgBackdrop}>
              <Svg width="100%" height="100%" viewBox="0 0 340 176" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id={pocketGradId} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={palette.pocketLight} stopOpacity="1" />
                    <Stop offset="0.5" stopColor={palette.pocketBase} stopOpacity="1" />
                    <Stop offset="0.86" stopColor={palette.pocketDeep} stopOpacity="1" />
                    <Stop offset="1" stopColor={palette.pocketEdge} stopOpacity="1" />
                  </LinearGradient>
                  <LinearGradient id={earGradId} x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={palette.earTop} stopOpacity="1" />
                    <Stop offset="1" stopColor={palette.earBottom} stopOpacity="1" />
                  </LinearGradient>
                </Defs>

                <Path
                  d="M 0 16 Q 0 0 16 0 L 24 0 L 24 40 L 0 40 Z"
                  fill={`url(#${earGradId})`}
                />
                <Path
                  d="M 316 0 L 324 0 Q 340 0 340 16 L 340 40 L 316 40 Z"
                  fill={`url(#${earGradId})`}
                />
                <Path
                  d="M 0 26 C 84 44, 256 44, 340 26 L 340 146 Q 340 176 310 176 L 30 176 Q 0 176 0 146 Z"
                  fill={`url(#${pocketGradId})`}
                />
                <Path
                  d="M 10 30 C 90 47, 250 47, 330 30"
                  fill="none"
                  stroke={palette.stitchStroke}
                  strokeOpacity={0.62}
                  strokeWidth={1.4}
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                />
                <Path
                  d="M 8 14 L 8 144 Q 8 168 32 168 L 308 168 Q 332 168 332 144 L 332 14"
                  fill="none"
                  stroke={palette.stitchStroke}
                  strokeOpacity={0.55}
                  strokeWidth={1.4}
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                />
              </Svg>
            </View>

            <View style={styles.pocketContent}>
              <Pressable onPress={interactive ? triggerFlip : undefined}>
                <Text
                  testID={`${testID}-caption`}
                  numberOfLines={1}
                  style={styles.pocketCaptionText}
                >
                  {pocketCaption}
                </Text>
                <View style={styles.pocketHeroRow}>
                  <Text
                    testID={`${testID}-position`}
                    numberOfLines={1}
                    style={styles.pocketPositionText}
                  >
                    {displayPosition}
                  </Text>
                  <Text style={styles.pocketOfficeSuffix}>{displayOfficeCode}</Text>
                </View>
              </Pressable>

              <View style={styles.pocketBottomRow}>
                <Pressable
                  testID={`${testID}-action-btn`}
                  onPress={onActionPress}
                  style={styles.actionPillBtn}
                >
                  <Plus size={13} color="#FFFFFF" />
                  <Text numberOfLines={1} style={styles.actionPillText}>
                    {actionLabel}
                  </Text>
                </Pressable>

                <View style={styles.circleControlsRow}>
                  <Pressable
                    testID={`${testID}-flip-btn`}
                    accessibilityLabel="Flip lanyard card"
                    onPress={triggerFlip}
                    style={styles.circleIconBtn}
                  >
                    <Repeat size={13} color="#FFFFFF" />
                  </Pressable>
                  <Pressable
                    testID={`${testID}-mask-btn`}
                    accessibilityLabel={masked ? 'Reveal employee ID' : 'Mask employee ID'}
                    onPress={() => setMasked((prev) => !prev)}
                    style={styles.circleIconBtn}
                  >
                    {masked ? (
                      <EyeOff size={13} color="#FFFFFF" />
                    ) : (
                      <Eye size={13} color="#FFFFFF" />
                    )}
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* BACK FACE: Flipped Tracely Verified Custody Pass */}
        <Animated.View
          testID={`${testID}-back-face`}
          pointerEvents={flipped ? 'auto' : 'none'}
          style={[
            styles.faceLayer,
            styles.backFaceCard,
            {
              backgroundColor: palette.backFace,
              borderColor: palette.stitchStroke,
              opacity: backOpacity,
              transform: [{ perspective: 1000 }, { rotateY: backRotateY }],
            },
          ]}
        >
          <Pressable onPress={triggerFlip} style={styles.backFaceInner}>
            <View style={styles.backFaceHeader}>
              <Text style={styles.backFaceEyebrow}>TRACELY VERIFIED CUSTODY PASS</Text>
              <Text style={styles.backFaceBrand}>TRACELY</Text>
            </View>

            <View style={styles.backFaceIdentity}>
              <Text numberOfLines={1} style={styles.backFaceName}>
                {displayName}
              </Text>
              <Text numberOfLines={1} style={styles.backFaceRole}>
                {displayRole} · {displayOfficeCode} ({displayOfficeName})
              </Text>
              <Text numberOfLines={1} style={styles.backFaceId}>
                {displayId}
              </Text>
            </View>

            <View style={styles.backFaceStatsRow}>
              <View style={styles.backFaceStatTile}>
                <Text style={styles.backFaceStatLabel}>Active Custody</Text>
                <Text style={styles.backFaceStatValue}>
                  {(activeDocsCount ?? 0).toLocaleString()} docs
                </Text>
              </View>
              <View style={styles.backFaceStatTile}>
                <Text style={styles.backFaceStatLabel}>Completed</Text>
                <Text style={styles.backFaceStatValue}>
                  {(completedDocsCount ?? 0).toLocaleString()} docs
                </Text>
              </View>
            </View>

            <View style={styles.backFaceFooter}>
              <Text style={styles.backFaceHint}>Tap card to flip front</Text>
              <Repeat size={13} color="#DDD6FE" />
            </View>
          </Pressable>
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    width: '100%',
    alignItems: 'center',
  },
  liveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    backgroundColor: '#7C3AED',
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#6347E8',
  },
  lanyardHardwareWrap: {
    alignItems: 'center',
    marginBottom: -4,
    zIndex: 4,
  },
  lanyardStrap: {
    width: 30,
    height: 36,
    backgroundColor: '#4C2FD3',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    position: 'relative',
  },
  lanyardStrapStitchLeft: {
    position: 'absolute',
    left: 3,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  lanyardStrapStitchRight: {
    position: 'absolute',
    right: 3,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  lanyardClamp: {
    width: 34,
    height: 10,
    borderRadius: 3,
    backgroundColor: '#D9DCE2',
    borderWidth: 1,
    borderColor: '#AEB4C0',
    marginTop: -2,
  },
  lanyardRing: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: '#D9DCE2',
    marginTop: -2,
  },
  cardStage: {
    width: '100%',
    maxWidth: 344,
    height: 218,
    position: 'relative',
  },
  faceLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backfaceVisibility: 'hidden',
  },
  backStackCard: {
    position: 'absolute',
    top: 0,
    left: '14%',
    right: '14%',
    height: 46,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    backgroundColor: '#7758E4',
  },
  innerCard: {
    position: 'absolute',
    top: 11,
    left: '6.5%',
    right: '6.5%',
    height: 108,
    borderTopLeftRadius: 17,
    borderTopRightRadius: 17,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    backgroundColor: '#AC9CF4',
    paddingHorizontal: 16,
    paddingTop: 13,
    overflow: 'hidden',
  },
  innerCardTopRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  innerCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  innerLeftCopy: {
    flex: 1,
  },
  innerNameText: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  innerIdText: {
    marginTop: 4,
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.92)',
    letterSpacing: 0.6,
  },
  innerRightCopy: {
    alignItems: 'flex-end',
  },
  brandMarkText: {
    fontSize: 14.5,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  innerOfficeText: {
    marginTop: 3,
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  pocketLayer: {
    position: 'absolute',
    top: 42,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pocketSvgBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pocketContent: {
    flex: 1,
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 18,
    justifyContent: 'space-between',
  },
  pocketCaptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(233, 226, 255, 0.85)',
  },
  pocketHeroRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  pocketPositionText: {
    flexShrink: 1,
    fontSize: 19,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  pocketOfficeSuffix: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(220, 210, 255, 0.85)',
  },
  pocketBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  actionPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  actionPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  circleControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  circleIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.34)',
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backFaceCard: {
    borderRadius: 24,
    backgroundColor: '#3F21BD',
    borderWidth: 1.5,
    borderColor: 'rgba(223, 213, 255, 0.5)',
    borderStyle: 'dashed',
    padding: 16,
    shadowColor: '#29138A',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  backFaceInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  backFaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.18)',
  },
  backFaceEyebrow: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.7,
    color: '#C4B5FD',
  },
  backFaceBrand: {
    fontSize: 13,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#FFFFFF',
  },
  backFaceIdentity: {
    marginTop: 4,
  },
  backFaceName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  backFaceRole: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DDD6FE',
    marginTop: 2,
  },
  backFaceId: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#A78BFA',
    marginTop: 2,
    letterSpacing: 0.6,
  },
  backFaceStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  backFaceStatTile: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  backFaceStatLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#DDD6FE',
  },
  backFaceStatValue: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 1,
  },
  backFaceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  backFaceHint: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(221, 214, 254, 0.85)',
  },
});

export default MobileIdentityWalletCard;
