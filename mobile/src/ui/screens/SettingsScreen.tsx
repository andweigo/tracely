import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import {
  ArrowLeft,
  Bell,
  Camera,
  ChevronRight,
  Code2,
  FileText,
  Folder,
  HardDrive,
  Info,
  LogOut,
  Palette,
  ShieldCheck,
} from 'lucide-react-native';
import { MOBILE_APP_VERSION } from '../../config/ApiConfig';
import { LegalDocumentType } from '../../domain/legal/LegalPolicies';
import {
  DEFAULT_SERVICE_PERMISSIONS,
  DevicePermissionKey,
  DevicePermissionsBridge,
  DevicePermissionsSnapshot,
  DevicePermissionStatus,
  ServicePermissionsState,
} from '../../domain/security/DevicePermissionsBridge';
import { useAppServices } from '../../state/AppServiceContext';
import { AppIconBadge } from '../components/AppIconBadge';
import { MobileFolder } from '../components/MobileFolder';
import { MobileScreenHeader } from '../components/MobileTopBars';
import { LegalPolicySheet } from '../sheets/LegalPolicySheet';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';

function permissionStatusLabel(status: DevicePermissionStatus): string {
  switch (status) {
    case 'granted':
      return 'Allowed';
    case 'blocked':
      return 'Blocked';
    case 'denied':
      return 'Not Allowed';
    default:
      return 'Managed by OS';
  }
}

