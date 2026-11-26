import React, { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  AlertOctagon,
  Archive,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  Eye,
  FileText,
  FileUp,
  GraduationCap,
  KeyRound,
  Keyboard,
  Lock,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Undo2,
} from 'lucide-react-native';
import {
  ConfidentialityTier,
  DocumentCopyFormat,
  DocumentLifecycleStatus,
} from '../../domain/enums/DomainEnums';
import type { VersionChangeType } from '../../domain/entities/DocumentVersion';
import type {
  CommentVisibility,
  DocumentComment,
  PresignedDownloadGrant,
} from '../../repositories/contracts/IDocumentRepository';
import { useAppServices } from '../../state/AppServiceContext';
import {
  ConfidentialityBadge,
  CopyFormatBadge,
  LifecycleBadge,
  ReceiptStatusBadge,
  SlaBadge,
} from '../components/Badges';
import { DocumentArt } from '../components/DocumentArt';
import { ModalSheet } from '../components/ModalSheet';
import { SealedQrGlyph } from '../components/SealedQrCard';
import { AcknowledgeSheet } from '../sheets/AcknowledgeSheet';
import { ActionRemarksSheet, RemarksActionMode } from '../sheets/ActionRemarksSheet';
import { CameraCaptureSheet } from '../sheets/CameraCaptureSheet';
import { ForwardSheet } from '../sheets/ForwardSheet';
import { OpaqueQrModal } from '../sheets/OpaqueQrModal';
import { PasswordUnlockModal } from '../sheets/PasswordUnlockModal';
import { PresignedViewerModal } from '../sheets/PresignedViewerModal';
import { QrTokenEntryModal } from '../sheets/QrTokenEntryModal';
import { RevisionUploadSheet } from '../sheets/RevisionUploadSheet';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';
import {
  formatDisplayFileName,
  formatRelativeTime,
  formatShortTimestamp,
} from '../utils/formatters';

interface DocumentDetailScreenProps {
  documentId: string;
}

type DetailTab = 'timeline' | 'notes' | 'files' | 'details';

const FINALIZE_PRESETS = [
  'Approved & Released',
  'Signed by Executive',
  'Filed for Reference',
  'Archived / Completed',
] as const;

const MOBILE_VERSION_CHANGE_META: Record<
  VersionChangeType,
  { readonly label: string; readonly bg: string; readonly color: string }
> = {
  initial: { label: 'Initial Upload', bg: SDO_COLORS.surfaceSoft, color: SDO_COLORS.textSecondary },
  signed: { label: 'Signed / Countersigned', bg: SDO_COLORS.emeraldSoft, color: SDO_COLORS.emeraldText },
  revised: { label: 'Revised', bg: SDO_COLORS.amberSoft, color: SDO_COLORS.amberText },
  endorsed: { label: 'Endorsed / Stamped', bg: SDO_COLORS.skySoft, color: SDO_COLORS.skyText },
  supporting_attachment: { label: 'Supporting File', bg: SDO_COLORS.surfaceSoft, color: SDO_COLORS.textSecondary },
};

