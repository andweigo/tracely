import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyRound, Laptop, LogOut, Smartphone } from 'lucide-react-native';
import { AUTH_INPUT_LIMITS } from '../../domain/security/AuthInputPolicy';
import { useAppServices } from '../../state/AppServiceContext';
import { ModalSheet } from '../components/ModalSheet';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';
import { formatShortTimestamp } from '../utils/formatters';

interface SheetModalProps {
  open: boolean;
  onClose: () => void;
}

export const ActiveSessionsModal: React.FC<SheetModalProps> = ({ open, onClose }) => {
  const { actor, activeSessions, loadActiveSessions, revokeOtherSessions, isBusy } =
    useAppServices();

  useEffect(() => {
    if (open && actor) {
      loadActiveSessions().catch(() => {});
    }
  }, [open, actor, loadActiveSessions]);

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="Active Devices & Sessions"
      subtitle="Active device tokens issued to your verified Tracely account"
    >
      {!actor ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>Pre-Auth UI Mode</Text>
          <Text style={styles.noticeBody}>
            Once signed in to your Tracely account, connected mobile devices and desktop
            browsers appear here with remote session revocation.
          </Text>
        </View>
      ) : isBusy && activeSessions.length === 0 ? (
        <ActivityIndicator color={SDO_COLORS.navy} />
      ) : activeSessions.length === 0 ? (
        <Text style={styles.emptyText}>No active remote sessions reported by the server.</Text>
      ) : (
        <View style={styles.listGap}>
          {activeSessions.map((session) => (
            <View key={session.id} style={styles.sessionCard}>
              <View style={styles.sessionTop}>
                <View style={styles.rowLeft}>
                  {session.platform === 'web' ? (
                    <Laptop size={16} color={SDO_COLORS.navy} />
                  ) : (
                    <Smartphone size={16} color={SDO_COLORS.navy} />
                  )}
                  <Text style={styles.sessionName}>{session.deviceName}</Text>
                </View>
                {session.isCurrentDevice ? (
                  <Text style={styles.currentBadge}>THIS DEVICE</Text>
                ) : null}
              </View>
              <Text style={styles.sessionMeta}>
                Last active: {formatShortTimestamp(session.lastActiveAt)} · {session.ipHint}
              </Text>
            </View>
          ))}

          {activeSessions.some((s) => !s.isCurrentDevice) ? (
            <Pressable
              disabled={isBusy}
              onPress={() => {
                revokeOtherSessions().catch(() => {});
              }}
              style={[styles.revokeBtn, isBusy && styles.disabled]}
            >
              <LogOut size={15} color="#FFFFFF" />
              <Text style={styles.revokeBtnText}>
                {isBusy ? 'Revoking...' : 'Revoke All Other Devices'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </ModalSheet>
  );
};

export const ChangePasswordModal: React.FC<SheetModalProps> = ({ open, onClose }) => {
  const { actor, changePassword, isBusy } = useAppServices();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const resetFields = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async () => {
    try {
      await changePassword(currentPassword, newPassword, confirmPassword);
      resetFields();
      onClose();
    } catch {
      // Validation error surfaced via AppServiceContext toast
    }
  };

  return (
    <ModalSheet
      open={open}
      onClose={() => {
        resetFields();
        onClose();
      }}
      title="Change Account Password"
      subtitle={`Minimum ${AUTH_INPUT_LIMITS.passwordMin} characters · Synced across Web and Mobile`}
    >
      {!actor ? (
        <View style={styles.noticeBox}>
          <Text style={styles.noticeTitle}>Sign-In Required</Text>
          <Text style={styles.noticeBody}>
            Password management activates once backend Sanctum authentication is enabled and you
            are signed in.
          </Text>
        </View>
      ) : (
        <View style={styles.formGap}>
          <View style={styles.field}>
            <Text style={styles.label}>Current Password</Text>
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              maxLength={AUTH_INPUT_LIMITS.passwordMax}
              secureTextEntry
              placeholder="Enter current password"
              placeholderTextColor={SDO_COLORS.textMuted}
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>New Password (min {AUTH_INPUT_LIMITS.passwordMin} characters)</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              maxLength={AUTH_INPUT_LIMITS.passwordMax}
              secureTextEntry
              placeholder="Enter new strong password"
              placeholderTextColor={SDO_COLORS.textMuted}
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Confirm New Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              maxLength={AUTH_INPUT_LIMITS.passwordMax}
              secureTextEntry
              placeholder="Re-enter new password"
              placeholderTextColor={SDO_COLORS.textMuted}
              style={styles.input}
            />
          </View>
          <Pressable
            disabled={isBusy || !currentPassword || !newPassword || !confirmPassword}
            onPress={handleSubmit}
            style={[
              styles.submitBtn,
              (isBusy || !currentPassword || !newPassword || !confirmPassword) && styles.disabled,
            ]}
          >
            <KeyRound size={16} color={SDO_COLORS.navyInk} />
            <Text style={styles.submitText}>
              {isBusy ? 'Updating Password...' : 'Update Password'}
            </Text>
          </Pressable>
        </View>
      )}
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  listGap: {
    gap: 10,
  },
  sessionCard: {
    borderRadius: 16,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 14,
    gap: 4,
  },
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionName: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  currentBadge: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 9,
    fontWeight: '800',
    color: SDO_COLORS.emeraldText,
    backgroundColor: SDO_COLORS.emeraldSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  sessionMeta: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: SDO_COLORS.textSecondary,
    paddingLeft: 24,
  },
  revokeBtn: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.rose,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  revokeBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  noticeBox: {
    borderRadius: 16,
    backgroundColor: SDO_COLORS.skySoft,
    padding: 14,
    gap: 4,
  },
  noticeTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navy,
  },
  noticeBody: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: SDO_COLORS.textSecondary,
  },
  emptyText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    color: SDO_COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 14,
  },
  formGap: {
    gap: 12,
  },
  field: {
    gap: 6,
  },
  label: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  input: {
    fontFamily: SDO_FONTS.sans,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 16,
    fontSize: 14,
    color: SDO_COLORS.textPrimary,
  },
  submitBtn: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  submitText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  disabled: {
    opacity: 0.45,
  },
});
