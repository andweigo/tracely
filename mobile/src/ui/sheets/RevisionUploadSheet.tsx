import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import { FileText, FileUp, Pencil } from 'lucide-react-native';
import { Document } from '../../domain/entities/Document';
import { useAppServices } from '../../state/AppServiceContext';
import { ModalSheet } from '../components/ModalSheet';
import { SDO_COLORS } from '../theme/tokens';
import { formatBytes, normalizeUploadFileName } from '../utils/formatters';

interface RevisionUploadSheetProps {
  open: boolean;
  document: Document;
  nextVersionNumber: number;
  onClose: () => void;
}

export const RevisionUploadSheet: React.FC<RevisionUploadSheetProps> = ({
  open,
  document,
  nextVersionNumber,
  onClose,
}) => {
  const { uploadRevision, computeSha256FromUri, isBusy, notify } = useAppServices();
  const [selectedFile, setSelectedFile] = useState<{
    uri: string;
    originalName: string;
    name: string;
    mimeType: string;
    size: number;
    sha256: string;
  } | null>(null);
  const [hashing, setHashing] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');

  const handleChooseDocument = async () => {
    setHashing(true);
    try {
      const [file] = await pick({
        type: [types.pdf, types.images],
        mode: 'import',
      });
      const sha256 = await computeSha256FromUri(file.uri);
      const pickedName = file.name ?? `revision_v${nextVersionNumber}.pdf`;
      setSelectedFile({
        uri: file.uri,
        originalName: pickedName,
        name: pickedName,
        mimeType: file.type ?? 'application/pdf',
        size: file.size ?? 0,
        sha256,
      });
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      notify('error', err instanceof Error ? err.message : 'Unable to pick document file.');
    } finally {
      setHashing(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || !revisionNote.trim()) return;
    const normalizedName = normalizeUploadFileName(selectedFile.name, selectedFile.originalName);
    try {
      await uploadRevision(document, {
        documentId: document.id,
        fileUri: selectedFile.uri,
        fileName: normalizedName,
        mimeType: selectedFile.mimeType,
        sizeBytes: selectedFile.size,
        sha256Checksum: selectedFile.sha256,
        revisionNote,
      });
      setSelectedFile(null);
      setRevisionNote('');
      onClose();
    } catch {
      // Surfaced via AppServiceContext toast
    }
  };

  const disabled = !selectedFile || !revisionNote.trim() || hashing || isBusy;

  const isInitialScan = nextVersionNumber === 1;

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={
        isInitialScan
          ? 'Attach Scanned Copy (v1)'
          : `Upload Non-Destructive v${nextVersionNumber}`
      }
      subtitle={
        isInitialScan
          ? `${document.trackingCode} · Converts Hard Copy to Hard Copy + Scan`
          : `${document.trackingCode} · Prior versions remain preserved read-only`
      }
    >
      <View style={styles.block}>
        <Text style={styles.label}>
          {isInitialScan
            ? 'Scanned Document File (PDF or Image)'
            : 'Corrected Document File (PDF or Image)'}
        </Text>
        <Pressable
          disabled={hashing}
          onPress={handleChooseDocument}
          style={styles.filePickerBtn}
        >
          <FileText size={17} color={SDO_COLORS.navy} />
          <Text style={styles.filePickerText}>
            {hashing ? 'Computing SHA-256...' : 'Select File from Device'}
          </Text>
        </Pressable>

        {selectedFile ? (
          <View style={styles.fileCard}>
            <Text style={styles.fileName}>
              {`${normalizeUploadFileName(selectedFile.name, selectedFile.originalName)} (${formatBytes(selectedFile.size)})`}
            </Text>
            <View style={styles.renameRow}>
              <Pencil size={12} color={SDO_COLORS.textSecondary} />
              <Text style={styles.renameLabel}>File Name</Text>
            </View>
            <TextInput
              value={selectedFile.name}
              onChangeText={(text) =>
                setSelectedFile((prev) => (prev ? { ...prev, name: text } : null))
              }
              maxLength={180}
              accessibilityLabel={`File name for ${selectedFile.originalName}`}
              placeholder={selectedFile.originalName}
              placeholderTextColor={SDO_COLORS.textMuted}
              style={styles.renameInput}
            />
            <Text numberOfLines={1} style={styles.hashText}>
              SHA-256: {selectedFile.sha256}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.block}>
        <Text style={styles.label}>Revision Summary Note</Text>
        <TextInput
          multiline
          numberOfLines={3}
          value={revisionNote}
          onChangeText={setRevisionNote}
          placeholder="Describe corrections made for this revision..."
          placeholderTextColor={SDO_COLORS.textMuted}
          style={styles.textarea}
        />
      </View>

      <Pressable
        disabled={disabled}
        onPress={handleSubmit}
        style={[styles.submitBtn, disabled && styles.disabled]}
      >
        <FileUp size={18} color={SDO_COLORS.navyInk} />
        <Text style={styles.submitText}>Publish v{nextVersionNumber} with SHA-256</Text>
      </Pressable>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  block: {
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  filePickerBtn: {
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: SDO_COLORS.navy,
    backgroundColor: SDO_COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  filePickerText: {
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  fileCard: {
    borderRadius: 14,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 12,
    gap: 6,
  },
  fileName: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  renameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  renameLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  renameInput: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 10,
    fontSize: 12,
    color: SDO_COLORS.textPrimary,
  },
  hashText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: SDO_COLORS.textMuted,
  },
  textarea: {
    minHeight: 84,
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
    backgroundColor: SDO_COLORS.amber,
  },
  disabled: {
    opacity: 0.45,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
});
