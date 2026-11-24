import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { ArrowUpRight, X } from 'lucide-react-native';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';

export interface MobileFolderSheetItem {
  readonly id?: string;
  readonly docId?: string;
  readonly bucketId?: string;
  readonly isOverflowSheet?: boolean;
  readonly title?: string;
  readonly description?: string;
}

export interface MobileFolderProps {
  readonly items?: ReadonlyArray<MobileFolderSheetItem>;
  readonly label?: string;
  readonly mode?: 'flap' | 'book';
  readonly variant?: 'solid' | 'glass' | 'matte';
  readonly layout?: 'spread' | 'stack' | 'row';
  readonly color?: string;
  readonly open?: boolean;
  readonly defaultOpen?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
  readonly onItemClick?: (item: MobileFolderSheetItem, index: number) => void;
  readonly onOpenDocument?: (docId: string) => void;
  readonly testID?: string;
}

const MAX_ITEMS = 6;

const DEFAULT_ITEMS: ReadonlyArray<MobileFolderSheetItem> = [
  { title: 'Brand guidelines' },
  { title: 'Launch plan' },
  { title: 'Moodboard' },
];

function darkenHex(hex: string, ratio: number): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return hex;
  const r = Math.max(0, Math.round(parseInt(clean.slice(0, 2), 16) * (1 - ratio)));
  const g = Math.max(0, Math.round(parseInt(clean.slice(2, 4), 16) * (1 - ratio)));
  const b = Math.max(0, Math.round(parseInt(clean.slice(4, 6), 16) * (1 - ratio)));
  return `rgb(${r}, ${g}, ${b})`;
}

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim();
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface SheetPose {
  readonly dx: number;
  readonly dy: number;
  readonly rot: string;
}

// Resting tucked poses matching Web FLAP_REST
const SHELF_REST_POSES: ReadonlyArray<SheetPose> = [
  { dx: 12, dy: 2, rot: '3deg' },
  { dx: -13, dy: -2, rot: '-3.5deg' },
  { dx: 0, dy: -6, rot: '0.5deg' },
  { dx: 18, dy: -4, rot: '5deg' },
  { dx: -18, dy: -5, rot: '-5.5deg' },
  { dx: 6, dy: -8, rot: '1.5deg' },
];

// Full-scale open poses mirroring React Bits Web <Folder /> spread / stack / row
const STAGE_REST_POSES: ReadonlyArray<SheetPose> = [
  { dx: 16, dy: 8, rot: '3deg' },
  { dx: -16, dy: 4, rot: '-3.5deg' },
  { dx: 0, dy: 0, rot: '0.5deg' },
  { dx: 24, dy: 2, rot: '5deg' },
  { dx: -24, dy: 2, rot: '-5.5deg' },
  { dx: 8, dy: -2, rot: '1.5deg' },
];

function computeStageOpenPose(
  index: number,
  total: number,
  layout: 'spread' | 'stack' | 'row',
): SheetPose {
  if (layout === 'stack') {
    const step = total > 1 ? index - (total - 1) / 2 : 0;
    return {
      dx: Math.round(step * 14),
      dy: -108 - index * 14,
      rot: `${(step * 2.2).toFixed(1)}deg`,
    };
  }

  if (layout === 'row') {
    const cols = Math.min(3, Math.max(1, total));
    const row = Math.floor(index / cols);
    const col = index % cols;
    const rowCount = Math.min(cols, total - row * cols);
    const centeredCol = col - (rowCount - 1) / 2;
    return {
      dx: Math.round(centeredCol * 112),
      dy: row === 0 ? -138 : -6,
      rot: '0deg',
    };
  }

  // Default 'spread' — generous Web-style 2-tier arc fan so every document card is crisp & readable
  if (total <= 3) {
    const spreadStep = index - (total - 1) / 2;
    const arcLift = Math.abs(spreadStep) * 16;
    return {
      dx: Math.round(spreadStep * 104),
      dy: -124 + arcLift,
      rot: `${(spreadStep * 7.5).toFixed(1)}deg`,
    };
  }

  const topCount = Math.ceil(total / 2);
  const isTopRow = index < topCount;
  const rowLen = isTopRow ? topCount : total - topCount;
  const rowIdx = isTopRow ? index : index - topCount;
  const centered = rowIdx - (rowLen - 1) / 2;
  const arcDrop = Math.abs(centered) * 14;
  return {
    dx: Math.round(centered * 108),
    dy: (isTopRow ? -168 : -44) + arcDrop,
    rot: `${(centered * 6.5).toFixed(1)}deg`,
  };
}

