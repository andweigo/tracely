import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Inbox, LayoutDashboard, MapPin, Scan, Send } from 'lucide-react-native';
import { MobileTab, useAppServices } from '../../state/AppServiceContext';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';

interface NavItemSpec {
  readonly id: MobileTab;
  readonly label: string;
  readonly featured?: boolean;
  readonly renderIcon: (color: string, active: boolean) => React.ReactNode;
}

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useAppServices();

  const items: ReadonlyArray<NavItemSpec> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      renderIcon: (c, active) => (
        <LayoutDashboard size={active ? 21 : 19} strokeWidth={active ? 2.4 : 1.8} color={c} />
      ),
    },
    {
      id: 'inbox',
      label: 'Inbox',
      renderIcon: (c, active) => (
        <Inbox size={active ? 21 : 19} strokeWidth={active ? 2.4 : 1.8} color={c} />
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
      id: 'scanner',
      label: 'Scan',
      renderIcon: (c, active) => (
        <Scan size={active ? 21 : 19} strokeWidth={active ? 2.4 : 1.8} color={c} />
      ),
    },
    {
      id: 'track',
      label: 'Track',
      renderIcon: (c, active) => (
        <MapPin size={active ? 21 : 19} strokeWidth={active ? 2.4 : 1.8} color={c} />
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
                testID={`bottom-nav-tab-${item.id}`}
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
              testID={`bottom-nav-tab-${item.id}`}
              onPress={() => setActiveTab(item.id)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              style={styles.tabCol}
            >
              <View style={styles.iconSlot}>{item.renderIcon(iconColor, active)}</View>
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
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    alignItems: 'center',
    overflow: 'visible',
  },
  tabGroup: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 420,
  },
  tabCol: {
    flex: 1,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    paddingHorizontal: 2,
  },
  iconSlot: {
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabLabelActive: {
    fontWeight: '800',
    color: SDO_COLORS.navy,
  },
  centerTabCol: {
    flex: 1,
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    paddingHorizontal: 2,
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
    shadowOpacity: 0.24,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  centerCircleActive: {
    backgroundColor: SDO_COLORS.amber,
    borderColor: SDO_COLORS.amberSoft,
  },
  centerLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    color: SDO_COLORS.navy,
  },
  centerLabelActive: {
    color: SDO_COLORS.navyInk,
  },
});
