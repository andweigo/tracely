import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertCircle, Camera, Keyboard, Lock } from 'lucide-react-native';
import { ModalSheet } from '../components/ModalSheet';
import { SDO_COLORS } from '../theme/tokens';

interface QrTokenEntryModalProps {
  open: boolean;
  isBusy?: boolean;
  expectedTrackingCode?: string | null;
  onOpenScanner?: () => void;
  onClose: () => void;
  onSubmitToken: (rawToken: string) => Promise<void>;
}

/**
 * Shared modal sheet for manual QR token or Tracking Code entry across Inbox, Scanner,
 * and locked Document Detail screens.
 */
export const QrTokenEntryModal: React.FC<QrTokenEntryModalProps> = ({
  open,
  isBusy = false,
  expectedTrackingCode,
  onOpenScanner,
  onClose,
  onSubmitToken,
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setErrorMsg(null);
    }
  }, [open]);

  const handleResolve = async () => {
    const clean = tokenInput.trim();
    if (!clean || isBusy) return;
    setErrorMsg(null);
    try {
      await onSubmitToken(clean);
      setTokenInput('');
      setErrorMsg(null);
      onClose();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Unable to verify this code. Check the tracking code or QR token and try again.',
      );
    }
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="Enter QR Token / Code"
      subtitle={
        expectedTrackingCode
          ? "Enter the 6-char Tracely Web code, Tracking Code, or QR token to verify and unlock access"
          : 'Enter a 6-char Tracely Web code (e.g. K7P-492), Tracking Code (TRC-2026-000142), or QR token'
      }
    >
      <View style={styles.inputRow}>
        <Keyboard size={16} color={SDO_COLORS.textMuted} />
        <TextInput
          value={tokenInput}
          onChangeText={(text) => {
            setTokenInput(text);
            if (errorMsg) setErrorMsg(null);
          }}
          placeholder="K7P-492, TRC-2026-000142, or TRC-QR:DOC:..."
          placeholderTextColor={SDO_COLORS.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => {
            handleResolve().catch(() => {});
          }}
          style={styles.input}
        />
      </View>

      {errorMsg ? (
        <View style={styles.errorBox} testID="mobile-manual-qr-error">
          <AlertCircle size={14} color={SDO_COLORS.roseText} />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      <View style={styles.securityNote}>
        <Lock size={13} color={SDO_COLORS.navy} />
        <Text style={styles.securityNoteText}>
          Accepts 6-char Tracely Web Unlock Code (K7P-492), Tracking Code (TRC-2026-000142), or
          full QR payload (TRC-QR:DOC:...). Server role custody rules still verify access.
        </Text>
      </View>

      <Pressable
        disabled={isBusy || !tokenInput.trim()}
        onPress={() => {
          handleResolve().catch(() => {});
        }}
        style={[
          styles.submitBtn,
          (isBusy || !tokenInput.trim()) && styles.disabled,
        ]}
      >
        <Text style={styles.submitBtnText}>
          {isBusy ? 'Verifying Token...' : 'Verify & Resolve'}
        </Text>
      </Pressable>

      {onOpenScanner ? (
        <Pressable
          onPress={() => {
            onClose();
            onOpenScanner();
          }}
          style={styles.scannerBtn}
        >
          <Camera size={15} color={SDO_COLORS.navy} />
          <Text style={styles.scannerBtnText}>Open Camera QR Scanner Instead</Text>
        </Pressable>
      ) : null}
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
    fontFamily: 'monospace',
    fontSize: 13,
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
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.skySoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  securityNoteText: {
    flex: 1,
    fontSize: 11,
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
  scannerBtn: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scannerBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  disabled: {
    opacity: 0.45,
  },
});
