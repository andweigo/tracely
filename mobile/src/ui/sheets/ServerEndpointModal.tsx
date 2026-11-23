import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppServices } from '../../state/AppServiceContext';
import { ModalSheet } from '../components/ModalSheet';
import { SDO_COLORS } from '../theme/tokens';

interface ServerEndpointModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Shared modal sheet for configuring the Tracely API v1 base URL.
 */
export const ServerEndpointModal: React.FC<ServerEndpointModalProps> = ({ open, onClose }) => {
  const { apiBaseUrl, updateApiBaseUrl, isBusy } = useAppServices();
  const [serverUrlDraft, setServerUrlDraft] = useState(apiBaseUrl);

  useEffect(() => {
    if (open) {
      setServerUrlDraft(apiBaseUrl);
    }
  }, [open, apiBaseUrl]);

  const handleSave = async () => {
    try {
      await updateApiBaseUrl(serverUrlDraft);
      onClose();
    } catch {
      // Validation message is surfaced via AppServiceContext toast
    }
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="Backend API Endpoint"
      subtitle="Configure your Tracely API v1 server URL"
    >
      <View style={styles.field}>
        <Text style={styles.label}>API Base URL</Text>
        <TextInput
          value={serverUrlDraft}
          onChangeText={setServerUrlDraft}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="http://127.0.0.1:8000/api/v1"
          placeholderTextColor={SDO_COLORS.textMuted}
          style={styles.input}
        />
      </View>
      <View style={styles.presetRow}>
        <Pressable
          onPress={() => setServerUrlDraft('http://127.0.0.1:8000/api/v1')}
          style={styles.presetChip}
        >
          <Text style={styles.presetChipText}>ADB / USB (:8000)</Text>
        </Pressable>
        <Pressable
          onPress={() => setServerUrlDraft('http://10.0.2.2:8000/api/v1')}
          style={styles.presetChip}
        >
          <Text style={styles.presetChipText}>Emulator (10.0.2.2)</Text>
        </Pressable>
      </View>
      <Pressable
        disabled={isBusy || !serverUrlDraft.trim()}
        onPress={handleSave}
        style={[
          styles.saveBtn,
          (isBusy || !serverUrlDraft.trim()) && styles.disabled,
        ]}
      >
        <Text style={styles.saveBtnText}>Save Endpoint</Text>
      </Pressable>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  input: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 16,
    fontSize: 12,
    fontFamily: 'monospace',
    color: SDO_COLORS.textPrimary,
  },
  saveBtn: {
    minHeight: 46,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  disabled: {
    opacity: 0.45,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
});