interface StageSheetProps {
  readonly item: MobileFolderSheetItem;
  readonly index: number;
  readonly total: number;
  readonly openAnim: Animated.Value;
  readonly layout: 'spread' | 'stack' | 'row';
  readonly isZoomed: boolean;
  readonly testID?: string;
  readonly onPress: () => void;
}

const StageDraggableSheet: React.FC<StageSheetProps> = ({
  item,
  index,
  total,
  openAnim,
  layout,
  isZoomed,
  testID,
  onPress,
}) => {
  const dragXY = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderMove: (_evt, gesture) => {
          dragXY.setValue({
            x: Math.max(-130, Math.min(130, gesture.dx)),
            y: Math.max(-140, Math.min(120, gesture.dy)),
          });
        },
        onPanResponderRelease: (_evt, gesture) => {
          Animated.spring(dragXY, {
            toValue: { x: 0, y: 0 },
            velocity: { x: gesture.vx * 0.3, y: gesture.vy * 0.3 },
            stiffness: 165,
            damping: 14,
            mass: 0.85,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(dragXY, {
            toValue: { x: 0, y: 0 },
            stiffness: 165,
            damping: 14,
            mass: 0.85,
            useNativeDriver: true,
          }).start();
        },
      }),
    [dragXY],
  );

  const safeIdx = index % MAX_ITEMS;
  const rest = STAGE_REST_POSES[safeIdx];
  const openPose = computeStageOpenPose(index, total, layout);

  const tx = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [rest.dx, openPose.dx],
  });
  const ty = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [rest.dy, openPose.dy],
  });
  const rot = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [rest.rot, isZoomed ? '0deg' : openPose.rot],
  });
  const scale = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, isZoomed ? 1.06 : 1],
  });

  const isOverflow = Boolean(item.isOverflowSheet);

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.stageSheetWrap,
        isZoomed ? styles.stageSheetZoomed : null,
        {
          transform: [
            { translateX: Animated.add(tx, dragXY.x) },
            { translateY: Animated.add(ty, dragXY.y) },
            { rotate: rot },
            { scale },
          ],
        },
      ]}
    >
      <Pressable
        testID={testID}
        onPress={onPress}
        style={[
          styles.stageSheetCard,
          isOverflow ? styles.stageSheetOverflow : null,
          isZoomed ? styles.stageSheetSelected : null,
        ]}
      >
        <Text
          numberOfLines={2}
          style={[styles.stageSheetTitle, isOverflow ? styles.sheetTitleOverflow : null]}
        >
          {item.title ?? 'Document'}
        </Text>
        {item.description ? (
          <Text numberOfLines={2} style={styles.stageSheetDesc}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.stageSheetHeadingBar} />
        <View style={styles.sheetLineWide} />
        <View style={styles.sheetLineMid} />
        <View style={styles.stageSheetBlock} />
      </Pressable>
    </Animated.View>
  );
};

