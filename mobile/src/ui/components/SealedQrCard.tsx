import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { Check, ChevronRight, Lock, QrCode } from 'lucide-react-native';
import { Document } from '../../domain/entities/Document';
import { ConfidentialityTier, DocumentCopyFormat } from '../../domain/enums/DomainEnums';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';
import { formatRelativeTime } from '../utils/formatters';
import { SlaBadge } from './Badges';

interface SealedQrCardProps {
  document: Document;
  compact?: boolean;
  isBusy?: boolean;
  onScan: (doc: Document) => void;
  onSubmitCode?: (doc: Document, rawCode: string) => Promise<void>;
  onDecline?: (doc: Document) => void;
}

const FORMAT_TEXT: Record<DocumentCopyFormat, string> = {
  digital: 'Soft Copy',
  hard_copy: 'Hard Copy',
  hybrid: 'Hybrid',
};

const TIER_TEXT: Record<ConfidentialityTier, string | null> = {
  standard_internal: null,
  restricted: 'Restricted',
  confidential: 'Confidential',
};

function maskTrackingCodeDisplay(code: string): string {
  const clean = code.trim();
  if (!clean) return 'TRC-••••••';
  if (clean.includes('•')) return clean;
  const lastDash = clean.lastIndexOf('-');
  if (lastDash > 0) {
    return `${clean.slice(0, lastDash + 1)}••••••`;
  }
  return `${clean.slice(0, 4)}••••`;
}

/**
 * Clean decorative locked QR icon (never encodes real qrToken or trackingCode).
 * Tapping it redirects the recipient straight to the QR Scanner.
 */
export const SealedQrGlyph: React.FC<{ size?: number }> = ({ size = 60 }) => (
  <Svg width={size} height={size} viewBox="0 0 80 80">
    {/* Top-left finder */}
    <Rect x={6} y={6} width={21} height={21} rx={4} fill="none" stroke="#0D3472" strokeWidth={3.2} />
    <Rect x={12.5} y={12.5} width={8} height={8} rx={1.8} fill="#0D3472" />
    {/* Top-right finder */}
    <Rect x={53} y={6} width={21} height={21} rx={4} fill="none" stroke="#0D3472" strokeWidth={3.2} />
    <Rect x={59.5} y={12.5} width={8} height={8} rx={1.8} fill="#0D3472" />
    {/* Bottom-left finder */}
    <Rect x={6} y={53} width={21} height={21} rx={4} fill="none" stroke="#0D3472" strokeWidth={3.2} />
    <Rect x={12.5} y={59.5} width={8} height={8} rx={1.8} fill="#0D3472" />
    {/* Subtle quiet data modules */}
    <Rect x={34} y={8} width={5} height={5} rx={1.2} fill="#94A3B8" opacity={0.45} />
    <Rect x={42} y={16} width={5} height={5} rx={1.2} fill="#94A3B8" opacity={0.45} />
    <Rect x={8} y={35} width={5} height={5} rx={1.2} fill="#94A3B8" opacity={0.45} />
    <Rect x={17} y={42} width={5} height={5} rx={1.2} fill="#94A3B8" opacity={0.45} />
    <Rect x={60} y={35} width={5} height={5} rx={1.2} fill="#94A3B8" opacity={0.45} />
    <Rect x={68} y={43} width={5} height={5} rx={1.2} fill="#94A3B8" opacity={0.45} />
    <Rect x={34} y={62} width={5} height={5} rx={1.2} fill="#94A3B8" opacity={0.45} />
    <Rect x={54} y={54} width={6} height={6} rx={1.5} fill="#94A3B8" opacity={0.45} />
    <Rect x={66} y={54} width={6} height={6} rx={1.5} fill="#94A3B8" opacity={0.45} />
    <Rect x={54} y={66} width={6} height={6} rx={1.5} fill="#94A3B8" opacity={0.45} />
    <Rect x={66} y={66} width={6} height={6} rx={1.5} fill="#94A3B8" opacity={0.45} />
    {/* Center lock seal */}
    <Circle cx={40} cy={40} r={14.5} fill="#FFFFFF" />
    <Circle cx={40} cy={40} r={12} fill="#F3B32A" />
    <Rect x={34.8} y={39} width={10.4} height={8} rx={2} fill="#0D1B3E" />
    <Path
      d="M37.2 39V36.5C37.2 34.9 38.4 33.7 40 33.7C41.6 33.7 42.8 34.9 42.8 36.5V39"
      fill="none"
      stroke="#0D1B3E"
      strokeWidth={2}
      strokeLinecap="round"
    />
  </Svg>
);

