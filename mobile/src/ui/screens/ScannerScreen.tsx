import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ArrowLeft,
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
import { MobileHeaderActions } from '../components/MobileHeaderActions';
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
    unlockSoftCopyWithPassword,
    setActiveTab,
    goBack,
    scannerPaused,
    setScannerPaused,
    recentScans,
    clearRecentScans,
    pendingOfflineCount,
  } = useAppServices();

  const [showTrackSheet, setShowTrackSheet] = useState(false);
  const [declineTarget, setDeclineTarget] = useState<Document | null>(null);
  const [passwordTarget, setPasswordTarget] = useState<Document | null>(null);

  const pendingIncomingDocs = useMemo(() => {
    if (!actor) return [];
    return documents.filter((d) => d.latestTransaction?.canBeAcknowledgedBy(actor) || d.isSealed);
  }, [actor, documents]);

  const targetedDoc = useMemo(() => {
    if (!scannerTarget) return null;
    return documents.find((d) => d.id === scannerTarget.documentId) ?? null;
  }, [documents, scannerTarget]);

  const isSoftCopyTarget = scannerTarget?.copyFormat === DocumentCopyFormat.DIGITAL;

  return (
    <View style={styles.screen}>
      <View style={styles.topHeader}>
        <Pressable
          onPress={() => goBack()}
          accessibilityLabel="Back to inbox"
          style={styles.circleBtn}
        >
          <ArrowLeft size={18} color={SDO_COLORS.navyInk} />
        </Pressable>
        <Text style={styles.headerTitle}>QR Scanner</Text>
        <MobileHeaderActions variant="soft" />
      </View>

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
                  Scan the QR code or enter the 6-character code to unlock.
                </Text>
              </View>
              <Pressable
                onPress={clearScannerTarget}
                accessibilityLabel="Clear target transfer"
                hitSlop={8}
                style={styles.targetCloseBtn}
              >
                <X size={14} color={SDO_COLORS.textSecondary} />
              </Pressable>
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
});
