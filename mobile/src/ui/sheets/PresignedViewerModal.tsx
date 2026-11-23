import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileCheck2,
  FileText,
  Fingerprint,
  Lock,
  Maximize2,
  ShieldCheck,
  Timer,
  X,
} from 'lucide-react-native';
import { DeviceSecurityBridge } from '../../domain/security/DeviceSecurityBridge';
import {
  DocumentViewerBridge,
  RenderedPdfResult,
} from '../../domain/security/DocumentViewerBridge';
import type { PresignedDownloadGrant } from '../../repositories/contracts/IDocumentRepository';
import { useAppServices } from '../../state/AppServiceContext';
import { ModalSheet } from '../components/ModalSheet';
import { SDO_COLORS } from '../theme/tokens';
import { formatBytes } from '../utils/formatters';

interface PresignedViewerModalProps {
  grant: PresignedDownloadGrant | null;
  trackingCode: string;
  requireDeviceLock?: boolean;
  onClose: () => void;
}

function detectPreviewKind(mimeType: string, fileName: string): 'image' | 'pdf' | 'other' {
  const mime = mimeType.toLowerCase();
  const lowerName = fileName.toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(lowerName)) {
    return 'image';
  }
  if (mime === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return 'pdf';
  }
  return 'other';
}

export const PresignedViewerModal: React.FC<PresignedViewerModalProps> = ({
  grant,
  trackingCode,
  requireDeviceLock = false,
  onClose,
}) => {
  const { actor, notify } = useAppServices();
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [unlockedGrant, setUnlockedGrant] = useState<PresignedDownloadGrant | null>(null);
  const [needsInAppConfirm, setNeedsInAppConfirm] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [openingExternal, setOpeningExternal] = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [renderedPdf, setRenderedPdf] = useState<RenderedPdfResult | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [fullscreenUri, setFullscreenUri] = useState<string | null>(null);

  const unlocked = !requireDeviceLock || (grant !== null && unlockedGrant === grant);

  useEffect(() => {
    if (!grant) {
      setUnlockedGrant(null);
      setRenderedPdf(null);
      setFullscreenUri(null);
      return;
    }
    setSecondsLeft(grant.ttlSeconds);
    setNeedsInAppConfirm(false);
    setVerifying(false);
    setOpeningExternal(false);
    setImageError(false);
    setImageLoading(detectPreviewKind(grant.version.mimeType, grant.version.fileName) === 'image');
    setPdfError(null);
    setRenderedPdf(null);
    setPageIndex(0);
    setFullscreenUri(null);

    const id = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => {
      clearInterval(id);
      DocumentViewerBridge.clearViewerCache().catch(() => {});
    };
  }, [grant]);

  useEffect(() => {
    if (secondsLeft === 0) {
      setFullscreenUri(null);
      setRenderedPdf(null);
      DocumentViewerBridge.clearViewerCache().catch(() => {});
    }
  }, [secondsLeft]);

  const previewKind = grant
    ? detectPreviewKind(grant.version.mimeType, grant.version.fileName)
    : 'other';

  useEffect(() => {
    if (!grant || !unlocked || secondsLeft === 0 || previewKind !== 'pdf') {
      return;
    }
    if (!DocumentViewerBridge.isNativeAvailable()) {
      return;
    }

    let cancelled = false;
    setPdfLoading(true);
    setPdfError(null);
    DocumentViewerBridge.renderPdfPages(grant.url, grant.version.fileName)
      .then((result) => {
        if (cancelled) return;
        if (result && result.pageUris.length > 0) {
          setRenderedPdf(result);
          setPageIndex(0);
        } else {
          setPdfError('No pages found in PDF preview.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setPdfError(err instanceof Error ? err.message : 'Unable to render PDF preview in-app.');
      })
      .finally(() => {
        if (!cancelled) {
          setPdfLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [grant, unlocked, secondsLeft, previewKind]);

  if (!grant) return null;

  const expired = secondsLeft === 0;
  const currentPdfPageUri = renderedPdf?.pageUris[pageIndex] ?? null;
  const watermarkLabel = `${actor?.fullName ?? 'Authorized Viewer'} · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · TRACELY PROTECTED`;

  const handleVerifyLock = async () => {
    setVerifying(true);
    try {
      const res = await DeviceSecurityBridge.verifyDeviceAccess(
        'Unlock Protected Document',
        `Verify identity to view ${trackingCode}`,
      );
      if (res.verified) {
        setUnlockedGrant(grant);
        return;
      }
      if (res.method === 'cancelled') {
        notify('info', res.reason ?? 'Device verification cancelled.');
        return;
      }
      setNeedsInAppConfirm(true);
    } finally {
      setVerifying(false);
    }
  };

  const handleOpenExternal = async () => {
    if (!unlocked || expired || openingExternal) return;
    setOpeningExternal(true);
    try {
      if (DocumentViewerBridge.isNativeAvailable()) {
        const opened = await DocumentViewerBridge.openExternalViewer(
          grant.url,
          grant.version.fileName,
          grant.version.mimeType,
        );
        if (opened) {
          return;
        }
      }
      // Call Linking.openURL directly rather than blocking on Android 11+ Linking.canOpenURL
      await Linking.openURL(grant.url);
    } catch {
      notify(
        'error',
        'Could not launch an external document app. Keep viewing inline or install a PDF reader.',
      );
    } finally {
      setOpeningExternal(false);
    }
  };

  return (
    <ModalSheet
      open={Boolean(grant)}
      onClose={onClose}
      title={`Document Viewer (${trackingCode})`}
      subtitle="In-app signed viewer · Policy verified & audit logged"
    >
      <View style={styles.ttlRow}>
        <View style={styles.ttlLeft}>
          <Lock size={15} color={SDO_COLORS.emeraldText} />
          <Text style={styles.ttlLabel}>Private Signed Access</Text>
        </View>
        <View style={styles.ttlRight}>
          <Timer size={15} color={SDO_COLORS.emeraldText} />
          <Text style={styles.ttlValue}>{expired ? 'Expired' : `${secondsLeft}s TTL`}</Text>
        </View>
      </View>

      <View style={styles.previewCard}>
        <View style={styles.fileHeader}>
          <FileCheck2 size={18} color={SDO_COLORS.navy} />
          <Text numberOfLines={2} style={styles.fileTitle}>
            {grant.version.fileName} (v{grant.version.versionNumber})
          </Text>
        </View>
        <Text style={styles.note}>
          {`${formatBytes(grant.version.sizeBytes)} · ${grant.version.revisionNote}`}
        </Text>
        <Text numberOfLines={1} style={styles.mono}>
          SHA-256: {grant.version.sha256Checksum}
        </Text>
      </View>

      {!unlocked ? (
        <View style={styles.lockGateCard}>
          <View style={styles.fileHeader}>
            <Fingerprint size={20} color={SDO_COLORS.navy} />
            <Text style={styles.fileTitle}>Device Lock Required</Text>
          </View>
          <Text style={styles.note}>
            Protected documents require device credential confirmation before opening the 60s signed
            viewer.
          </Text>
          {needsInAppConfirm ? (
            <Pressable onPress={() => setUnlockedGrant(grant)} style={styles.openBtn}>
              <ShieldCheck size={16} color={SDO_COLORS.navyInk} />
              <Text style={styles.openBtnText}>
                Confirm Access{actor ? ` as ${actor.fullName}` : ''}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              disabled={verifying || expired}
              onPress={handleVerifyLock}
              style={[styles.openBtn, (verifying || expired) && styles.disabled]}
            >
              <Fingerprint size={16} color={SDO_COLORS.navyInk} />
              <Text style={styles.openBtnText}>
                {verifying ? 'Verifying Device...' : 'Verify Device Lock to View'}
              </Text>
            </Pressable>
          )}
        </View>
      ) : expired ? (
        <View style={styles.viewerEmptyBox}>
          <Lock size={22} color={SDO_COLORS.textMuted} />
          <Text style={styles.emptyTitle}>Signed link expired</Text>
          <Text style={styles.note}>
            Close this viewer and tap View again to generate a fresh 60-second signed link.
          </Text>
        </View>
      ) : (
        <>
          {previewKind === 'image' ? (
            <View style={styles.viewerFrame} testID="mobile-inline-image-viewer">
              {imageLoading && !imageError ? (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="small" color={SDO_COLORS.navy} />
                  <Text style={styles.note}>Loading signed image...</Text>
                </View>
              ) : null}
              {!imageError ? (
                <Pressable
                  onPress={() => setFullscreenUri(grant.url)}
                  accessibilityLabel="Expand image fullscreen"
                  style={styles.mediaPressable}
                >
                  <Image
                    source={{ uri: grant.url }}
                    resizeMode="contain"
                    onLoadStart={() => setImageLoading(true)}
                    onLoadEnd={() => setImageLoading(false)}
                    onError={() => {
                      setImageLoading(false);
                      setImageError(true);
                    }}
                    style={styles.previewImage}
                  />
                  {requireDeviceLock ? (
                    <View
                      pointerEvents="none"
                      testID="mobile-viewer-watermark"
                      style={styles.watermarkOverlay}
                    >
                      <Text style={styles.watermarkText}>{watermarkLabel}</Text>
                      <Text style={styles.watermarkText}>{watermarkLabel}</Text>
                      <Text style={styles.watermarkText}>{watermarkLabel}</Text>
                    </View>
                  ) : null}
                  <View style={styles.expandChip}>
                    <Maximize2 size={12} color="#FFFFFF" />
                    <Text style={styles.expandChipText}>Tap to zoom</Text>
                  </View>
                </Pressable>
              ) : (
                <View style={styles.viewerEmptyBox}>
                  <FileText size={22} color={SDO_COLORS.textMuted} />
                  <Text style={styles.emptyTitle}>Inline image preview failed</Text>
                  <Text style={styles.note}>Use Open in External App below to inspect this file.</Text>
                </View>
              )}
            </View>
          ) : previewKind === 'pdf' ? (
            <View style={styles.viewerFrame} testID="mobile-inline-pdf-viewer">
              {pdfLoading ? (
                <View style={styles.viewerEmptyBox}>
                  <ActivityIndicator size="small" color={SDO_COLORS.navy} />
                  <Text style={styles.emptyTitle}>Rendering PDF preview...</Text>
                  <Text style={styles.note}>Loading secure document pages in-app.</Text>
                </View>
              ) : currentPdfPageUri ? (
                <>
                  <Pressable
                    onPress={() => setFullscreenUri(currentPdfPageUri)}
                    accessibilityLabel="Expand PDF page fullscreen"
                    style={styles.mediaPressable}
                  >
                    <Image
                      source={{ uri: currentPdfPageUri }}
                      resizeMode="contain"
                      style={styles.previewImage}
                    />
                    {requireDeviceLock ? (
                      <View
                        pointerEvents="none"
                        testID="mobile-viewer-watermark"
                        style={styles.watermarkOverlay}
                      >
                        <Text style={styles.watermarkText}>{watermarkLabel}</Text>
                        <Text style={styles.watermarkText}>{watermarkLabel}</Text>
                        <Text style={styles.watermarkText}>{watermarkLabel}</Text>
                      </View>
                    ) : null}
                    <View style={styles.expandChip}>
                      <Maximize2 size={12} color="#FFFFFF" />
                      <Text style={styles.expandChipText}>Tap to zoom</Text>
                    </View>
                  </Pressable>
                  <View style={styles.pagerBar}>
                    <Pressable
                      disabled={pageIndex <= 0}
                      onPress={() => setPageIndex((prev) => Math.max(0, prev - 1))}
                      style={[styles.pagerBtn, pageIndex <= 0 && styles.disabled]}
                    >
                      <ChevronLeft size={15} color={SDO_COLORS.navy} />
                      <Text style={styles.pagerBtnText}>Prev</Text>
                    </Pressable>
                    <Text style={styles.pagerLabel}>
                      {`Page ${pageIndex + 1} of ${renderedPdf?.pageCount ?? 1}`}
                    </Text>
                    <Pressable
                      disabled={pageIndex >= (renderedPdf?.pageUris.length ?? 1) - 1}
                      onPress={() =>
                        setPageIndex((prev) =>
                          Math.min((renderedPdf?.pageUris.length ?? 1) - 1, prev + 1),
                        )
                      }
                      style={[
                        styles.pagerBtn,
                        pageIndex >= (renderedPdf?.pageUris.length ?? 1) - 1 && styles.disabled,
                      ]}
                    >
                      <Text style={styles.pagerBtnText}>Next</Text>
                      <ChevronRight size={15} color={SDO_COLORS.navy} />
                    </Pressable>
                  </View>
                </>
              ) : (
                <View style={styles.viewerEmptyBox}>
                  <FileText size={22} color={SDO_COLORS.navy} />
                  <Text style={styles.emptyTitle}>
                    {pdfError ? 'In-app PDF preview unavailable' : 'PDF Document Ready'}
                  </Text>
                  <Text style={styles.note}>
                    {pdfError ??
                      'Tap Open Document below to inspect this PDF in your device viewer.'}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.viewerEmptyBox}>
              <FileText size={22} color={SDO_COLORS.navy} />
              <Text style={styles.emptyTitle}>Signed File Ready</Text>
              <Text style={styles.note}>Tap Open Document below to view {grant.version.fileName}.</Text>
            </View>
          )}

          <Pressable
            disabled={expired || openingExternal}
            onPress={handleOpenExternal}
            style={[styles.openBtn, (expired || openingExternal) && styles.disabled]}
          >
            <ExternalLink size={16} color={SDO_COLORS.navyInk} />
            <Text style={styles.openBtnText}>
              {openingExternal ? 'Opening Viewer...' : 'Open in External App'}
            </Text>
          </Pressable>
        </>
      )}

      <Modal
        visible={Boolean(fullscreenUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreenUri(null)}
      >
        <View style={styles.fullscreenBackdrop}>
          <Pressable
            onPress={() => setFullscreenUri(null)}
            accessibilityLabel="Close fullscreen document preview"
            style={styles.fullscreenClose}
          >
            <X size={20} color="#FFFFFF" />
          </Pressable>
          {fullscreenUri ? (
            <Image
              source={{ uri: fullscreenUri }}
              resizeMode="contain"
              style={styles.fullscreenImage}
            />
          ) : null}
        </View>
      </Modal>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  ttlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    backgroundColor: SDO_COLORS.emeraldSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ttlLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ttlLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.emeraldText,
  },
  ttlRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ttlValue: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: SDO_COLORS.emeraldText,
  },
  previewCard: {
    borderRadius: 16,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 12,
    gap: 5,
  },
  lockGateCard: {
    borderRadius: 18,
    backgroundColor: SDO_COLORS.amberSoft,
    padding: 14,
    gap: 10,
  },
  fileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fileTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  note: {
    fontSize: 12,
    color: SDO_COLORS.textSecondary,
    textAlign: 'center',
  },
  mono: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: SDO_COLORS.textMuted,
  },
  viewerFrame: {
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    overflow: 'hidden',
  },
  mediaPressable: {
    width: '100%',
    height: 300,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  expandChip: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  expandChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pagerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: SDO_COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: SDO_COLORS.border,
  },
  pagerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
  },
  pagerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  pagerLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  viewerEmptyBox: {
    borderRadius: 16,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  openBtn: {
    minHeight: 46,
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
  openBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  fullscreenBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  fullscreenClose: {
    position: 'absolute',
    top: 44,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullscreenImage: {
    width: '100%',
    height: '86%',
  },
  watermarkOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'space-around',
    alignItems: 'center',
    overflow: 'hidden',
  },
  watermarkText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: 'rgba(13, 52, 114, 0.18)',
    transform: [{ rotate: '-20deg' }],
  },
});
