import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, Image as ImageIcon, Shield, UploadCloud } from 'lucide-react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { SanitizedImageResult } from '../../domain/security/ImageSanitizer';
import { useAppServices } from '../../state/AppServiceContext';
import { ModalSheet } from '../components/ModalSheet';
import { SanitizedCaptureCard } from '../components/SanitizedCaptureCard';
import { SDO_COLORS } from '../theme/tokens';

interface CameraCaptureSheetProps {
  open: boolean;
  targetType: 'desktop_pair' | 'receipt_proof';
  targetId: string;
  targetLabel: string;
  onClose: () => void;
}

export const CameraCaptureSheet: React.FC<CameraCaptureSheetProps> = ({
  open,
  targetType,
  targetId,
  targetLabel,
  onClose,
}) => {
  const { captureAndQueuePhoto, sanitizeCapturedPhoto, isOnline, isBusy, notify } =
    useAppServices();
  const [capture, setCapture] = useState<SanitizedImageResult | null>(null);
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
        notify('error', response.errorMessage ?? 'Unable to open camera or gallery.');
        return;
      }

      const asset = response.assets?.[0];
      if (!asset?.uri) return;

      const sanitized = await sanitizeCapturedPhoto({
        uri: asset.uri,
        fileName: asset.fileName,
        originalBytes: asset.fileSize,
      });
      setCapture(sanitized);
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Photo processing failed.');
    } finally {
      setSanitizing(false);
    }
  };

  const handleSend = async () => {
    if (!capture) return;
    try {
      await captureAndQueuePhoto({
        targetType,
        targetId,
        targetLabel,
        image: capture,
      });
      setCapture(null);
      onClose();
    } catch {
      // Surfaced via AppServiceContext toast
    }
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="Mobile Camera Capture"
      subtitle={`Target: ${targetLabel}`}
    >
      <View style={styles.privacyBanner}>
        <View style={styles.bannerTitleRow}>
          <Shield size={16} color={SDO_COLORS.emeraldText} />
          <Text style={styles.bannerTitle}>Privacy-Safe Capture Pipeline</Text>
        </View>
        <Text style={styles.bannerBody}>
          Photos are compressed on-device, stripped of EXIF/GPS coordinates, and hashed (SHA-256)
          before syncing or queueing offline.
        </Text>
      </View>

      {capture ? (
        <SanitizedCaptureCard capture={capture} />
      ) : (
        <View style={styles.pickerRow}>
          <Pressable
            disabled={sanitizing}
            onPress={() => pickPhoto('camera')}
            style={styles.snapBtn}
          >
            <Camera size={22} color={SDO_COLORS.navy} />
            <Text style={styles.snapBtnText}>
              {sanitizing ? 'Processing...' : 'Take Photo'}
            </Text>
          </Pressable>
          <Pressable
            disabled={sanitizing}
            onPress={() => pickPhoto('library')}
            style={styles.snapBtn}
          >
            <ImageIcon size={22} color={SDO_COLORS.navy} />
            <Text style={styles.snapBtnText}>Gallery</Text>
          </Pressable>
        </View>
      )}

      <Pressable
        disabled={!capture || isBusy || sanitizing}
        onPress={handleSend}
        style={[styles.uploadBtn, (!capture || isBusy || sanitizing) && styles.disabled]}
      >
        <UploadCloud size={18} color={SDO_COLORS.navyInk} />
        <Text style={styles.uploadBtnText}>
          {isOnline ? 'Upload Now' : 'Save to Offline Retry Queue'}
        </Text>
      </Pressable>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  privacyBanner: {
    borderRadius: 16,
    backgroundColor: SDO_COLORS.emeraldSoft,
    padding: 13,
    gap: 4,
  },
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.emeraldText,
  },
  bannerBody: {
    fontSize: 12,
    lineHeight: 17,
    color: SDO_COLORS.emeraldText,
  },
  pickerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  snapBtn: {
    flex: 1,
    minHeight: 74,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: SDO_COLORS.navy,
    backgroundColor: SDO_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 14,
  },
  snapBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  uploadBtn: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  disabled: {
    opacity: 0.45,
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
});
