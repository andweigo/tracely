import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertOctagon, RotateCcw } from 'lucide-react-native';
import { ModalSheet } from '../components/ModalSheet';
import { SDO_COLORS } from '../theme/tokens';

export type RemarksActionMode = 'return_revision' | 'decline_misrouted';

const MODE_COPY: Record<
  RemarksActionMode,
  {
    title: string;
    subtitle: string;
    label: string;
    placeholder: string;
    cta: string;
    bg: string;
    textColor: string;
  }
> = {
  return_revision: {
    title: 'Return for Revision',
    subtitle: 'Existing versions remain preserved read-only with SHA-256 checksums.',
    label: 'Mandatory Revision Remarks',
    placeholder: 'Specify missing pages, corrections, or signatures needed for v2...',
    cta: 'Return to Originating Office',
    bg: SDO_COLORS.amber,
    textColor: SDO_COLORS.navyInk,
  },
  decline_misrouted: {
    title: 'Decline / Flag Misrouted',
    subtitle: 'Custody reverts immediately to the sending unit with an audit record.',
    label: 'Mandatory Misrouting Reason',
    placeholder: 'Explain why this document does not belong in your office...',
    cta: 'Flag Misrouted & Return Custody',
    bg: SDO_COLORS.rose,
    textColor: '#FFFFFF',
  },
};

interface ActionRemarksSheetProps {
  open: boolean;
  mode: RemarksActionMode;
  trackingCode: string;
  onClose: () => void;
  onConfirm: (remarks: string) => void;
}

export const ActionRemarksSheet: React.FC<ActionRemarksSheetProps> = ({
  open,
  mode,
  trackingCode,
  onClose,
  onConfirm,
}) => {
  const [remarks, setRemarks] = useState('');
  const cfg = MODE_COPY[mode];

  const handleSubmit = () => {
    if (!remarks.trim()) return;
    onConfirm(remarks);
    setRemarks('');
    onClose();
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={`${cfg.title} (${trackingCode})`}
      subtitle={cfg.subtitle}
    >
      <View style={styles.block}>
        <Text style={styles.label}>{cfg.label}</Text>
        <TextInput
          multiline
          numberOfLines={4}
          value={remarks}
          onChangeText={setRemarks}
          placeholder={cfg.placeholder}
          placeholderTextColor={SDO_COLORS.textMuted}
          style={styles.textarea}
        />
      </View>

      <Pressable
        disabled={!remarks.trim()}
        onPress={handleSubmit}
        style={[
          styles.submitBtn,
          { backgroundColor: cfg.bg },
          !remarks.trim() && styles.disabled,
        ]}
      >
        {mode === 'return_revision' ? (
          <RotateCcw size={17} color={cfg.textColor} />
        ) : (
          <AlertOctagon size={17} color={cfg.textColor} />
        )}
        <Text style={[styles.submitText, { color: cfg.textColor }]}>{cfg.cta}</Text>
      </Pressable>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  block: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  textarea: {
    minHeight: 96,
    borderRadius: 16,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 14,
    fontSize: 13,
    color: SDO_COLORS.textPrimary,
    textAlignVertical: 'top',
  },
  submitBtn: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
  },
  disabled: {
    opacity: 0.45,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