export const MobileFolder: React.FC<MobileFolderProps> = ({
  items,
  label,
  mode = 'flap',
  variant = 'solid',
  layout = 'spread',
  color = '#0ea5e9',
  open,
  defaultOpen = false,
  onOpenChange,
  onItemClick,
  onOpenDocument,
  testID,
}) => {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? Boolean(open) : internalOpen;

  const openAnim = useRef(new Animated.Value(isOpen ? 1 : 0)).current;

  useEffect(() => {
    if (!isOpen) {
      setZoomedIndex(null);
    }
    if (typeof jest !== 'undefined') {
      openAnim.setValue(isOpen ? 1 : 0);
      return;
    }
    if (isOpen) {
      openAnim.setValue(0);
      Animated.spring(openAnim, {
        toValue: 1,
        stiffness: 150,
        damping: 14,
        mass: 0.9,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.spring(openAnim, {
        toValue: 0,
        stiffness: 185,
        damping: 17,
        mass: 0.85,
        useNativeDriver: true,
      }).start();
    }
  }, [isOpen, openAnim]);

  const entries = (items && items.length > 0 ? items : DEFAULT_ITEMS).slice(0, MAX_ITEMS);
  const backColor = darkenHex(color, 0.16);
  const frontColor =
    variant === 'glass'
      ? withAlpha(color, 0.56)
      : variant === 'matte'
        ? darkenHex(color, 0.08)
        : color;

  const setOpenState = (next: boolean) => {
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
  };

  const toggleOpen = () => {
    setOpenState(!isOpen);
  };

  const flapRotateX = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-62deg'],
  });
  const flapDropY = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 26],
  });
  const bookRotateY = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-145deg'],
  });
  const bookShiftX = openAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -86],
  });

  const shelfBackPath =
    'M 0 24 Q 0 14 10 14 L 58 14 C 66 14 66 0 74 0 L 142 0 C 150 0 150 14 158 14 L 146 14 Q 156 14 156 24 L 156 116 Q 156 126 146 126 L 10 126 Q 0 126 0 116 Z';
  const stageBackPath =
    'M 0 34 Q 0 20 14 20 L 82 20 C 92 20 92 0 104 0 L 204 0 C 216 0 216 20 226 20 L 210 20 Q 224 20 224 34 L 224 164 Q 224 178 210 178 L 14 178 Q 0 178 0 164 Z';

  const zoomedItem = zoomedIndex !== null ? entries[zoomedIndex] ?? null : null;

  return (
    <View testID={testID} style={styles.root}>
      {/* Compact Shelf Folder Preview (Tap to Open Web-Parity Interactive Folder Stage) */}
      <Pressable
        testID={testID ? `${testID}-toggle` : undefined}
        onPress={toggleOpen}
        accessibilityRole="button"
        accessibilityLabel={label ? `${label} folder` : 'Folder'}
        style={styles.stage}
      >
        <View style={styles.groundShadow} />

        <View style={styles.backLayer}>
          <Svg width={156} height={126} viewBox="0 0 156 126">
            <Path d={shelfBackPath} fill={backColor} />
          </Svg>
          {label ? (
            <View style={styles.tabLabelBox}>
              <Text numberOfLines={1} style={styles.tabLabelText}>
                {label}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Tucked miniature sheets peeking out of closed folder */}
        {entries.slice(0, 4).map((item, idx) => {
          const pose = SHELF_REST_POSES[idx % SHELF_REST_POSES.length];
          return (
            <View
              key={item.id ?? idx}
              pointerEvents="none"
              style={[
                styles.shelfSheetWrap,
                {
                  transform: [
                    { translateX: pose.dx },
                    { translateY: pose.dy },
                    { rotate: pose.rot },
                  ],
                },
              ]}
            >
              <View style={[styles.shelfSheetCard, item.isOverflowSheet && styles.stageSheetOverflow]}>
                <Text numberOfLines={1} style={styles.shelfSheetTitle}>
                  {item.title ?? 'Document'}
                </Text>
                <View style={styles.sheetLineWide} />
                <View style={styles.sheetLineMid} />
              </View>
            </View>
          );
        })}

        {/* Shelf Front Flap / Cover */}
        <View
          pointerEvents="none"
          style={[
            styles.frontLayer,
            mode === 'book' ? styles.frontLayerBook : null,
            variant === 'glass' ? styles.frontLayerGlass : null,
            { backgroundColor: frontColor },
          ]}
        >
          {variant !== 'matte' ? (
            <View
              style={[
                styles.frontSheen,
                variant === 'glass' ? styles.frontSheenGlass : null,
              ]}
            />
          ) : null}
        </View>
      </Pressable>

      {/* Web-Parity Expanded Interactive Folder Stage (Displays all fanned-out documents cleanly) */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpenState(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            accessibilityLabel="Close open folder"
            onPress={() => {
              if (zoomedIndex !== null) {
                setZoomedIndex(null);
              } else {
                setOpenState(false);
              }
            }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.modalHeaderBar}>
            <View style={styles.modalHeaderBadge}>
              <Text style={styles.modalHeaderTitle}>{label ?? 'Folder'}</Text>
            </View>
            <Pressable
              testID={testID ? `${testID}-close-stage` : undefined}
              onPress={() => setOpenState(false)}
              accessibilityLabel="Close folder view"
              style={styles.modalCloseBtn}
            >
              <X size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Center 3D Web-Scale Folder + Fanned Interactive Sheets */}
          <View style={styles.expandedCenterWrap} pointerEvents="box-none">
            <View style={styles.expandedFolderStage}>
              <View style={styles.expandedGroundShadow} />

              {/* Expanded Folder Back Plate + Tab */}
              <Pressable
                onPress={() => {
                  if (zoomedIndex !== null) {
                    setZoomedIndex(null);
                  } else {
                    setOpenState(false);
                  }
                }}
                style={styles.expandedBackLayer}
              >
                <Svg width={224} height={178} viewBox="0 0 224 178">
                  <Path d={stageBackPath} fill={backColor} />
                </Svg>
                {label ? (
                  <View style={styles.expandedTabLabelBox}>
                    <Text numberOfLines={1} style={styles.expandedTabLabelText}>
                      {label}
                    </Text>
                  </View>
                ) : null}
              </Pressable>

              {/* All Up-to-6 Interactive Draggable & Zoomable Document Sheets */}
              {entries.map((item, idx) => (
                <StageDraggableSheet
                  key={item.id ?? idx}
                  item={item}
                  index={idx}
                  total={entries.length}
                  openAnim={openAnim}
                  layout={layout}
                  isZoomed={zoomedIndex === idx}
                  testID={testID ? `${testID}-sheet-${idx}` : undefined}
                  onPress={() => {
                    if (item.isOverflowSheet) {
                      setOpenState(false);
                      onItemClick?.(item, idx);
                      return;
                    }
                    setZoomedIndex((prev) => (prev === idx ? null : idx));
                    onItemClick?.(item, idx);
                  }}
                />
              ))}

              {/* Spring-Animated Expanded Front Flap / Book Cover */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.expandedFrontLayer,
                  mode === 'book' ? styles.expandedFrontBook : null,
                  variant === 'glass' ? styles.frontLayerGlass : null,
                  {
                    backgroundColor: frontColor,
                    transform:
                      mode === 'book'
                        ? [
                            { perspective: 900 },
                            { translateX: bookShiftX },
                            { rotateY: bookRotateY },
                          ]
                        : [
                            { perspective: 900 },
                            { translateY: flapDropY },
                            { rotateX: flapRotateX },
                          ],
                  },
                ]}
              >
                {variant !== 'matte' ? (
                  <View
                    style={[
                      styles.frontSheen,
                      variant === 'glass' ? styles.frontSheenGlass : null,
                    ]}
                  />
                ) : null}
              </Animated.View>
            </View>
          </View>

          {/* Zoomed Document Sheet Focus Card (Web zoomOnClick parity) */}
          {zoomedItem ? (
            <View testID={testID ? `${testID}-zoomed-card` : undefined} style={styles.zoomOverlayWrap}>
              <View style={styles.zoomCard}>
                <View style={styles.zoomCardTop}>
                  <Text style={styles.zoomCardEyebrow}>DOCUMENT PREVIEW</Text>
                  <Pressable onPress={() => setZoomedIndex(null)} style={styles.zoomDismissBtn}>
                    <X size={14} color={SDO_COLORS.textSecondary} />
                  </Pressable>
                </View>
                <Text style={styles.zoomCardTitle}>{zoomedItem.title ?? 'Document'}</Text>
                {zoomedItem.description ? (
                  <Text style={styles.zoomCardDesc}>{zoomedItem.description}</Text>
                ) : null}
                <View style={styles.zoomDocLines}>
                  <View style={styles.zoomHeadingBar} />
                  <View style={styles.sheetLineWide} />
                  <View style={styles.sheetLineMid} />
                  <View style={styles.zoomPreviewBlock} />
                </View>
                <View style={styles.zoomActionsRow}>
                  {zoomedItem.docId && onOpenDocument ? (
                    <Pressable
                      testID={testID ? `${testID}-zoom-open-btn` : undefined}
                      onPress={() => {
                        const targetId = zoomedItem.docId;
                        setZoomedIndex(null);
                        setOpenState(false);
                        if (targetId) onOpenDocument(targetId);
                      }}
                      style={styles.zoomPrimaryBtn}
                    >
                      <Text style={styles.zoomPrimaryBtnText}>Open Document</Text>
                      <ArrowUpRight size={14} color="#FFFFFF" />
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={() => setZoomedIndex(null)}
                    style={styles.zoomSecondaryBtn}
                  >
                    <Text style={styles.zoomSecondaryBtnText}>Put Back</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    width: 164,
    height: 146,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
  },
  stage: {
    width: 156,
    height: 126,
    position: 'relative',
  },
  groundShadow: {
    position: 'absolute',
    bottom: 2,
    left: 14,
    right: 14,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(13, 35, 71, 0.14)',
  },
  backLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 156,
    height: 126,
  },
  tabLabelBox: {
    position: 'absolute',
    top: 1,
    left: 68,
    width: 82,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabLabelText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 8.5,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.1,
  },
  shelfSheetWrap: {
    position: 'absolute',
    left: 36,
    top: 22,
    zIndex: 10,
  },
  shelfSheetCard: {
    width: 84,
    height: 82,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.12)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  shelfSheetTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 7.5,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
    marginBottom: 4,
  },
  sheetTitleOverflow: {
    color: '#0284C7',
  },
  sheetLineWide: {
    width: '90%',
    height: 3.5,
    borderRadius: 99,
    backgroundColor: 'rgba(15, 23, 42, 0.1)',
    marginBottom: 4,
  },
  sheetLineMid: {
    width: '72%',
    height: 3.5,
    borderRadius: 99,
    backgroundColor: 'rgba(15, 23, 42, 0.1)',
    marginBottom: 5,
  },
  frontLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 78,
    borderRadius: 10,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
    zIndex: 25,
  },
  frontLayerBook: {
    height: 110,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  frontLayerGlass: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  frontSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  frontSheenGlass: {
    height: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 22, 46, 0.58)',
    justifyContent: 'space-between',
    paddingVertical: 48,
    paddingHorizontal: 16,
  },
  modalHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 60,
  },
  modalHeaderBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  modalHeaderTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  expandedCenterWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 62,
  },
  expandedFolderStage: {
    width: 224,
    height: 178,
    position: 'relative',
  },
  expandedGroundShadow: {
    position: 'absolute',
    bottom: -4,
    left: 16,
    right: 16,
    height: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.32)',
  },
  expandedBackLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 224,
    height: 178,
    zIndex: 4,
  },
  expandedTabLabelBox: {
    position: 'absolute',
    top: 2,
    left: 96,
    width: 118,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  expandedTabLabelText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  stageSheetWrap: {
    position: 'absolute',
    left: 59,
    top: 26,
    zIndex: 20,
  },
  stageSheetZoomed: {
    zIndex: 55,
  },
  stageSheetCard: {
    width: 106,
    height: 126,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.14)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  stageSheetOverflow: {
    backgroundColor: '#F0F9FF',
    borderColor: '#38BDF8',
  },
  stageSheetSelected: {
    borderColor: '#0EA5E9',
    borderWidth: 2,
  },
  stageSheetTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 9.5,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
    lineHeight: 12,
    marginBottom: 3,
  },
  stageSheetDesc: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 7.5,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
    lineHeight: 10,
    marginBottom: 6,
  },
  stageSheetHeadingBar: {
    width: '56%',
    height: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(15, 23, 42, 0.18)',
    marginBottom: 5,
  },
  stageSheetBlock: {
    width: '100%',
    height: 24,
    borderRadius: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.07)',
    marginTop: 2,
  },
  expandedFrontLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 112,
    borderRadius: 14,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.4)',
    zIndex: 40,
  },
  expandedFrontBook: {
    height: 158,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  zoomOverlayWrap: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 34,
    zIndex: 80,
    alignItems: 'center',
  },
  zoomCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  zoomCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  zoomCardEyebrow: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#0284C7',
  },
  zoomDismissBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomCardTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 15,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
    lineHeight: 20,
  },
  zoomCardDesc: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
  },
  zoomDocLines: {
    paddingTop: 4,
    paddingBottom: 6,
  },
  zoomHeadingBar: {
    width: '48%',
    height: 6,
    borderRadius: 99,
    backgroundColor: 'rgba(15, 23, 42, 0.16)',
    marginBottom: 6,
  },
  zoomPreviewBlock: {
    width: '100%',
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.06)',
    marginTop: 4,
  },
  zoomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  zoomPrimaryBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.navyInk,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 14,
  },
  zoomPrimaryBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  zoomSecondaryBtn: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  zoomSecondaryBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
});

export default MobileFolder;
