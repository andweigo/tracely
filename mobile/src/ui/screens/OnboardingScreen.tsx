import React, { useId, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowRight, CheckCircle2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import { useAppServices } from '../../state/AppServiceContext';
import { AppIconBadge } from '../components/AppIconBadge';
import { SDO_COLORS } from '../theme/tokens';

interface OnboardingHighlight {
  readonly id: string;
  readonly kicker: string;
  readonly accentColor: string;
  readonly title: string;
  readonly body: string;
}

const ONBOARDING_HIGHLIGHTS: ReadonlyArray<OnboardingHighlight> = [
  {
    id: 'routing',
    kicker: 'TRACELY · LIVE CUSTODY',
    accentColor: '#5EEAD4',
    title: 'Every Document.\nEvery Desk.',
    body: 'Follow official transmittals across offices with timestamped receipts and seamless internal handoffs.',
  },
  {
    id: 'scanner',
    kicker: 'QR & OFFLINE PROOF',
    accentColor: '#FFD24C',
    title: 'Scan to Receive.\nSync Offline.',
    body: 'Confirm custody arrival in seconds via QR scan and attach EXIF-stripped photo proofs without connectivity.',
  },
  {
    id: 'security',
    kicker: 'PRIVACY PROTECTED',
    accentColor: '#93C5FD',
    title: 'Security Built Into\nEvery Step.',
    body: 'Confidentiality tiers guard restricted records while Android Keystore protects your verified division session.',
  },
];

/**
 * Clean editorial onboarding experience featuring the borderless living vector app icon
 * floating over an atmospheric sky-to-navy canvas with typographic hierarchy.
 */
export const OnboardingScreen: React.FC = () => {
  const { completeOnboarding, isBusy } = useAppServices();
  const insets = useSafeAreaInsets();
  const rawId = useId();
  const idSuffix = rawId.replace(/[^a-zA-Z0-9_-]/g, '');

  const [stepIndex, setStepIndex] = useState(0);
  const copyFade = useRef(new Animated.Value(1)).current;
  const copySlide = useRef(new Animated.Value(0)).current;

  const isLastStep = stepIndex === ONBOARDING_HIGHLIGHTS.length - 1;
  const currentHighlight = ONBOARDING_HIGHLIGHTS[stepIndex];

  const transitionToStep = (nextIndex: number) => {
    if (nextIndex === stepIndex) return;
    const direction = nextIndex > stepIndex ? 1 : -1;
    copyFade.setValue(0.15);
    copySlide.setValue(direction * 18);
    setStepIndex(nextIndex);

    Animated.parallel([
      Animated.timing(copyFade, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(copySlide, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();
  };

  const handleNext = () => {
    if (isLastStep) {
      completeOnboarding().catch(() => {});
      return;
    }
    transitionToStep(stepIndex + 1);
  };

  const handleSkip = () => {
    completeOnboarding().catch(() => {});
  };

  const handleOpenAuth = () => {
    completeOnboarding('login').catch(() => {});
  };

  const bgGradId = `onbBg_${idSuffix}`;
  const skyHaloId = `onbHalo_${idSuffix}`;
  const amberGlowId = `onbAmber_${idSuffix}`;
  const tealGlowId = `onbTeal_${idSuffix}`;

  return (
    <View style={styles.root}>
      {/* Full-bleed atmospheric sky-to-navy SVG backdrop harmonized with the floating icon */}
      <Svg
        viewBox="0 0 400 840"
        preserveAspectRatio="xMidYMid slice"
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id={bgGradId} x1="25%" y1="0%" x2="75%" y2="100%">
            <Stop offset="0%" stopColor="#1B5BBF" />
            <Stop offset="28%" stopColor="#4A97E8" />
            <Stop offset="58%" stopColor="#1E5CBC" />
            <Stop offset="100%" stopColor="#0D3472" />
          </LinearGradient>
          <RadialGradient id={skyHaloId} cx="50%" cy="34%" r="40%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.34" />
            <Stop offset="52%" stopColor="#A6D5FF" stopOpacity="0.16" />
            <Stop offset="100%" stopColor="#1E5CBC" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={amberGlowId} cx="78%" cy="24%" r="32%">
            <Stop offset="0%" stopColor="#FFD24C" stopOpacity="0.16" />
            <Stop offset="100%" stopColor="#FFD24C" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={tealGlowId} cx="20%" cy="46%" r="34%">
            <Stop offset="0%" stopColor="#34D399" stopOpacity="0.16" />
            <Stop offset="100%" stopColor="#1B8B71" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width="400" height="840" fill={`url(#${bgGradId})`} />
        <Rect x="0" y="0" width="400" height="840" fill={`url(#${skyHaloId})`} />
        <Rect x="0" y="0" width="400" height="840" fill={`url(#${amberGlowId})`} />
        <Rect x="0" y="0" width="400" height="840" fill={`url(#${tealGlowId})`} />

        {/* Subtle dashed breadcrumb arc matching the document route inside the icon */}
        <Path
          d="M -20 430 Q 115 350 200 280 T 430 150"
          stroke="#FFFFFF"
          strokeOpacity="0.15"
          strokeWidth="1.5"
          strokeDasharray="6 7"
          fill="none"
        />
        <Circle cx="68" cy="378" r="4" fill="#34D399" fillOpacity="0.44" />
        <Circle cx="332" cy="196" r="3.5" fill="#FFD24C" fillOpacity="0.46" />
      </Svg>

      <View
        style={[
          styles.safeWrap,
          {
            paddingTop: Math.max(insets.top + 10, 20),
            paddingBottom: Math.max(insets.bottom + 20, 28),
          },
        ]}
      >
        {/* Minimal top bar with Skip action only */}
        <View style={styles.topBar}>
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

        {/* Borderless Floating Animated Vector App Icon */}
        <View style={styles.heroStage}>
          <AppIconBadge size={160} animated interactive showBackground={false} />
        </View>

        {/* Visual Hierarchy Typography & Controls directly on canvas */}
        <View style={styles.bottomSection}>
          <Animated.View
            style={[
              styles.copyStack,
              {
                opacity: copyFade,
                transform: [{ translateX: copySlide }],
              },
            ]}
          >
            <Text style={[styles.kicker, { color: currentHighlight.accentColor }]}>
              {currentHighlight.kicker}
            </Text>
            <Text style={styles.displayTitle}>{currentHighlight.title}</Text>
            <Text style={styles.bodyCopy}>{currentHighlight.body}</Text>
          </Animated.View>

          <View style={styles.dotsRow}>
            {ONBOARDING_HIGHLIGHTS.map((item, idx) => {
              const active = idx === stepIndex;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => transitionToStep(idx)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Step ${idx + 1}`}
                  style={[styles.dot, active && styles.dotActive]}
                />
              );
            })}
          </View>

          <View style={styles.ctaGroup}>
            <Pressable
              onPress={handleNext}
              disabled={isBusy}
              accessibilityRole="button"
              style={styles.primaryCta}
            >
              <Text style={styles.primaryCtaText}>
                {isLastStep ? 'Get Started' : 'Continue'}
              </Text>
              {isLastStep ? (
                <CheckCircle2 size={18} color={SDO_COLORS.navy} />
              ) : (
                <ArrowRight size={18} color={SDO_COLORS.navy} />
              )}
            </Pressable>

            {isLastStep ? (
              <Pressable
                onPress={handleOpenAuth}
                disabled={isBusy}
                accessibilityRole="button"
                style={styles.secondaryCta}
              >
                <Text style={styles.secondaryCtaText}>Sign In or Create Account</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SDO_COLORS.navy,
  },
  safeWrap: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minHeight: 36,
  },
  skipBtn: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  skipText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomSection: {
    gap: 22,
  },
  copyStack: {
    gap: 10,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  displayTitle: {
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#FFFFFF',
  },
  bodyCopy: {
    fontSize: 15,
    lineHeight: 22,
    color: '#D6E7FF',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
  },
  dotActive: {
    width: 26,
    backgroundColor: SDO_COLORS.amber,
  },
  ctaGroup: {
    gap: 10,
  },
  primaryCta: {
    minHeight: 52,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#091936',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  primaryCtaText: {
    fontSize: 15,
    fontWeight: '800',
    color: SDO_COLORS.navy,
  },
  secondaryCta: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.36)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