export const DocumentDetailScreen: React.FC<DocumentDetailScreenProps> = ({ documentId }) => {
  const {
    actor,
    documents,
    closeDocument,
    openScannerForDocument,
    setActiveTab,
    openSidebar,
    refreshDocument,
    issuePresignedView,
    issueProofPhotoView,
    completeDocument,
    updateDocumentDetails,
    listDocumentComments,
    addDocumentComment,
    acknowledgeReceipt,
    unlockSoftCopyWithPassword,
    scanQr,
    recallTransfer,
    declineMisrouted,
    returnForRevision,
    isOnline,
    isBusy,
    pendingOfflineCount,
    retryOfflineQueue,
    securityPrefs,
    realtimeTick,
  } = useAppServices();

  const [activeTab, setDetailTab] = useState<DetailTab>('timeline');
  const [timelineScope, setTimelineScope] = useState<'internal' | 'external_safe'>('internal');
  const [refreshing, setRefreshing] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [showAckSheet, setShowAckSheet] = useState(false);
  const [showManualUnlockModal, setShowManualUnlockModal] = useState(false);
  const [showPasswordUnlockModal, setShowPasswordUnlockModal] = useState(false);
  const [inlineUnlockCode, setInlineUnlockCode] = useState('');
  const [inlineUnlockError, setInlineUnlockError] = useState<string | null>(null);
  const [submittingInlineCode, setSubmittingInlineCode] = useState(false);
  const [showForwardSheet, setShowForwardSheet] = useState(false);
  const [showCompleteSheet, setShowCompleteSheet] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<'approved' | 'archived'>('approved');
  const [completeRemarks, setCompleteRemarks] = useState('');
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPhysicalRef, setEditPhysicalRef] = useState('');
  const [editPageCount, setEditPageCount] = useState('');
  const [showCaptureSheet, setShowCaptureSheet] = useState(false);
  const [showRevisionSheet, setShowRevisionSheet] = useState(false);
  const [remarksMode, setRemarksMode] = useState<RemarksActionMode | null>(null);
  const [viewerGrant, setViewerGrant] = useState<PresignedDownloadGrant | null>(null);
  const [comments, setComments] = useState<ReadonlyArray<DocumentComment>>([]);
  const [commentBody, setCommentBody] = useState('');
  const [commentVisibility, setCommentVisibility] = useState<CommentVisibility>('cross_office');

  const doc = documentId ? documents.find((d) => d.id === documentId) : undefined;
  const activeDocId = doc?.id ?? null;
  const activeActorId = actor?.id ?? null;
  const isDocSealedForActor = Boolean(
    doc &&
      (doc.isSealed || Boolean(actor && doc.latestTransaction?.canBeAcknowledgedBy(actor))),
  );

  useEffect(() => {
    let active = true;
    if (!activeDocId || !activeActorId || isDocSealedForActor) {
      setComments([]);
      return;
    }
    listDocumentComments(activeDocId)
      .then((items) => {
        if (active) setComments(items);
      })
      .catch(() => {
        if (active) setComments([]);
      });
    return () => {
      active = false;
    };
  }, [activeDocId, activeActorId, isDocSealedForActor, listDocumentComments, realtimeTick]);

  if (!documentId && !doc) {
    return (
      <View style={styles.screen}>
        <View style={styles.topHeader}>
          <Pressable
            onPress={closeDocument}
            accessibilityLabel="Back to inbox"
            style={styles.circleIconBtn}
          >
            <ArrowLeft size={18} color={SDO_COLORS.navyInk} />
          </Pressable>
          <Text style={styles.headerTitle}>Document</Text>
          <Pressable
            onPress={openSidebar}
            accessibilityLabel="Open navigation sidebar"
            style={styles.circleIconBtn}
          >
            <Menu size={18} color={SDO_COLORS.navyInk} />
          </Pressable>
        </View>
        <View style={styles.emptyDetailCard}>
          <DocumentArt size={84} />
          <Text style={styles.emptyDetailTitle}>No Document Selected</Text>
          <Text style={styles.emptyDetailBody}>
            Select any document from Inbox or scan its QR code to inspect custody timestamps,
            versions, and routing actions.
          </Text>
          <View style={styles.emptyBtnRow}>
            <Pressable
              onPress={closeDocument}
              style={styles.emptyOutlineBtn}
            >
              <Text style={styles.emptyOutlineText}>Go Back</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                closeDocument();
                setActiveTab('scanner');
              }}
              style={styles.emptyAmberBtn}
            >
              <Text style={styles.emptyAmberText}>Open Scanner</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  if (!doc || !actor) {
    return (
      <View style={styles.deniedWrap}>
        <Pressable
          onPress={closeDocument}
          style={styles.circleIconBtn}
        >
          <ArrowLeft size={18} color={SDO_COLORS.navyInk} />
        </Pressable>
        <View style={styles.deniedCard}>
          <Text style={styles.deniedText}>
            Access denied or document is outside your office custody scope.
          </Text>
        </View>
      </View>
    );
  }

  const latestTx = doc.latestTransaction;
  const latestVersion = doc.latestVersionOrNull;
  const pendingSentByMe = Boolean(latestTx?.isPendingSentBy(actor.id));
  const isPendingForMyOffice = Boolean(latestTx?.canBeAcknowledgedBy(actor)) || doc.isSealed;
  const canRecall = Boolean(latestTx?.canBeRecalledBy(actor.id));
  const isInMyCustody =
    doc.currentOffice.id === actor.office.id && !isPendingForMyOffice && !pendingSentByMe;
  const isFinalized =
    doc.lifecycleStatus === DocumentLifecycleStatus.APPROVED ||
    doc.lifecycleStatus === DocumentLifecycleStatus.ARCHIVED;
  const canUploadRevision =
    doc.lifecycleStatus === DocumentLifecycleStatus.RETURNED_FOR_REVISION &&
    doc.originOffice.id === actor.office.id;
  const canAttachInitialScan =
    !doc.hasDigitalFile && (isInMyCustody || doc.originOffice.id === actor.office.id);
  const canAttachNewVersion = (isInMyCustody || canUploadRevision) && !isFinalized;
  const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

  if (isPendingForMyOffice) {
    const fromOffice = latestTx?.fromOffice ?? doc.originOffice;
    const fromUser = latestTx?.fromUserName;
    const sealedFiles = doc.attachmentCount;
    const isSoftCopy = doc.copyFormat === DocumentCopyFormat.DIGITAL;

    return (
      <View style={styles.screen}>
        <View style={styles.topHeader}>
          <Pressable
            onPress={closeDocument}
            accessibilityLabel="Back to inbox"
            style={styles.circleIconBtn}
          >
            <ArrowLeft size={18} color={SDO_COLORS.navyInk} />
          </Pressable>
          <Text style={styles.headerTitle}>Sealed Transfer</Text>
          <View style={styles.circleIconPlaceholder} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollBody}>
          <View style={styles.lockGateCard} testID="mobile-qr-lock-gate">
            <Pressable
              testID={`mobile-sealed-detail-qr-trigger-${doc.id}`}
              accessibilityLabel={
                isSoftCopy
                  ? `Scan QR in Tracely Web to unlock incoming soft copy from ${fromOffice.code}`
                  : `Scan QR to unlock incoming transfer from ${fromOffice.code}`
              }
              onPress={() => openScannerForDocument(doc, true)}
              style={styles.sealedDetailQrBtn}
            >
              <SealedQrGlyph size={96} />
            </Pressable>

            <View style={styles.lockBadge}>
              <Lock size={13} color={SDO_COLORS.amberText} />
              <Text style={styles.lockBadgeText}>Sealed Transfer</Text>
            </View>

            <Text style={styles.lockGateTitle}>
              {isSoftCopy
                ? 'Scan QR in Tracely Web to Unlock'
                : 'Scan Routing QR to Access Document'}
            </Text>

            <Text style={styles.lockGateBody} testID="mobile-files-locked-card">
              {isSoftCopy
                ? `From ${fromOffice.code}${fromUser ? ` · ${fromUser}` : ''} · ${
                    sealedFiles > 0
                      ? `${sealedFiles} sealed ${sealedFiles === 1 ? 'file' : 'files'}`
                      : 'Soft copy'
                  }. Open this transfer in Tracely Web to display the Unlock QR, then scan it or enter its 6-char code.`
                : `From ${fromOffice.code}${fromUser ? ` · ${fromUser}` : ''} · ${
                    sealedFiles > 0
                      ? `${sealedFiles} sealed ${sealedFiles === 1 ? 'file' : 'files'}`
                      : 'Hard-copy transfer'
                  }. Scan the sender's routing QR code to reveal details and attachments.`}
            </Text>

            <View style={styles.lockMetaRow}>
              <SlaBadge state={doc.slaState} suffix={formatRelativeTime(doc.slaDueAt)} />
              {doc.confidentialityTier !== 'standard_internal' ? (
                <ConfidentialityBadge tier={doc.confidentialityTier} />
              ) : null}
            </View>

            <View style={styles.lockInlineCodeBox}>
              <View style={styles.lockInlineCodeRow}>
                <TextInput
                  testID="mobile-detail-inline-code-input"
                  value={inlineUnlockCode}
                  onChangeText={(val) => {
                    setInlineUnlockCode(val);
                    if (inlineUnlockError) setInlineUnlockError(null);
                  }}
                  placeholder={
                    isSoftCopy
                      ? 'Enter 6-char code (e.g. K7P-492)'
                      : 'Enter Tracking Code (e.g. TRC-2026-000142)'
                  }
                  placeholderTextColor={SDO_COLORS.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  style={[
                    styles.lockInlineCodeInput,
                    inlineUnlockError && styles.lockInlineCodeInputError,
                  ]}
                />
                <Pressable
                  testID="mobile-detail-inline-code-submit"
                  disabled={!inlineUnlockCode.trim() || submittingInlineCode || isBusy}
                  onPress={async () => {
                    const clean = inlineUnlockCode.trim();
                    if (!clean || submittingInlineCode || isBusy) return;
                    setInlineUnlockError(null);
                    setSubmittingInlineCode(true);
                    try {
                      const resolved = await scanQr(clean, doc.id);
                      if (resolved.kind === 'document_denied') {
                        throw new Error(resolved.reason);
                      }
                      if (resolved.kind !== 'document_authorized') {
                        throw new Error(
                          isSoftCopy
                            ? 'Enter the 6-char Unlock Code from Tracely Web or the document tracking code.'
                            : "Enter the Document Tracking Code or QR token from the sender's routing slip.",
                        );
                      }
                      if (resolved.document.id !== doc.id) {
                        throw new Error(
                          'Entered code belongs to a different document than this sealed transfer.',
                        );
                      }
                      if (resolved.sentByActor) {
                        throw new Error('Senders cannot confirm receipt of their own dispatch.');
                      }
                      if (!resolved.unlockedViaSync && resolved.pendingForActorOffice) {
                        await acknowledgeReceipt(doc, null, resolved.verificationCode ?? clean);
                      }
                      setInlineUnlockCode('');
                    } catch (err) {
                      setInlineUnlockError(
                        err instanceof Error ? err.message : 'Unable to verify unlock code.',
                      );
                    } finally {
                      setSubmittingInlineCode(false);
                    }
                  }}
                  style={[
                    styles.lockInlineCodeBtn,
                    (!inlineUnlockCode.trim() || submittingInlineCode || isBusy) &&
                      styles.lockInlineCodeBtnDisabled,
                  ]}
                >
                  <Check size={14} color={SDO_COLORS.white} />
                  <Text style={styles.lockInlineCodeBtnText}>
                    {submittingInlineCode ? '...' : 'Unlock'}
                  </Text>
                </Pressable>
              </View>
              {inlineUnlockError ? (
                <Text testID="mobile-detail-inline-code-error" style={styles.lockInlineCodeError}>
                  {inlineUnlockError}
                </Text>
              ) : null}
            </View>

            <Pressable
              onPress={() => setShowManualUnlockModal(true)}
              style={styles.lockManualBtn}
            >
              <Keyboard size={14} color={SDO_COLORS.navy} />
              <Text style={styles.scanActionText}>Enter Code Manually</Text>
            </Pressable>

            {isSoftCopy ? (
              <Pressable
                testID="mobile-detail-password-fallback-btn"
                onPress={() => setShowPasswordUnlockModal(true)}
                style={styles.lockPasswordLink}
              >
                <KeyRound size={13} color={SDO_COLORS.navy} />
                <Text style={styles.lockPasswordLinkText}>
                  No desktop nearby? Unlock with Password
                </Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <Pressable
            onPress={() => setRemarksMode('decline_misrouted')}
            style={styles.outlineActionBtn}
          >
            <Text style={styles.outlineActionText}>Misrouted</Text>
          </Pressable>
          <Pressable
            onPress={() => openScannerForDocument(doc, true)}
            style={styles.primaryActionBtn}
          >
            <QrCode size={16} color={SDO_COLORS.navyInk} />
            <Text style={styles.primaryActionText}>
              {isSoftCopy ? 'Scan QR in Tracely Web' : 'Scan QR'}
            </Text>
          </Pressable>
        </View>

        <QrTokenEntryModal
          open={showManualUnlockModal}
          isBusy={isBusy}
          expectedTrackingCode={null}
          onOpenScanner={() => openScannerForDocument(doc, true)}
          onClose={() => setShowManualUnlockModal(false)}
          onSubmitToken={async (raw) => {
            const resolved = await scanQr(raw, doc.id);
            if (resolved.kind === 'document_denied') {
              throw new Error(resolved.reason);
            }
            if (resolved.kind !== 'document_authorized') {
              throw new Error(
                isSoftCopy
                  ? 'Enter the 6-char Unlock Code from Tracely Web or the document tracking code.'
                  : "Enter the Document Tracking Code or QR token from the sender's routing slip.",
              );
            }
            if (resolved.document.id !== doc.id) {
              throw new Error('Entered code belongs to a different document than this sealed transfer.');
            }
            if (resolved.sentByActor) {
              throw new Error('Senders cannot confirm receipt of their own dispatch.');
            }
            if (resolved.unlockedViaSync || !resolved.pendingForActorOffice) {
              return;
            }
            await acknowledgeReceipt(
              doc,
              null,
              resolved.verificationCode ?? raw.trim(),
            );
          }}
        />

        {isSoftCopy ? (
          <PasswordUnlockModal
            open={showPasswordUnlockModal}
            isBusy={isBusy}
            fromOfficeLabel={fromOffice.code}
            onClose={() => setShowPasswordUnlockModal(false)}
            onSubmitPassword={async (password) => {
              await unlockSoftCopyWithPassword(doc, password);
            }}
          />
        ) : null}

        {remarksMode === 'decline_misrouted' ? (
          <ActionRemarksSheet
            open
            mode="decline_misrouted"
            trackingCode={`From ${fromOffice.code}`}
            onConfirm={(remarks) => {
              declineMisrouted(doc, remarks)
                .then(() => closeDocument())
                .catch(() => {});
            }}
            onClose={() => setRemarksMode(null)}
          />
        ) : null}
      </View>
    );
  }

  const primaryLabel = isPendingForMyOffice
    ? 'Scan QR · Confirm Receipt'
    : canUploadRevision
      ? `Upload v${nextVersionNumber}`
      : isInMyCustody
        ? 'Forward'
        : 'Attach Slip';

  const onPrimaryPress = () => {
    if (isPendingForMyOffice) {
      setShowManualUnlockModal(true);
    } else if (canUploadRevision) {
      setShowRevisionSheet(true);
    } else if (isInMyCustody) {
      setShowForwardSheet(true);
    } else {
      setShowCaptureSheet(true);
    }
  };

  const handleOpenPresigned = async (versionNumber: number) => {
    try {
      const grant = await issuePresignedView(doc, versionNumber);
      setViewerGrant(grant);
    } catch {
      // Surfaced via toast
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshDocument(doc.id);
    } catch {
      // Offline/transient refresh failure handled cleanly
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topHeader}>
        <Pressable
          onPress={closeDocument}
          accessibilityLabel="Back to inbox"
          style={styles.circleIconBtn}
        >
          <ArrowLeft size={18} color={SDO_COLORS.navyInk} />
        </Pressable>
        <Text style={styles.headerTitle}>Document</Text>
        {!isPendingForMyOffice ? (
          <Pressable
            onPress={() => setShowQrModal(true)}
            accessibilityLabel="Show opaque QR code"
            style={styles.circleIconBtn}
          >
            <QrCode size={18} color={SDO_COLORS.navyInk} />
          </Pressable>
        ) : (
          <View style={styles.circleIconPlaceholder} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollBody}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {isPendingForMyOffice ? (
          <View style={styles.lockGateCard} testID="mobile-qr-lock-gate">
            <View style={styles.lockBadge}>
              <Lock size={14} color={SDO_COLORS.amberText} />
              <Text style={styles.lockBadgeText}>Document Locked — Scan QR to Unlock</Text>
            </View>
            <Text style={styles.lockGateBody}>
              Only the routing QR notice was delivered to your office. Scan the sender&apos;s QR
              code or enter the code manually to confirm receipt and unlock attached files.
            </Text>
            <View style={styles.hardCopyActions}>
              <Pressable
                onPress={() => {
                  closeDocument();
                  setActiveTab('scanner');
                }}
                style={styles.qrActionBtn}
              >
                <QrCode size={14} color="#FFFFFF" />
                <Text style={styles.qrActionText}>Scan QR</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowManualUnlockModal(true)}
                style={styles.scanActionBtn}
              >
                <Keyboard size={14} color={SDO_COLORS.navy} />
                <Text style={styles.scanActionText}>Enter Code</Text>
              </Pressable>
            </View>
          </View>
        ) : latestVersion ? (
          <Pressable
            onPress={() => handleOpenPresigned(latestVersion.versionNumber)}
            style={styles.previewCard}
          >
            <DocumentArt size={96} />
            <View style={styles.hashPill}>
              <Text style={styles.hashPillText}>
                v{latestVersion.versionNumber} · {latestVersion.formattedSize} · sha256{' '}
                {latestVersion.sha256Checksum.slice(0, 4)}...
                {latestVersion.sha256Checksum.slice(-4)}
              </Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.previewCard}>
            <DocumentArt size={88} />
            <View style={styles.hardCopyPill}>
              <FileText size={13} color={SDO_COLORS.amberText} />
              <Text style={styles.hardCopyPillText}>
                Physical Hard Copy · Zero Digital File
              </Text>
            </View>
            {doc.physicalSummary ? (
              <Text style={styles.physicalMeta}>{doc.physicalSummary}</Text>
            ) : null}
            <View style={styles.hardCopyActions}>
              <Pressable onPress={() => setShowQrModal(true)} style={styles.qrActionBtn}>
                <QrCode size={14} color="#FFFFFF" />
                <Text style={styles.qrActionText}>QR Routing Slip</Text>
              </Pressable>
              {canAttachInitialScan ? (
                <Pressable
                  onPress={() => setShowRevisionSheet(true)}
                  style={styles.scanActionBtn}
                >
                  <FileUp size={14} color={SDO_COLORS.navy} />
                  <Text style={styles.scanActionText}>Attach Scan v1</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}

        <View style={styles.metaBlock}>
          <View style={styles.rowBetween}>
            <Text style={styles.trackingCode}>{doc.trackingCode}</Text>
            <SlaBadge state={doc.slaState} suffix={formatRelativeTime(doc.slaDueAt)} />
          </View>
          <Text style={styles.docTitle}>{doc.title}</Text>
          <Text style={styles.docOriginLine}>
            {doc.submittedSchool ? `${doc.submittedSchool.name} · ` : ''}
            {doc.originOffice.name}
          </Text>
          {pendingSentByMe ? (
            <View style={styles.selfSentBanner} testID="mobile-detail-self-sent-banner">
              <Text style={styles.selfSentBannerText}>
                {`Dispatched by you to ${doc.currentOffice.code} — awaiting recipient confirmation. Senders cannot confirm receipt of their own dispatch.`}
              </Text>
            </View>
          ) : null}
          {doc.lifecycleStatus === DocumentLifecycleStatus.APPROVED ||
          doc.lifecycleStatus === DocumentLifecycleStatus.ARCHIVED ? (
            <View style={styles.finalizedBanner} testID="mobile-doc-finalized-banner">
              {doc.lifecycleStatus === DocumentLifecycleStatus.APPROVED ? (
                <CheckCircle2 size={14} color={SDO_COLORS.emeraldText} />
              ) : (
                <Archive size={14} color={SDO_COLORS.emeraldText} />
              )}
              <Text style={styles.finalizedBannerText}>
                {doc.lifecycleStatus === DocumentLifecycleStatus.APPROVED
                  ? `Approved & Released · Finalized at ${doc.currentOffice.code}`
                  : `Archived / Closed · Stored at ${doc.currentOffice.code}`}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.segmentRow}>
          {(
            [
              { id: 'timeline', label: 'Timeline' },
              { id: 'notes', label: `Notes (${comments.length})` },
              { id: 'files', label: `Files (${doc.versions.length})` },
              { id: 'details', label: 'Details' },
            ] as const
          ).map((tab) => {
            const active = activeTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setDetailTab(tab.id)}
                style={[styles.segmentPill, active && styles.segmentPillActive]}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {activeTab === 'timeline' ? (
          <View style={styles.sectionGap}>
            <View style={styles.scopeSwitchRow}>
              <Pressable
                onPress={() => setTimelineScope('internal')}
                style={[
                  styles.scopeChip,
                  timelineScope === 'internal' && styles.scopeChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.scopeChipText,
                    timelineScope === 'internal' && styles.scopeChipTextActive,
                  ]}
                >
                  Tracely Routing
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setTimelineScope('external_safe')}
                style={[
                  styles.scopeChip,
                  timelineScope === 'external_safe' && styles.scopeChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.scopeChipText,
                    timelineScope === 'external_safe' && styles.scopeChipTextActive,
                  ]}
                >
                  External Safe
                </Text>
              </Pressable>
            </View>

            {timelineScope === 'internal' ? (
              <View style={styles.timelineList}>
                {doc.transactions.map((tx) => (
                  <View key={tx.id} style={styles.timelineItem}>
                    <View style={styles.tealDot} />
                    <View style={styles.timelineCopy}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.timelineTitle}>
                          {tx.fromOffice.code} → {tx.toOffice.code}
                        </Text>
                        <ReceiptStatusBadge status={tx.receiptStatus} />
                      </View>
                      <Text style={styles.timelineSub}>
                        {tx.fromUserName} · {formatShortTimestamp(tx.sentAt)}
                      </Text>
                      {tx.remarks ? <Text style={styles.timelineRemark}>{tx.remarks}</Text> : null}
                      {tx.proofPhoto ? (
                        <View style={styles.proofInlineWrap}>
                          <View style={styles.proofInline}>
                            <ShieldCheck size={13} color={SDO_COLORS.emeraldText} />
                            <Text style={styles.proofInlineText}>
                              Receipt photo: {tx.proofPhoto.fileName}
                            </Text>
                          </View>
                          <Pressable
                            onPress={() => {
                              issueProofPhotoView(doc.id, tx.id)
                                .then((grant) => setViewerGrant(grant))
                                .catch(() => {});
                            }}
                            style={styles.proofViewChip}
                          >
                            <Eye size={12} color={SDO_COLORS.navy} />
                            <Text style={styles.proofViewChipText}>View Proof</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.timelineList}>
                {doc.externalMilestones.map((ms) => (
                  <View key={ms.id} style={styles.timelineItem}>
                    <View style={styles.tealDot} />
                    <View style={styles.timelineCopy}>
                      <Text style={styles.timelineTitle}>{ms.stageLabel}</Text>
                      <Text style={styles.timelineSub}>
                        {ms.officeName} · {formatShortTimestamp(ms.occurredAt)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {!isOnline || pendingOfflineCount > 0 ? (
              <View style={styles.offlineBanner}>
                <Text style={styles.offlineBannerText}>
                  {isOnline
                    ? `${pendingOfflineCount} photo(s) waiting to upload.`
                    : `Offline. ${pendingOfflineCount} photo(s) waiting to upload.`}
                </Text>
                <Pressable onPress={retryOfflineQueue}>
                  <Text style={styles.retryLink}>Retry now</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {activeTab === 'notes' ? (
          <View style={styles.sectionGap} testID="mobile-document-comments">
            <View style={styles.scopeSwitchRow}>
              <Pressable
                onPress={() => setCommentVisibility('cross_office')}
                style={[
                  styles.scopeChip,
                  commentVisibility === 'cross_office' && styles.scopeChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.scopeChipText,
                    commentVisibility === 'cross_office' && styles.scopeChipTextActive,
                  ]}
                >
                  Cross-Office Note
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setCommentVisibility('internal_office')}
                style={[
                  styles.scopeChip,
                  commentVisibility === 'internal_office' && styles.scopeChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.scopeChipText,
                    commentVisibility === 'internal_office' && styles.scopeChipTextActive,
                  ]}
                >
                  {`Internal (${actor.office.code} Only)`}
                </Text>
              </Pressable>
            </View>

            <View style={styles.commentComposer}>
              <TextInput
                value={commentBody}
                onChangeText={setCommentBody}
                multiline
                placeholder={
                  commentVisibility === 'internal_office'
                    ? `Private note visible only inside ${actor.office.code}...`
                    : 'Post a clarification note for participating offices...'
                }
                placeholderTextColor={SDO_COLORS.textMuted}
                style={styles.commentInput}
              />
              <Pressable
                disabled={!commentBody.trim() || isBusy}
                onPress={() => {
                  const clean = commentBody.trim();
                  if (!clean) return;
                  addDocumentComment(doc.id, clean, commentVisibility)
                    .then((created) => {
                      setComments((prev) => [...prev, created]);
                      setCommentBody('');
                    })
                    .catch(() => {});
                }}
                style={[
                  styles.commentSendBtn,
                  (!commentBody.trim() || isBusy) && styles.disabledBtn,
                ]}
              >
                <MessageSquare size={13} color="#FFFFFF" />
                <Text style={styles.commentSendText}>Post Note</Text>
              </Pressable>
            </View>

            {comments.length === 0 ? (
              <View style={styles.softCard}>
                <Text style={styles.docOriginLine}>No notes yet.</Text>
              </View>
            ) : (
              comments.map((cmt) => {
                const isInternal = cmt.visibility === 'internal_office';
                return (
                  <View
                    key={cmt.id}
                    style={[styles.commentCard, isInternal && styles.commentCardInternal]}
                  >
                    <View style={styles.rowBetween}>
                      <Text style={styles.commentAuthor}>
                        {`${cmt.authorName} · ${cmt.authorOfficeCode}`}
                      </Text>
                      {isInternal ? (
                        <View style={styles.commentBadgeRow}>
                          <Lock size={10} color={SDO_COLORS.amberText} />
                          <Text style={[styles.commentScopeLabel, { color: SDO_COLORS.amberText }]}>
                            {cmt.authorOfficeCode} only
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.commentBodyText}>{cmt.body}</Text>
                    <Text style={styles.commentTime}>{formatShortTimestamp(cmt.createdAt)}</Text>
                  </View>
                );
              })
            )}
          </View>
        ) : null}

        {activeTab === 'files' ? (
          <View style={styles.sectionGap}>
            {isPendingForMyOffice ? (
              <View style={styles.lockGateCard} testID="mobile-files-locked-card">
                <View style={styles.lockBadge}>
                  <Lock size={14} color={SDO_COLORS.amberText} />
                  <Text style={styles.lockBadgeText}>
                    {doc.versions.length > 0
                      ? `${doc.versions.length} file${doc.versions.length === 1 ? '' : 's'} locked until received`
                      : 'Confirm receipt to open'}
                  </Text>
                </View>
                <View style={styles.hardCopyActions}>
                  <Pressable
                    onPress={() => {
                      closeDocument();
                      setActiveTab('scanner');
                    }}
                    style={styles.qrActionBtn}
                  >
                    <QrCode size={14} color="#FFFFFF" />
                    <Text style={styles.qrActionText}>Scan QR</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowManualUnlockModal(true)}
                    style={styles.scanActionBtn}
                  >
                    <Keyboard size={14} color={SDO_COLORS.navy} />
                    <Text style={styles.scanActionText}>Enter Code</Text>
                  </Pressable>
                </View>
              </View>
            ) : doc.versions.length === 0 ? (
              <View style={styles.softCard}>
                <Text style={styles.docOriginLine}>No files attached yet.</Text>
                {canAttachInitialScan ? (
                  <Pressable
                    testID="mobile-doc-attach-file-btn"
                    onPress={() => setShowRevisionSheet(true)}
                    style={styles.scanActionBtn}
                  >
                    <FileUp size={14} color={SDO_COLORS.navy} />
                    <Text style={styles.scanActionText}>Attach Scan</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <>
                {canAttachNewVersion ? (
                  <Pressable
                    testID="mobile-doc-attach-file-btn"
                    onPress={() => setShowRevisionSheet(true)}
                    style={styles.attachNewVersionBtn}
                  >
                    <FileUp size={15} color={SDO_COLORS.navyInk} />
                    <Text style={styles.attachNewVersionText}>
                      Attach Signed / Updated File (v{nextVersionNumber})
                    </Text>
                  </Pressable>
                ) : null}
                <View style={styles.changeHistoryHeader}>
                  <Text style={styles.changeHistoryTitle}>
                    Document Change History ({doc.versions.length})
                  </Text>
                  <Text style={styles.changeHistorySub}>
                    Earlier versions stay read-only so every office signature or revision is traceable.
                  </Text>
                </View>
                {[...doc.versions].reverse().map((ver, idx) => {
                  const isLatest = idx === 0;
                  const meta =
                    MOBILE_VERSION_CHANGE_META[ver.changeType] ??
                    MOBILE_VERSION_CHANGE_META.revised;
                  const officeCode =
                    ver.uploadedByOfficeCode ??
                    (ver.versionNumber === 1 ? doc.originOffice.code : doc.currentOffice.code);
                  const officeName =
                    ver.uploadedByOfficeName ??
                    (ver.versionNumber === 1 ? doc.originOffice.name : '');
                  return (
                    <View
                      key={ver.id}
                      testID={`mobile-change-history-v${ver.versionNumber}`}
                      style={styles.softCard}
                    >
                      <View style={styles.rowBetween}>
                        <Text numberOfLines={2} ellipsizeMode="middle" style={styles.fileTitle}>
                          v{ver.versionNumber} · {formatDisplayFileName(ver.fileName)}
                        </Text>
                        <Pressable
                          onPress={() => handleOpenPresigned(ver.versionNumber)}
                          style={styles.viewPill}
                        >
                          <Eye size={13} color="#FFFFFF" />
                          <Text style={styles.viewPillText}>View</Text>
                        </Pressable>
                      </View>
                      <View style={styles.versionMetaPillRow}>
                        <View style={[styles.changeTypePill, { backgroundColor: meta.bg }]}>
                          <Text style={[styles.changeTypePillText, { color: meta.color }]}>
                            {meta.label}
                          </Text>
                        </View>
                        {isLatest ? (
                          <View style={[styles.changeTypePill, { backgroundColor: SDO_COLORS.skySoft }]}>
                            <Text style={[styles.changeTypePillText, { color: SDO_COLORS.skyText }]}>
                              Latest
                            </Text>
                          </View>
                        ) : ver.versionNumber === 1 ? (
                          <View style={[styles.changeTypePill, { backgroundColor: SDO_COLORS.surface }]}>
                            <Text style={[styles.changeTypePillText, { color: SDO_COLORS.textMuted }]}>
                              Original
                            </Text>
                          </View>
                        ) : null}
                        <Text style={styles.versionOfficeCode}>{officeCode}</Text>
                      </View>
                      <Text style={styles.versionActorLine}>
                        {`${officeName ? `${officeName} · ` : ''}${ver.uploadedByName} · ${formatShortTimestamp(ver.uploadedAt)}`}
                      </Text>
                      {ver.revisionNote ? (
                        <Text style={styles.docOriginLine}>{ver.revisionNote}</Text>
                      ) : null}
                      <Text style={styles.monoSmall}>{ver.formattedSize}</Text>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        ) : null}

        {activeTab === 'details' ? (
          <View style={styles.sectionGap}>
            <View style={styles.softCard}>
              <View style={styles.badgeRow}>
                <CopyFormatBadge format={doc.copyFormat} />
                <LifecycleBadge status={doc.lifecycleStatus} />
                <ConfidentialityBadge tier={doc.confidentialityTier} />
              </View>
              <Text style={styles.detailRow}>Category: {doc.categoryName}</Text>
              <Text style={styles.detailRow}>
                Held by: {doc.currentOffice.code} ({doc.currentHolderName})
              </Text>
              {doc.physicalSummary ? (
                <Text style={styles.detailRow}>Physical Bundle: {doc.physicalSummary}</Text>
              ) : null}
            </View>

            {doc.submittedSchool ? (
              <View style={styles.schoolCard}>
                <View style={styles.rowLeft}>
                  <GraduationCap size={16} color={SDO_COLORS.navy} />
                  <Text style={styles.schoolTitle}>
                    Site / Branch ID {doc.submittedSchool.depedSchoolId}
                  </Text>
                </View>
                <Text style={styles.docOriginLine}>{doc.submittedSchool.name}</Text>
                <Text style={styles.monoSmall}>
                  {doc.submittedSchool.district} · {doc.submittedSchool.municipality}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.bottomBar}>
        <Pressable
          onPress={() => setShowMoreActions(true)}
          accessibilityLabel="More document actions"
          style={styles.moreBtn}
        >
          <MoreHorizontal size={20} color={SDO_COLORS.navyInk} />
        </Pressable>

        <Pressable
          onPress={() => {
            if (canRecall) {
              recallTransfer(doc).catch(() => {});
            } else if (isPendingForMyOffice) {
              setRemarksMode('decline_misrouted');
            } else if (isInMyCustody && canUploadRevision) {
              setShowForwardSheet(true);
            } else if (isInMyCustody) {
              setRemarksMode('return_revision');
            } else {
              setShowQrModal(true);
            }
          }}
          style={styles.outlineActionBtn}
        >
          <Text style={styles.outlineActionText}>
            {canRecall
              ? 'Recall'
              : isPendingForMyOffice
                ? 'Decline'
                : isInMyCustody && canUploadRevision
                  ? 'Forward'
                  : isInMyCustody
                    ? 'Return'
                    : 'QR Slip'}
          </Text>
        </Pressable>

        <Pressable onPress={onPrimaryPress} style={styles.primaryActionBtn}>
          {isPendingForMyOffice ? <Check size={16} color={SDO_COLORS.navyInk} /> : null}
          <Text style={styles.primaryActionText}>{primaryLabel}</Text>
        </Pressable>
      </View>

      <ModalSheet
        open={showMoreActions}
        onClose={() => setShowMoreActions(false)}
        title="Document Actions"
        subtitle={doc.trackingCode}
      >
        {canAttachNewVersion ? (
          <Pressable
            testID="mobile-more-attach-file-btn"
            onPress={() => {
              setShowMoreActions(false);
              setShowRevisionSheet(true);
            }}
            style={styles.menuRow}
          >
            <FileUp size={18} color={SDO_COLORS.navy} />
            <Text style={styles.menuText}>
              {doc.hasDigitalFile
                ? `Attach Signed / Updated File (v${nextVersionNumber})`
                : 'Attach Scanned Copy (v1)'}
            </Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => {
            setShowMoreActions(false);
            setShowCaptureSheet(true);
          }}
          style={styles.menuRow}
        >
          <Camera size={18} color={SDO_COLORS.navy} />
          <Text style={styles.menuText}>Attach Signed Slip / Photo</Text>
        </Pressable>

        {isInMyCustody &&
        doc.lifecycleStatus !== DocumentLifecycleStatus.APPROVED &&
        doc.lifecycleStatus !== DocumentLifecycleStatus.ARCHIVED ? (
          <>
            <Pressable
              testID="mobile-open-edit-doc-btn"
              onPress={() => {
                setShowMoreActions(false);
                setEditTitle(doc.title);
                setEditPhysicalRef(doc.physicalReference ?? '');
                setEditPageCount(doc.physicalPageCount ? String(doc.physicalPageCount) : '');
                setShowEditSheet(true);
              }}
              style={styles.menuRow}
            >
              <Pencil size={18} color={SDO_COLORS.navy} />
              <Text style={styles.menuText}>Edit Document Details</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setShowMoreActions(false);
                setShowCompleteSheet(true);
              }}
              style={styles.menuRow}
            >
              <CheckCircle2 size={18} color={SDO_COLORS.emeraldText} />
              <Text style={styles.menuText}>Approve / Archive Document</Text>
            </Pressable>
          </>
        ) : null}

        {isInMyCustody ? (
          <Pressable
            onPress={() => {
              setShowMoreActions(false);
              setRemarksMode('return_revision');
            }}
            style={styles.menuRow}
          >
            <RotateCcw size={18} color={SDO_COLORS.amberText} />
            <Text style={styles.menuText}>Return for Revision</Text>
          </Pressable>
        ) : null}

        {isPendingForMyOffice ? (
          <Pressable
            onPress={() => {
              setShowMoreActions(false);
              setRemarksMode('decline_misrouted');
            }}
            style={styles.menuRow}
          >
            <AlertOctagon size={18} color={SDO_COLORS.rose} />
            <Text style={styles.menuText}>Decline / Flag Misrouted</Text>
          </Pressable>
        ) : null}

        {canRecall ? (
          <Pressable
            onPress={() => {
              setShowMoreActions(false);
              recallTransfer(doc).catch(() => {});
            }}
            style={styles.menuRow}
          >
            <Undo2 size={18} color={SDO_COLORS.amberText} />
            <Text style={styles.menuText}>Recall Pending Transfer</Text>
          </Pressable>
        ) : null}

        {canUploadRevision || canAttachInitialScan ? (
          <Pressable
            onPress={() => {
              setShowMoreActions(false);
              setShowRevisionSheet(true);
            }}
            style={styles.menuRow}
          >
            <FileUp size={18} color={SDO_COLORS.navy} />
            <Text style={styles.menuText}>
              {doc.hasDigitalFile ? `Upload Revision v${nextVersionNumber}` : 'Attach Scan (v1)'}
            </Text>
          </Pressable>
        ) : null}
      </ModalSheet>

      <OpaqueQrModal
        open={showQrModal}
        qrToken={doc.qrToken}
        trackingCode={doc.trackingCode}
        isHardCopy={doc.isHardCopy}
        document={doc}
        onClose={() => setShowQrModal(false)}
      />

      <AcknowledgeSheet
        open={showAckSheet}
        document={doc}
        routeSummary={`${latestTx?.fromOffice.name ?? doc.originOffice.name} → ${doc.currentOffice.name}`}
        onClose={() => setShowAckSheet(false)}
      />

      <QrTokenEntryModal
        open={showManualUnlockModal}
        isBusy={isBusy}
        expectedTrackingCode={doc.trackingCode}
        onOpenScanner={() => {
          closeDocument();
          setActiveTab('scanner');
        }}
        onClose={() => setShowManualUnlockModal(false)}
        onSubmitToken={async (raw) => {
          const resolved = await scanQr(raw);
          if (resolved.kind === 'document_denied') {
            throw new Error(resolved.reason);
          }
          if (resolved.kind !== 'document_authorized') {
            throw new Error('Enter the Document Tracking Code or QR token for this document.');
          }
          if (resolved.document.id !== doc.id) {
            throw new Error(
              `Entered code belongs to ${resolved.document.trackingCode}, not ${doc.trackingCode}.`,
            );
          }
          if (resolved.sentByActor) {
            throw new Error('Senders cannot confirm receipt of their own dispatch.');
          }
          await acknowledgeReceipt(
            doc,
            null,
            resolved.verificationCode ?? raw.trim(),
          );
        }}
      />

      <ForwardSheet
        open={showForwardSheet}
        document={doc}
        onClose={() => setShowForwardSheet(false)}
      />

      <ModalSheet
        open={showCompleteSheet}
        onClose={() => setShowCompleteSheet(false)}
        title="Finalize Document Disposition"
        subtitle={`${doc.trackingCode} · ${doc.title}`}
      >
        <View style={styles.scopeSwitchRow}>
          <Pressable
            onPress={() => setCompleteTarget('approved')}
            style={[styles.scopeChip, completeTarget === 'approved' && styles.scopeChipActive]}
          >
            <Text
              style={[
                styles.scopeChipText,
                completeTarget === 'approved' && styles.scopeChipTextActive,
              ]}
            >
              Approved &amp; Released
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setCompleteTarget('archived')}
            style={[styles.scopeChip, completeTarget === 'archived' && styles.scopeChipActive]}
          >
            <Text
              style={[
                styles.scopeChipText,
                completeTarget === 'archived' && styles.scopeChipTextActive,
              ]}
            >
              Archive / Close
            </Text>
          </Pressable>
        </View>

        <View style={styles.finalizePresetWrap}>
          {FINALIZE_PRESETS.map((preset) => (
            <Pressable
              key={preset}
              onPress={() => setCompleteRemarks(preset)}
              style={[styles.scopeChip, completeRemarks === preset && styles.scopeChipActive]}
            >
              <Text
                style={[
                  styles.scopeChipText,
                  completeRemarks === preset && styles.scopeChipTextActive,
                ]}
              >
                {preset}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={completeRemarks}
          onChangeText={setCompleteRemarks}
          multiline
          placeholder="Optional final disposition note..."
          placeholderTextColor={SDO_COLORS.textMuted}
          style={styles.commentInput}
        />

        <Pressable
          disabled={isBusy}
          onPress={() => {
            completeDocument(doc, completeTarget, completeRemarks.trim())
              .then(() => {
                setCompleteRemarks('');
                setShowCompleteSheet(false);
              })
              .catch(() => {});
          }}
          style={[styles.primaryActionBtn, isBusy && styles.disabledBtn]}
        >
          <Text style={styles.primaryActionText}>
            {completeTarget === 'approved' ? 'Mark Approved & Released' : 'Archive Document'}
          </Text>
        </Pressable>
      </ModalSheet>

      <ModalSheet
        open={showEditSheet}
        onClose={() => setShowEditSheet(false)}
        title={`Edit Document · ${doc.trackingCode}`}
        subtitle="Update title or physical folder info after recall or return before re-sending"
      >
        <TextInput
          testID="mobile-edit-doc-title-input"
          value={editTitle}
          onChangeText={setEditTitle}
          placeholder="Document title / subject"
          placeholderTextColor={SDO_COLORS.textMuted}
          style={styles.commentInput}
        />
        <TextInput
          testID="mobile-edit-doc-phys-ref-input"
          value={editPhysicalRef}
          onChangeText={setEditPhysicalRef}
          placeholder="Physical folder / envelope reference (optional)"
          placeholderTextColor={SDO_COLORS.textMuted}
          style={styles.commentInput}
        />
        <TextInput
          testID="mobile-edit-doc-pages-input"
          value={editPageCount}
          onChangeText={setEditPageCount}
          keyboardType="number-pad"
          placeholder="Page count (optional)"
          placeholderTextColor={SDO_COLORS.textMuted}
          style={styles.commentInput}
        />
        <Pressable
          testID="mobile-save-edit-doc-btn"
          disabled={isBusy || editTitle.trim().length < 3}
          onPress={() => {
            const parsedPages = editPageCount.trim()
              ? Number.parseInt(editPageCount.trim(), 10)
              : null;
            updateDocumentDetails(doc, {
              title: editTitle.trim(),
              physicalReference: editPhysicalRef.trim() || null,
              physicalPageCount:
                parsedPages && !Number.isNaN(parsedPages) && parsedPages > 0 ? parsedPages : null,
            })
              .then(() => setShowEditSheet(false))
              .catch(() => {});
          }}
          style={[
            styles.primaryActionBtn,
            (isBusy || editTitle.trim().length < 3) && styles.disabledBtn,
          ]}
        >
          <Text style={styles.primaryActionText}>Save Changes</Text>
        </Pressable>
      </ModalSheet>

      <CameraCaptureSheet
        open={showCaptureSheet}
        targetType="receipt_proof"
        targetId={doc.id}
        targetLabel={`${doc.trackingCode} (Proof / Supporting Slip)`}
        onClose={() => setShowCaptureSheet(false)}
      />

      <RevisionUploadSheet
        open={showRevisionSheet}
        document={doc}
        nextVersionNumber={nextVersionNumber}
        onClose={() => setShowRevisionSheet(false)}
      />

      {remarksMode ? (
        <ActionRemarksSheet
          open={Boolean(remarksMode)}
          mode={remarksMode}
          trackingCode={doc.trackingCode}
          onClose={() => setRemarksMode(null)}
          onConfirm={(remarks) => {
            if (remarksMode === 'decline_misrouted') {
              declineMisrouted(doc, remarks).catch(() => {});
            } else {
              returnForRevision(doc, remarks).catch(() => {});
            }
          }}
        />
      ) : null}

      <PresignedViewerModal
        grant={viewerGrant}
        trackingCode={doc.trackingCode}
        requireDeviceLock={
          securityPrefs.biometricGateEnabled &&
          doc.confidentialityTier !== ConfidentialityTier.STANDARD_INTERNAL
        }
        onClose={() => setViewerGrant(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SDO_COLORS.bg,
  },
  deniedWrap: {
    padding: 18,
    gap: 12,
  },
  deniedCard: {
    borderRadius: 16,
    backgroundColor: SDO_COLORS.roseSoft,
    padding: 14,
  },
  deniedText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    color: SDO_COLORS.roseText,
  },
  emptyDetailCard: {
    margin: 18,
    borderRadius: 24,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  emptyDetailTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 16,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  emptyDetailBody: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
    color: SDO_COLORS.textSecondary,
    textAlign: 'center',
  },
  emptyBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
    width: '100%',
  },
  emptyOutlineBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: SDO_COLORS.navy,
    backgroundColor: SDO_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyOutlineText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  emptyAmberBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAmberText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  circleIconBtn: {
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
  scrollBody: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 16,
  },
  previewCard: {
    borderRadius: 24,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 12,
  },
  hashPill: {
    borderRadius: 999,
    backgroundColor: SDO_COLORS.emeraldSoft,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  hashPillText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: SDO_FONTS.mono,
    color: SDO_COLORS.emeraldText,
  },
  hardCopyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amberSoft,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  hardCopyPillText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '800',
    color: SDO_COLORS.amberText,
  },
  selfSentBanner: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: SDO_COLORS.amberSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selfSentBannerText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.amberText,
    lineHeight: 17,
  },
  physicalMeta: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
  },
  hardCopyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  qrActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.navy,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  qrActionText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  scanActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  scanActionText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  metaBlock: {
    gap: 4,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackingCode: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: SDO_FONTS.mono,
    color: SDO_COLORS.textSecondary,
  },
  docTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 18,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
    lineHeight: 24,
  },
  docOriginLine: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.textSecondary,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentPill: {
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentPillActive: {
    backgroundColor: SDO_COLORS.navyInk,
  },
  segmentText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  sectionGap: {
    gap: 12,
  },
  scopeSwitchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scopeChip: {
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  scopeChipActive: {
    backgroundColor: SDO_COLORS.skySoft,
  },
  scopeChipText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  scopeChipTextActive: {
    color: SDO_COLORS.navy,
  },
  timelineList: {
    gap: 14,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  tealDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: SDO_COLORS.tealDot,
    marginTop: 5,
  },
  timelineCopy: {
    flex: 1,
    gap: 3,
  },
  timelineTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  timelineSub: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.textSecondary,
  },
  timelineRemark: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.textPrimary,
    marginTop: 2,
  },
  proofInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 10,
    backgroundColor: SDO_COLORS.emeraldSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  proofInlineText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '600',
    color: SDO_COLORS.emeraldText,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.amberSoft,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  offlineBannerText: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.amberText,
  },
  retryLink: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.amberText,
    textDecorationLine: 'underline',
  },
  softCard: {
    borderRadius: 18,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 14,
    gap: 6,
  },
  fileTitle: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    minWidth: 0,
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  viewPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.navy,
    paddingHorizontal: 11,
    paddingVertical: 6,
    flexShrink: 0,
  },
  viewPillText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  monoSmall: {
    fontSize: 11,
    fontFamily: SDO_FONTS.mono,
    color: SDO_COLORS.textMuted,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  detailRow: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    color: SDO_COLORS.textPrimary,
  },
  schoolCard: {
    borderRadius: 18,
    backgroundColor: SDO_COLORS.skySoft,
    padding: 14,
    gap: 4,
  },
  schoolTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navy,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  moreBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineActionBtn: {
    minHeight: 44,
    minWidth: 96,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: SDO_COLORS.navy,
    backgroundColor: SDO_COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  outlineActionText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  primaryActionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  primaryActionText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  menuRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 14,
  },
  menuText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 14,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  finalizedBanner: {
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: SDO_COLORS.emeraldSoft,
    borderWidth: 1,
    borderColor: SDO_COLORS.emeraldBorder,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  finalizedBannerText: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.emeraldText,
  },
  proofInlineWrap: {
    gap: 6,
    marginTop: 4,
  },
  proofViewChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  proofViewChipText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  commentComposer: {
    borderRadius: 16,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 12,
    gap: 8,
  },
  commentInput: {
    fontFamily: SDO_FONTS.sans,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 48,
    fontSize: 13,
    color: SDO_COLORS.textPrimary,
    textAlignVertical: 'top',
  },
  commentSendBtn: {
    alignSelf: 'flex-end',
    borderRadius: 999,
    backgroundColor: SDO_COLORS.navy,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentSendText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  commentCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    padding: 12,
    gap: 5,
  },
  commentCardInternal: {
    backgroundColor: SDO_COLORS.amberSoft,
    borderColor: SDO_COLORS.amberBorder,
  },
  commentAuthor: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  commentBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentScopeLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    color: SDO_COLORS.navy,
  },
  commentBodyText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    lineHeight: 18,
    color: SDO_COLORS.textPrimary,
  },
  commentTime: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10.5,
    color: SDO_COLORS.textMuted,
  },
  finalizePresetWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  disabledBtn: {
    opacity: 0.45,
  },
  circleIconPlaceholder: {
    width: 40,
    height: 40,
  },
  lockGateCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amberSoft,
    borderWidth: 1,
    borderColor: SDO_COLORS.amberBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lockBadgeText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '800',
    color: SDO_COLORS.amberText,
  },
  lockGateTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 17,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
    textAlign: 'center',
  },
  lockGateBody: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    lineHeight: 18,
    color: SDO_COLORS.textSecondary,
    textAlign: 'center',
  },
  lockMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  lockManualBtn: {
    marginTop: 4,
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  lockPasswordLink: {
    marginTop: 2,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  lockPasswordLinkText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  sealedDetailQrBtn: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SDO_COLORS.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    padding: 14,
  },
  lockInlineCodeBox: {
    width: '100%',
    gap: 6,
    marginTop: 4,
  },
  lockInlineCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockInlineCodeInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SDO_COLORS.borderStrong,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: SDO_FONTS.mono,
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  lockInlineCodeInputError: {
    borderColor: SDO_COLORS.rose,
  },
  lockInlineCodeBtn: {
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: SDO_COLORS.navy,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    flexShrink: 0,
  },
  lockInlineCodeBtnDisabled: {
    opacity: 0.48,
  },
  lockInlineCodeBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '800',
    color: SDO_COLORS.white,
  },
  lockInlineCodeError: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '600',
    color: SDO_COLORS.roseText,
    textAlign: 'left',
  },
  attachNewVersionBtn: {
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.amber,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  attachNewVersionText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  changeHistoryHeader: {
    gap: 2,
    paddingHorizontal: 2,
  },
  changeHistoryTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13.5,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  changeHistorySub: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    lineHeight: 16,
    color: SDO_COLORS.textSecondary,
  },
  versionMetaPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  changeTypePill: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  changeTypePillText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10.5,
    fontWeight: '700',
  },
  versionOfficeCode: {
    fontFamily: SDO_FONTS.mono,
    fontSize: 11,
    fontWeight: '800',
    color: SDO_COLORS.navy,
  },
  versionActorLine: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
  },
});
