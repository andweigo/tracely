import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertCircle, Check, Info, X } from 'lucide-react-native';
import type { ToastMessage } from '../../state/AppServiceContext';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';

interface CustomToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

const TONE_SPEC: Record<
  ToastMessage['tone'],
  {
    readonly iconBg: string;
    readonly iconColor: string;
    readonly accentBorder: string;
  }
> = {
  success: {
    iconBg: 'rgba(16, 185, 129, 0.18)',
    iconColor: '#34D399',
    accentBorder: 'rgba(52, 211, 153, 0.28)',
  },
  error: {
    iconBg: 'rgba(244, 63, 94, 0.2)',
    iconColor: '#FB7185',
    accentBorder: 'rgba(251, 113, 133, 0.32)',
  },
  info: {
    iconBg: 'rgba(243, 179, 42, 0.2)',
    iconColor: SDO_COLORS.amber,
    accentBorder: 'rgba(243, 179, 42, 0.3)',
  },
};

/**
 * Floating minimalist toast banner with smooth entrance animation and zero layout shift.
 */
export const CustomToast: React.FC<CustomToastProps> = ({ toast, onDismiss }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-10)).current;

  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    translateY.setValue(-10);

    const anim = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: false,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [toast, opacity, translateY]);

  if (!toast) return null;

  const spec = TONE_SPEC[toast.tone];

  return (
    <View pointerEvents="box-none" style={styles.overlayWrap}>
      <Animated.View
        style={[
          styles.card,
          { borderColor: spec.accentBorder, opacity, transform: [{ translateY }] },
        ]}
      >
        <View style={[styles.iconBadge, { backgroundColor: spec.iconBg }]}>
          {toast.tone === 'success' ? (
            <Check size={14} strokeWidth={2.6} color={spec.iconColor} />
          ) : toast.tone === 'error' ? (
            <AlertCircle size={14} strokeWidth={2.4} color={spec.iconColor} />
          ) : (
            <Info size={14} strokeWidth={2.4} color={spec.iconColor} />
          )}
        </View>

        <Text numberOfLines={3} style={styles.messageText}>
          {toast.text}
        </Text>

        {toast.action ? (
          <Pressable
            onPress={() => {
              const fn = toast.action?.onPress;
              onDismiss();
              fn?.();
            }}
            hitSlop={6}
            style={styles.actionBtn}
          >
            <Text style={styles.actionBtnText}>{toast.action.label}</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          accessibilityLabel="Dismiss notification"
          style={styles.closeBtn}
        >
          <X size={14} color="#94A3B8" />
        </Pressable>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayWrap: {
    position: 'absolute',
    top: 10,
    left: 16,
    right: 16,
    zIndex: 100,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: SDO_COLORS.navyInk,
    paddingHorizontal: 13,
    paddingVertical: 11,
    shadowColor: '#020617',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageText: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17.5,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  actionBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  actionBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
