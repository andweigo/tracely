import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, Menu } from 'lucide-react-native';
import { useAppServices } from '../../state/AppServiceContext';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';

interface MobileHeaderActionsProps {
  readonly sidebarTestID?: string;
  readonly variant?: 'outlined' | 'soft';
}

export const MobileHeaderActions: React.FC<MobileHeaderActionsProps> = ({
  sidebarTestID,
  variant = 'soft',
}) => {
  const {
    activeTab,
    setActiveTab,
    openSidebar,
    unreadNotificationCount,
    pendingOfflineCount,
  } = useAppServices();

  const alertBadge = unreadNotificationCount + pendingOfflineCount;
  const alertsActive = activeTab === 'alerts';
  const btnStyle = variant === 'outlined' ? styles.outlinedBtn : styles.softBtn;

  return (
    <View style={styles.row}>
      <Pressable
        testID="mobile-topbar-alerts-btn"
        onPress={() => setActiveTab('alerts')}
        accessibilityRole="button"
        accessibilityLabel="Open alerts"
        style={[btnStyle, alertsActive && styles.activeBtn]}
      >
        <Bell size={18} color={alertsActive ? '#FFFFFF' : SDO_COLORS.navyInk} />
        {alertBadge > 0 ? (
          <View testID="mobile-topbar-alerts-badge" style={styles.badge}>
            <Text style={styles.badgeText}>
              {alertBadge > 99 ? '99+' : String(alertBadge)}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Pressable
        testID={sidebarTestID}
        onPress={openSidebar}
        accessibilityRole="button"
        accessibilityLabel="Open navigation sidebar"
        style={btnStyle}
      >
        <Menu size={19} color={SDO_COLORS.navyInk} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  softBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  outlinedBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeBtn: {
    backgroundColor: SDO_COLORS.navy,
    borderColor: SDO_COLORS.navy,
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: SDO_COLORS.rose,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: SDO_COLORS.bg,
  },
  badgeText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});

export default MobileHeaderActions;
