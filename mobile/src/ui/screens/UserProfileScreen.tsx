import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowLeft,
  BellOff,
  Check,
  FileText,
  Fingerprint,
  KeyRound,
  Lock,
  LogOut,
  MapPin,
  Palette,
  Phone,
  Radio,
  Settings,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  UserCircle2,
} from 'lucide-react-native';
import {
  AVATAR_COLOR_SWATCHES,
  LandingTabPreference,
} from '../../domain/entities/Personnel';
import { RoutingScope } from '../../domain/enums/DomainEnums';
import { DISPOSITION_REMARK_PRESETS } from '../../repositories/contracts/IDocumentRepository';
import { useAppServices } from '../../state/AppServiceContext';
import { MobileIdentityWalletCard } from '../components/MobileIdentityWalletCard';
import { AuditInspectorSheet } from '../sheets/AuditInspectorSheet';
import {
  ActiveSessionsModal,
  ChangePasswordModal,
} from '../sheets/SecurityActionsSheet';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';
import { formatShortTimestamp } from '../utils/formatters';

type UserProfileTab = 'info' | 'preferences' | 'settings';

export const UserProfileScreen: React.FC = () => {
  const {
    actor,
    sessionMetadata,
    securityPrefs,
    userPreferences,
    realtimeStatus,
    fcmConfigured,
    auditLogs,
    isBusy,
    updateProfile,
    updateUserPreferences,
    updateSecurityPrefs,
    signOutAndWipeCache,
    goBack,
  } = useAppServices();

  const [tab, setTab] = useState<UserProfileTab>('info');

  // Personal Info state
  const [fullName, setFullName] = useState(actor?.fullName ?? '');
  const [email, setEmail] = useState(actor?.email ?? '');
  const [position, setPosition] = useState(actor?.position ?? '');
  const [contactNumber, setContactNumber] = useState(actor?.contactNumber ?? '');
  const [deskNote, setDeskNote] = useState(actor?.deskNote ?? '');
  const [avatarColor, setAvatarColor] = useState(actor?.avatarColor ?? '#0D3472');

  // Preferences state
  const [defaultCopyFormat, setDefaultCopyFormat] = useState<'digital' | 'hard_copy'>(
    userPreferences.defaultCopyFormat,
  );
  const [defaultRoutingScope, setDefaultRoutingScope] = useState<RoutingScope>(
    userPreferences.defaultRoutingScope,
  );
  const [defaultRemarks, setDefaultRemarks] = useState(userPreferences.defaultRemarks);
  const [defaultLandingScreen, setDefaultLandingScreen] = useState<LandingTabPreference>(
    userPreferences.defaultLandingScreen,
  );
  const [compactDensity, setCompactDensity] = useState(userPreferences.compactDensity);
  const [notificationSound, setNotificationSound] = useState(userPreferences.notificationSound);
  const [hideLockScreenTitles, setHideLockScreenTitles] = useState(
    userPreferences.hideLockScreenTitles,
  );

  // Settings modals
  const [showAudit, setShowAudit] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    if (!actor) return;
    setFullName(actor.fullName);
    setEmail(actor.email);
    setPosition(actor.position);
    setContactNumber(actor.contactNumber ?? '');
    setDeskNote(actor.deskNote ?? '');
    setAvatarColor(actor.avatarColor || '#0D3472');
  }, [actor]);

  useEffect(() => {
    setDefaultCopyFormat(userPreferences.defaultCopyFormat);
    setDefaultRoutingScope(userPreferences.defaultRoutingScope);
    setDefaultRemarks(userPreferences.defaultRemarks);
    setDefaultLandingScreen(userPreferences.defaultLandingScreen);
    setCompactDensity(userPreferences.compactDensity);
    setNotificationSound(userPreferences.notificationSound);
    setHideLockScreenTitles(userPreferences.hideLockScreenTitles);
  }, [userPreferences]);

  const handleSaveInfo = () => {
    updateProfile({
      fullName: fullName.trim(),
      position: position.trim(),
      contactNumber: contactNumber.trim() || null,
      deskNote: deskNote.trim() || null,
      avatarColor,
    }).catch(() => {});
  };

  const handleSavePreferences = () => {
    updateUserPreferences({
      defaultCopyFormat,
      defaultRoutingScope,
      defaultRemarks: defaultRemarks.trim(),
      defaultLandingScreen,
      compactDensity,
      notificationSound,
      hideLockScreenTitles,
    }).catch(() => {});
  };

  return (
    <View style={styles.screen} testID="mobile-user-profile-screen">
      <View style={styles.topHeader}>
        <Pressable
          onPress={() => goBack()}
          accessibilityLabel="Back to Desk Profile"
          style={styles.circleBtn}
        >
          <ArrowLeft size={18} color={SDO_COLORS.navyInk} />
        </Pressable>
        <Text style={styles.headerTitle}>User Profile & Settings</Text>
        <View style={styles.circlePlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        <MobileIdentityWalletCard
          testID="mobile-user-profile-wallet-card"
          liveSyncBadge="Live Personnel Pass · Synced With Your Profile"
          fullName={fullName || actor?.fullName || 'User Profile'}
          employeeId={actor?.employeeId ?? 'EMP-2026-0001'}
          position={position || actor?.position || 'Staff'}
          officeCode={actor?.office.code ?? 'RECORDS'}
          officeName={actor?.office.name ?? 'Records & Registry'}
          roleLabel={actor?.roleLabel ?? 'Authorized Personnel'}
          email={actor?.email ?? email}
          accentColor={avatarColor}
          actionLabel={contactNumber.trim() || deskNote.trim() || 'Active Pass'}
          onActionPress={() => setTab('info')}
          defaultMasked={false}
        />

        <View style={styles.tabRow}>
          {(
            [
              { id: 'info', label: 'Personal Info', icon: UserCircle2 },
              { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
              { id: 'settings', label: 'Settings', icon: Settings },
            ] as const
          ).map((item) => {
            const active = tab === item.id;
            const Icon = item.icon;
            return (
              <Pressable
                key={item.id}
                testID={`mobile-user-profile-tab-${item.id}`}
                onPress={() => setTab(item.id)}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
              >
                <Icon size={13} color={active ? '#FFFFFF' : SDO_COLORS.textSecondary} />
                <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'info' ? (
          <>
            <View style={styles.softCard}>
              <Text style={styles.cardHeading}>Edit Personal Information</Text>

              <View style={styles.rowLeft}>
                <Palette size={13} color={SDO_COLORS.textMuted} />
                <Text style={styles.fieldLabel}>Avatar Theme Accent</Text>
              </View>
              <View style={styles.swatchRow}>
                {AVATAR_COLOR_SWATCHES.map((swatch) => {
                  const selected = avatarColor === swatch.hex;
                  return (
                    <Pressable
                      key={swatch.hex}
                      testID={`mobile-avatar-color-${swatch.label}`}
                      onPress={() => setAvatarColor(swatch.hex)}
                      style={[
                        styles.swatchChip,
                        selected && { backgroundColor: swatch.hex, borderColor: swatch.hex },
                      ]}
                    >
                      <View style={[styles.swatchDot, { backgroundColor: swatch.hex }]} />
                      <Text
                        style={[
                          styles.swatchLabel,
                          selected && styles.swatchLabelActive,
                        ]}
                      >
                        {swatch.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.fieldLabel}>Full Name</Text>
              <TextInput
                testID="mobile-profile-fullname-input"
                value={fullName}
                onChangeText={setFullName}
                maxLength={50}
                placeholder="e.g. Marco A. Villareal"
                placeholderTextColor={SDO_COLORS.textMuted}
                style={styles.input}
              />

              <View style={styles.rowLeft}>
                <Lock size={12} color={SDO_COLORS.textMuted} />
                <Text style={styles.fieldLabel}>Official Email Address (Read-Only)</Text>
              </View>
              <TextInput
                testID="mobile-profile-email-input"
                value={actor?.email ?? email}
                editable={false}
                selectTextOnFocus={false}
                accessibilityState={{ disabled: true }}
                placeholder="name@tracely.app"
                placeholderTextColor={SDO_COLORS.textMuted}
                style={[styles.input, styles.inputReadOnly]}
              />

              <Text style={styles.fieldLabel}>Position / Designation</Text>
              <TextInput
                testID="mobile-profile-position-input"
                value={position}
                onChangeText={setPosition}
                maxLength={80}
                placeholder="e.g. Administrative Officer V"
                placeholderTextColor={SDO_COLORS.textMuted}
                style={styles.input}
              />

              <View style={styles.rowLeft}>
                <Phone size={12} color={SDO_COLORS.textMuted} />
                <Text style={styles.fieldLabel}>Contact Number / Local Ext.</Text>
              </View>
              <TextInput
                testID="mobile-profile-contact-input"
                value={contactNumber}
                onChangeText={setContactNumber}
                maxLength={32}
                keyboardType="phone-pad"
                placeholder="e.g. +63 917 555 0142"
                placeholderTextColor={SDO_COLORS.textMuted}
                style={styles.input}
              />

              <View style={styles.rowLeft}>
                <MapPin size={12} color={SDO_COLORS.textMuted} />
                <Text style={styles.fieldLabel}>Desk Location / Receiving Note</Text>
              </View>
              <TextInput
                testID="mobile-profile-desknote-input"
                value={deskNote}
                onChangeText={setDeskNote}
                maxLength={160}
                placeholder="e.g. 2nd Floor Finance Wing · Window 3"
                placeholderTextColor={SDO_COLORS.textMuted}
                style={styles.input}
              />

              <Pressable
                testID="mobile-save-profile-info-btn"
                disabled={isBusy || !actor || fullName.trim().length < 2 || position.trim().length < 2}
                onPress={handleSaveInfo}
                style={[
                  styles.primaryBtn,
                  (isBusy || !actor || fullName.trim().length < 2 || position.trim().length < 2) &&
                    styles.disabled,
                ]}
              >
                <Check size={15} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Save Profile Info</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {tab === 'preferences' ? (
          <View style={styles.softCard}>
            <Text style={styles.cardHeading}>Workflow & Routing Preferences</Text>

            <Text style={styles.fieldLabel}>Default Send Document Format</Text>
            <View style={styles.choiceRow}>
              {(
                [
                  { id: 'digital', label: 'Soft Copy (PDF/Scan)' },
                  { id: 'hard_copy', label: 'Hard Copy (QR Slip)' },
                ] as const
              ).map((opt) => {
                const active = defaultCopyFormat === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    testID={`mobile-pref-format-${opt.id}`}
                    onPress={() => setDefaultCopyFormat(opt.id)}
                    style={[styles.choicePill, active && styles.choicePillActive]}
                  >
                    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Default Forwarding Scope</Text>
            <View style={styles.choiceRow}>
              {(
                [
                  { id: RoutingScope.INTER_OFFICE, label: 'Inter-Office' },
                  { id: RoutingScope.INTERNAL_OFFICE, label: 'Internal Office' },
                ] as const
              ).map((opt) => {
                const active = defaultRoutingScope === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    testID={`mobile-pref-scope-${opt.id}`}
                    onPress={() => setDefaultRoutingScope(opt.id)}
                    style={[styles.choicePill, active && styles.choicePillActive]}
                  >
                    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Default Disposition Remark</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipScrollRow}>
                {['', ...DISPOSITION_REMARK_PRESETS].map((preset) => {
                  const active = defaultRemarks === preset;
                  const label = preset || 'None';
                  return (
                    <Pressable
                      key={label}
                      testID={`mobile-pref-remark-${label}`}
                      onPress={() => setDefaultRemarks(preset)}
                      style={[styles.swatchChip, active && styles.choicePillActive]}
                    >
                      <Text style={[styles.swatchLabel, active && styles.choiceTextActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <Text style={styles.fieldLabel}>Default Workspace Start Screen</Text>
            <View style={styles.choiceRow}>
              {(
                [
                  { id: 'inbox', label: 'Inbox' },
                  { id: 'scanner', label: 'Scanner' },
                  { id: 'sent', label: 'Sent' },
                  { id: 'track', label: 'Track' },
                ] as const
              ).map((opt) => {
                const active = defaultLandingScreen === opt.id;
                return (
                  <Pressable
                    key={opt.id}
                    testID={`mobile-pref-landing-${opt.id}`}
                    onPress={() => setDefaultLandingScreen(opt.id)}
                    style={[styles.choicePill, active && styles.choicePillActive]}
                  >
                    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Compact Card Density</Text>
                <Text style={styles.toggleSub}>Fit more documents on screen</Text>
              </View>
              <Switch
                value={compactDensity}
                onValueChange={setCompactDensity}
                trackColor={{ false: '#CBD5E1', true: SDO_COLORS.navy }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Notification Alert Chime</Text>
                <Text style={styles.toggleSub}>Play audio cue on incoming routing alerts</Text>
              </View>
              <Switch
                value={notificationSound}
                onValueChange={setNotificationSound}
                trackColor={{ false: '#CBD5E1', true: SDO_COLORS.navy }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Mask Lock-Screen Titles (Privacy)</Text>
                <Text style={styles.toggleSub}>
                  Hide document titles and sender names on lock-screen alerts
                </Text>
              </View>
              <Switch
                value={hideLockScreenTitles}
                onValueChange={setHideLockScreenTitles}
                trackColor={{ false: '#CBD5E1', true: SDO_COLORS.navy }}
                thumbColor="#FFFFFF"
              />
            </View>

            <Pressable
              testID="mobile-save-preferences-btn"
              disabled={isBusy}
              onPress={handleSavePreferences}
              style={[styles.primaryBtn, isBusy && styles.disabled]}
            >
              <Check size={15} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Save Preferences</Text>
            </Pressable>
          </View>
        ) : null}

        {tab === 'settings' ? (
          <View style={styles.softCard}>
            <Text style={styles.cardHeading}>Account & Security Settings</Text>

            {sessionMetadata ? (
              <View style={styles.readOnlyBox}>
                <View style={styles.rowBetween}>
                  <View style={styles.rowLeft}>
                    <KeyRound size={13} color={SDO_COLORS.textMuted} />
                    <Text style={styles.metaLabel}>Sanctum Token</Text>
                  </View>
                  <Text style={styles.metaMono}>{sessionMetadata.tokenHint}</Text>
                </View>
                <View style={styles.rowBetween}>
                  <Text style={styles.metaLabel}>Expires</Text>
                  <Text style={styles.metaVal}>
                    {formatShortTimestamp(sessionMetadata.expiresAt)}
                  </Text>
                </View>
              </View>
            ) : null}

            <View style={styles.livePulseRow}>
              <Radio
                size={15}
                color={realtimeStatus === 'live' ? SDO_COLORS.emeraldText : SDO_COLORS.navy}
              />
              <Text style={styles.livePulseText}>
                {realtimeStatus === 'live'
                  ? `Real-Time Live Pulse Active (3s) · ${fcmConfigured ? 'FCM Push Live' : 'SSE & Push Ready'}`
                  : `Background Sync Polling · ${fcmConfigured ? 'FCM Push Live' : 'SSE & Push Ready'}`}
              </Text>
            </View>

            <View style={styles.toggleRow}>
              <Fingerprint size={16} color={SDO_COLORS.navy} />
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Device Lock for Confidential Docs</Text>
                <Text style={styles.toggleSub}>
                  Require Android screen lock / biometrics before 60s viewing
                </Text>
              </View>
              <Switch
                value={securityPrefs.biometricGateEnabled}
                disabled={isBusy}
                onValueChange={(next) => {
                  updateSecurityPrefs({ biometricGateEnabled: next }).catch(() => {});
                }}
                trackColor={{ false: '#CBD5E1', true: SDO_COLORS.navy }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.toggleRow}>
              <BellOff size={16} color={SDO_COLORS.navy} />
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Hide Titles on Lock Screen</Text>
                <Text style={styles.toggleSub}>Mask titles inside push previews</Text>
              </View>
              <Switch
                value={securityPrefs.hideLockScreenTitles}
                disabled={isBusy}
                onValueChange={(next) => {
                  updateSecurityPrefs({ hideLockScreenTitles: next }).catch(() => {});
                }}
                trackColor={{ false: '#CBD5E1', true: SDO_COLORS.navy }}
                thumbColor="#FFFFFF"
              />
            </View>

            <View style={styles.toggleRow}>
              <Lock size={16} color={SDO_COLORS.navy} />
              <View style={styles.toggleCopy}>
                <Text style={styles.toggleTitle}>Screenshot Shield (FLAG_SECURE)</Text>
                <Text style={styles.toggleSub}>Block screenshots inside Tracely</Text>
              </View>
              <Switch
                value={securityPrefs.screenshotShieldEnabled}
                disabled={isBusy}
                onValueChange={(next) => {
                  updateSecurityPrefs({ screenshotShieldEnabled: next }).catch(() => {});
                }}
                trackColor={{ false: '#CBD5E1', true: SDO_COLORS.navy }}
                thumbColor="#FFFFFF"
              />
            </View>

            <Pressable onPress={() => setShowPasswordModal(true)} style={styles.whiteBtn}>
              <Lock size={16} color={SDO_COLORS.navy} />
              <Text style={styles.whiteBtnText}>Change Account Password</Text>
            </Pressable>

            <Pressable onPress={() => setShowSessionsModal(true)} style={styles.whiteBtn}>
              <Smartphone size={16} color={SDO_COLORS.navy} />
              <Text style={styles.whiteBtnText}>Active Devices & Sanctum Sessions</Text>
            </Pressable>

            <Pressable onPress={() => setShowAudit(true)} style={styles.whiteBtn}>
              <FileText size={16} color={SDO_COLORS.navy} />
              <Text style={styles.whiteBtnText}>
                Audit Trail ({auditLogs.length} loaded)
              </Text>
            </Pressable>

            {actor ? (
              <Pressable
                disabled={isBusy}
                onPress={() => {
                  signOutAndWipeCache().catch(() => {});
                }}
                style={[styles.wipeBtn, isBusy && styles.disabled]}
              >
                <Trash2 size={15} color="#FFFFFF" />
                <LogOut size={15} color="#FFFFFF" />
                <Text style={styles.wipeBtnText}>Sign Out & Wipe Local Cache</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <AuditInspectorSheet open={showAudit} onClose={() => setShowAudit(false)} />
      <ActiveSessionsModal open={showSessionsModal} onClose={() => setShowSessionsModal(false)} />
      <ChangePasswordModal open={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
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
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePlaceholder: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 16,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  container: {
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 14,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },
  tabBtnActive: {
    backgroundColor: SDO_COLORS.navy,
  },
  tabBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
  },
  softCard: {
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 16,
    gap: 10,
  },
  cardHeading: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  fieldLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: SDO_COLORS.textMuted,
  },
  input: {
    fontFamily: SDO_FONTS.sans,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: SDO_COLORS.textPrimary,
  },
  inputReadOnly: {
    backgroundColor: SDO_COLORS.surfaceSoft,
    color: SDO_COLORS.textSecondary,
  },
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  swatchChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  swatchDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
  },
  swatchLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  swatchLabelActive: {
    color: '#FFFFFF',
  },
  primaryBtn: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  primaryBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  helperHint: {
    fontSize: 11.5,
    lineHeight: 16,
    color: SDO_COLORS.textMuted,
  },
  readOnlyBox: {
    borderRadius: 14,
    backgroundColor: SDO_COLORS.surface,
    padding: 12,
    gap: 8,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.textSecondary,
  },
  metaMono: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: SDO_FONTS.mono,
    color: SDO_COLORS.textPrimary,
  },
  metaVal: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  choiceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  choicePill: {
    flex: 1,
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surface,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  choicePillActive: {
    backgroundColor: SDO_COLORS.navy,
    borderColor: SDO_COLORS.navy,
  },
  choiceText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  choiceTextActive: {
    color: '#FFFFFF',
  },
  chipScrollRow: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toggleCopy: {
    flex: 1,
    gap: 1,
  },
  toggleTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  toggleSub: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    lineHeight: 15,
    color: SDO_COLORS.textSecondary,
  },
  livePulseRow: {
    minHeight: 38,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.skySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  livePulseText: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  whiteBtn: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
  },
  whiteBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  whiteBtnUrl: {
    flex: 1,
    fontSize: 11,
    fontFamily: SDO_FONTS.mono,
    color: SDO_COLORS.navy,
  },
  wipeBtn: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.rose,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  wipeBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  disabled: {
    opacity: 0.45,
  },
});
