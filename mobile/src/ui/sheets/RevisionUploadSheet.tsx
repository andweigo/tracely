import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import { FileText, FileUp, Pencil } from 'lucide-react-native';
import { Document } from '../../domain/entities/Document';
import { VersionChangeType } from '../../domain/entities/DocumentVersion';
import { DocumentLifecycleStatus } from '../../domain/enums/DomainEnums';
import { useAppServices } from '../../state/AppServiceContext';
import { ModalSheet } from '../components/ModalSheet';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';
import { formatBytes, formatDisplayFileName, normalizeUploadFileName } from '../utils/formatters';

const CHANGE_TYPE_OPTIONS: ReadonlyArray<{
  readonly id: VersionChangeType;
  readonly label: string;
  readonly defaultNote: string;
}> = [
  { id: 'signed', label: 'Signed / Countersigned', defaultNote: 'Countersigned and attached updated copy' },
  { id: 'revised', label: 'Revised Copy', defaultNote: 'Revised document content per remarks' },
  { id: 'endorsed', label: 'Endorsed / Stamped', defaultNote: 'Endorsed and stamped by office' },
  { id: 'supporting_attachment', label: 'Supporting File', defaultNote: 'Attached supporting document' },
];

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
  const [changeType, setChangeType] = useState<VersionChangeType>('signed');
  const [revisionNote, setRevisionNote] = useState('');

  const isInitialScan = nextVersionNumber === 1;

  useEffect(() => {
    if (!open) return;
    if (isInitialScan) {
      setChangeType('initial');
    } else if (document.lifecycleStatus === DocumentLifecycleStatus.RETURNED_FOR_REVISION) {
      setChangeType('revised');
    } else {
      setChangeType('signed');
    }
  }, [open, isInitialScan, document.lifecycleStatus]);

  const handleChooseDocument = async () => {
    setHashing(true);
    try {
      const [file] = await pick({
        type: [types.pdf, types.images],
        mode: 'import',
      });
      const sha256 = await computeSha256FromUri(file.uri);
      const pickedName = formatDisplayFileName(
        file.name ?? `revision_v${nextVersionNumber}.pdf`,
        `revision_v${nextVersionNumber}.pdf`,
      );
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
        changeType: isInitialScan ? 'initial' : changeType,
      });
      setSelectedFile(null);
      setRevisionNote('');
      onClose();
    } catch {
      // Surfaced via AppServiceContext toast
    }
  };

  const disabled = !selectedFile || !revisionNote.trim() || hashing || isBusy;

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={
        isInitialScan
          ? 'Attach Scanned Copy (v1)'
          : `Attach Signed / Updated File (v${nextVersionNumber})`
      }
      subtitle={
        isInitialScan
          ? `${document.trackingCode} · Converts Hard Copy to Hard Copy + Scan`
          : `${document.trackingCode} · Prior versions stay preserved read-only in Change History`
      }
    >
      {!isInitialScan ? (
        <View style={styles.block}>
          <Text style={styles.label}>What changed in this file?</Text>
          <View style={styles.chipWrap}>
            {CHANGE_TYPE_OPTIONS.map((opt) => {
              const active = changeType === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  testID={`mobile-version-change-type-${opt.id}`}
                  onPress={() => {
                    setChangeType(opt.id);
                    if (!revisionNote.trim()) {
                      setRevisionNote(opt.defaultNote);
                    }
                  }}
                  style={[styles.changeChip, active && styles.changeChipActive]}
                >
                  <Text style={[styles.changeChipText, active && styles.changeChipTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.block}>
        <Text style={styles.label}>
          {isInitialScan
            ? 'Scanned Document File (PDF or Image)'
            : 'Signed / Updated Document File (PDF or Image)'}
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
            <Text numberOfLines={2} ellipsizeMode="middle" style={styles.fileName}>
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
        <Text style={styles.label}>Change Summary / Version Note</Text>
        <TextInput
          multiline
          numberOfLines={3}
          value={revisionNote}
          onChangeText={setRevisionNote}
          placeholder="e.g. Countersigned by Budget Officer; added endorsement stamp"
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
        <Text style={styles.submitText}>
          {isInitialScan
            ? 'Attach Scan (v1) with SHA-256'
            : `Attach File (v${nextVersionNumber}) with SHA-256`}
        </Text>
      </Pressable>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  block: {
    gap: 8,
  },
  label: {
    fontFamily: SDO_FONTS.sans,
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
    fontFamily: SDO_FONTS.sans,
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
    fontFamily: SDO_FONTS.sans,
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
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  renameInput: {
    fontFamily: SDO_FONTS.sans,
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
    fontFamily: SDO_FONTS.mono,
    color: SDO_COLORS.textMuted,
  },
  textarea: {
    fontFamily: SDO_FONTS.sans,
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
    fontFamily: SDO_FONTS.sans,
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  changeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceSoft,
  },
  changeChipActive: {
    borderColor: SDO_COLORS.navy,
    backgroundColor: SDO_COLORS.navy,
  },
  changeChipText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  changeChipTextActive: {
    color: SDO_COLORS.white,
  },
});
