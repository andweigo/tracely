import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertCircle, KeyRound, ShieldCheck } from 'lucide-react-native';
import { ModalSheet } from '../components/ModalSheet';
import { SDO_COLORS } from '../theme/tokens';

interface PasswordUnlockModalProps {
  open: boolean;
  isBusy?: boolean;
  fromOfficeLabel?: string;
  onClose: () => void;
  onSubmitPassword: (password: string) => Promise<void>;
}

/**
 * Fallback unlock modal for Soft Copy transfers when the recipient does not have
 * Tracely Web nearby. Verifies the user's real account password on the server,
 * logs receipt in Track & Audit Log, and unlocks the document.
 */
export const PasswordUnlockModal: React.FC<PasswordUnlockModalProps> = ({
  open,
  isBusy = false,
  fromOfficeLabel,
  onClose,
  onSubmitPassword,
}) => {
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPassword('');
      setErrorMsg(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!password || isBusy) return;
    setErrorMsg(null);
    try {
      await onSubmitPassword(password);
      setPassword('');
      setErrorMsg(null);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Incorrect password. Please check your Tracely account password and try again.',
      );
    }
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="Unlock Soft Copy with Password"
      subtitle={
        fromOfficeLabel
          ? `Confirm receipt of the Soft Copy transfer from ${fromOfficeLabel} using your Tracely account password.`
          : 'No desktop nearby? Verify your Tracely account password to confirm receipt and unlock.'
      }
    >
      <View style={styles.inputRow}>
        <KeyRound size={16} color={SDO_COLORS.textMuted} />
        <TextInput
          testID="mobile-password-unlock-input"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (errorMsg) setErrorMsg(null);
          }}
          placeholder="Enter your Tracely password"
          placeholderTextColor={SDO_COLORS.textMuted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => {
            handleSubmit().catch(() => {});
          }}
          style={styles.input}
        />
      </View>

      {errorMsg ? (
        <View style={styles.errorBox} testID="mobile-password-unlock-error">
          <AlertCircle size={14} color={SDO_COLORS.roseText} />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      <View style={styles.auditNote}>
        <ShieldCheck size={14} color={SDO_COLORS.navy} />
        <Text style={styles.auditNoteText}>
          Password confirmation acts as an official digital receipt: it unlocks the file and logs a
          Received timestamp in Track and the Audit Log.
        </Text>
      </View>

      <Pressable
        testID="mobile-password-unlock-submit"
        disabled={isBusy || !password}
        onPress={() => {
          handleSubmit().catch(() => {});
        }}
        style={[styles.submitBtn, (isBusy || !password) && styles.disabled]}
      >
        <Text style={styles.submitBtnText}>
          {isBusy ? 'Verifying Password...' : 'Confirm Receipt & Unlock'}
        </Text>
      </Pressable>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  inputRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 13.5,
    color: SDO_COLORS.textPrimary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.roseSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
    color: SDO_COLORS.roseText,
  },
  auditNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.skySoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  auditNoteText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    color: SDO_COLORS.navy,
  },
  submitBtn: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  disabled: {
    opacity: 0.45,
  },
});
