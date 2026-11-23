import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { SDO_COLORS } from '../theme/tokens';

export type ScreenSkeletonVariant =
  | 'dashboard'
  | 'inbox'
  | 'scanner'
  | 'send'
  | 'sent'
  | 'completed'
  | 'document'
  | 'track'
  | 'categories'
  | 'alerts'
  | 'profile'
  | 'user_profile'
  | 'settings'
  | 'login';

interface AppBootSkeletonProps {
  readonly variant?: ScreenSkeletonVariant;
  readonly testID?: string;
}

/**
 * First-render loading skeleton adapted to every workspace screen layout.
 * Shown only on app bootstrap or the first time a screen opens.
 */
export const AppBootSkeleton: React.FC<AppBootSkeletonProps> = ({
  variant = 'inbox',
  testID = 'app-boot-skeleton',
}) => {
  const pulse = useRef(new Animated.Value(0.65)).current;

  useEffect(() => {
    if (typeof jest !== 'undefined') {
      pulse.setValue(0.85);
      return;
    }
    let active = true;
    let loop: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!active || reduced) {
          pulse.setValue(0.85);
          return;
        }
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, {
              toValue: 1,
              duration: 700,
              useNativeDriver: false,
            }),
            Animated.timing(pulse, {
              toValue: 0.52,
              duration: 700,
              useNativeDriver: false,
            }),
          ]),
        );
        loop.start();
      })
      .catch(() => {});

    return () => {
      active = false;
      loop?.stop();
    };
  }, [pulse]);

  const blockStyle = [styles.shimmerBlock, { opacity: pulse }];

  const renderHeader = (hasCircleAction = true) => (
    <View style={styles.topHeader}>
      <View style={styles.profileRow}>
        <Animated.View style={[styles.avatar, { opacity: pulse }]} />
        <View style={styles.profileCopy}>
          <Animated.View style={[styles.lineShort, blockStyle]} />
          <Animated.View style={[styles.lineTiny, blockStyle]} />
        </View>
      </View>
      {hasCircleAction ? <Animated.View style={[styles.circleIcon, { opacity: pulse }]} /> : null}
    </View>
  );

  const renderDocCards = (count: number) =>
    Array.from({ length: count }).map((_, idx) => (
      <View key={idx} style={styles.docCard}>
        <View style={styles.cardTop}>
          <Animated.View style={[styles.codeBar, blockStyle]} />
          <Animated.View style={[styles.badgeBar, blockStyle]} />
        </View>
        <Animated.View style={[styles.titleBar, blockStyle]} />
        <Animated.View style={[styles.metaBar, blockStyle]} />
        <View style={styles.cardActions}>
          <Animated.View style={[styles.primaryPill, blockStyle]} />
          <Animated.View style={[styles.secondaryPill, blockStyle]} />
        </View>
      </View>
    ));

  if (variant === 'scanner') {
    return (
      <View testID={testID} style={styles.container}>
        {renderHeader()}
        <Animated.View style={[styles.heroCard, { opacity: pulse }]}>
          <View style={styles.heroTitleBar} />
          <View style={styles.heroSubBar} />
          <View style={[styles.heroFrame, styles.heroFrameTall]} />
          <View style={styles.heroBtnRow}>
            <View style={styles.heroBtn} />
            <View style={styles.heroBtn} />
          </View>
        </Animated.View>
        <Animated.View style={[styles.sectionLine, blockStyle]} />
        {renderDocCards(2)}
      </View>
    );
  }

  if (variant === 'send') {
    return (
      <View testID={testID} style={styles.container}>
        {renderHeader()}
        <View style={styles.segmentBox}>
          <Animated.View style={[styles.segmentHalf, blockStyle]} />
          <Animated.View style={[styles.segmentHalfMuted, { opacity: pulse }]} />
        </View>
        <Animated.View style={[styles.inputSkeleton, { opacity: pulse }]} />
        <Animated.View style={[styles.dropzoneSkeleton, { opacity: pulse }]} />
        <View style={styles.tabRow}>
          <Animated.View style={[styles.tabPillWide, { opacity: pulse }]} />
          <Animated.View style={[styles.tabPill, { opacity: pulse }]} />
          <Animated.View style={[styles.tabPill, { opacity: pulse }]} />
        </View>
        <Animated.View style={[styles.ctaBarSkeleton, blockStyle]} />
      </View>
    );
  }

  if (variant === 'track') {
    return (
      <View testID={testID} style={styles.container}>
        {renderHeader()}
        <Animated.View style={[styles.searchFull, { opacity: pulse }]} />
        <View style={styles.segmentBox}>
          <Animated.View style={[styles.segmentHalf, blockStyle]} />
          <Animated.View style={[styles.segmentHalfMuted, { opacity: pulse }]} />
        </View>
        {renderDocCards(3)}
      </View>
    );
  }

  if (variant === 'document') {
    return (
      <View testID={testID} style={styles.container}>
        {renderHeader()}
        <View style={styles.docCard}>
          <View style={styles.cardTop}>
            <Animated.View style={[styles.codeBar, blockStyle]} />
            <Animated.View style={[styles.badgeBar, blockStyle]} />
          </View>
          <Animated.View style={[styles.titleBar, blockStyle]} />
          <Animated.View style={[styles.metaBar, blockStyle]} />
          <View style={styles.tabRow}>
            <Animated.View style={[styles.tabPill, { opacity: pulse }]} />
            <Animated.View style={[styles.tabPill, { opacity: pulse }]} />
            <Animated.View style={[styles.tabPill, { opacity: pulse }]} />
          </View>
        </View>
        <View style={styles.segmentBox}>
          <Animated.View style={[styles.segmentHalf, blockStyle]} />
          <Animated.View style={[styles.segmentHalfMuted, { opacity: pulse }]} />
        </View>
        {[0, 1, 2].map((idx) => (
          <View key={idx} style={styles.timelineRow}>
            <Animated.View style={[styles.timelineDot, blockStyle]} />
            <View style={styles.timelineCopy}>
              <Animated.View style={[styles.titleBar, styles.w62, blockStyle]} />
              <Animated.View style={[styles.metaBar, styles.w44, blockStyle]} />
            </View>
          </View>
        ))}
      </View>
    );
  }

  if (variant === 'categories' || variant === 'alerts' || variant === 'sent') {
    return (
      <View testID={testID} style={styles.container}>
        {renderHeader()}
        {variant === 'categories' || variant === 'sent' ? (
          <Animated.View style={[styles.searchFull, { opacity: pulse }]} />
        ) : null}
        <View style={styles.tabRow}>
          <Animated.View style={[styles.tabPillWide, { opacity: pulse }]} />
          <Animated.View style={[styles.tabPill, { opacity: pulse }]} />
          <Animated.View style={[styles.tabPill, { opacity: pulse }]} />
        </View>
        {[0, 1, 2, 3].map((idx) => (
          <View key={idx} style={styles.docCard}>
            <View style={styles.cardTop}>
              <Animated.View style={[styles.codeBar, styles.w92, blockStyle]} />
              <Animated.View style={[styles.badgeBar, styles.w64, blockStyle]} />
            </View>
            <Animated.View style={[styles.titleBar, styles.w74, blockStyle]} />
            <Animated.View style={[styles.metaBar, styles.w48, blockStyle]} />
          </View>
        ))}
      </View>
    );
  }

  if (variant === 'profile' || variant === 'user_profile') {
    return (
      <View testID={testID} style={styles.container}>
        {renderHeader()}
        <Animated.View style={[styles.heroCard, { opacity: pulse }]}>
          <View style={styles.heroTitleBar} />
          <View style={styles.heroSubBar} />
          <View style={[styles.heroSubBar, styles.w52]} />
        </Animated.View>
        <View style={styles.statsGrid}>
          {[0, 1, 2, 3].map((idx) => (
            <View key={idx} style={styles.statTile}>
              <Animated.View style={[styles.lineShort, styles.w42, blockStyle]} />
              <Animated.View style={[styles.lineTiny, styles.w78, blockStyle]} />
            </View>
          ))}
        </View>
        <View style={styles.docCard}>
          <Animated.View style={[styles.titleBar, styles.w58, blockStyle]} />
          <Animated.View style={[styles.metaBar, styles.w85, blockStyle]} />
          <Animated.View style={[styles.primaryPill, styles.mt6, blockStyle]} />
        </View>
      </View>
    );
  }

  if (variant === 'login') {
    return (
      <View testID={testID} style={[styles.container, styles.centerContainer]}>
        <View style={[styles.docCard, styles.loginCard]}>
          <View style={styles.profileRow}>
            <Animated.View style={[styles.avatar, blockStyle]} />
            <View style={styles.profileCopy}>
              <Animated.View style={[styles.lineShort, blockStyle]} />
              <Animated.View style={[styles.lineTiny, blockStyle]} />
            </View>
          </View>
          <Animated.View style={[styles.loginSegment, blockStyle]} />
          <Animated.View style={[styles.loginField, blockStyle]} />
          <Animated.View style={[styles.loginField, blockStyle]} />
          <Animated.View style={[styles.loginSubmit, blockStyle]} />
        </View>
      </View>
    );
  }

  // Default 'inbox'
  return (
    <View testID={testID} style={styles.container}>
      {renderHeader()}

      <View style={styles.searchRow}>
        <Animated.View style={[styles.searchPill, { opacity: pulse }]} />
        <Animated.View style={[styles.filterCircle, { opacity: pulse }]} />
      </View>

      <View style={styles.tabRow}>
        <Animated.View style={[styles.tabPillWide, { opacity: pulse }]} />
        <Animated.View style={[styles.tabPill, { opacity: pulse }]} />
        <Animated.View style={[styles.tabPill, { opacity: pulse }]} />
        <Animated.View style={[styles.tabPill, { opacity: pulse }]} />
      </View>

      <Animated.View style={[styles.heroCard, { opacity: pulse }]}>
        <View style={styles.heroTitleBar} />
        <View style={styles.heroSubBar} />
        <View style={styles.heroFrame} />
        <View style={styles.heroBtnRow}>
          <View style={styles.heroBtn} />
          <View style={styles.heroBtn} />
        </View>
      </Animated.View>

      {renderDocCards(3)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SDO_COLORS.bg,
    paddingHorizontal: 18,
    paddingTop: 14,
    gap: 14,
  },
  shimmerBlock: {
    backgroundColor: '#E2E8F0',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E2E8F0',
  },
  profileCopy: {
    gap: 6,
  },
  lineShort: {
    width: 112,
    height: 14,
    borderRadius: 7,
  },
  lineTiny: {
    width: 80,
    height: 10,
    borderRadius: 5,
  },
  circleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchPill: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
  },
  filterCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SDO_COLORS.surfaceSoft,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabPillWide: {
    width: 82,
    height: 32,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  tabPill: {
    width: 74,
    height: 32,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
  },
  sectionLine: {
    width: 148,
    height: 16,
    borderRadius: 8,
  },
  heroCard: {
    borderRadius: 24,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 18,
    gap: 10,
  },
  heroTitleBar: {
    width: '45%',
    height: 18,
    borderRadius: 9,
    backgroundColor: '#E2E8F0',
  },
  heroSubBar: {
    width: '72%',
    height: 11,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  heroFrame: {
    height: 120,
    borderRadius: 16,
    backgroundColor: '#E9EEF5',
    marginTop: 2,
  },
  heroBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroBtn: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
  },
  docCard: {
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 16,
    gap: 9,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  codeBar: {
    width: 132,
    height: 12,
    borderRadius: 6,
  },
  badgeBar: {
    width: 78,
    height: 20,
    borderRadius: 999,
  },
  titleBar: {
    width: '86%',
    height: 15,
    borderRadius: 7,
  },
  metaBar: {
    width: '56%',
    height: 11,
    borderRadius: 5,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryPill: {
    flex: 1,
    height: 36,
    borderRadius: 999,
  },
  secondaryPill: {
    width: 88,
    height: 36,
    borderRadius: 999,
  },
  segmentBox: {
    flexDirection: 'row',
    gap: 6,
    borderRadius: 14,
    padding: 4,
    backgroundColor: SDO_COLORS.surfaceSoft,
  },
  segmentHalf: {
    flex: 1,
    height: 38,
    borderRadius: 10,
  },
  segmentHalfMuted: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: SDO_COLORS.surface,
  },
  inputSkeleton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: SDO_COLORS.surfaceSoft,
  },
  dropzoneSkeleton: {
    height: 96,
    borderRadius: 16,
    backgroundColor: SDO_COLORS.surfaceSoft,
  },
  ctaBarSkeleton: {
    height: 48,
    borderRadius: 14,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineCopy: {
    flex: 1,
    gap: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statTile: {
    width: '48%',
    borderRadius: 16,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 14,
    gap: 8,
  },
  heroFrameTall: {
    height: 176,
  },
  searchFull: {
    width: '100%',
    height: 44,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
  },
  centerContainer: {
    justifyContent: 'center',
  },
  loginCard: {
    gap: 14,
    padding: 20,
  },
  loginSegment: {
    height: 42,
    borderRadius: 999,
  },
  loginField: {
    height: 46,
    borderRadius: 14,
  },
  loginSubmit: {
    width: '100%',
    height: 42,
    borderRadius: 999,
  },
  mt6: {
    marginTop: 6,
  },
  w42: { width: 42 },
  w44: { width: '44%' },
  w48: { width: '48%' },
  w52: { width: '52%' },
  w58: { width: '58%' },
  w62: { width: '62%' },
  w64: { width: 64 },
  w74: { width: '74%' },
  w78: { width: 78 },
  w85: { width: '85%' },
  w92: { width: 92 },
});