/**
 * Clean sealed QR card shown to pending recipients instead of full document details.
 * Tapping the QR tile or card redirects directly to the QR Scanner.
 */
export const SealedQrCard: React.FC<SealedQrCardProps> = ({
  document: doc,
  compact = false,
  isBusy = false,
  onScan,
  onSubmitCode,
  onDecline,
}) => {
  const [inlineCode, setInlineCode] = useState('');
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [submittingCode, setSubmittingCode] = useState(false);

  const latest = doc.latestTransaction;
  const fromOffice = latest?.fromOffice ?? doc.originOffice;
  const fromUser = latest?.fromUserName;
  const sentElapsed = latest?.sentAt ? formatRelativeTime(latest.sentAt) : '';
  const sealedFiles = doc.attachmentCount;
  const maskedCode = maskTrackingCodeDisplay(doc.trackingCode);
  const tierNote = TIER_TEXT[doc.confidentialityTier];
  const isSoftCopy = doc.copyFormat === DocumentCopyFormat.DIGITAL;
  const actionLabel = isSoftCopy ? 'Scan QR in Tracely Web' : 'Scan QR';
  const compactHint = isSoftCopy ? 'Tap to scan QR in Tracely Web' : 'Tap to target scanner';

  const handleInlineUnlock = async () => {
    if (!onSubmitCode) return;
    const clean = inlineCode.trim();
    if (!clean || submittingCode || isBusy) {
      if (!clean) {
        setInlineError(
          isSoftCopy
            ? 'Enter the 6-char unlock code or tracking code.'
            : 'Enter the routing tracking code.',
        );
      }
      return;
    }
    setInlineError(null);
    setSubmittingCode(true);
    try {
      await onSubmitCode(doc, clean);
      setInlineCode('');
    } catch (err) {
      setInlineError(
        err instanceof Error ? err.message : 'Unable to verify unlock code.',
      );
    } finally {
      setSubmittingCode(false);
    }
  };

  const metaLine = [
    `From ${fromOffice.code}${fromUser ? ` · ${fromUser}` : ''}`,
    sentElapsed || null,
    sealedFiles > 0
      ? `${sealedFiles} ${sealedFiles === 1 ? 'file' : 'files'}`
      : FORMAT_TEXT[doc.copyFormat],
    !compact && tierNote ? tierNote : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      testID={`mobile-sealed-qr-card-${doc.id}`}
      onPress={() => onScan(doc)}
      style={[styles.card, compact && styles.cardCompact]}
    >
      <View style={styles.row}>
        <Pressable
          testID={`mobile-sealed-qr-trigger-${doc.id}`}
          accessibilityLabel={
            isSoftCopy
              ? `Scan QR in Tracely Web to unlock incoming soft copy from ${fromOffice.code}`
              : `Scan QR to unlock incoming transfer from ${fromOffice.code}`
          }
          onPress={() => onScan(doc)}
          style={styles.qrTile}
        >
          <SealedQrGlyph size={compact ? 48 : 56} />
        </Pressable>

        <View style={styles.body}>
          <View style={styles.topRow}>
            <View style={styles.codeWrap}>
              <Lock size={11} color={SDO_COLORS.textMuted} />
              <Text numberOfLines={1} style={styles.maskedCode}>
                {maskedCode}
              </Text>
            </View>
            <SlaBadge state={doc.slaState} suffix={formatRelativeTime(doc.slaDueAt)} />
          </View>

          <Text style={styles.title} numberOfLines={1}>
            Sealed Incoming Document
          </Text>
          <Text style={styles.meta} numberOfLines={2}>
            {metaLine}
          </Text>
        </View>
      </View>

      {!compact && onSubmitCode ? (
        <View style={styles.inlineCodeBlock}>
          <View style={styles.inlineCodeRow}>
            <TextInput
              testID={`mobile-sealed-qr-code-input-${doc.id}`}
              value={inlineCode}
              onChangeText={(val) => {
                setInlineCode(val);
                if (inlineError) setInlineError(null);
              }}
              placeholder={
                isSoftCopy
                  ? 'Enter 6-char code (e.g. K7P-492)'
                  : 'Enter tracking code (e.g. TRC-2026-000142)'
              }
              placeholderTextColor={SDO_COLORS.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => {
                handleInlineUnlock().catch(() => {});
              }}
              style={[styles.inlineCodeInput, inlineError && styles.inlineCodeInputError]}
            />
            <Pressable
              testID={`mobile-sealed-qr-code-submit-${doc.id}`}
              disabled={!inlineCode.trim() || submittingCode || isBusy}
              onPress={() => {
                handleInlineUnlock().catch(() => {});
              }}
              style={[
                styles.inlineCodeSubmitBtn,
                (!inlineCode.trim() || submittingCode || isBusy) && styles.inlineCodeSubmitDisabled,
              ]}
            >
              <Check size={14} color={SDO_COLORS.white} />
              <Text style={styles.inlineCodeSubmitText}>
                {submittingCode ? '...' : 'Unlock'}
              </Text>
            </Pressable>
          </View>
          {inlineError ? (
            <Text
              testID={`mobile-sealed-qr-code-error-${doc.id}`}
              style={styles.inlineCodeErrorText}
            >
              {inlineError}
            </Text>
          ) : null}
        </View>
      ) : null}

      {!compact ? (
        <View style={styles.footer}>
          <Pressable onPress={() => onScan(doc)} style={styles.scanBtn}>
            <QrCode size={13} color={SDO_COLORS.navyInk} />
            <Text numberOfLines={1} style={styles.scanBtnText}>
              {actionLabel}
            </Text>
          </Pressable>
          {onDecline ? (
            <Pressable onPress={() => onDecline(doc)} style={styles.declineLink}>
              <Text style={styles.declineLinkText}>Misrouted</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.compactFooter}>
          <View style={styles.hintRow}>
            <Text numberOfLines={1} style={styles.hintText}>
              {compactHint}
            </Text>
            <ChevronRight size={13} color={SDO_COLORS.navy} />
          </View>
          {onDecline ? (
            <Pressable onPress={() => onDecline(doc)} style={styles.declineLink}>
              <Text style={styles.declineLinkText}>Misrouted</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    backgroundColor: SDO_COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    padding: 15,
    gap: 12,
    overflow: 'hidden',
  },
  cardCompact: {
    padding: 13,
    gap: 10,
    borderRadius: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qrTile: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    flexWrap: 'wrap',
  },
  codeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  maskedCode: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: SDO_FONTS.mono,
    color: SDO_COLORS.textMuted,
    flexShrink: 1,
  },
  title: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 14.5,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  meta: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.textSecondary,
    lineHeight: 16,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SDO_COLORS.border,
  },
  scanBtn: {
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    flexShrink: 1,
  },
  scanBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
    flexShrink: 1,
  },
  compactFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: SDO_COLORS.border,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 1,
    minWidth: 0,
  },
  hintText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: SDO_COLORS.navy,
    flexShrink: 1,
  },
  declineLink: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surface,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
  },
  declineLinkText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  inlineCodeBlock: {
    gap: 6,
  },
  inlineCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inlineCodeInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SDO_COLORS.borderStrong,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 11,
    paddingVertical: 7,
    fontFamily: SDO_FONTS.mono,
    fontSize: 12.5,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  inlineCodeInputError: {
    borderColor: SDO_COLORS.rose,
  },
  inlineCodeSubmitBtn: {
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: SDO_COLORS.navy,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    flexShrink: 0,
  },
  inlineCodeSubmitDisabled: {
    opacity: 0.48,
  },
  inlineCodeSubmitText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.white,
  },
  inlineCodeErrorText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '600',
    color: SDO_COLORS.roseText,
  },
});