export const SettingsScreen: React.FC = () => {
  const {
    actor,
    isBusy,
    securityPrefs,
    updateSecurityPrefs,
    folderAppearance,
    updateFolderAppearance,
    signOutAndWipeCache,
    setActiveTab,
    goBack,
    notify,
  } = useAppServices();

  const [devicePerms, setDevicePerms] = useState<DevicePermissionsSnapshot>({
    camera: 'unavailable',
    notifications: 'unavailable',
    media: 'unavailable',
  });
  const [servicePerms, setServicePerms] = useState<ServicePermissionsState>(
    DEFAULT_SERVICE_PERMISSIONS,
  );
  const [legalSheetTab, setLegalSheetTab] = useState<LegalDocumentType | null>(null);

  const refreshPermissions = useCallback(async () => {
    const [deviceSnap, svcSnap] = await Promise.all([
      DevicePermissionsBridge.checkAllDevicePermissions(),
      DevicePermissionsBridge.loadServicePermissions(),
    ]);
    setDevicePerms(deviceSnap);
    setServicePerms(svcSnap);
  }, []);

  useEffect(() => {
    void refreshPermissions();
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshPermissions();
      }
    });
    return () => sub.remove();
  }, [refreshPermissions]);

  const handleRequestDevicePerm = async (key: DevicePermissionKey) => {
    const current = devicePerms[key];
    if (current === 'blocked') {
      await DevicePermissionsBridge.openSystemSettings();
      return;
    }
    const next = await DevicePermissionsBridge.requestDevicePermission(key);
    setDevicePerms((prev) => ({ ...prev, [key]: next }));
    if (next === 'granted') {
      notify('success', 'Device permission enabled.');
    } else if (next === 'blocked') {
      notify('info', 'Permission blocked in system settings. Tap Settings to enable.');
    }
  };

  const handleToggleServicePerm = async (
    key: keyof ServicePermissionsState,
    value: boolean,
  ) => {
    const updated: ServicePermissionsState = { ...servicePerms, [key]: value };
    setServicePerms(updated);
    await DevicePermissionsBridge.saveServicePermissions(updated);
  };

  const devicePermissionRows: ReadonlyArray<{
    readonly key: DevicePermissionKey;
    readonly title: string;
    readonly detail: string;
    readonly icon: React.ReactNode;
  }> = [
    {
      key: 'camera',
      title: 'Camera',
      detail: 'Scan QR codes and capture proofs',
      icon: <Camera size={15} color={SDO_COLORS.navy} />,
    },
    {
      key: 'notifications',
      title: 'Notifications',
      detail: 'Incoming document alerts',
      icon: <Bell size={15} color={SDO_COLORS.navy} />,
    },
    {
      key: 'media',
      title: 'Files & Media',
      detail: 'Attach documents and photos',
      icon: <HardDrive size={15} color={SDO_COLORS.navy} />,
    },
  ];

  return (
    <View testID="mobile-settings-screen" style={styles.screen}>
      <MobileScreenHeader title="Settings" />

      <ScrollView contentContainerStyle={styles.container}>
        {/* System Identity Header */}
        <View style={styles.brandBlock}>
          <AppIconBadge size={44} animated />
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>Tracely</Text>
            <Text style={styles.brandTagline}>Document Tracking App</Text>
          </View>
        </View>

        {/* Folder Appearance Preferences */}
        <View testID="mobile-settings-folder-prefs-card" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Folder size={15} color={SDO_COLORS.navy} />
            <Text style={styles.sectionTitle}>Folder Design</Text>
          </View>

          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <MobileFolder
              label="Preview"
              color="#0ea5e9"
              mode={folderAppearance.mode}
              variant={folderAppearance.variant}
              layout={folderAppearance.layout}
              items={[
                { id: 'prev-1', title: 'Budget Memo', description: 'FIN · Sample file' },
                { id: 'prev-2', title: 'Travel Order', description: 'HR · Sample file' },
              ]}
            />
          </View>

          <View style={styles.prefGroup}>
            <Text style={styles.prefLabel}>Style</Text>
            <View style={styles.segmentedRow}>
              {(['flap', 'book'] as const).map((m) => (
                <Pressable
                  key={m}
                  testID={`mobile-pref-folder-mode-${m}`}
                  onPress={() => updateFolderAppearance({ mode: m })}
                  style={[
                    styles.segBtn,
                    folderAppearance.mode === m && styles.segBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.segText,
                      folderAppearance.mode === m && styles.segTextActive,
                    ]}
                  >
                    {m === 'flap' ? 'Flap' : 'Book'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.prefGroup}>
            <Text style={styles.prefLabel}>Surface</Text>
            <View style={styles.segmentedRow}>
              {(['solid', 'glass', 'matte'] as const).map((v) => (
                <Pressable
                  key={v}
                  testID={`mobile-pref-folder-variant-${v}`}
                  onPress={() => updateFolderAppearance({ variant: v })}
                  style={[
                    styles.segBtn,
                    folderAppearance.variant === v && styles.segBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.segText,
                      folderAppearance.variant === v && styles.segTextActive,
                    ]}
                  >
                    {v === 'solid' ? 'Solid' : v === 'glass' ? 'Glass' : 'Matte'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.prefGroup}>
            <Text style={styles.prefLabel}>Sheet Layout</Text>
            <View style={styles.segmentedRow}>
              {(['spread', 'stack', 'row'] as const).map((l) => (
                <Pressable
                  key={l}
                  testID={`mobile-pref-folder-layout-${l}`}
                  onPress={() => updateFolderAppearance({ layout: l })}
                  style={[
                    styles.segBtn,
                    folderAppearance.layout === l && styles.segBtnActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.segText,
                      folderAppearance.layout === l && styles.segTextActive,
                    ]}
                  >
                    {l === 'spread' ? 'Spread' : l === 'stack' ? 'Stack' : 'Row'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>

        {/* Device & Service Permissions */}
        <View testID="mobile-settings-permissions-card" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <ShieldCheck size={15} color={SDO_COLORS.navy} />
            <Text style={styles.sectionTitle}>Device &amp; Service Permissions</Text>
          </View>

          <Text style={styles.subsectionLabel}>Device Access</Text>
          <View style={styles.infoList}>
            {devicePermissionRows.map((row, idx) => {
              const status = devicePerms[row.key];
              const isGranted = status === 'granted';
              return (
                <View
                  key={row.key}
                  style={[
                    styles.permRow,
                    idx === devicePermissionRows.length - 1 ? styles.infoRowLast : null,
                  ]}
                >
                  <View style={styles.permIconWrap}>{row.icon}</View>
                  <View style={styles.capCopy}>
                    <Text style={styles.capTitle}>{row.title}</Text>
                    <Text style={styles.capDetail}>{row.detail}</Text>
                  </View>
                  {isGranted ? (
                    <View style={styles.permGrantedBadge}>
                      <Text style={styles.permGrantedText}>Allowed</Text>
                    </View>
                  ) : (
                    <Pressable
                      testID={`mobile-perm-btn-${row.key}`}
                      onPress={() => {
                        void handleRequestDevicePerm(row.key);
                      }}
                      accessibilityRole="button"
                      style={styles.permActionBtn}
                    >
                      <Text style={styles.permActionText}>
                        {status === 'blocked'
                          ? 'Settings'
                          : status === 'unavailable'
                            ? permissionStatusLabel(status)
                            : 'Allow'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>

          <Text style={styles.subsectionLabel}>App Services</Text>
          <View style={styles.infoList}>
            <View style={styles.serviceRow}>
              <View style={styles.capCopy}>
                <Text style={styles.capTitle}>Live Sync</Text>
                <Text style={styles.capDetail}>Sync incoming documents automatically</Text>
              </View>
              <Switch
                testID="mobile-service-live-sync-switch"
                value={servicePerms.liveSyncEnabled}
                onValueChange={(next) => {
                  void handleToggleServicePerm('liveSyncEnabled', next);
                }}
                trackColor={{ false: '#CBD5E1', true: SDO_COLORS.navy }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.serviceRow}>
              <View style={styles.capCopy}>
                <Text style={styles.capTitle}>Offline Cache</Text>
                <Text style={styles.capDetail}>Save captures when offline</Text>
              </View>
              <Switch
                testID="mobile-service-offline-cache-switch"
                value={servicePerms.offlineCacheEnabled}
                onValueChange={(next) => {
                  void handleToggleServicePerm('offlineCacheEnabled', next);
                }}
                trackColor={{ false: '#CBD5E1', true: SDO_COLORS.navy }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.serviceRow}>
              <View style={styles.capCopy}>
                <Text style={styles.capTitle}>Document Alerts</Text>
                <Text style={styles.capDetail}>Hide titles on lock screen</Text>
              </View>
              <Switch
                testID="mobile-service-alerts-switch"
                value={servicePerms.custodyAlertsEnabled}
                onValueChange={(next) => {
                  void handleToggleServicePerm('custodyAlertsEnabled', next);
                }}
                trackColor={{ false: '#CBD5E1', true: SDO_COLORS.navy }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={[styles.serviceRow, styles.infoRowLast]}>
              <View style={styles.capCopy}>
                <Text style={styles.capTitle}>Screenshot Shield</Text>
                <Text style={styles.capDetail}>Block screenshots on restricted files</Text>
              </View>
              <Switch
                testID="mobile-service-screenshot-switch"
                value={securityPrefs.screenshotShieldEnabled}
                disabled={isBusy}
                onValueChange={(next) => {
                  updateSecurityPrefs({ screenshotShieldEnabled: next }).catch(() => {});
                }}
                trackColor={{ false: '#CBD5E1', true: SDO_COLORS.navy }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* System Information (Public-Safe, Zero Secrets) */}
        <View testID="mobile-system-info-card" style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Info size={15} color={SDO_COLORS.navy} />
            <Text style={styles.sectionTitle}>System Information</Text>
          </View>

          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Application</Text>
              <Text style={styles.infoValue}>Tracely</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoMono}>{MOBILE_APP_VERSION}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform</Text>
              <Text style={styles.infoValue}>Mobile App</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <View style={styles.labelIconRow}>
                <Code2 size={13} color={SDO_COLORS.textMuted} />
                <Text style={styles.infoLabel}>Developer</Text>
              </View>
              <Text testID="mobile-system-developer" style={styles.infoValueStrong}>
                Andrei Obligar
              </Text>
            </View>
          </View>
        </View>

        {/* Account & Legal */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account &amp; Legal</Text>

          <Pressable
            testID="mobile-settings-open-profile-btn"
            onPress={() => setActiveTab('user_profile')}
            style={styles.navActionRow}
          >
            <View style={styles.navActionLeft}>
              <View style={styles.capIconWrap}>
                <Palette size={15} color={SDO_COLORS.navy} />
              </View>
              <Text style={styles.capTitle}>Profile &amp; ID Color</Text>
            </View>
            <ChevronRight size={16} color={SDO_COLORS.textMuted} />
          </Pressable>

          <Pressable
            testID="mobile-settings-open-security-btn"
            onPress={() => setActiveTab('profile')}
            style={styles.navActionRow}
          >
            <View style={styles.navActionLeft}>
              <View style={styles.capIconWrap}>
                <ShieldCheck size={15} color={SDO_COLORS.emeraldText} />
              </View>
              <Text style={styles.capTitle}>Security &amp; Availability</Text>
            </View>
            <ChevronRight size={16} color={SDO_COLORS.textMuted} />
          </Pressable>

          <Pressable
            testID="mobile-settings-terms-btn"
            onPress={() => setLegalSheetTab('terms')}
            style={styles.navActionRow}
          >
            <View style={styles.navActionLeft}>
              <View style={styles.capIconWrap}>
                <FileText size={15} color={SDO_COLORS.navy} />
              </View>
              <Text style={styles.capTitle}>Terms &amp; Conditions</Text>
            </View>
            <ChevronRight size={16} color={SDO_COLORS.textMuted} />
          </Pressable>

          <Pressable
            testID="mobile-settings-privacy-btn"
            onPress={() => setLegalSheetTab('privacy')}
            style={styles.navActionRow}
          >
            <View style={styles.navActionLeft}>
              <View style={styles.capIconWrap}>
                <ShieldCheck size={15} color={SDO_COLORS.navy} />
              </View>
              <Text style={styles.capTitle}>Privacy Policy</Text>
            </View>
            <ChevronRight size={16} color={SDO_COLORS.textMuted} />
          </Pressable>
        </View>

        {actor ? (
          <Pressable
            testID="mobile-settings-signout-btn"
            disabled={isBusy}
            onPress={() => {
              signOutAndWipeCache().catch(() => {});
            }}
            accessibilityRole="button"
            style={[styles.signOutBtn, isBusy && styles.disabled]}
          >
            <LogOut size={15} color="#FFFFFF" />
            <Text style={styles.signOutBtnText}>Sign Out</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <LegalPolicySheet
        open={legalSheetTab !== null}
        initialTab={legalSheetTab ?? 'terms'}
        onClose={() => setLegalSheetTab(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SDO_COLORS.bg,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 16,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 36,
    gap: 16,
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  brandCopy: {
    flex: 1,
    gap: 1,
  },
  brandName: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 19,
    fontWeight: '900',
    color: SDO_COLORS.navyInk,
  },
  brandTagline: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
  },
  sectionCard: {
    borderRadius: 18,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 15,
    gap: 11,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  prefGroup: {
    gap: 6,
  },
  prefLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: SDO_COLORS.surface,
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
  },
  segBtn: {
    flex: 1,
    minHeight: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segBtnActive: {
    backgroundColor: SDO_COLORS.navy,
  },
  segText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  segTextActive: {
    color: '#FFFFFF',
  },
  subsectionLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textMuted,
    marginTop: 2,
  },
  infoList: {
    borderRadius: 14,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
  },
  permRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  permIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permGrantedBadge: {
    borderRadius: 999,
    backgroundColor: SDO_COLORS.emeraldSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  permGrantedText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '800',
    color: SDO_COLORS.emeraldText,
  },
  permActionBtn: {
    borderRadius: 999,
    backgroundColor: SDO_COLORS.navy,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  permActionText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  labelIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
  },
  infoValue: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
    textAlign: 'right',
    flexShrink: 1,
  },
  infoValueStrong: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '800',
    color: SDO_COLORS.navy,
    textAlign: 'right',
  },
  infoMono: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: SDO_FONTS.mono,
    color: SDO_COLORS.textPrimary,
  },
  capIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: SDO_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  capCopy: {
    flex: 1,
    gap: 2,
  },
  capTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  capDetail: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: SDO_COLORS.textSecondary,
  },
  navActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.surface,
    padding: 12,
  },
  navActionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  signOutBtn: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.rose,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  signOutBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.55,
  },
});

export default SettingsScreen;
