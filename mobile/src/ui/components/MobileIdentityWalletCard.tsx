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

interface MobileIdPalette {
  readonly stageTint: string;
  readonly headerBase: string;
  readonly headerDeep: string;
  readonly headerLight: string;
  readonly tintBg: string;
  readonly tintBorder: string;
  readonly strapColor: string;
  readonly strapEdge: string;
  readonly controlInk: string;
  readonly controlBorder: string;
}

function parseHexRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return [13, 52, 114];
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return [13, 52, 114];
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

function deriveMobileIdPalette(accentColor?: string): MobileIdPalette {
  const normalized = (accentColor ?? '').trim().toUpperCase();
  const baseHex = /^#[0-9A-F]{6}$/.test(normalized) ? normalized : '#0D3472';
  const rgb = parseHexRgb(baseHex);
  const white: [number, number, number] = [255, 255, 255];
  const dark: [number, number, number] = [9, 18, 36];

  return {
    stageTint: '#F4F6FA',
    headerBase: baseHex,
    headerDeep: mixHex(rgb, dark, 0.34),
    headerLight: mixHex(rgb, white, 0.16),
    tintBg: mixHex(rgb, white, 0.91),
    tintBorder: mixHex(rgb, white, 0.72),
    strapColor: mixHex(rgb, dark, 0.16),
    strapEdge: mixHex(rgb, dark, 0.36),
    controlInk: mixHex(rgb, dark, 0.18),
    controlBorder: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.24)`,
  };
}

function extractInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'TR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatMaskedIdentifier(rawId: string, masked: boolean): string {
  const cleaned = rawId.trim() || 'EMP-2026-5678';
  if (!masked) {
    return cleaned;
  }
  const suffix = cleaned.slice(-4).padStart(4, '0');
  return `•••• ${suffix}`;
}

function buildBarcodePattern(seed: string): ReadonlyArray<{ x: number; w: number }> {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const bars: Array<{ x: number; w: number }> = [];
  let cursor = 0;
  let step = 0;
  while (cursor < 132) {
    const bit = ((hash >>> (step % 28)) ^ (step * 7)) & 3;
    const w = bit === 0 ? 1.8 : bit === 1 ? 3 : bit === 2 ? 1.4 : 4;
    const gap = bit === 3 ? 2.4 : 2;
    if (cursor + w <= 132) {
      bars.push({ x: cursor, w });
    }
    cursor += w + gap;
    step += 1;
  }
  return bars;
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
  lanyardHeight = 368,
  testID = 'mobile-identity-wallet-card',
}) => {
  const [masked, setMasked] = useState(defaultMasked);
  const [flipped, setFlipped] = useState(false);
  const [showMetricsMode, setShowMetricsMode] = useState(false);
  const [stageWidth, setStageWidth] = useState(336);
  const [phys, setPhys] = useState<LanyardPhysicsSnapshot>(INITIAL_PHYSICS_SNAPSHOT);

  const rawUid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const strapGradId = `mIdStrap_${rawUid}`;
  const metalGradId = `mIdMetal_${rawUid}`;

  const palette = useMemo(() => deriveMobileIdPalette(accentColor), [accentColor]);

  // Portrait vertical ID dimensions matching Web 1.6 : 2.25 ratio
  const stageHeight = compact ? 324 : lanyardHeight;
  const cardHeight = compact ? 236 : 272;
  const cardWidth = Math.round(cardHeight * (1.6 / 2.25));
  const strapRestLength = Math.max(44, Math.round(stageHeight - cardHeight - 44));

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

  useEffect(() => {
    if (!interactive || typeof jest !== 'undefined') return;

    const sim = simRef.current;
    sim.x = -10;
    sim.y = -18;
    sim.vx = 40;
    sim.rotZ = 7;
    sim.vRotZ = -20;
    sim.rotY = -10;

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
        const stiffness = 170;
        const damping = 18;
        const ax = (sim.dragTargetX - sim.x) * stiffness - sim.vx * damping;
        const ay = (sim.dragTargetY - sim.y) * stiffness - sim.vy * damping;
        sim.vx += ax * dt;
        sim.vy += ay * dt;
        sim.x += sim.vx * dt;
        sim.y += sim.vy * dt;

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
        const breezeForce =
          Math.sin(sim.time * 1.35) * 3.6 + Math.sin(sim.time * 0.72 + 1.1) * 1.8;
        const restK = 44;
        const dampXY = 5.4;
        const ax = -sim.x * restK - sim.vx * dampXY + breezeForce * 4.2;
        const ay = -sim.y * (restK * 1.45) - sim.vy * (dampXY * 1.15);

        sim.vx += ax * dt;
        sim.vy += ay * dt;
        sim.x += sim.vx * dt;
        sim.y += sim.vy * dt;

        const targetZ = clamp(-sim.x * 0.24 - sim.vx * 0.03 + breezeForce * 0.35, -30, 30);
        sim.vRotZ += ((targetZ - sim.rotZ) * 65 - sim.vRotZ * 6.8) * dt;
        sim.rotZ += sim.vRotZ * dt;

        const targetX = clamp(-sim.vy * 0.032 - sim.y * 0.12, -16, 16);
        sim.vRotX += ((targetX - sim.rotX) * 70 - sim.vRotX * 7.5) * dt;
        sim.rotX += sim.vRotX * dt;

        const breezeYaw = Math.sin(sim.time * 1.1 + 0.4) * 3;
        const desiredY = sim.targetFlipDeg + breezeYaw;
        sim.vRotY += ((desiredY - sim.rotY) * 76 - sim.vRotY * 7.2) * dt;
        sim.rotY += sim.vRotY * dt;
      }

      const targetMid1X = sim.x * 0.28 + Math.sin(sim.time * 1.35) * 1.1;
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
      });

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
      alive = false;
      cancelAnimationFrame(rafId);
    };
  }, [interactive, strapRestLength]);

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
            const dir: 1 | -1 = sim.grabLocalX < 0 ? -1 : 1;
            triggerFlip(dir);
            return;
          }

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
  const initials = extractInitials(displayName);
  const displayOfficeCode = officeCode.trim().toUpperCase() || 'OFFICE';
  const displayOfficeName = officeName?.trim() || displayOfficeCode;
  const displayPosition = position.trim() || 'Position';
  const displayRole = roleLabel?.trim() || 'Staff';
  const displayId = formatMaskedIdentifier(employeeId, masked);
  const displayEmail =
    email && email.trim()
      ? masked
        ? `•••@${email.split('@')[1] || 'tracely.app'}`
        : email.trim()
      : 'Verified account';

  const primarySubtitle = showMetricsMode
    ? `${(activeDocsCount ?? 0).toLocaleString()} Active · ${(completedDocsCount ?? 0).toLocaleString()} Done`
    : displayPosition;

  const barcodeBars = useMemo(
    () => buildBarcodePattern(`${displayId}-${displayName}`),
    [displayId, displayName],
  );

  const normalizedRotY = ((phys.rotY % 360) + 360) % 360;
  const showingBackVisually = normalizedRotY > 90 && normalizedRotY < 270;
  const backPointerEvents = flipped ? 'auto' : 'none';
  const frontPointerEvents = flipped ? 'none' : 'auto';

  const anchorX = stageWidth / 2;
  const clampEndX = anchorX + phys.x;
  const clampEndY = Math.max(22, strapRestLength + phys.y);
  const c1x = anchorX + phys.mid1X;
  const c1y = phys.mid1Y;
  const c2x = anchorX + phys.mid2X;
  const c2y = phys.mid2Y;

  const strapPath = `M ${anchorX} -8 C ${c1x} ${c1y}, ${c2x} ${c2y}, ${clampEndX} ${clampEndY - 8}`;
  const strapStitchLeft = `M ${anchorX - 8} -8 C ${c1x - 8} ${c1y}, ${c2x - 8} ${c2y}, ${clampEndX - 8} ${clampEndY - 8}`;
  const strapStitchRight = `M ${anchorX + 8} -8 C ${c1x + 8} ${c1y}, ${c2x + 8} ${c2y}, ${clampEndX + 8} ${clampEndY - 8}`;

  const cardTop = strapRestLength + 2;

  return (
    <View testID={testID} style={styles.root}>
      {liveSyncBadge ? (
        <View style={styles.liveBadgeRow}>
          <View style={[styles.liveDot, { backgroundColor: palette.headerBase }]} />
          <Text style={[styles.liveBadgeText, { color: palette.controlInk }]}>
            {liveSyncBadge}
          </Text>
        </View>
      ) : null}

      <View
        testID={`${testID}-lanyard-stage`}
        onLayout={handleStageLayout}
        style={[
          styles.lanyardStage,
          { height: stageHeight, backgroundColor: palette.stageTint },
        ]}
      >
        {/* Woven Lanyard Ribbon & Silver Clamp */}
        <View pointerEvents="none" style={styles.strapSvgOverlay}>
          <Svg width={stageWidth} height={stageHeight} testID={`${testID}-strap`}>
            <Defs>
              <LinearGradient id={strapGradId} x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={palette.strapEdge} />
                <Stop offset="0.24" stopColor={palette.strapColor} />
                <Stop offset="0.5" stopColor={palette.headerLight} />
                <Stop offset="0.76" stopColor={palette.strapColor} />
                <Stop offset="1" stopColor={palette.strapEdge} />
              </LinearGradient>
              <LinearGradient id={metalGradId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#F3F5F8" />
                <Stop offset="0.45" stopColor="#CFD6E0" />
                <Stop offset="0.82" stopColor="#94A0B2" />
                <Stop offset="1" stopColor="#E2E8F0" />
              </LinearGradient>
            </Defs>

            <Path
              d={`M ${anchorX + 2} -8 C ${c1x + 2} ${c1y + 2}, ${c2x + 2} ${c2y + 2}, ${clampEndX + 2} ${clampEndY - 6}`}
              fill="none"
              stroke="rgba(15, 23, 42, 0.12)"
              strokeWidth={24}
              strokeLinecap="butt"
            />
            <Path
              d={strapPath}
              fill="none"
              stroke={`url(#${strapGradId})`}
              strokeWidth={22}
              strokeLinecap="butt"
            />
            <Path
              d={strapStitchLeft}
              fill="none"
              stroke="rgba(255, 255, 255, 0.3)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <Path
              d={strapStitchRight}
              fill="none"
              stroke="rgba(255, 255, 255, 0.3)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />

            <Path
              d={`M ${clampEndX - 14} ${clampEndY - 12} L ${clampEndX + 14} ${clampEndY - 12} L ${clampEndX + 11} ${clampEndY - 1} Q ${clampEndX} ${clampEndY + 2} ${clampEndX - 11} ${clampEndY - 1} Z`}
              fill={`url(#${metalGradId})`}
              stroke="#94A3B8"
              strokeWidth={0.9}
              transform={`rotate(${phys.clampAngleDeg}, ${clampEndX}, ${clampEndY})`}
            />
            <Circle
              cx={clampEndX}
              cy={clampEndY + 4}
              r={5.5}
              fill="none"
              stroke={`url(#${metalGradId})`}
              strokeWidth={2.4}
              transform={`rotate(${phys.clampAngleDeg}, ${clampEndX}, ${clampEndY})`}
            />
          </Svg>
        </View>

        {/* Hanging Vertical Identification Card */}
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
          {/* FRONT FACE: Clean Vertical PVC Identification Card */}
          <View
            testID={`${testID}-inner-card`}
            pointerEvents={frontPointerEvents}
            style={[
              styles.idCardShell,
              {
                opacity: showingBackVisually ? 0 : 1,
                transform: [{ perspective: 1000 }, { rotateY: `${phys.rotY.toFixed(2)}deg` }],
              },
            ]}
          >
            {/* Header Color Band */}
            <View style={[styles.idHeaderBand, { backgroundColor: palette.headerBase }]}>
              <View style={styles.idSlotCutout} />
              <View style={styles.idHeaderRow}>
                <View>
                  <Text style={styles.idBrandMark}>TRACELY</Text>
                  <Text style={styles.idBrandSub}>ID CARD</Text>
                </View>
                <View style={styles.idOfficePill}>
                  <Text testID={`${testID}-office`} numberOfLines={1} style={styles.idOfficeText}>
                    {displayOfficeCode}
                  </Text>
                </View>
              </View>
            </View>

            {/* Portrait Initials Avatar Overlapping Header */}
            <View style={styles.avatarWrap}>
              <View
                style={[
                  styles.avatarCircle,
                  {
                    backgroundColor: palette.tintBg,
                    borderColor: palette.headerBase,
                  },
                ]}
              >
                <Text style={[styles.avatarInitials, { color: palette.headerBase }]}>
                  {initials}
                </Text>
              </View>
            </View>

            {/* Primary Identity Info */}
            <View style={styles.idBody}>
              <Text testID={`${testID}-name`} numberOfLines={1} style={styles.idNameText}>
                {displayName}
              </Text>
              <Text
                testID={`${testID}-position`}
                numberOfLines={1}
                style={[styles.idPositionText, { color: palette.headerBase }]}
              >
                {primarySubtitle}
              </Text>
              <Text testID={`${testID}-caption`} numberOfLines={1} style={styles.idOfficeNameText}>
                {displayOfficeName}
              </Text>

              <View style={styles.idFieldBox}>
                <View style={styles.idFieldRow}>
                  <Text style={styles.idFieldLabel}>ID NO.</Text>
                  <Text
                    testID={`${testID}-employee-id`}
                    numberOfLines={1}
                    style={styles.idFieldMono}
                  >
                    {displayId}
                  </Text>
                </View>
                <View style={styles.idFieldDivider} />
                <View style={styles.idFieldRow}>
                  <Text style={styles.idFieldLabel}>ROLE</Text>
                  <Text numberOfLines={1} style={styles.idFieldValue}>
                    {displayRole}
                  </Text>
                </View>
              </View>

              {/* Barcode Strip */}
              <View style={styles.barcodeWrap}>
                <Svg width={132} height={16} viewBox="0 0 132 16">
                  {barcodeBars.map((bar, idx) => (
                    <Rect
                      key={idx}
                      x={bar.x}
                      y={0}
                      width={bar.w}
                      height={16}
                      rx={0.5}
                      fill="#0F172A"
                      fillOpacity={0.82}
                    />
                  ))}
                </Svg>
              </View>
            </View>

            {/* Bottom Accent Bar */}
            <View style={[styles.idFooterBar, { backgroundColor: palette.headerBase }]} />
          </View>

          {/* BACK FACE: Verified Custody Pass Back */}
          <View
            testID={`${testID}-back-face`}
            pointerEvents={backPointerEvents}
            style={[
              styles.idCardShell,
              {
                opacity: showingBackVisually ? 1 : 0,
                transform: [
                  { perspective: 1000 },
                  { rotateY: `${(phys.rotY + 180).toFixed(2)}deg` },
                ],
              },
            ]}
          >
            <View style={styles.magStripe} />

            <View style={styles.backBody}>
              <Text
                numberOfLines={1}
                style={[styles.backEyebrow, { color: palette.headerBase }]}
              >
                TRACELY VERIFIED CUSTODY PASS
              </Text>

              <Text numberOfLines={1} style={styles.backName}>
                {displayName}
              </Text>
              <Text numberOfLines={1} style={styles.backSub}>
                {displayOfficeCode} · {displayOfficeName}
              </Text>

              <View style={styles.backMetaList}>
                <View style={styles.backMetaRow}>
                  <Text style={styles.backMetaLabel}>ID</Text>
                  <Text numberOfLines={1} style={styles.backMetaMono}>
                    {displayId}
                  </Text>
                </View>
                <View style={styles.backMetaRow}>
                  <Text style={styles.backMetaLabel}>ROLE</Text>
                  <Text numberOfLines={1} style={styles.backMetaValue}>
                    {displayRole}
                  </Text>
                </View>
                <View style={styles.backMetaRow}>
                  <Text style={styles.backMetaLabel}>EMAIL</Text>
                  <Text numberOfLines={1} style={styles.backMetaValue}>
                    {displayEmail}
                  </Text>
                </View>
              </View>

              <View style={styles.backStatsRow}>
                <View
                  style={[
                    styles.backStatTile,
                    { backgroundColor: palette.tintBg, borderColor: palette.tintBorder },
                  ]}
                >
                  <Text style={styles.backStatLabel}>Active</Text>
                  <Text style={[styles.backStatValue, { color: palette.headerBase }]}>
                    {(activeDocsCount ?? 0).toLocaleString()}
                  </Text>
                </View>
                <View
                  style={[
                    styles.backStatTile,
                    { backgroundColor: palette.tintBg, borderColor: palette.tintBorder },
                  ]}
                >
                  <Text style={styles.backStatLabel}>Done</Text>
                  <Text style={[styles.backStatValue, { color: palette.headerBase }]}>
                    {(completedDocsCount ?? 0).toLocaleString()}
                  </Text>
                </View>
              </View>

              <Text numberOfLines={1} style={styles.backNotice}>
                Authorized Tracely Identification
              </Text>
            </View>

            <View style={[styles.idFooterBar, { backgroundColor: palette.headerBase }]} />
          </View>
        </View>

        {/* Minimal Floating Corner Controls */}
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
            accessibilityLabel="Flip ID card"
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
    fontSize: 11,
    fontWeight: '700',
  },
  lanyardStage: {
    position: 'relative',
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  idCardShell: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    shadowColor: '#0F172A',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  idHeaderBand: {
    height: 66,
    paddingHorizontal: 11,
    paddingTop: 8,
    paddingBottom: 10,
    justifyContent: 'space-between',
  },
  idSlotCutout: {
    alignSelf: 'center',
    width: 30,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
  },
  idHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  idBrandMark: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10.5,
    fontWeight: '900',
    letterSpacing: 0.9,
    color: '#FFFFFF',
  },
  idBrandSub: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 6.5,
    fontWeight: '700',
    letterSpacing: 1,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  idOfficePill: {
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.32)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    maxWidth: 74,
  },
  idOfficeText: {
    fontFamily: SDO_FONTS.mono,
    fontSize: 8,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  avatarWrap: {
    alignItems: 'center',
    marginTop: -22,
  },
  avatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  avatarInitials: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  idBody: {
    flex: 1,
    paddingHorizontal: 11,
    paddingTop: 6,
    paddingBottom: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  idNameText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  idPositionText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 8.5,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 1,
  },
  idOfficeNameText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 7.5,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  idFieldBox: {
    width: '100%',
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 4,
  },
  idFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  idFieldDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  idFieldLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 6.5,
    fontWeight: '700',
    letterSpacing: 0.7,
    color: '#64748B',
  },
  idFieldMono: {
    fontFamily: SDO_FONTS.mono,
    fontSize: 8,
    fontWeight: '800',
    color: '#0F172A',
    flexShrink: 1,
  },
  idFieldValue: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 7.8,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  barcodeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  idFooterBar: {
    height: 7,
    width: '100%',
  },
  magStripe: {
    height: 22,
    width: '100%',
    backgroundColor: '#0F172A',
    marginTop: 18,
  },
  backBody: {
    flex: 1,
    paddingHorizontal: 11,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  backEyebrow: {
    fontFamily: SDO_FONTS.mono,
    fontSize: 6.8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  backName: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  backSub: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 7.5,
    fontWeight: '600',
    color: '#64748B',
  },
  backMetaList: {
    gap: 4,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  backMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 6,
  },
  backMetaLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 6.5,
    fontWeight: '700',
    color: '#64748B',
  },
  backMetaMono: {
    fontFamily: SDO_FONTS.mono,
    fontSize: 7.8,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  backMetaValue: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 7.5,
    fontWeight: '600',
    color: '#0F172A',
    flexShrink: 1,
  },
  backStatsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  backStatTile: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 5,
  },
  backStatLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 7,
    fontWeight: '700',
    color: '#475569',
  },
  backStatValue: {
    fontFamily: SDO_FONTS.mono,
    fontSize: 11.5,
    fontWeight: '800',
    marginTop: 1,
  },
  backNotice: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 6.8,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
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
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  cornerActionText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
  },
  cornerCircleBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});

export default MobileIdentityWalletCard;
