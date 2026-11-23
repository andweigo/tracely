import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ArrowLeft,
  ChevronRight,
  Code2,
  Cpu,
  FolderKanban,
  Info,
  Layers,
  Menu,
  Palette,
  QrCode,
  ShieldCheck,
} from 'lucide-react-native';
import { useAppServices } from '../../state/AppServiceContext';
import { AppIconBadge } from '../components/AppIconBadge';
import { SDO_COLORS } from '../theme/tokens';

const SYSTEM_CAPABILITIES: ReadonlyArray<{
  readonly title: string;
  readonly detail: string;
}> = [
  {
    title: 'Verified QR Custody & Sealed Transfers',
    detail: 'Track physical and digital document handoffs with tamper-evident receipt steps.',
  },
  {
    title: 'Routing Flow Analytics',
    detail: 'Visualize per-user and per-office outgoing document corridors and transit volume.',
  },
  {
    title: 'High-Scale Interactive Desk Folders',
    detail: 'Organize active records with priority sheets and searchable paginated ledgers.',
  },
  {
    title: 'Offline Capture Queue & Privacy Guard',
    detail: 'Capture receipts offline and protect restricted records with device-level privacy controls.',
  },
];

export const SettingsScreen: React.FC = () => {
  const { setActiveTab, goBack, openSidebar } = useAppServices();

  return (
    <View testID="mobile-settings-screen" style={styles.screen}>
      <View style={styles.topHeader}>
        <Pressable
          onPress={() => goBack()}
          accessibilityLabel="Back to dashboard"
          style={styles.circleBtn}
        >
          <ArrowLeft size={18} color={SDO_COLORS.navyInk} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings &amp; System Info</Text>
        <Pressable
          onPress={openSidebar}
          accessibilityLabel="Open navigation sidebar"
          style={styles.circleBtn}
        >
          <Menu size={18} color={SDO_COLORS.navyInk} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* System Identity Header */}
        <View style={styles.brandBlock}>
          <AppIconBadge size={48} animated />
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>Tracely</Text>
            <Text style={styles.brandTagline}>
              Document Custody, Routing &amp; QR Tracking Workspace
            </Text>
          </View>
        </View>

        {/* System Information Table (Public-Safe, Zero Secrets) */}
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
              <Text style={styles.infoMono}>1.0.0</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Platform</Text>
              <Text style={styles.infoValue}>Mobile Companion App</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.labelIconRow}>
                <Code2 size={13} color={SDO_COLORS.textMuted} />
                <Text style={styles.infoLabel}>Developer</Text>
              </View>
              <Text testID="mobile-system-developer" style={styles.infoValueStrong}>
                Andrei Obligar
              </Text>
            </View>
            <View style={styles.infoRow}>
              <View style={styles.labelIconRow}>
                <Cpu size={13} color={SDO_COLORS.textMuted} />
                <Text style={styles.infoLabel}>Architecture</Text>
              </View>
              <Text style={styles.infoValue}>Encrypted Workspace · QR Ledger</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowLast]}>
              <View style={styles.labelIconRow}>
                <ShieldCheck size={13} color={SDO_COLORS.emeraldText} />
                <Text style={styles.infoLabel}>Security Model</Text>
              </View>
              <Text style={styles.infoValue}>TLS · RBAC · Privacy Masking</Text>
            </View>
          </View>
        </View>

        {/* Core Capabilities */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Layers size={15} color={SDO_COLORS.navy} />
            <Text style={styles.sectionTitle}>Core Capabilities</Text>
          </View>

          <View style={styles.capList}>
            {SYSTEM_CAPABILITIES.map((cap, idx) => (
              <View
                key={cap.title}
                style={[
                  styles.capRow,
                  idx === SYSTEM_CAPABILITIES.length - 1 ? styles.capRowLast : null,
                ]}
              >
                <View style={styles.capIconWrap}>
                  {idx % 2 === 0 ? (
                    <QrCode size={14} color={SDO_COLORS.navy} />
                  ) : (
                    <FolderKanban size={14} color={SDO_COLORS.navy} />
                  )}
                </View>
                <View style={styles.capCopy}>
                  <Text style={styles.capTitle}>{cap.title}</Text>
                  <Text style={styles.capDetail}>{cap.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Settings Navigation */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Workspace Preferences</Text>

          <Pressable
            testID="mobile-settings-open-profile-btn"
            onPress={() => setActiveTab('user_profile')}
            style={styles.navActionRow}
          >
            <View style={styles.navActionLeft}>
              <View style={styles.capIconWrap}>
                <Palette size={15} color={SDO_COLORS.navy} />
              </View>
              <View style={styles.capCopy}>
                <Text style={styles.capTitle}>Profile Theme &amp; Lanyard Color</Text>
                <Text style={styles.capDetail}>
                  Customize accent color, personal details, and routing defaults
                </Text>
              </View>
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
              <View style={styles.capCopy}>
                <Text style={styles.capTitle}>Availability &amp; Device Privacy Guard</Text>
                <Text style={styles.capDetail}>
                  Manage screenshot shield, device lock, and active sessions
                </Text>
              </View>
            </View>
            <ChevronRight size={16} color={SDO_COLORS.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.footerCaption}>
          Tracely · Designed &amp; Developed by Andrei Obligar
        </Text>
      </ScrollView>
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
    fontSize: 16,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 36,
    gap: 16,
  },
  brandBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 6,
  },
  brandCopy: {
    flex: 1,
    gap: 2,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '900',
    color: SDO_COLORS.navyInk,
    letterSpacing: -0.3,
  },
  brandTagline: {
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
    lineHeight: 16,
  },
  sectionCard: {
    borderRadius: 18,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
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
  infoRowLast: {
    borderBottomWidth: 0,
  },
  labelIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
    textAlign: 'right',
    flexShrink: 1,
  },
  infoValueStrong: {
    fontSize: 12.5,
    fontWeight: '800',
    color: SDO_COLORS.navy,
    textAlign: 'right',
  },
  infoMono: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: SDO_COLORS.textPrimary,
  },
  capList: {
    gap: 10,
  },
  capRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
  },
  capRowLast: {
    paddingBottom: 0,
    borderBottomWidth: 0,
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
    fontSize: 12.5,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  capDetail: {
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
  footerCaption: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
    marginTop: 4,
  },
});

export default SettingsScreen;
