import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { Eye, EyeOff, Plus, Repeat } from 'lucide-react-native';
import { SDO_FONTS } from '../theme/tokens';

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
  readonly onDragChange?: (dragging: boolean) => void;
  readonly liveSyncBadge?: string;
  readonly defaultMasked?: boolean;
  readonly interactive?: boolean;
  readonly compact?: boolean;
  readonly lanyardHeight?: number;
  readonly testID?: string;
}

interface MobileWalletPalette {
  readonly canvasBg: string;
  readonly stageTint: string;
  readonly backStackStart: string;
  readonly backStackEnd: string;
  readonly innerStart: string;
  readonly innerMid: string;
  readonly innerShade: string;
  readonly innerEnd: string;
  readonly earTop: string;
  readonly earBottom: string;
  readonly pocketLight: string;
  readonly pocketBase: string;
  readonly pocketDeep: string;
  readonly pocketEdge: string;
  readonly shadowColor: string;
  readonly stitchStroke: string;
  readonly strapColor: string;
  readonly strapEdge: string;
  readonly backGradStart: string;
  readonly backGradMid: string;
  readonly backGradEnd: string;
  readonly controlInk: string;
  readonly controlBorder: string;
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

/**
 * Exact 1:1 color derivation parity with web/src/components/IdentityWalletCard.tsx
 */
function deriveMobileWalletPalette(accentColor?: string): MobileWalletPalette {
  const normalized = (accentColor ?? '').trim().toUpperCase();
  if (!normalized || normalized === '#5736E4') {
    return {
      canvasBg: '#F6F5FC',
      stageTint: '#F4F3FA',
      backStackStart: '#8B6CEF',
      backStackEnd: '#6D4ED8',
      innerStart: '#BDB0F9',
      innerMid: '#D4CCFF',
      innerShade: '#9A82EC',
      innerEnd: '#846AE2',
      earTop: '#9478FC',
      earBottom: '#6B4CEB',
      pocketLight: '#7C5DFA',
      pocketBase: '#5736E4',
      pocketDeep: '#4324C7',
      pocketEdge: '#6345EE',
      shadowColor: '#371D9E',
      stitchStroke: '#DFD5FF',
      strapColor: '#4C2FD3',
      strapEdge: '#371EA8',
      backGradStart: '#5736E4',
      backGradMid: '#3F21BD',
      backGradEnd: '#29138A',
      controlInk: '#4324C7',
      controlBorder: 'rgba(99, 71, 232, 0.28)',
    };
  }
  const rgb = parseHexRgb(normalized);
  const white: [number, number, number] = [255, 255, 255];
  const black: [number, number, number] = [10, 14, 28];
  const baseHex = mixHex(rgb, white, 0);
  return {
    canvasBg: mixHex(rgb, white, 0.94),
    stageTint: mixHex(rgb, white, 0.95),
    backStackStart: mixHex(rgb, white, 0.28),
    backStackEnd: mixHex(rgb, white, 0.14),
    innerStart: mixHex(rgb, white, 0.48),
    innerMid: mixHex(rgb, white, 0.64),
    innerShade: mixHex(rgb, white, 0.34),
    innerEnd: mixHex(rgb, white, 0.2),
    earTop: mixHex(rgb, white, 0.34),
    earBottom: mixHex(rgb, white, 0.12),
    pocketLight: mixHex(rgb, white, 0.18),
    pocketBase: baseHex,
    pocketDeep: mixHex(rgb, black, 0.24),
    pocketEdge: mixHex(rgb, white, 0.08),
    shadowColor: mixHex(rgb, black, 0.38),
    stitchStroke: mixHex(rgb, white, 0.78),
    strapColor: mixHex(rgb, black, 0.18),
    strapEdge: mixHex(rgb, black, 0.38),
    backGradStart: baseHex,
    backGradMid: mixHex(rgb, black, 0.24),
    backGradEnd: mixHex(rgb, black, 0.46),
    controlInk: mixHex(rgb, black, 0.14),
    controlBorder: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.28)`,
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

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

interface LanyardPhysicsSnapshot {
  readonly x: number;
  readonly y: number;
  readonly rotZ: number;
  readonly rotX: number;
  readonly rotY: number;
  readonly mid1X: number;
  readonly mid1Y: number;
  readonly mid2X: number;
  readonly mid2Y: number;
  readonly clampAngleDeg: number;
  readonly sheenOffset: number;
}

const INITIAL_PHYSICS_SNAPSHOT: LanyardPhysicsSnapshot = {
  x: 0,
  y: 0,
  rotZ: 0,
  rotX: 0,
  rotY: 0,
  mid1X: 0,
  mid1Y: 20,
  mid2X: 0,
  mid2Y: 42,
  clampAngleDeg: 0,
  sheenOffset: 0,
};

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
  onDragChange,
  liveSyncBadge,
  defaultMasked = false,
  interactive = true,
  compact = false,
  lanyardHeight = 304,
  testID = 'mobile-identity-wallet-card',
}) => {
  const [masked, setMasked] = useState(defaultMasked);
  const [flipped, setFlipped] = useState(false);
  const [showMetricsMode, setShowMetricsMode] = useState(false);
  const [stageWidth, setStageWidth] = useState(336);
  const [phys, setPhys] = useState<LanyardPhysicsSnapshot>(INITIAL_PHYSICS_SNAPSHOT);

  const rawUid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const backStackGradId = `mBackStack_${rawUid}`;
  const innerGradId = `mInner_${rawUid}`;
  const sheenGradId = `mSheen_${rawUid}`;
  const pocketGradId = `mPocket_${rawUid}`;
  const earGradId = `mEar_${rawUid}`;
  const backFaceGradId = `mBackFace_${rawUid}`;
  const strapGradId = `mStrap_${rawUid}`;
  const metalGradId = `mMetal_${rawUid}`;

  const palette = useMemo(() => deriveMobileWalletPalette(accentColor), [accentColor]);

  const stageHeight = compact ? 276 : lanyardHeight;
  const cardWidth = Math.min(286, Math.max(242, stageWidth - 46));
  const cardHeight = Math.round(cardWidth * (640 / 900));
  const strapRestLength = Math.max(46, Math.round(stageHeight - cardHeight - 54));

  // Real-time spring-pendulum & 3D flip physics state matching web Lanyard.tsx feel
  const simRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rotZ: 0,
    vRotZ: 0,
    rotX: 0,
    vRotX: 0,
    rotY: 0,
    vRotY: 0,
    targetFlipDeg: 0,
    dragging: false,
    dragTargetX: 0,
    dragTargetY: 0,
    dragStartX: 0,
    dragStartY: 0,
    grabLocalX: 0,
    pressTime: 0,
    moved: false,
    time: 0,
    mid1X: 0,
    mid1Y: 20,
    mid2X: 0,
    mid2Y: 42,
    vMid1X: 0,
    vMid2X: 0,
  });

  const flippedRef = useRef(false);
  const onDragChangeRef = useRef(onDragChange);
  onDragChangeRef.current = onDragChange;

  const triggerFlip = useCallback((direction: 1 | -1 = 1) => {
    const next = !flippedRef.current;
    flippedRef.current = next;
    setFlipped(next);
    const sim = simRef.current;
    sim.targetFlipDeg = next ? 180 * direction : 0;
    sim.vRotY += 320 * direction;

    if (typeof jest !== 'undefined') {
      sim.rotY = next ? 180 : 0;
      setPhys((prev) => ({ ...prev, rotY: sim.rotY }));
    }
  }, []);

  // Intro drop-in & gentle breeze + 60fps elastic pendulum physics loop (no-op in Jest)
  useEffect(() => {
    if (!interactive || typeof jest !== 'undefined') return;

    const sim = simRef.current;
    // Gentle web-matched intro sway drop-in
    sim.x = -14;
    sim.y = -22;
    sim.vx = 48;
    sim.rotZ = 9;
    sim.vRotZ = -26;
    sim.rotY = -14;

    let alive = true;
    let rafId = 0;
    let lastTime = Date.now();

    const step = () => {
      if (!alive) return;
      const now = Date.now();
      const dt = Math.min(0.033, Math.max(0.008, (now - lastTime) / 1000));
      lastTime = now;
      sim.time += dt;

      if (sim.dragging) {
        // Spring grip pulls card responsively toward finger with realistic strap tension
        const stiffness = 170;
        const damping = 18;
        const ax = (sim.dragTargetX - sim.x) * stiffness - sim.vx * damping;
        const ay = (sim.dragTargetY - sim.y) * stiffness - sim.vy * damping;
        sim.vx += ax * dt;
        sim.vy += ay * dt;
        sim.x += sim.vx * dt;
        sim.y += sim.vy * dt;

        // Grabbing off-center induces natural Z-swing & Y-yaw tilt just like 3D Lanyard
        const targetZ = clamp(-sim.x * 0.21 + sim.grabLocalX * 0.08 - sim.vx * 0.025, -28, 28);
        const targetX = clamp(-sim.y * 0.16, -16, 16);
        const targetYawOffset = clamp(sim.vx * 0.065 + sim.grabLocalX * 0.14, -36, 36);

        sim.vRotZ += ((targetZ - sim.rotZ) * 140 - sim.vRotZ * 14) * dt;
        sim.rotZ += sim.vRotZ * dt;

        sim.vRotX += ((targetX - sim.rotX) * 140 - sim.vRotX * 14) * dt;
        sim.rotX += sim.vRotX * dt;

        const desiredY = sim.targetFlipDeg + targetYawOffset;
        sim.vRotY += ((desiredY - sim.rotY) * 110 - sim.vRotY * 12) * dt;
        sim.rotY += sim.vRotY * dt;
      } else {
        // Free hanging elastic pendulum with gentle ambient breeze (matching web breeze=0.35)
        const breezeForce =
          Math.sin(sim.time * 1.35) * 4.2 + Math.sin(sim.time * 0.72 + 1.1) * 2.1;
        const restK = 44;
        const dampXY = 5.4;
        const ax = -sim.x * restK - sim.vx * dampXY + breezeForce * 4.5;
        const ay = -sim.y * (restK * 1.45) - sim.vy * (dampXY * 1.15);

        sim.vx += ax * dt;
        sim.vy += ay * dt;
        sim.x += sim.vx * dt;
        sim.y += sim.vy * dt;

        // Coupled pendulum swing angle responds to horizontal velocity & displacement
        const targetZ = clamp(-sim.x * 0.24 - sim.vx * 0.03 + breezeForce * 0.35, -30, 30);
        sim.vRotZ += ((targetZ - sim.rotZ) * 65 - sim.vRotZ * 6.8) * dt;
        sim.rotZ += sim.vRotZ * dt;

        // Vertical pitch settles smoothly
        const targetX = clamp(-sim.vy * 0.032 - sim.y * 0.12, -16, 16);
        sim.vRotX += ((targetX - sim.rotX) * 70 - sim.vRotX * 7.5) * dt;
        sim.rotX += sim.vRotX * dt;

        // 3D Y-axis flip spring with lively rotational inertia & gentle breeze yaw
        const breezeYaw = Math.sin(sim.time * 1.1 + 0.4) * 3.5;
        const desiredY = sim.targetFlipDeg + breezeYaw;
        sim.vRotY += ((desiredY - sim.rotY) * 76 - sim.vRotY * 7.2) * dt;
        sim.rotY += sim.vRotY * dt;
      }

      // Update 2 intermediate flexible rope nodes so the woven strap curves organically
      const targetMid1X = sim.x * 0.28 + Math.sin(sim.time * 1.35) * 1.2;
      const targetMid2X = sim.x * 0.68;
      sim.vMid1X += ((targetMid1X - sim.mid1X) * 180 - sim.vMid1X * 16) * dt;
      sim.vMid2X += ((targetMid2X - sim.mid2X) * 180 - sim.vMid2X * 16) * dt;
      sim.mid1X += sim.vMid1X * dt;
      sim.mid2X += sim.vMid2X * dt;

      const endY = Math.max(18, strapRestLength + sim.y);
      sim.mid1Y = endY * 0.34;
      sim.mid2Y = endY * 0.7;

      const dxClamp = sim.x - sim.mid2X;
      const dyClamp = Math.max(10, endY - sim.mid2Y);
      const clampAngleDeg = clamp((-Math.atan2(dxClamp, dyClamp) * 180) / Math.PI, -38, 38);

      const normYaw = ((sim.rotY % 360) + 360) % 360;
      const sheenOffset = clamp(
        (sim.rotZ * 2.2 + (normYaw > 90 && normYaw < 270 ? normYaw - 180 : sim.rotY) * 1.4),
        -75,
        75,
      );

      setPhys({
        x: sim.x,
        y: sim.y,
        rotZ: sim.rotZ,
        rotX: sim.rotX,
        rotY: sim.rotY,
        mid1X: sim.mid1X,
        mid1Y: sim.mid1Y,
        mid2X: sim.mid2X,
        mid2Y: sim.mid2Y,
        clampAngleDeg,
        sheenOffset,
      });

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
    };
  }, [interactive, strapRestLength]);

  // Grab, drag, swing, flick, or tap-to-flip directly on the hanging card (matches Lanyard.tsx)
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => interactive,
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          interactive && (Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (evt) => {
          const sim = simRef.current;
          sim.dragging = true;
          sim.dragStartX = sim.x;
          sim.dragStartY = sim.y;
          sim.dragTargetX = sim.x;
          sim.dragTargetY = sim.y;
          const locX = evt.nativeEvent.locationX ?? cardWidth / 2;
          sim.grabLocalX = clamp(locX - cardWidth / 2, -cardWidth / 2, cardWidth / 2);
          sim.pressTime = Date.now();
          sim.moved = false;
          onDragChangeRef.current?.(true);
        },
        onPanResponderMove: (_evt, gesture) => {
          const sim = simRef.current;
          if (Math.hypot(gesture.dx, gesture.dy) > 7) {
            sim.moved = true;
          }
          sim.dragTargetX = clamp(sim.dragStartX + gesture.dx * 0.82, -88, 88);
          sim.dragTargetY = clamp(sim.dragStartY + gesture.dy * 0.72, -32, 68);
        },
        onPanResponderRelease: (_evt, gesture) => {
          const sim = simRef.current;
          sim.dragging = false;
          onDragChangeRef.current?.(false);

          const elapsed = Date.now() - sim.pressTime;
          if (!sim.moved && elapsed < 420) {
            // Quick tap flips 180° in the direction of the tapped side (exact Lanyard.tsx feel!)
            const dir: 1 | -1 = sim.grabLocalX < 0 ? -1 : 1;
            triggerFlip(dir);
            return;
          }

          // Impart natural flick velocity so releasing swings the lanyard elastically
          sim.vx += clamp(gesture.vx * 190, -260, 260);
          sim.vy += clamp(gesture.vy * 160, -200, 200);
          if (Math.abs(gesture.vx) > 1.35 && Math.abs(gesture.dx) > 42) {
            triggerFlip(gesture.vx > 0 ? 1 : -1);
          }
        },
        onPanResponderTerminate: () => {
          simRef.current.dragging = false;
          onDragChangeRef.current?.(false);
        },
      }),
    [cardWidth, interactive, triggerFlip],
  );

  const handleStageLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 100) {
      setStageWidth(w);
    }
  }, []);

  const displayName = fullName.trim() || 'Your Full Name';
  const displayOfficeCode = officeCode.trim().toUpperCase() || 'OFFICE';
  const displayPosition = position.trim() || 'Designation / Position';
  const displayRole = roleLabel?.trim() || 'Authorized Personnel';
  const displayId = formatMaskedIdentifier(employeeId, masked);
  const displayOfficeName = officeName?.trim() || displayOfficeCode;

  const pocketCaption = showMetricsMode
    ? 'Active Workspace Custody'
    : email && email.trim()
      ? `${displayRole} · ${
          masked ? '•••@' + (email.split('@')[1] || 'tracely.local') : email.trim()
        }`
      : displayOfficeName;

  const pocketPrimaryText = showMetricsMode
    ? `${(activeDocsCount ?? 0).toLocaleString()} Active · ${(
        completedDocsCount ?? 0
      ).toLocaleString()} Done`
    : displayPosition;

  // Determine which face is visually forward based on real-time 3D Y-rotation
  const normalizedRotY = ((phys.rotY % 360) + 360) % 360;
  const showingBackVisually = normalizedRotY > 90 && normalizedRotY < 270;
  const backPointerEvents = flipped ? 'auto' : 'none';
  const frontPointerEvents = flipped ? 'none' : 'auto';

  // Compute live SVG coordinates for the curved woven lanyard strap & brushed silver clamp
  const anchorX = stageWidth / 2;
  const clampEndX = anchorX + phys.x;
  const clampEndY = Math.max(24, strapRestLength + phys.y);
  const c1x = anchorX + phys.mid1X;
  const c1y = phys.mid1Y;
  const c2x = anchorX + phys.mid2X;
  const c2y = phys.mid2Y;

  const strapPath = `M ${anchorX} -8 C ${c1x} ${c1y}, ${c2x} ${c2y}, ${clampEndX} ${clampEndY - 8}`;
  const strapStitchLeft = `M ${anchorX - 9} -8 C ${c1x - 9} ${c1y}, ${c2x - 9} ${c2y}, ${clampEndX - 9} ${clampEndY - 8}`;
  const strapStitchRight = `M ${anchorX + 9} -8 C ${c1x + 9} ${c1y}, ${c2x + 9} ${c2y}, ${clampEndX + 9} ${clampEndY - 8}`;

  const cardTop = strapRestLength + 2;

  return (
    <View testID={testID} style={styles.root}>
      {liveSyncBadge ? (
        <View style={styles.liveBadgeRow}>
          <View style={[styles.liveDot, { backgroundColor: palette.pocketBase }]} />
          <Text style={[styles.liveBadgeText, { color: palette.controlInk }]}>
            {liveSyncBadge}
          </Text>
        </View>
      ) : null}

      {/* Rounded Soft-Tinted 3D Lanyard Stage (Exact Parity with Web IdentityWalletCard) */}
      <View
        testID={`${testID}-lanyard-stage`}
        onLayout={handleStageLayout}
        style={[
          styles.lanyardStage,
          { height: stageHeight, backgroundColor: palette.stageTint },
        ]}
      >
        {/* Dynamic Multi-Joint Curved Woven Lanyard Band + Brushed Silver Clamp & Split Ring */}
        <View pointerEvents="none" style={styles.strapSvgOverlay}>
          <Svg width={stageWidth} height={stageHeight} testID={`${testID}-strap`}>
            <Defs>
              <LinearGradient id={strapGradId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={palette.strapEdge} />
                <Stop offset="0.22" stopColor={palette.strapColor} />
                <Stop offset="0.5" stopColor={palette.pocketLight} />
                <Stop offset="0.78" stopColor={palette.strapColor} />
                <Stop offset="1" stopColor={palette.strapEdge} />
              </LinearGradient>
              <LinearGradient id={metalGradId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#F3F5F8" />
                <Stop offset="0.45" stopColor="#CFD6E0" />
                <Stop offset="0.82" stopColor="#94A0B2" />
                <Stop offset="1" stopColor="#E2E8F0" />
              </LinearGradient>
            </Defs>

            {/* Soft strap cast shadow */}
            <Path
              d={`M ${anchorX + 3} -8 C ${c1x + 3} ${c1y + 2}, ${c2x + 3} ${c2y + 2}, ${clampEndX + 3} ${clampEndY - 6}`}
              fill="none"
              stroke="rgba(15, 23, 42, 0.14)"
              strokeWidth={27}
              strokeLinecap="butt"
            />
            {/* Main woven lanyard ribbon */}
            <Path
              d={strapPath}
              fill="none"
              stroke={`url(#${strapGradId})`}
              strokeWidth={25}
              strokeLinecap="butt"
            />
            {/* Woven edge stitching */}
            <Path
              d={strapStitchLeft}
              fill="none"
              stroke="rgba(255, 255, 255, 0.34)"
              strokeWidth={1.1}
              strokeDasharray="3 3"
            />
            <Path
              d={strapStitchRight}
              fill="none"
              stroke="rgba(255, 255, 255, 0.34)"
              strokeWidth={1.1}
              strokeDasharray="3 3"
            />

            {/* Brushed silver crimp clamp + split ring aligned to live strap tangent */}
            <Path
              d={`M ${clampEndX - 15} ${clampEndY - 12} L ${clampEndX + 15} ${clampEndY - 12} L ${clampEndX + 12} ${clampEndY - 1} Q ${clampEndX} ${clampEndY + 2} ${clampEndX - 12} ${clampEndY - 1} Z`}
              fill={`url(#${metalGradId})`}
              stroke="#94A3B8"
              strokeWidth={0.9}
              transform={`rotate(${phys.clampAngleDeg}, ${clampEndX}, ${clampEndY})`}
            />
            <Circle
              cx={clampEndX}
              cy={clampEndY + 4}
              r={6}
              fill="none"
              stroke={`url(#${metalGradId})`}
              strokeWidth={2.6}
              transform={`rotate(${phys.clampAngleDeg}, ${clampEndX}, ${clampEndY})`}
            />
          </Svg>
        </View>

        {/* Hanging 3D Interactive Glossy Landscape Badge Card */}
        <View
          {...panResponder.panHandlers}
          style={[
            styles.cardAnchorWrap,
            {
              top: cardTop,
              width: cardWidth,
              height: cardHeight,
              transform: [
                { perspective: 1000 },
                { translateX: phys.x },
                { translateY: phys.y },
                { rotateX: `${phys.rotX.toFixed(2)}deg` },
                { rotateZ: `${phys.rotZ.toFixed(2)}deg` },
              ],
            },
          ]}
        >
          {/* FRONT FACE: Exact Web 900×640 Glossy Framed Wallet Card */}
          <View
            pointerEvents={frontPointerEvents}
            style={[
              styles.glossyCardShell,
              {
                backgroundColor: palette.canvasBg,
                shadowColor: palette.shadowColor,
                opacity: showingBackVisually ? 0 : 1,
                transform: [{ perspective: 1000 }, { rotateY: `${phys.rotY.toFixed(2)}deg` }],
              },
            ]}
          >
            {/* Metallic Silver Eyelet Hole at Top Center */}
            <View style={styles.cardEyeletRing} />

            {/* Full-bleed Web-matched SVG Background Layers (Back Stack + Inner Metallic + Sheen + Concave Stitched Pocket) */}
            <View pointerEvents="none" style={styles.cardSvgBackdrop}>
              <Svg width="100%" height="100%" viewBox="0 0 900 640" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id={backStackGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor={palette.backStackStart} />
                    <Stop offset="100%" stopColor={palette.backStackEnd} />
                  </LinearGradient>
                  <LinearGradient id={innerGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor={palette.innerStart} />
                    <Stop offset="38%" stopColor={palette.innerMid} />
                    <Stop offset="72%" stopColor={palette.innerShade} />
                    <Stop offset="100%" stopColor={palette.innerEnd} />
                  </LinearGradient>
                  <LinearGradient id={sheenGradId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
                    <Stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.34" />
                    <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
                  </LinearGradient>
                  <LinearGradient id={pocketGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor={palette.pocketLight} />
                    <Stop offset="48%" stopColor={palette.pocketBase} />
                    <Stop offset="85%" stopColor={palette.pocketDeep} />
                    <Stop offset="100%" stopColor={palette.pocketEdge} />
                  </LinearGradient>
                  <LinearGradient id={earGradId} x1="0%" y1="0%" x2="0%" y2="100%">
                    <Stop offset="0%" stopColor={palette.earTop} />
                    <Stop offset="100%" stopColor={palette.earBottom} />
                  </LinearGradient>
                </Defs>

                {/* Outer rounded card surface */}
                <Rect width="900" height="640" rx="44" fill={palette.canvasBg} />

                {/* 1. Top Back Stack Card Peeking Behind */}
                <Rect x="155" y="64" width="590" height="120" rx="32" fill={`url(#${backStackGradId})`} />

                {/* 2. Middle Inner Metallic Card + Dynamic Tilting Sheen */}
                <Rect
                  x="88"
                  y="92"
                  width="724"
                  height="250"
                  rx="38"
                  fill={`url(#${innerGradId})`}
                  stroke="#FFFFFF"
                  strokeOpacity={0.65}
                  strokeWidth={2.5}
                />
                <Rect
                  x={368 + phys.sheenOffset * 2.2}
                  y="52"
                  width="180"
                  height="340"
                  fill={`url(#${sheenGradId})`}
                  transform={`rotate(-22 ${458 + phys.sheenOffset * 2.2} 212)`}
                />

                {/* 3. Front Stitched Concave Wallet Pocket Sleeve */}
                <Path
                  d="M 46 206 Q 46 168 84 168 L 100 168 L 100 260 L 46 260 Z"
                  fill={`url(#${earGradId})`}
                />
                <Path
                  d="M 800 168 L 816 168 Q 854 168 854 206 L 854 260 L 800 260 Z"
                  fill={`url(#${earGradId})`}
                />
                <Path
                  d="M 46 226 C 246 272, 654 272, 854 226 L 854 510 Q 854 580 784 580 L 116 580 Q 46 580 46 510 Z"
                  fill={`url(#${pocketGradId})`}
                />
                <Path
                  d="M 68 236 C 256 280, 644 280, 832 236"
                  fill="none"
                  stroke={palette.stitchStroke}
                  strokeOpacity={0.62}
                  strokeWidth={3.2}
                  strokeDasharray="9 9"
                  strokeLinecap="round"
                />
                <Path
                  d="M 64 196 L 64 506 Q 64 562 120 562 L 780 562 Q 836 562 836 506 L 836 196"
                  fill="none"
                  stroke={palette.stitchStroke}
                  strokeOpacity={0.54}
                  strokeWidth={3.2}
                  strokeDasharray="9 9"
                  strokeLinecap="round"
                />
              </Svg>
            </View>

            {/* Inner Metallic Card Typography */}
            <View testID={`${testID}-inner-card`} style={styles.innerTextOverlay}>
              <View style={styles.innerLeftCol}>
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
              <View style={styles.innerRightCol}>
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

            {/* Stitched Pocket Foreground Content (Exact Web Layout & Frosted Badge Row) */}
            <View style={styles.pocketTextOverlay}>
              <View>
                <Text
                  testID={`${testID}-caption`}
                  numberOfLines={1}
                  style={[styles.pocketCaptionText, { color: palette.stitchStroke }]}
                >
                  {pocketCaption}
                </Text>
                <View style={styles.pocketHeroRow}>
                  <Text
                    testID={`${testID}-position`}
                    numberOfLines={1}
                    style={styles.pocketPositionText}
                  >
                    {pocketPrimaryText}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.pocketOfficeSuffix, { color: palette.stitchStroke }]}
                  >
                    {displayOfficeCode}
                  </Text>
                </View>
              </View>

              {/* Visual Card-Face Glass Pill & Twin Circles matching Web SVG texture */}
              <View style={styles.cardFaceGlassRow}>
                <View style={styles.cardFaceGlassPill}>
                  <Text numberOfLines={1} style={styles.cardFaceGlassPillText}>
                    + {actionLabel}
                  </Text>
                </View>
                <View style={styles.cardFaceGlassCircles}>
                  <View style={styles.cardFaceGlassDot}>
                    <Text style={styles.cardFaceGlassGlyph}>⇄</Text>
                  </View>
                  <View style={styles.cardFaceGlassDot}>
                    <Text style={styles.cardFaceGlassGlyph}>◉</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* BACK FACE: Exact Web 900×640 Tracely Verified Custody Pass */}
          <View
            testID={`${testID}-back-face`}
            pointerEvents={backPointerEvents}
            style={[
              styles.glossyCardShell,
              {
                backgroundColor: palette.canvasBg,
                shadowColor: palette.shadowColor,
                opacity: showingBackVisually ? 1 : 0,
                transform: [
                  { perspective: 1000 },
                  { rotateY: `${(phys.rotY + 180).toFixed(2)}deg` },
                ],
              },
            ]}
          >
            <View style={styles.cardEyeletRing} />
            <View pointerEvents="none" style={styles.cardSvgBackdrop}>
              <Svg width="100%" height="100%" viewBox="0 0 900 640" preserveAspectRatio="none">
                <Defs>
                  <LinearGradient id={backFaceGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor={palette.backGradStart} />
                    <Stop offset="55%" stopColor={palette.backGradMid} />
                    <Stop offset="100%" stopColor={palette.backGradEnd} />
                  </LinearGradient>
                </Defs>
                <Rect width="900" height="640" rx="44" fill={palette.canvasBg} />
                <Rect
                  x="46"
                  y="72"
                  width="808"
                  height="496"
                  rx="46"
                  fill={`url(#${backFaceGradId})`}
                />
                <Rect
                  x="66"
                  y="92"
                  width="768"
                  height="456"
                  rx="36"
                  fill="none"
                  stroke={palette.stitchStroke}
                  strokeOpacity={0.48}
                  strokeWidth={3}
                  strokeDasharray="9 9"
                />
              </Svg>
            </View>

            <View style={styles.backFaceOverlay}>
              <View style={styles.backFaceHeader}>
                <Text
                  numberOfLines={1}
                  style={[styles.backFaceEyebrow, { color: palette.stitchStroke }]}
                >
                  TRACELY VERIFIED CUSTODY PASS
                </Text>
                <Text style={styles.backFaceBrand}>TRACELY</Text>
              </View>

              <View style={styles.backFaceIdentity}>
                <Text numberOfLines={1} style={styles.backFaceName}>
                  {displayName}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.backFaceRole, { color: palette.stitchStroke }]}
                >
                  {displayRole} · {displayOfficeCode} ({displayOfficeName})
                </Text>
                <Text numberOfLines={1} style={styles.backFaceId}>
                  {displayId}
                </Text>
              </View>

              <View style={styles.backFaceStatsRow}>
                <View style={styles.backFaceStatTile}>
                  <Text style={[styles.backFaceStatLabel, { color: palette.stitchStroke }]}>
                    Active Desk Custody
                  </Text>
                  <Text style={styles.backFaceStatValue}>
                    {(activeDocsCount ?? 0).toLocaleString()} docs
                  </Text>
                </View>
                <View style={styles.backFaceStatTile}>
                  <Text style={[styles.backFaceStatLabel, { color: palette.stitchStroke }]}>
                    Completed Records
                  </Text>
                  <Text style={styles.backFaceStatValue}>
                    {(completedDocsCount ?? 0).toLocaleString()} docs
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Minimal Floating Corner Controls (Exact Parity with Web IdentityWalletCard.tsx) */}
        <View style={styles.floatingCornerControls}>
          {onActionPress ? (
            <Pressable
              testID={`${testID}-action-btn`}
              onPress={onActionPress}
              style={[
                styles.cornerActionPill,
                { borderColor: palette.controlBorder },
              ]}
            >
              <Plus size={12} color={palette.controlInk} />
              <Text
                numberOfLines={1}
                style={[styles.cornerActionText, { color: palette.controlInk }]}
              >
                {actionLabel}
              </Text>
            </Pressable>
          ) : null}

          <Pressable
            testID={`${testID}-flip-btn`}
            accessibilityLabel="Flip lanyard card"
            onPress={() => {
              setShowMetricsMode((prev) => !prev);
              triggerFlip(1);
            }}
            style={[
              styles.cornerCircleBtn,
              { borderColor: palette.controlBorder },
            ]}
          >
            <Repeat size={13} color={palette.controlInk} />
          </Pressable>

          <Pressable
            testID={`${testID}-mask-btn`}
            accessibilityLabel={masked ? 'Reveal employee ID' : 'Mask employee ID'}
            onPress={() => setMasked((prev) => !prev)}
            style={[
              styles.cornerCircleBtn,
              { borderColor: palette.controlBorder },
            ]}
          >
            {masked ? (
              <EyeOff size={13} color={palette.controlInk} />
            ) : (
              <Eye size={13} color={palette.controlInk} />
            )}
          </Pressable>
        </View>
      </View>
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
    gap: 6,
    marginBottom: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
  },
  liveBadgeText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  lanyardStage: {
    position: 'relative',
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
  },
  strapSvgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
  },
  cardAnchorWrap: {
    position: 'absolute',
    zIndex: 3,
  },
  glossyCardShell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    shadowOpacity: 0.24,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  cardEyeletRing: {
    position: 'absolute',
    top: 5,
    alignSelf: 'center',
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: 'rgba(15, 23, 42, 0.16)',
    zIndex: 6,
  },
  cardSvgBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  innerTextOverlay: {
    position: 'absolute',
    top: '16.5%',
    left: '14.5%',
    right: '14.5%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  innerLeftCol: {
    flex: 1,
  },
  innerNameText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  innerIdText: {
    fontFamily: SDO_FONTS.mono,
    marginTop: 2,
    fontSize: 8.2,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.92)',
    letterSpacing: 0.5,
  },
  innerRightCol: {
    alignItems: 'flex-end',
  },
  brandMarkText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '900',
    fontStyle: 'italic',
    letterSpacing: 0.4,
    color: '#FFFFFF',
  },
  innerOfficeText: {
    fontFamily: SDO_FONTS.sans,
    marginTop: 1,
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  pocketTextOverlay: {
    position: 'absolute',
    top: '45%',
    left: '11%',
    right: '11%',
    bottom: '13%',
    justifyContent: 'space-between',
  },
  pocketCaptionText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 8.2,
    fontWeight: '600',
  },
  pocketHeroRow: {
    marginTop: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 6,
  },
  pocketPositionText: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pocketOfficeSuffix: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 9.5,
    fontWeight: '700',
  },
  cardFaceGlassRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  cardFaceGlassPill: {
    paddingHorizontal: 10,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.36)',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '58%',
  },
  cardFaceGlassPillText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 8.5,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardFaceGlassCircles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardFaceGlassDot: {
    width: 21,
    height: 21,
    borderRadius: 10.5,
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.36)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFaceGlassGlyph: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  backFaceOverlay: {
    position: 'absolute',
    top: '17%',
    left: '11.5%',
    right: '11.5%',
    bottom: '16%',
    justifyContent: 'space-between',
  },
  backFaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.18)',
  },
  backFaceEyebrow: {
    fontFamily: SDO_FONTS.mono,
    fontSize: 7.4,
    fontWeight: '700',
    letterSpacing: 0.5,
    flex: 1,
  },
  backFaceBrand: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10.5,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#FFFFFF',
  },
  backFaceIdentity: {
    marginTop: 2,
  },
  backFaceName: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  backFaceRole: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 8.5,
    fontWeight: '600',
    marginTop: 1,
  },
  backFaceId: {
    fontFamily: SDO_FONTS.mono,
    fontSize: 8.2,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.84)',
    marginTop: 1,
  },
  backFaceStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  backFaceStatTile: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.24)',
  },
  backFaceStatLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 7.4,
    fontWeight: '600',
  },
  backFaceStatValue: {
    fontFamily: SDO_FONTS.mono,
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 1,
  },
  floatingCornerControls: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 8,
  },
  cornerActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cornerActionText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '700',
  },
  cornerCircleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});

export default MobileIdentityWalletCard;
