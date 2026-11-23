import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { useAppServices } from '../../state/AppServiceContext';
import { useQrScanner } from '../hooks/useQrScanner';
import { CameraCaptureSheet } from '../sheets/CameraCaptureSheet';
import { QrTokenEntryModal } from '../sheets/QrTokenEntryModal';
import { SDO_COLORS } from '../theme/tokens';
import { QrCameraPreview } from './QrCameraPreview';
import { QrScanResultCard } from './QrScanResultCard';
import { QrViewfinderCard } from './QrViewfinderCard';

interface ScanToReceiveCardProps {
  /** Whether the camera should open automatically when permission is already granted. */
  autoStart?: boolean;
  /** Optional externally persisted pause flag for the dedicated Scanner tab. */
  persistedPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /** Shows a dismiss button on inline scan results (ideal for Dashboard use). */
  allowDismissResult?: boolean;
  /** Optional targeted sealed document id when launched from clicking a Sealed QR card. */
  targetDocumentId?: string | null;
}

/**
 * Self-contained "Scan to receive" viewfinder card with inline live CameraX scanning,
 * clean pause/resume hardware teardown, manual token modal, and inline resolution actions.
 */
export const ScanToReceiveCard: React.FC<ScanToReceiveCardProps> = ({
  autoStart = false,
  persistedPaused = false,
  onPausedChange,
  allowDismissResult = false,
  targetDocumentId = null,
}) => {
  const { openDocument, acknowledgeReceipt, isBusy } = useAppServices();
  const [showTokenModal, setShowTokenModal] = useState(false);

  const scanner = useQrScanner({
    autoStartWhenPermitted: autoStart,
    initialPaused: persistedPaused,
    onPausedChange,
    onAutoOpenDocument: openDocument,
  });

  const frameContent =
    scanner.isCameraMounted || scanner.resolving ? (
      <QrCameraPreview
        active={scanner.isCameraMounted}
        sessionKey={scanner.cameraSessionKey}
        resolving={scanner.resolving}
        barcodePaused={Boolean(scanner.pairCaptureTarget)}
        torchMode={scanner.appliedTorchMode}
        onReadCode={scanner.handleResolve}
        onCameraError={scanner.handleCameraError}
      />
    ) : null;

  const pendingBatchCount = useMemo(
    () =>
      scanner.batchItems.filter(
        (item) =>
          item.result.kind === 'document_authorized' &&
          item.result.pendingForActorOffice &&
          !item.result.sentByActor,
      ).length,
    [scanner.batchItems],
  );

  return (
    <View style={styles.wrap}>
      <QrViewfinderCard
        title="Scan to receive"
        subtitle={
          scanner.batchMode
            ? 'Batch mode active: camera stays open across scans.'
            : 'Point at a Tracely Web Unlock QR, routing slip QR, or attach code.'
        }
        frameHeight={scanner.frameHeight}
        frameCaption={scanner.frameCaption}
        frameContent={frameContent}
        isCameraActive={scanner.isCameraMounted}
        scanLabel={scanner.scanButtonLabel}
        torchOn={scanner.scannerTorchOn}
        batchMode={scanner.batchMode}
        onToggleBatchMode={scanner.toggleBatchMode}
        onToggleTorch={scanner.handleToggleTorch}
        onPressScan={scanner.handlePrimaryCameraPress}
        onPressEnterCode={() => setShowTokenModal(true)}
      />

      {scanner.batchItems.length > 0 ? (
        <View style={styles.batchCard}>
          <View style={styles.batchHeader}>
            <Text style={styles.batchTitle}>
              Batch Queue ({scanner.batchItems.length})
            </Text>
            <Pressable onPress={scanner.clearBatchItems}>
              <Text style={styles.batchClearText}>Clear</Text>
            </Pressable>
          </View>

          {scanner.batchItems.map((item) => {
            const code =
              item.result.kind === 'document_authorized'
                ? item.result.document.trackingCode
                : item.result.kind === 'desktop_pair_ready'
                  ? item.result.pairing.pairToken
                  : item.result.trackingCode;
            const title =
              item.result.kind === 'document_authorized'
                ? item.result.document.title
                : item.result.kind === 'desktop_pair_ready'
                  ? item.result.pairing.draftLabel
                  : item.result.kind === 'transmittal_verified'
                    ? `Verified at ${item.result.currentOfficeName}`
                    : item.result.reason;
            const isPending =
              item.result.kind === 'document_authorized' && item.result.pendingForActorOffice;

            return (
              <View key={item.key} style={styles.batchRow}>
                <View style={styles.batchCopy}>
                  <Text style={styles.batchCode}>
                    {code}
                    {isPending ? ' · Awaiting receipt' : ''}
                  </Text>
                  <Text numberOfLines={1} style={styles.batchLabel}>
                    {title}
                  </Text>
                </View>
                <Pressable
                  onPress={() => scanner.removeBatchItem(item.key)}
                  accessibilityLabel={`Remove ${code} from batch`}
                  style={styles.batchRemoveBtn}
                >
                  <X size={14} color={SDO_COLORS.textMuted} />
                </Pressable>
              </View>
            );
          })}

          {pendingBatchCount > 0 ? (
            <Pressable
              disabled={isBusy}
              onPress={() => {
                scanner.confirmBatchReceipts().catch(() => {});
              }}
              style={[styles.batchConfirmBtn, isBusy && styles.batchDisabled]}
            >
              <Check size={15} color={SDO_COLORS.navyInk} />
              <Text style={styles.batchConfirmText}>
                Confirm All Receipt ({pendingBatchCount})
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {scanner.result ? (
        <QrScanResultCard
          result={scanner.result}
          isBusy={isBusy}
          targetDocumentId={targetDocumentId}
          onOpenDocument={openDocument}
          onConfirmReceipt={async (doc) => {
            try {
              const code =
                (scanner.result?.kind === 'document_authorized'
                  ? scanner.result.verificationCode
                  : undefined) ??
                scanner.scannedVerificationCode ??
                undefined;
              await acknowledgeReceipt(doc, null, code);
              scanner.clearResult();
              openDocument(doc.id);
            } catch {
              // Surfaced via AppServiceContext toast
            }
          }}
          onCaptureDesktopPair={scanner.openPairCapture}
          onScanAnother={scanner.handleResetScan}
          onDismiss={allowDismissResult ? scanner.clearResult : undefined}
        />
      ) : null}

      {scanner.pairCaptureTarget ? (
        <CameraCaptureSheet
          open={Boolean(scanner.pairCaptureTarget)}
          targetType="desktop_pair"
          targetId={scanner.pairCaptureTarget.pairToken}
          targetLabel={scanner.pairCaptureTarget.label}
          onClose={scanner.clearPairCaptureTarget}
        />
      ) : null}

      <QrTokenEntryModal
        open={showTokenModal}
        isBusy={scanner.resolving || isBusy}
        onClose={() => setShowTokenModal(false)}
        onSubmitToken={(raw) => scanner.handleResolve(raw, true)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    gap: 14,
  },
  batchCard: {
    borderRadius: 18,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 14,
    gap: 10,
  },
  batchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  batchTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  batchClearText: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  batchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  batchCopy: {
    flex: 1,
    gap: 2,
  },
  batchCode: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: SDO_COLORS.navy,
  },
  batchLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.textPrimary,
  },
  batchRemoveBtn: {
    padding: 4,
  },
  batchConfirmBtn: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  batchConfirmText: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  batchDisabled: {
    opacity: 0.45,
  },
});
