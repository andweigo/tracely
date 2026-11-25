import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, ChevronDown } from 'lucide-react-native';
import { useAppServices } from '../../state/AppServiceContext';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';
import { MobileHeaderActions } from './MobileHeaderActions';

interface MobilePrimaryHeaderProps {
  readonly subtitle: string;
  readonly avatarTestID?: string;
  readonly sidebarTestID?: string;
}

/**
 * Pixel-identical top bar shared by Dashboard and Inbox screens.
 */
export const MobilePrimaryHeader: React.FC<MobilePrimaryHeaderProps> = ({
  subtitle,
  avatarTestID,
  sidebarTestID,
}) => {
  const { actor, setActiveTab } = useAppServices();
  const firstName = actor ? (actor.fullName.split(' ')[0] ?? actor.fullName) : 'Tracely';
  const avatarInitials = actor ? actor.initials : 'TR';

  return (
    <View style={styles.primaryBar}>
      <Pressable
        onPress={() => setActiveTab('profile')}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        style={styles.profileBtn}
      >
        <View
          testID={avatarTestID}
          style={[
            styles.avatar,
            actor?.avatarColor ? { backgroundColor: actor.avatarColor } : null,
          ]}
        >
          <Text style={styles.avatarText}>{avatarInitials}</Text>
        </View>
        <View style={styles.profileCopy}>
          <View style={styles.greetingRow}>
            <Text numberOfLines={1} style={styles.greeting}>
              {actor ? `Hey, ${firstName}` : 'Tracely'}
            </Text>
            <ChevronDown size={14} color={SDO_COLORS.textSecondary} />
          </View>
          <Text numberOfLines={1} style={styles.subGreeting}>
            {subtitle}
          </Text>
        </View>
      </Pressable>

      <MobileHeaderActions sidebarTestID={sidebarTestID} variant="outlined" />
    </View>
  );
};

interface MobileScreenHeaderProps {
  readonly title: string;
  readonly badgeCount?: number;
  readonly badgeTestID?: string;
  readonly onBack?: () => void;
  readonly backAccessibilityLabel?: string;
  readonly hideBack?: boolean;
  readonly rightSlot?: React.ReactNode;
  readonly sidebarTestID?: string;
  readonly bordered?: boolean;
}

/**
 * Standard secondary screen header with mathematically centered title,
 * unaffected by asymmetric left/right icon counts (e.g. Alerts + Menu on the right).
 */
export const MobileScreenHeader: React.FC<MobileScreenHeaderProps> = ({
  title,
  badgeCount = 0,
  badgeTestID,
  onBack,
  backAccessibilityLabel = 'Back',
  hideBack = false,
  rightSlot,
  sidebarTestID,
  bordered = false,
}) => {
  const { goBack } = useAppServices();
  const handleBack = onBack ?? (() => goBack());

  return (
    <View style={[styles.secondaryBar, bordered && styles.bordered]}>
      <View style={styles.leftSlot}>
        {!hideBack ? (
          <Pressable
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={backAccessibilityLabel}
            style={styles.backBtn}
          >
            <ArrowLeft size={18} color={SDO_COLORS.navyInk} />
          </Pressable>
        ) : null}
      </View>

      <View pointerEvents="none" style={styles.centerLayer}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.screenTitle}>
            {title}
          </Text>
          {badgeCount > 0 ? (
            <View testID={badgeTestID} style={styles.titleBadge}>
              <Text style={styles.titleBadgeText}>
                {badgeCount > 99 ? '99+' : String(badgeCount)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.rightSlot}>
        {rightSlot !== undefined ? (
          rightSlot
        ) : (
          <MobileHeaderActions sidebarTestID={sidebarTestID} variant="soft" />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  primaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 62,
    paddingHorizontal: 18,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: SDO_COLORS.bg,
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
  },
  profileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SDO_COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  greeting: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
    flexShrink: 1,
  },
  subGreeting: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '500',
    color: SDO_COLORS.textSecondary,
  },
  secondaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 58,
    paddingHorizontal: 18,
    paddingVertical: 9,
    position: 'relative',
    backgroundColor: SDO_COLORS.bg,
  },
  bordered: {
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
  },
  leftSlot: {
    zIndex: 2,
    minWidth: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  rightSlot: {
    zIndex: 2,
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLayer: {
    position: 'absolute',
    left: 104,
    right: 104,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  screenTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 16,
    fontWeight: '700',
    color: SDO_COLORS.navyInk,
    textAlign: 'center',
    flexShrink: 1,
  },
  titleBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: SDO_COLORS.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBadgeText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
