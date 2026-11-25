import React, { useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, CheckCircle2, Lock, QrCode, Route } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { useAppServices } from '../../state/AppServiceContext';
import { AppIconBadge } from '../components/AppIconBadge';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';

interface OnboardingSlide {
  readonly id: 'track' | 'scan' | 'privacy';
  readonly title: string;
  readonly body: string;
  readonly accent: string;
  readonly softBg: string;
}

const SLIDES: ReadonlyArray<OnboardingSlide> = [
  {
    id: 'track',
    title: 'Know where every\nfile is.',
    body: 'Follow physical and digital documents across offices in real time.',
    accent: '#0D3472',
    softBg: '#EFF6FF',
  },
  {
    id: 'scan',
    title: 'Scan QR to\nreceive.',
    body: 'Confirm handoffs in seconds with your camera, even offline.',
    accent: '#0F766E',
    softBg: '#ECFDF5',
  },
  {
    id: 'privacy',
    title: 'Private by\ndefault.',
    body: 'Restricted files stay visible only to authorized offices.',
    accent: '#B45309',
    softBg: '#FFFBEB',
  },
];

const StepIllustration: React.FC<{ readonly slide: OnboardingSlide }> = ({ slide }) => {
  if (slide.id === 'track') {
    return (
      <View style={[styles.visualCard, { backgroundColor: slide.softBg }]}>
        <Svg width={220} height={116} viewBox="0 0 220 116">
          <Line
            x1="44"
            y1="58"
            x2="176"
            y2="58"
            stroke="#CBD5E1"
            strokeWidth="3"
            strokeDasharray="6 6"
          />
          <Line x1="44" y1="58" x2="112" y2="58" stroke="#0D3472" strokeWidth="3.5" />
          <Circle cx="44" cy="58" r="16" fill="#0D3472" />
          <Circle cx="112" cy="58" r="20" fill="#FFFFFF" stroke="#0D3472" strokeWidth="3.5" />
          <Circle cx="112" cy="58" r="7" fill="#F3B32A" />
          <Circle cx="176" cy="58" r="15" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2.5" />
        </Svg>
        <View style={styles.visualLabelRow}>
          <Route size={15} color={slide.accent} />
          <Text style={[styles.visualLabel, { color: slide.accent }]}>
            Records → Finance → Legal
          </Text>
        </View>
      </View>
    );
  }

  if (slide.id === 'scan') {
    return (
      <View style={[styles.visualCard, { backgroundColor: slide.softBg }]}>
        <View style={styles.qrFrame}>
          <QrCode size={76} color={slide.accent} strokeWidth={1.6} />
          <View style={styles.scanLine} />
        </View>
        <View style={styles.visualLabelRow}>
          <CheckCircle2 size={15} color={slide.accent} />
          <Text style={[styles.visualLabel, { color: slide.accent }]}>Instant QR handoff</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.visualCard, { backgroundColor: slide.softBg }]}>
      <View style={styles.lockStage}>
        <Svg width={170} height={96} viewBox="0 0 170 96">
          <Rect x="16" y="14" width="138" height="22" rx="8" fill="#FFFFFF" stroke="#FDE68A" />
          <Rect x="28" y="22" width="68" height="6" rx="3" fill="#CBD5E1" />
          <Rect x="16" y="46" width="138" height="36" rx="10" fill="#FFFFFF" stroke="#F59E0B" strokeWidth="1.5" />
          <Rect x="28" y="58" width="52" height="6" rx="3" fill="#0D3472" />
          <Rect x="28" y="69" width="84" height="5" rx="2.5" fill="#94A3B8" />
        </Svg>
        <View style={styles.lockBadge}>
          <Lock size={16} color="#FFFFFF" />
        </View>
      </View>
      <View style={styles.visualLabelRow}>
        <Lock size={14} color={slide.accent} />
        <Text style={[styles.visualLabel, { color: slide.accent }]}>Authorized access only</Text>
      </View>
    </View>
  );
};

export const OnboardingScreen: React.FC = () => {
  const { completeOnboarding, isBusy } = useAppServices();
  const insets = useSafeAreaInsets();

  const [stepIndex, setStepIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const shift = useRef(new Animated.Value(0)).current;

  const isLastStep = stepIndex === SLIDES.length - 1;
  const current = SLIDES[stepIndex];

  const goToStep = (nextIndex: number) => {
    if (nextIndex === stepIndex) return;
    const dir = nextIndex > stepIndex ? 1 : -1;
    fade.setValue(0.2);
    shift.setValue(dir * 16);
    setStepIndex(nextIndex);

    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(shift, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handlePrimary = () => {
    if (isLastStep) {
      completeOnboarding('login').catch(() => {});
      return;
    }
    goToStep(stepIndex + 1);
  };

  const handleSkip = () => {
    completeOnboarding('login').catch(() => {});
  };

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: Math.max(insets.top + 14, 24),
          paddingBottom: Math.max(insets.bottom + 20, 28),
        },
      ]}
    >
      {/* Top Bar: Brand + Quiet Skip */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <AppIconBadge size={34} animated={false} interactive={false} />
          <Text style={styles.brandName}>Tracely</Text>
        </View>

        {!isLastStep ? (
          <Pressable
            onPress={handleSkip}
            disabled={isBusy}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            style={styles.skipBtn}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Visual + Copy Stage */}
      <Animated.View
        style={[
          styles.stage,
          {
            opacity: fade,
            transform: [{ translateX: shift }],
          },
        ]}
      >
        <StepIllustration slide={current} />

        <View style={styles.copyBlock}>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>
        </View>
      </Animated.View>

      {/* Bottom Progress + Single Primary CTA */}
      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {SLIDES.map((item, idx) => {
            const active = idx === stepIndex;
            return (
              <Pressable
                key={item.id}
                onPress={() => goToStep(idx)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Step ${idx + 1}`}
                style={[styles.dot, active && styles.dotActive]}
              />
            );
          })}
        </View>

        <Pressable
          onPress={handlePrimary}
          disabled={isBusy}
          accessibilityRole="button"
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>{isLastStep ? 'Get Started' : 'Continue'}</Text>
          <ArrowRight size={17} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SDO_COLORS.bg,
    paddingHorizontal: 26,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandName: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 17,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
    letterSpacing: -0.3,
  },
  skipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  skipText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13.5,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
  },
  stage: {
    flex: 1,
    justifyContent: 'center',
    gap: 32,
  },
  visualCard: {
    height: 210,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 20,
  },
  visualLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  visualLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '700',
  },
  qrFrame: {
    width: 112,
    height: 112,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  scanLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#10B981',
  },
  lockStage: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    position: 'absolute',
    right: 8,
    bottom: 6,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#0D3472',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBlock: {
    gap: 10,
  },
  title: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    letterSpacing: -0.6,
    color: SDO_COLORS.navyInk,
  },
  body: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 15,
    lineHeight: 22,
    color: SDO_COLORS.textSecondary,
  },
  footer: {
    gap: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#CBD5E1',
  },
  dotActive: {
    width: 24,
    backgroundColor: SDO_COLORS.navyInk,
  },
  primaryBtn: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.navyInk,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
