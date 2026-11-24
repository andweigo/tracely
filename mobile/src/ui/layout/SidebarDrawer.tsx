import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Bell,
  CheckCircle2,
  FileOutput,
  FileText,
  FolderKanban,
  Home,
  LayoutDashboard,
  LogOut,
  MapPin,
  Scan,
  Send,
  Settings,
  User,
  UserCog,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MobileTab, useAppServices } from '../../state/AppServiceContext';
import { AppIconBadge } from '../components/AppIconBadge';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';
import { selectSentDocuments } from '../utils/sentFilter';

interface SidebarScreenItem {
  readonly tab: MobileTab;
  readonly label: string;
  readonly badge?: number;
  readonly renderIcon: (color: string) => React.ReactNode;
}

/**
 * Minimalist enterprise navigation sidebar with top-bar branding, workspace routes,
 * Sign Out redirect, and Android edge-to-edge SafeAreaView & StatusBar insets.
 */
export const SidebarDrawer: React.FC = () => {
  const {
    actor,
    documents,
    activeTab,
    selectedDocumentId,
    setActiveTab,
    sidebarOpen,
    closeSidebar,
    signOutAndWipeCache,
    unreadNotificationCount,
    pendingOfflineCount,
    workloadSummary,
  } = useAppServices();

  const insets = useSafeAreaInsets();
  const slideX = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (!sidebarOpen) return;
    slideX.setValue(300);
    const anim = Animated.timing(slideX, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [sidebarOpen, slideX]);

  const totalAlerts = unreadNotificationCount + pendingOfflineCount;
  const pendingSentCount = selectSentDocuments(documents, actor).filter(
    (item) => item.status === 'pending',
  ).length;
  const effectiveTab: MobileTab = selectedDocumentId ? 'document' : activeTab;

  const screens: ReadonlyArray<SidebarScreenItem> = [
    {
      tab: 'dashboard',
      label: 'Dashboard',
      renderIcon: (c) => <LayoutDashboard size={18} strokeWidth={2} color={c} />,
    },
    {
      tab: 'inbox',
      label: 'Inbox',
      badge: workloadSummary.pendingReceiptCount,
      renderIcon: (c) => <Home size={18} strokeWidth={2} color={c} />,
    },
    {
      tab: 'scanner',
      label: 'QR Scanner',
      renderIcon: (c) => <Scan size={18} strokeWidth={2} color={c} />,
    },
    {
      tab: 'send',
      label: 'Send Document',
      renderIcon: (c) => <Send size={18} strokeWidth={2} color={c} />,
    },
    {
      tab: 'sent',
      label: 'Sent Files',
      badge: pendingSentCount,
      renderIcon: (c) => <FileOutput size={18} strokeWidth={2} color={c} />,
    },
    {
      tab: 'completed',
      label: 'Completed',
      renderIcon: (c) => <CheckCircle2 size={18} strokeWidth={2} color={c} />,
    },
    {
      tab: 'document',
      label: 'Document Detail',
      renderIcon: (c) => <FileText size={18} strokeWidth={2} color={c} />,
    },
    {
      tab: 'track',
      label: 'Track Docs',
      renderIcon: (c) => <MapPin size={18} strokeWidth={2} color={c} />,
    },
    {
      tab: 'categories',
      label: 'Categories',
      renderIcon: (c) => <FolderKanban size={18} strokeWidth={2} color={c} />,
    },
    {
      tab: 'alerts',
      label: 'Alerts & Sync',
      badge: totalAlerts,
      renderIcon: (c) => <Bell size={18} strokeWidth={2} color={c} />,
    },
    {
      tab: 'profile',
      label: 'Profile',
      renderIcon: (c) => <User size={18} strokeWidth={2} color={c} />,
    },
  ];

  const handleSignOut = () => {
    closeSidebar();
    return signOutAndWipeCache().catch(() => {});
  };

  return (
    <Modal
      visible={sidebarOpen}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      onRequestClose={closeSidebar}
    >
      <View style={styles.backdrop}>
        <Pressable
          onPress={closeSidebar}
          accessibilityLabel="Close navigation sidebar backdrop"
          style={styles.scrim}
        />

        <Animated.View
          style={[
            styles.panel,
            {
              paddingTop: Math.max(insets.top + 12, 20),
              paddingBottom: Math.max(insets.bottom + 14, 20),
              transform: [{ translateX: slideX }],
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.userRow}>
              <AppIconBadge size={36} animated={sidebarOpen} />
              <View style={styles.userMeta}>
                <Text numberOfLines={1} style={styles.userName}>
                  {actor ? actor.fullName : 'Tracely'}
                </Text>
                <Text numberOfLines={1} style={styles.userSub}>
                  {actor ? `${actor.office.code} · ${actor.roleLabel}` : 'Document Custody & QR Tracking'}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={closeSidebar}
              hitSlop={10}
              accessibilityLabel="Close navigation sidebar"
              style={styles.closeBtn}
            >
              <X size={18} color={SDO_COLORS.textSecondary} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.navList}>
            <Text style={styles.sectionLabel}>WORKSPACE</Text>
            {screens.map((item) => {
              const active = effectiveTab === item.tab;
              const iconColor = active ? SDO_COLORS.navy : SDO_COLORS.textSecondary;

              return (
                <Pressable
                  key={item.tab}
                  onPress={() => setActiveTab(item.tab)}
                  style={[styles.navRow, active && styles.navRowActive]}
                >
                  {item.renderIcon(iconColor)}
                  <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                  {item.badge && item.badge > 0 ? (
                    <View style={[styles.badge, active && styles.badgeActive]}>
                      <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
                        {item.badge}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}

            <Text style={[styles.sectionLabel, styles.accountSectionLabel]}>ACCOUNT</Text>
            <Pressable
              testID="sidebar-user-profile-item"
              onPress={() => setActiveTab('user_profile')}
              style={[styles.navRow, effectiveTab === 'user_profile' && styles.navRowActive]}
            >
              <UserCog
                size={18}
                strokeWidth={2}
                color={
                  effectiveTab === 'user_profile' ? SDO_COLORS.navy : SDO_COLORS.textSecondary
                }
              />
              <Text
                style={[
                  styles.navLabel,
                  effectiveTab === 'user_profile' && styles.navLabelActive,
                ]}
              >
                User Profile
              </Text>
            </Pressable>
            <Pressable
              testID="sidebar-settings-item"
              onPress={() => setActiveTab('settings')}
              style={[styles.navRow, effectiveTab === 'settings' && styles.navRowActive]}
            >
              <Settings
                size={18}
                strokeWidth={2}
                color={
                  effectiveTab === 'settings' ? SDO_COLORS.navy : SDO_COLORS.textSecondary
                }
              />
              <Text
                style={[
                  styles.navLabel,
                  effectiveTab === 'settings' && styles.navLabelActive,
                ]}
              >
                Settings
              </Text>
            </Pressable>
          </ScrollView>

          <View style={styles.footerWrap}>
            <Pressable
              onPress={handleSignOut}
              accessibilityRole="button"
              accessibilityLabel="Sign Out"
              style={styles.signOutRow}
            >
              <LogOut size={18} strokeWidth={2} color={SDO_COLORS.rose} />
              <Text style={styles.signOutLabel}>Sign Out</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(13, 27, 62, 0.36)',
  },
  scrim: {
    flex: 1,
  },
  panel: {
    width: '76%',
    maxWidth: 292,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 18,
    gap: 16,
    borderLeftWidth: 1,
    borderLeftColor: SDO_COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.surfaceSoft,
  },
  userRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userMeta: {
    flex: 1,
    gap: 1,
  },
  userName: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 14,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  userSub: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: SDO_COLORS.textMuted,
  },
  closeBtn: {
    padding: 4,
  },
  navList: {
    gap: 4,
  },
  sectionLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    color: SDO_COLORS.textMuted,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  accountSectionLabel: {
    marginTop: 10,
  },
  navRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  navRowActive: {
    backgroundColor: SDO_COLORS.surfaceSoft,
  },
  navLabel: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
  },
  navLabelActive: {
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeActive: {
    backgroundColor: SDO_COLORS.navy,
  },
  badgeText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  badgeTextActive: {
    color: '#FFFFFF',
  },
  footerWrap: {
    borderTopWidth: 1,
    borderTopColor: SDO_COLORS.surfaceSoft,
    paddingTop: 10,
    gap: 10,
  },
  signOutRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    backgroundColor: SDO_COLORS.roseSoft,
    paddingHorizontal: 12,
  },
  signOutLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 14,
    fontWeight: '700',
    color: SDO_COLORS.rose,
  },
});
