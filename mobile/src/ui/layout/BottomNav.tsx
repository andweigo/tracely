import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, Home, MapPin, Scan, Send } from 'lucide-react-native';
import { MobileTab, useAppServices } from '../../state/AppServiceContext';
import { SDO_COLORS } from '../theme/tokens';

interface NavItemSpec {
  readonly id: MobileTab;
  readonly label: string;
  readonly featured?: boolean;
  readonly badge?: number;
  readonly renderIcon: (color: string, active: boolean) => React.ReactNode;
}

export const BottomNav: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    unreadNotificationCount,
    pendingOfflineCount,
  } = useAppServices();

  const alertBadge = unreadNotificationCount + pendingOfflineCount;

  const items: ReadonlyArray<NavItemSpec> = [
    {
      id: 'inbox',
      label: 'Inbox',
      renderIcon: (c, active) => (
        <Home size={active ? 22 : 20} strokeWidth={active ? 2.5 : 1.8} color={c} />
      ),
    },
    {
      id: 'scanner',
      label: 'Scan',
      renderIcon: (c, active) => (
        <Scan size={active ? 22 : 20} strokeWidth={active ? 2.5 : 1.8} color={c} />
      ),
    },
    {
      id: 'send',
      label: 'Send',
      featured: true,
      renderIcon: (c, active) => (
        <Send size={active ? 21 : 19} strokeWidth={2.3} color={c} />
      ),
    },
    {
      id: 'track',
      label: 'Track',
      renderIcon: (c, active) => (
        <MapPin size={active ? 22 : 20} strokeWidth={active ? 2.5 : 1.8} color={c} />
      ),
    },
    {
      id: 'alerts',
      label: 'Alerts',
      badge: alertBadge,
      renderIcon: (c, active) => (
        <Bell size={active ? 22 : 20} strokeWidth={active ? 2.5 : 1.8} color={c} />
      ),
    },
  ];

  return (
    <View style={styles.navBar}>
      <View style={styles.tabGroup}>
        {items.map((item) => {
          const active = activeTab === item.id;

          if (item.featured) {
            const featuredIconColor = active ? SDO_COLORS.navyInk : '#FFFFFF';
            return (
              <Pressable
                key={item.id}
                onPress={() => setActiveTab(item.id)}
                accessibilityRole="button"
                accessibilityLabel="Send Document"
                accessibilityState={{ selected: active }}
                style={styles.centerTabCol}
              >
                <View style={[styles.centerCircle, active && styles.centerCircleActive]}>
                  {item.renderIcon(featuredIconColor, active)}
                </View>
                <Text
                  numberOfLines={1}
                  style={[styles.centerLabel, active && styles.centerLabelActive]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          }

          const iconColor = active ? SDO_COLORS.navy : '#94A3B8';

          return (
            <Pressable
              key={item.id}
              onPress={() => setActiveTab(item.id)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              style={styles.tabCol}
            >
              <View style={styles.iconSlot}>
                <View style={styles.iconWrap}>
                  {item.renderIcon(iconColor, active)}
                  {item.badge && item.badge > 0 ? (
                    <View
                      testID={item.id === 'alerts' ? 'bottom-nav-alerts-badge' : undefined}
                      style={styles.badge}
                    >
                      <Text style={styles.badgeText}>
                        {item.badge > 99 ? '99+' : String(item.badge)}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Text numberOfLines={1} style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  navBar: {
    borderTopWidth: 1,
    borderTopColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    alignItems: 'center',
    overflow: 'visible',
  },
  tabGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
  },
  tabCol: {
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    paddingHorizontal: 4,
  },
  iconSlot: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabLabelActive: {
    fontWeight: '800',
    color: SDO_COLORS.navy,
  },
  centerTabCol: {
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    paddingHorizontal: 4,
  },
  centerCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginTop: -20,
    borderWidth: 3,
    borderColor: SDO_COLORS.surface,
    backgroundColor: SDO_COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SDO_COLORS.navyDeep,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  centerCircleActive: {
    backgroundColor: SDO_COLORS.amber,
    borderColor: SDO_COLORS.amberSoft,
  },
  centerLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: SDO_COLORS.navy,
  },
  centerLabelActive: {
    color: SDO_COLORS.navyInk,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -7,
    top: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: SDO_COLORS.rose,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
