import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  Check,
  History,
  KeyRound,
  Lock,
  MapPin,
  UploadCloud,
  X,
} from 'lucide-react-native';
import { Document } from '../../domain/entities/Document';
import { DocumentCopyFormat } from '../../domain/enums/DomainEnums';
import { useAppServices } from '../../state/AppServiceContext';
import { MobileScreenHeader } from '../components/MobileTopBars';
import { ScanToReceiveCard } from '../components/ScanToReceiveCard';
import { SealedQrCard } from '../components/SealedQrCard';
import { ActionRemarksSheet } from '../sheets/ActionRemarksSheet';
import { PasswordUnlockModal } from '../sheets/PasswordUnlockModal';
import { TrackDocumentSheet } from '../sheets/TrackDocumentSheet';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';
import { formatClockTime } from '../utils/formatters';

export const ScannerScreen: React.FC = () => {
  const {
    actor,
    documents,
    isBusy,
    openDocument,
    openScannerForDocument,
    scannerTarget,
    clearScannerTarget,
    declineMisrouted,
    scanQr,
    acknowledgeReceipt,
    unlockSoftCopyWithPassword,
    setActiveTab,
    scannerPaused,
    setScannerPaused,
    recentScans,
    clearRecentScans,
    pendingOfflineCount,
  } = useAppServices();

  const [showTrackSheet, setShowTrackSheet] = useState(false);
  const [declineTarget, setDeclineTarget] = useState<Document | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<Document | null>(null);
  const [targetCodeInput, setTargetCodeInput] = useState('');
  const [targetCodeError, setTargetCodeError] = useState<string | null>(null);
  const [submittingTargetCode, setSubmittingTargetCode] = useState(false);

  const pendingIncomingDocs = useMemo(() => {
    if (!actor) return [];
    return documents.filter((d) => d.latestTransaction?.canBeAcknowledgedBy(actor) || d.isSealed);
  }, [actor, documents]);

  const targetedDoc = useMemo(() => {
    if (!scannerTarget) return null;
    return documents.find((d) => d.id === scannerTarget.documentId) ?? null;
  }, [documents, scannerTarget]);

  const isSoftCopyTarget = scannerTarget?.copyFormat === DocumentCopyFormat.DIGITAL;

  const handleTargetCodeSubmit = async () => {
    if (!scannerTarget) return;
    const clean = targetCodeInput.trim();
    if (!clean || submittingTargetCode || isBusy) {
      if (!clean) {
        setTargetCodeError(
          isSoftCopyTarget
            ? 'Enter the 6-char Unlock Code from Tracely Web or tracking code.'
            : "Enter the Tracking Code from the sender's routing slip.",
        );
      }
      return;
    }
    setTargetCodeError(null);
    setSubmittingTargetCode(true);
    try {
      const resolved = await scanQr(clean, scannerTarget.documentId);
      if (resolved.kind === 'document_denied') {
        throw new Error(resolved.reason);
      }
      if (resolved.kind !== 'document_authorized') {
        throw new Error(
          isSoftCopyTarget
            ? 'Enter the 6-char Unlock Code from Tracely Web or tracking code.'
            : "Enter the Tracking Code from the sender's routing slip.",
        );
      }
      if (resolved.document.id !== scannerTarget.documentId) {
        throw new Error('This code belongs to a different sealed transfer.');
      }
      if (resolved.sentByActor) {
        throw new Error('Senders cannot confirm receipt of their own dispatch.');
      }
      if (!resolved.unlockedViaSync && resolved.pendingForActorOffice) {
        await acknowledgeReceipt(
          resolved.document,
          null,
          resolved.verificationCode ?? clean,
        );
      }
      setTargetCodeInput('');
      clearScannerTarget();
      openDocument(resolved.document.id);
    } catch (err) {
      setTargetCodeError(
        err instanceof Error ? err.message : 'Unable to verify unlock code.',
      );
    } finally {
      setSubmittingTargetCode(false);
    }
  };

  return (
    <View style={styles.screen}>
      <MobileScreenHeader title="Scan QR" />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {scannerTarget ? (
          <View style={styles.targetBanner} testID="mobile-scanner-target-banner">
            <View style={styles.targetRow}>
              <View style={styles.targetIcon}>
                <Lock size={15} color={SDO_COLORS.navyInk} />
              </View>
              <View style={styles.targetCopy}>
                <Text style={styles.targetTitle}>
                  {`From ${scannerTarget.fromOfficeCode}${
                    scannerTarget.fromUserName ? ` (${scannerTarget.fromUserName})` : ''
                  }`}
                </Text>
                <Text style={styles.targetSub}>
                  Scan the QR code or enter the active code below to unlock.
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  setTargetCodeInput('');
                  setTargetCodeError(null);
                  clearScannerTarget();
                }}
                accessibilityLabel="Clear target transfer"
                hitSlop={8}
                style={styles.targetCloseBtn}
              >
                <X size={14} color={SDO_COLORS.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.targetCodeWrap}>
              <View style={styles.targetCodeRow}>
                <TextInput
                  testID="mobile-scanner-target-code-input"
                  value={targetCodeInput}
                  onChangeText={(val) => {
                    setTargetCodeInput(val);
                    if (targetCodeError) setTargetCodeError(null);
                  }}
                  placeholder={
                    isSoftCopyTarget
                      ? 'Enter 6-char code (e.g. K7P-492)'
                      : 'Enter Tracking Code (e.g. TRC-2026-000142)'
                  }
                  placeholderTextColor={SDO_COLORS.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    handleTargetCodeSubmit().catch(() => {});
                  }}
                  style={[styles.targetCodeInput, targetCodeError && styles.targetCodeInputError]}
                />
                <Pressable
                  testID="mobile-scanner-target-code-submit"
                  disabled={!targetCodeInput.trim() || submittingTargetCode || isBusy}
                  onPress={() => {
                    handleTargetCodeSubmit().catch(() => {});
                  }}
                  style={[
                    styles.targetCodeBtn,
                    (!targetCodeInput.trim() || submittingTargetCode || isBusy) &&
                      styles.targetCodeBtnDisabled,
                  ]}
                >
                  <Check size={14} color={SDO_COLORS.white} />
                  <Text style={styles.targetCodeBtnText}>
                    {submittingTargetCode ? '...' : 'Unlock'}
                  </Text>
                </Pressable>
              </View>
              {targetCodeError ? (
                <Text testID="mobile-scanner-target-code-error" style={styles.targetCodeError}>
                  {targetCodeError}
                </Text>
              ) : null}
            </View>
            {isSoftCopyTarget && targetedDoc ? (
              <Pressable
                testID="mobile-scanner-password-fallback-btn"
                onPress={() => setPasswordTarget(targetedDoc)}
                style={styles.passwordFallbackBtn}
              >
                <KeyRound size={13} color={SDO_COLORS.navy} />
                <Text style={styles.passwordFallbackText}>
                  No desktop nearby? Unlock with Password
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <ScanToReceiveCard
          key={scannerTarget ? `target-${scannerTarget.documentId}` : 'scanner-default'}
          autoStart={Boolean(scannerTarget?.autoStartCamera)}
          targetDocumentId={scannerTarget?.documentId ?? null}
          persistedPaused={scannerTarget ? false : scannerPaused}
          onPausedChange={setScannerPaused}
        />

        {pendingIncomingDocs.length > 0 ? (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeading}>
                Incoming ({pendingIncomingDocs.length})
              </Text>
            </View>
            {pendingIncomingDocs.slice(0, 3).map((doc) => (
              <SealedQrCard
                key={doc.id}
                document={doc}
                compact
                onScan={(target) => openScannerForDocument(target, true)}
                onDecline={(target) => setDeclineTarget(target)}
              />
            ))}
          </View>
        ) : null}

        <View style={styles.sectionBlock}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeading}>Recent Scans</Text>
            {recentScans.length > 0 ? (
              <Pressable onPress={clearRecentScans}>
                <Text style={styles.clearLink}>Clear</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setShowTrackSheet(true)} style={styles.trackChip}>
                <MapPin size={12} color={SDO_COLORS.navy} />
                <Text style={styles.trackChipText}>Track Office Docs</Text>
              </Pressable>
            )}
          </View>

          {recentScans.length === 0 ? (
            <View style={styles.emptyCard}>
              <History size={22} color={SDO_COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No scans in this session</Text>
              <Text style={styles.emptyBody}>
                Scanned document QRs, desktop attach pairings, and verified A4 slips appear here for
                quick access.
              </Text>
              <View style={styles.quickActionRow}>
                <Pressable onPress={() => setShowTrackSheet(true)} style={styles.whiteChipBtn}>
                  <MapPin size={14} color={SDO_COLORS.navy} />
                  <Text style={styles.whiteChipText}>Track Office Docs</Text>
                </Pressable>
                {pendingOfflineCount > 0 ? (
                  <Pressable
                    onPress={() => setActiveTab('alerts')}
                    style={styles.whiteChipBtn}
                  >
                    <UploadCloud size={14} color={SDO_COLORS.amberText} />
                    <Text style={styles.whiteChipText}>
                      {pendingOfflineCount} Queued
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : (
            recentScans.map((entry) => (
              <Pressable
                key={entry.id}
                disabled={!entry.documentId}
                onPress={() => {
                  if (entry.documentId) openDocument(entry.documentId);
                }}
                style={styles.historyCard}
              >
                <View style={styles.queueHeaderRow}>
                  <Text style={styles.trackingMono}>{entry.trackingCode}</Text>
                  <Text style={styles.timeMeta}>{formatClockTime(entry.scannedAt)}</Text>
                </View>
                <Text numberOfLines={1} style={styles.historyTitle}>
                  {entry.label}
                </Text>
                <Text numberOfLines={2} style={styles.metaText}>
                  {entry.subtitle}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      {declineTarget ? (
        <ActionRemarksSheet
          open={Boolean(declineTarget)}
          mode="decline_misrouted"
          trackingCode={`From ${declineTarget.latestTransaction?.fromOffice.code ?? declineTarget.originOffice.code}`}
          onConfirm={(reason) => {
            declineMisrouted(declineTarget, reason).catch(() => {});
          }}
          onClose={() => setDeclineTarget(null)}
        />
      ) : null}

      <TrackDocumentSheet
        open={showTrackSheet}
        onClose={() => setShowTrackSheet(false)}
      />

      <PasswordUnlockModal
        open={Boolean(passwordTarget)}
        isBusy={isBusy}
        fromOfficeLabel={
          passwordTarget
            ? (passwordTarget.latestTransaction?.fromOffice.code ?? passwordTarget.originOffice.code)
            : undefined
        }
        onClose={() => setPasswordTarget(null)}
        onSubmitPassword={async (password) => {
          if (!passwordTarget) return;
          const unlocked = await unlockSoftCopyWithPassword(passwordTarget, password);
          setPasswordTarget(null);
          openDocument(unlocked.id);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SDO_COLORS.bg,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 16,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  container: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 16,
  },
  targetBanner: {
    gap: 10,
    borderRadius: 18,
    backgroundColor: SDO_COLORS.amberSoft,
    borderWidth: 1.5,
    borderColor: SDO_COLORS.amberBorder,
    padding: 12,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  passwordFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.amberBorder,
    backgroundColor: SDO_COLORS.surface,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  passwordFallbackText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  targetIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: SDO_COLORS.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetCopy: {
    flex: 1,
    gap: 2,
  },
  targetTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  targetSub: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: SDO_COLORS.textSecondary,
  },
  targetCloseBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: SDO_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sectionHeading: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  sectionHint: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: SDO_COLORS.textMuted,
  },
  clearLink: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  trackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.skySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trackChipText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  queueCard: {
    borderRadius: 18,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 14,
    gap: 6,
  },
  queueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  fromMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  queueTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  emptyCard: {
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  emptyBody: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: SDO_COLORS.textSecondary,
    textAlign: 'center',
  },
  quickActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  whiteChipBtn: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  whiteChipText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  historyCard: {
    borderRadius: 18,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 14,
    gap: 4,
  },
  historyTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  timeMeta: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: SDO_COLORS.textMuted,
  },
  targetCodeWrap: {
    gap: 6,
  },
  targetCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  targetCodeInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SDO_COLORS.amberBorder,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 11,
    paddingVertical: 7,
    fontFamily: SDO_FONTS.mono,
    fontSize: 12.5,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  targetCodeInputError: {
    borderColor: SDO_COLORS.rose,
  },
  targetCodeBtn: {
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
  targetCodeBtnDisabled: {
    opacity: 0.48,
  },
  targetCodeBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.white,
  },
  targetCodeError: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '600',
    color: SDO_COLORS.roseText,
  },
});
