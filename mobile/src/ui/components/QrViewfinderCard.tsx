import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Flashlight, Keyboard, Pause, QrCode } from 'lucide-react-native';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';

interface QrViewfinderCardProps {
  title?: string;
  subtitle?: string;
  frameCaption?: string;
  frameHeight?: number;
  frameContent?: React.ReactNode;
  isCameraActive?: boolean;
  scanLabel?: string;
  torchOn?: boolean;
  batchMode?: boolean;
  onToggleBatchMode?: () => void;
  onToggleTorch?: () => void;
  onPressScan: () => void;
  onPressEnterCode: () => void;
}

/**
 * Reusable navy QR viewfinder hero card shared by the Dashboard and Scanner screen.
 */
export const QrViewfinderCard: React.FC<QrViewfinderCardProps> = ({
  title = 'Scan to receive',
  subtitle = 'Point at a document QR or a desktop attach code.',
  frameCaption = 'Align the QR inside the frame',
  frameHeight = 168,
  frameContent,
  isCameraActive = false,
  scanLabel = 'Scan QR',
  torchOn: controlledTorch,
  batchMode = false,
  onToggleBatchMode,
  onToggleTorch,
  onPressScan,
  onPressEnterCode,
}) => {
  const [internalTorch, setInternalTorch] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const torchOn = controlledTorch !== undefined ? controlledTorch : internalTorch;
  const cameraShowing = isCameraActive || Boolean(frameContent);
  const isPauseAction = scanLabel === 'Pause Scan';
  const sweepAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotion(Boolean(enabled));
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setReduceMotion(Boolean(enabled));
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      sweepAnim.setValue(0.5);
      return;
    }

    const durationMs = cameraShowing ? 1450 : 2300;
    sweepAnim.setValue(0);
    const sweepLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweepAnim, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(sweepAnim, {
          toValue: 0,
          duration: durationMs,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    sweepLoop.start();

    return () => {
      sweepLoop.stop();
    };
  }, [cameraShowing, reduceMotion, sweepAnim]);

  const topPad = 24;
  const bottomPad = cameraShowing ? 42 : 40;
  const travelDistance = Math.max(frameHeight - topPad - bottomPad, 40);
  const scanLineTranslateY = sweepAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [topPad, topPad + travelDistance],
  });

  const handleTorchPress = () => {
    if (onToggleTorch) {
      onToggleTorch();
    } else {
      setInternalTorch((v) => !v);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <View style={styles.headerActions}>
          {onToggleBatchMode ? (
            <Pressable
              onPress={onToggleBatchMode}
              accessibilityLabel="Toggle batch scan mode"
              style={[styles.batchBtn, batchMode && styles.batchBtnOn]}
            >
              <Text style={[styles.batchBtnText, batchMode && styles.batchBtnTextOn]}>
                {batchMode ? 'Batch On' : 'Batch'}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleTorchPress}
            accessibilityLabel="Toggle flashlight"
            style={[styles.torchBtn, torchOn && styles.torchBtnOn]}
          >
            <Flashlight size={18} color={torchOn ? SDO_COLORS.navyInk : '#FFFFFF'} />
          </Pressable>
        </View>
      </View>

      <View collapsable={false} style={[styles.frame, { height: frameHeight }]}>
        {frameContent ? (
          <View collapsable={false} style={StyleSheet.absoluteFill}>
            {frameContent}
          </View>
        ) : (
          <View collapsable={false} style={styles.pausedFill} />
        )}
        <View style={styles.frameOverlay} pointerEvents="none">
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
          <Animated.View
            style={[
              styles.scanLine,
              cameraShowing && styles.scanLineActive,
              { transform: [{ translateY: scanLineTranslateY }] },
            ]}
          />
          <Text style={[styles.frameCaption, cameraShowing && styles.frameCaptionOverlay]}>
            {frameCaption}
          </Text>
        </View>
      </View>

      <View style={styles.ctaRow}>
        <Pressable onPress={onPressScan} style={styles.scanBtn}>
          {isPauseAction ? (
            <Pause size={16} color={SDO_COLORS.navyInk} />
          ) : (
            <QrCode size={16} color={SDO_COLORS.navyInk} />
          )}
          <Text style={styles.scanBtnText}>{scanLabel}</Text>
        </Pressable>
        <Pressable onPress={onPressEnterCode} style={styles.codeBtn}>
          <Keyboard size={16} color="#FFFFFF" />
          <Text style={styles.codeBtnText}>Enter code</Text>
        </Pressable>
      </View>
    </View>
  );
};

const CORNER_SIZE = 22;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: SDO_COLORS.navy,
    padding: 18,
    gap: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: '#CBD5E1',
  },
  torchBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  batchBtn: {
    height: 38,
    borderRadius: 19,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  batchBtnOn: {
    backgroundColor: SDO_COLORS.amber,
  },
  batchBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  batchBtnTextOn: {
    color: SDO_COLORS.navyInk,
  },
  torchBtnOn: {
    backgroundColor: SDO_COLORS.amber,
  },
  frame: {
    height: 168,
    borderRadius: 18,
    backgroundColor: SDO_COLORS.navyDeep,
    overflow: 'hidden',
    position: 'relative',
  },
  pausedFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: SDO_COLORS.navyDeep,
  },
  frameOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 16,
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: SDO_COLORS.amber,
  },
  cornerTL: {
    top: 16,
    left: 18,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 16,
    right: 18,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 16,
    left: 18,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 16,
    right: 18,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: 6,
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 28,
    right: 28,
    height: 2,
    borderRadius: 1,
    backgroundColor: SDO_COLORS.amber,
    opacity: 0.78,
  },
  scanLineActive: {
    height: 2.5,
    left: 24,
    right: 24,
    opacity: 1,
  },
  frameCaption: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: '#CBD5E1',
  },
  frameCaptionOverlay: {
    fontWeight: '600',
    color: '#F8FAFC',
    backgroundColor: 'rgba(6, 20, 48, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  scanBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  scanBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  codeBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  codeBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
