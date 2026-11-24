import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SanitizedImageResult } from '../../domain/security/ImageSanitizer';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';
import { formatBytes } from '../utils/formatters';

interface SanitizedCaptureCardProps {
  capture: SanitizedImageResult;
}

/**
 * Displays real sanitized photo thumbnail, compression savings, EXIF removal status, and SHA-256.
 */
export const SanitizedCaptureCard: React.FC<SanitizedCaptureCardProps> = ({ capture }) => (
  <View style={styles.card}>
    <View style={styles.previewRow}>
      <Image source={{ uri: capture.uri }} style={styles.thumbnail} resizeMode="cover" />
      <View style={styles.previewCopy}>
        <Text numberOfLines={1} style={styles.fileName}>
          {capture.fileName}
        </Text>
        <Text style={styles.metaText}>
          {formatBytes(capture.originalBytes)} → {formatBytes(capture.compressedBytes)}
        </Text>
        <View style={styles.exifPill}>
          <Text style={styles.exifText}>EXIF / GPS Stripped ✓</Text>
        </View>
      </View>
    </View>
    <Text numberOfLines={1} style={styles.hashText}>
      SHA-256: {capture.sha256Checksum}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 12,
    gap: 8,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: SDO_COLORS.border,
  },
  previewCopy: {
    flex: 1,
    gap: 4,
  },
  fileName: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  metaText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: SDO_COLORS.textSecondary,
  },
  exifPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: SDO_COLORS.emeraldSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  exifText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10,
    fontWeight: '700',
    color: SDO_COLORS.emeraldText,
  },
  hashText: {
    fontSize: 10,
    fontFamily: SDO_FONTS.mono,
    color: SDO_COLORS.textMuted,
  },
});
