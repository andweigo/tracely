import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Check, Image as ImageIcon } from 'lucide-react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { Document } from '../../domain/entities/Document';
import { SanitizedImageResult } from '../../domain/security/ImageSanitizer';
import { useAppServices } from '../../state/AppServiceContext';
import { ModalSheet } from '../components/ModalSheet';
import { SanitizedCaptureCard } from '../components/SanitizedCaptureCard';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';

interface AcknowledgeSheetProps {
  open: boolean;
  document: Document;
  routeSummary?: string;
  onClose: () => void;
}

export const AcknowledgeSheet: React.FC<AcknowledgeSheetProps> = ({
  open,
  document,
  routeSummary,
  onClose,
}) => {
  const {
    acknowledgeReceipt,
    captureAndQueuePhoto,
    sanitizeCapturedPhoto,
    isOnline,
    isBusy,
    notify,
  } = useAppServices();
  const [proofImage, setProofImage] = useState<SanitizedImageResult | null>(null);
  const [sanitizing, setSanitizing] = useState(false);

  const pickPhoto = async (source: 'camera' | 'library') => {
    setSanitizing(true);
    try {
      const response =
        source === 'camera'
          ? await launchCamera({ mediaType: 'photo', saveToPhotos: false })
          : await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });

      if (response.didCancel) return;
      if (response.errorCode) {
        notify('error', response.errorMessage ?? 'Unable to capture photo.');
        return;
      }

      const asset = response.assets?.[0];
      if (!asset?.uri) return;

      const sanitized = await sanitizeCapturedPhoto({
        uri: asset.uri,
        fileName: asset.fileName ?? `receipt_${document.trackingCode}.jpg`,
        originalBytes: asset.fileSize,
      });
      setProofImage(sanitized);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Failed to process photo.');
    } finally {
      setSanitizing(false);
    }
  };

  const handleConfirm = async () => {
    try {
      if (!isOnline && proofImage) {
        await captureAndQueuePhoto({
          targetType: 'receipt_proof',
          targetId: document.id,
          targetLabel: `${document.trackingCode} (Signed Slip Proof)`,
          image: proofImage,
        });
        setProofImage(null);
        onClose();
        return;
      }

      await acknowledgeReceipt(document, proofImage);
      setProofImage(null);
      onClose();
    } catch {
      // Surfaced via AppServiceContext toast
    }
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={document.isHardCopy ? 'Confirm physical receipt' : 'Confirm digital receipt'}
      subtitle={
        document.isHardCopy
          ? 'Records physical custody handoff. Attach signed slip photo if required.'
          : 'One tap records digital custody. No paper hand-off is required.'
      }
    >
      <View style={styles.docSummaryCard}>
        <Text style={styles.trackingCode}>{document.trackingCode}</Text>
        <Text style={styles.docTitle}>{document.title}</Text>
        {routeSummary ? <Text style={styles.routeLine}>{routeSummary}</Text> : null}
        {document.physicalSummary ? (
          <Text style={styles.routeLine}>{`Physical bundle: ${document.physicalSummary}`}</Text>
        ) : null}
      </View>

      <View style={styles.mintCard}>
        <Text style={styles.mintTitle}>
          {document.isHardCopy
            ? '✓ Confirming physical folder custody'
            : '✓ You are confirming digital receipt'}
        </Text>
        <Text style={styles.mintBody}>
          Your personnel ID and server timestamp are recorded in the immutable audit trail.
        </Text>
      </View>

      <View style={styles.photoHeader}>
        <Text style={styles.photoLabel}>
          {document.isHardCopy ? 'Stamped folder / slip proof photo' : 'Signed slip photo'}
        </Text>
        <View
          style={[
            styles.optionalPill,
            document.isHardCopy && { backgroundColor: SDO_COLORS.amberSoft },
          ]}
        >
          <Text
            style={[
              styles.optionalText,
              document.isHardCopy && { color: SDO_COLORS.amberText },
            ]}
          >
            {document.isHardCopy ? 'RECOMMENDED · OPTIONAL' : 'OPTIONAL'}
          </Text>
        </View>
      </View>

      {proofImage ? (
        <View style={styles.captureWrap}>
          <SanitizedCaptureCard capture={proofImage} />
          <Pressable onPress={() => setProofImage(null)}>
            <Text style={styles.removeLink}>Remove attached slip photo</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.pickerRow}>
          <Pressable
            disabled={sanitizing}
            onPress={() => pickPhoto('camera')}
            style={styles.addPhotoBtn}
          >
            <Camera size={16} color={SDO_COLORS.navy} />
            <Text style={styles.addPhotoText}>
              {sanitizing ? 'Processing...' : 'Camera'}
            </Text>
          </Pressable>
          <Pressable
            disabled={sanitizing}
            onPress={() => pickPhoto('library')}
            style={styles.addPhotoBtn}
          >
            <ImageIcon size={16} color={SDO_COLORS.navy} />
            <Text style={styles.addPhotoText}>Gallery</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.helperText}>
        Compressed before upload · EXIF removed{'\n'}No photo is needed to confirm receipt.
      </Text>

      <Pressable
        disabled={isBusy || sanitizing}
        onPress={handleConfirm}
        style={[styles.confirmBtn, (isBusy || sanitizing) && styles.disabled]}
      >
        <Check size={16} color={SDO_COLORS.navyInk} />
        <Text style={styles.confirmBtnText}>
          {!isOnline && proofImage
            ? 'Queue receipt offline'
            : document.isHardCopy
              ? 'Confirm physical receipt'
              : 'Confirm digital receipt'}
        </Text>
      </Pressable>

      <Text style={styles.offlineHint}>
        Offline? Confirmation stays queued until the server accepts it.
      </Text>

      <Pressable onPress={onClose} style={styles.cancelWrap}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  docSummaryCard: {
    borderRadius: 18,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 14,
    gap: 3,
  },
  trackingCode: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: SDO_FONTS.mono,
    color: SDO_COLORS.textMuted,
  },
  docTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 15,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  routeLine: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.textSecondary,
    marginTop: 1,
  },
  mintCard: {
    borderRadius: 16,
    backgroundColor: SDO_COLORS.emeraldSoft,
    padding: 14,
    gap: 4,
  },
  mintTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.emeraldText,
  },
  mintBody: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: SDO_COLORS.emeraldText,
  },
  photoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  photoLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  optionalPill: {
    borderRadius: 999,
    backgroundColor: SDO_COLORS.skySoft,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  optionalText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    color: SDO_COLORS.navy,
  },
  captureWrap: {
    gap: 8,
  },
  removeLink: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.rose,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addPhotoBtn: {
    flex: 1,
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: SDO_COLORS.navy,
    backgroundColor: SDO_COLORS.surface,
  },
  addPhotoText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  helperText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    lineHeight: 16,
    color: SDO_COLORS.textMuted,
  },
  confirmBtn: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    paddingHorizontal: 18,
  },
  disabled: {
    opacity: 0.45,
  },
  confirmBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  offlineHint: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: SDO_COLORS.textMuted,
    textAlign: 'center',
  },
  cancelWrap: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  cancelText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
});
