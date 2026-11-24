import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck, X } from 'lucide-react-native';
import { Document } from '../../domain/entities/Document';
import { QrResolutionResult } from '../../domain/security/QrPayload';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';

interface QrScanResultCardProps {
  result: QrResolutionResult;
  isBusy: boolean;
  targetDocumentId?: string | null;
  onOpenDocument: (documentId: string) => void;
  onConfirmReceipt: (document: Document) => Promise<void> | void;
  onCaptureDesktopPair: (pairToken: string, draftLabel: string) => void;
  onScanAnother: () => void;
  onDismiss?: () => void;
}

/**
 * Shared inline verification card rendered under QrViewfinderCard on both Dashboard
 * and ScannerScreen once an opaque QR token resolves.
 */
export const QrScanResultCard: React.FC<QrScanResultCardProps> = ({
  result,
  isBusy,
  targetDocumentId = null,
  onOpenDocument,
  onConfirmReceipt,
  onCaptureDesktopPair,
  onScanAnother,
  onDismiss,
}) => (
  <View style={styles.resultCard}>
    {onDismiss ? (
      <Pressable
        onPress={onDismiss}
        hitSlop={8}
        accessibilityLabel="Dismiss scan result"
        style={styles.dismissBtn}
      >
        <X size={15} color={SDO_COLORS.textMuted} />
      </Pressable>
    ) : null}

    {result.kind === 'document_authorized' ? (
      <View style={styles.resultGap}>
        {result.sentByActor ? (
          <View style={styles.amberPillBadge}>
            <ShieldAlert size={14} color={SDO_COLORS.amberText} />
            <Text style={styles.amberPillBadgeText}>
              Sent by You · {result.document.trackingCode}
            </Text>
          </View>
        ) : (
          <View style={styles.mintPill}>
            <ShieldCheck size={14} color={SDO_COLORS.emeraldText} />
            <Text style={styles.mintPillText}>
              Policy Verified · {result.document.trackingCode}
            </Text>
          </View>
        )}
        <Text style={styles.resultTitle}>{result.document.title}</Text>
        <Text style={styles.metaText}>
          Current Office: {result.document.currentOffice.name}
        </Text>
        {result.sentByActor ? (
          <View style={styles.selfSentBox} testID="mobile-qr-self-sent-notice">
            <Text style={styles.selfSentText}>
              You sent this transfer — awaiting recipient confirmation. Senders cannot confirm
              receipt of their own QR.
            </Text>
          </View>
        ) : null}
        {result.pendingForActorOffice && !result.sentByActor ? (
          <View style={styles.unlockHintBox}>
            <Text style={styles.unlockHintText}>
              {targetDocumentId && result.document.id === targetDocumentId
                ? 'Matched your incoming sealed transfer. Confirm receipt below to accept custody and unlock the full document.'
                : 'QR verified. Confirm receipt below to accept custody and unlock attached document files.'}
            </Text>
          </View>
        ) : null}
        <View style={styles.btnRow}>
          {result.pendingForActorOffice && !result.sentByActor ? (
            <Pressable
              disabled={isBusy}
              onPress={() => onConfirmReceipt(result.document)}
              style={[styles.amberPill, isBusy && styles.disabled]}
            >
              <Text style={styles.amberPillText}>Confirm Receipt &amp; Unlock</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => onOpenDocument(result.document.id)}
              style={styles.outlinePill}
            >
              <Text style={styles.outlinePillText}>Open Record</Text>
            </Pressable>
          )}
        </View>
      </View>
    ) : null}

    {result.kind === 'document_denied' ? (
      <View style={styles.resultGap}>
        <View style={styles.rosePill}>
          <ShieldAlert size={14} color={SDO_COLORS.roseText} />
          <Text style={styles.rosePillText}>
            Access Denied · {result.trackingCode}
          </Text>
        </View>
        <Text style={styles.denyBody}>{result.reason}</Text>
      </View>
    ) : null}

    {result.kind === 'desktop_pair_ready' ? (
      <View style={styles.resultGap}>
        <View style={styles.mintPill}>
          <CheckCircle2 size={14} color={SDO_COLORS.emeraldText} />
          <Text style={styles.mintPillText}>Desktop Attach Ready</Text>
        </View>
        <Text style={styles.resultTitle}>{result.pairing.draftLabel}</Text>
        <Pressable
          onPress={() =>
            onCaptureDesktopPair(result.pairing.pairToken, result.pairing.draftLabel)
          }
          style={styles.amberPill}
        >
          <Text style={styles.amberPillText}>Capture & Upload Photo</Text>
        </Pressable>
      </View>
    ) : null}

    {result.kind === 'transmittal_verified' ? (
      <View style={styles.resultGap}>
        <View style={styles.mintPill}>
          <CheckCircle2 size={14} color={SDO_COLORS.emeraldText} />
          <Text style={styles.mintPillText}>Authentic A4 Transmittal</Text>
        </View>
        <Text style={styles.trackingMono}>{result.trackingCode}</Text>
        <Text style={styles.metaText}>
          Current Unit: {result.currentOfficeName} · {result.milestoneCount} milestones
        </Text>
        <Text style={styles.hashMono}>SHA-256: {result.latestChecksumShort}</Text>
      </View>
    ) : null}

    <Pressable onPress={onScanAnother} style={styles.rescanRow}>
      <RefreshCw size={14} color={SDO_COLORS.navy} />
      <Text style={styles.rescanText}>Scan Another QR</Text>
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  resultCard: {
    position: 'relative',
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 16,
    gap: 12,
  },
  dismissBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SDO_COLORS.surface,
  },
  resultGap: {
    gap: 8,
  },
  mintPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.emeraldSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  mintPillText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.emeraldText,
  },
  amberPillBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amberSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  amberPillBadgeText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.amberText,
  },
  selfSentBox: {
    borderRadius: 12,
    backgroundColor: SDO_COLORS.amberSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selfSentText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.amberText,
    lineHeight: 17,
  },
  unlockHintBox: {
    borderRadius: 12,
    backgroundColor: SDO_COLORS.emeraldSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  unlockHintText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.emeraldText,
    lineHeight: 17,
  },
  rosePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.roseSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rosePillText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.roseText,
  },
  resultTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 15,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  denyBody: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.roseText,
  },
  trackingMono: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: SDO_FONTS.mono,
    color: SDO_COLORS.navy,
  },
  metaText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.textSecondary,
  },
  hashMono: {
    fontSize: 11,
    fontFamily: SDO_FONTS.mono,
    color: SDO_COLORS.textMuted,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  outlinePill: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: SDO_COLORS.navy,
    backgroundColor: SDO_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlinePillText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  amberPill: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  amberPillText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  rescanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: SDO_COLORS.border,
  },
  rescanText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  disabled: {
    opacity: 0.45,
  },
});
