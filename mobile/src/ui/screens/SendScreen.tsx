import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import {
  Clock,
  FileText,
  FileUp,
  Lock,
  Menu,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Send as SendIcon,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react-native';
import { Document } from '../../domain/entities/Document';
import {
  AvailabilityStatus,
  ConfidentialityTier,
  DocumentCopyFormat,
} from '../../domain/enums/DomainEnums';
import { DocumentViewerBridge } from '../../domain/security/DocumentViewerBridge';
import { DISPOSITION_REMARK_PRESETS } from '../../repositories/contracts/IDocumentRepository';
import { useAppServices } from '../../state/AppServiceContext';
import { AvailabilityBadge } from '../components/Badges';
import { OpaqueQrModal } from '../sheets/OpaqueQrModal';
import { SDO_COLORS } from '../theme/tokens';
import {
  buildBatchItemTitle,
  formatBytes,
  formatCompactDate,
  normalizeUploadFileName,
} from '../utils/formatters';

const RECENT_RECIPIENTS_PREFIX = '@sdo_doctrack/recent_recipients_';
const LAST_CATEGORY_PREFIX = '@sdo_doctrack/last_category_';

const COPY_FORMAT_LABELS: Record<DocumentCopyFormat, string> = {
  [DocumentCopyFormat.DIGITAL]: 'Soft Copy',
  [DocumentCopyFormat.HARD_COPY]: 'Hard Copy',
  [DocumentCopyFormat.HYBRID]: 'Hybrid (Hard + Scan)',
};

const TIER_PRINT_LABELS: Record<ConfidentialityTier, string> = {
  [ConfidentialityTier.STANDARD_INTERNAL]: 'Standard Internal',
  [ConfidentialityTier.RESTRICTED]: 'Restricted',
  [ConfidentialityTier.CONFIDENTIAL]: 'Confidential (Restricted)',
};

type SendMedium = 'soft_copy' | 'hard_copy';

interface PickedSoftFile {
  readonly uri: string;
  readonly originalName: string;
  readonly name: string;
  readonly mimeType: string;
  readonly size: number;
  readonly sha256: string;
  readonly customTitle: string;
}

const TIER_OPTIONS: ReadonlyArray<{ id: ConfidentialityTier; label: string }> = [
  { id: ConfidentialityTier.STANDARD_INTERNAL, label: 'Standard' },
  { id: ConfidentialityTier.RESTRICTED, label: 'Restricted' },
  { id: ConfidentialityTier.CONFIDENTIAL, label: 'Confidential' },
];

/**
 * Minimalist Send / Originate Document screen with clear Soft Copy vs Hard Copy switch
 * and progressive disclosure for classification and routing details.
 */
export const SendScreen: React.FC = () => {
  const {
    actor,
    categories,
    personnelDirectory,
    userPreferences,
    computeSha256FromUri,
    sendDigitalDocumentBundle,
    sendDigitalDocumentBatch,
    registerHardCopyDocument,
    declareCategory,
    findSimilarCategories,
    openDocument,
    openSidebar,
    isBusy,
    notify,
  } = useAppServices();

  const [medium, setMedium] = useState<SendMedium>(() =>
    userPreferences.defaultCopyFormat === 'hard_copy' ? 'hard_copy' : 'soft_copy',
  );
  const [multiFileMode, setMultiFileMode] = useState<'bundle' | 'batch'>('bundle');
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 'cat-general');
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [customCategoryCode, setCustomCategoryCode] = useState('');
  const [savingCustomCategory, setSavingCustomCategory] = useState(false);
  const [tier, setTier] = useState<ConfidentialityTier>(ConfidentialityTier.STANDARD_INTERNAL);
  const [showOptions, setShowOptions] = useState(false);
  const [pickedFiles, setPickedFiles] = useState<ReadonlyArray<PickedSoftFile>>([]);
  const [hashing, setHashing] = useState(false);
  const [physicalRef, setPhysicalRef] = useState('');
  const [pageCountText, setPageCountText] = useState('');
  const [recipientUserId, setRecipientUserId] = useState<string | null>(null);
  const [routeToDelegate, setRouteToDelegate] = useState(true);
  const [remarks, setRemarks] = useState(() => userPreferences.defaultRemarks || '');
  const [formError, setFormError] = useState<string | null>(null);
  const [issuedDocs, setIssuedDocs] = useState<ReadonlyArray<Document>>([]);
  const [qrModalDoc, setQrModalDoc] = useState<Document | null>(null);
  const [recentRecipientIds, setRecentRecipientIds] = useState<ReadonlyArray<string>>([]);
  const [printingBatch, setPrintingBatch] = useState(false);

  useEffect(() => {
    let active = true;
    if (!actor) {
      setRecentRecipientIds([]);
      return;
    }
    Promise.all([
      AsyncStorage.getItem(`${RECENT_RECIPIENTS_PREFIX}${actor.id}`).catch(() => null),
      AsyncStorage.getItem(`${LAST_CATEGORY_PREFIX}${actor.id}`).catch(() => null),
    ]).then(([rawRecent, rawCat]) => {
      if (!active) return;
      if (rawRecent) {
        try {
          const parsed = JSON.parse(rawRecent) as unknown;
          if (Array.isArray(parsed)) {
            setRecentRecipientIds(
              parsed.filter((v): v is string => typeof v === 'string').slice(0, 4),
            );
          }
        } catch {
          // Ignore invalid JSON
        }
      }
      if (rawCat && categories.some((c) => c.id === rawCat)) {
        setCategoryId(rawCat);
      }
    });
    return () => {
      active = false;
    };
  }, [actor, categories]);

  useEffect(() => {
    if (categories.length > 0 && !categories.some((c) => c.id === categoryId)) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const peers = useMemo(
    () => personnelDirectory.filter((p) => p.isActive && p.id !== actor?.id),
    [personnelDirectory, actor],
  );

  const recentPeers = useMemo(
    () =>
      recentRecipientIds
        .map((id) => peers.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [recentRecipientIds, peers],
  );

  const persistSendMemory = (sentRecipientId: string | null, sentCategoryId: string) => {
    if (!actor) return;
    if (sentRecipientId) {
      setRecentRecipientIds((prev) => {
        const next = [sentRecipientId, ...prev.filter((id) => id !== sentRecipientId)].slice(0, 4);
        AsyncStorage.setItem(`${RECENT_RECIPIENTS_PREFIX}${actor.id}`, JSON.stringify(next)).catch(
          () => {},
        );
        return next;
      });
    }
    if (sentCategoryId) {
      AsyncStorage.setItem(`${LAST_CATEGORY_PREFIX}${actor.id}`, sentCategoryId).catch(() => {});
    }
  };

  const handlePrintBatchSlips = async () => {
    if (issuedDocs.length === 0 || printingBatch) return;
    setPrintingBatch(true);
    try {
      const ok = await DocumentViewerBridge.printBatchRoutingSlips(
        issuedDocs.map((docItem) => ({
          qrPayload: `TRC-QR:DOC:${docItem.qrToken}`,
          trackingCode: docItem.trackingCode,
          title: docItem.title,
          categoryName: docItem.categoryName,
          copyFormatLabel: COPY_FORMAT_LABELS[docItem.copyFormat],
          classificationLabel: TIER_PRINT_LABELS[docItem.confidentialityTier],
          originOfficeLabel: `${docItem.originOffice.code} — ${docItem.originOffice.name}`,
          currentOfficeLabel: `${docItem.currentOffice.code} — ${docItem.currentOffice.name}`,
          issuedDateLabel: formatCompactDate(docItem.createdAt),
          physicalFolderLabel: docItem.physicalSummary ?? undefined,
          isConfidential: docItem.confidentialityTier === ConfidentialityTier.CONFIDENTIAL,
        })),
      );
      if (!ok) {
        notify('info', 'Android Print Service is unavailable on this device.');
      }
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to print batch routing slips.');
    } finally {
      setPrintingBatch(false);
    }
  };

  const handlePrintBatchTransmittal = async () => {
    if (issuedDocs.length === 0 || printingBatch) return;
    setPrintingBatch(true);
    try {
      const refCode = `TR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(issuedDocs.length).padStart(2, '0')}`;
      const ok = await DocumentViewerBridge.printTransmittalSheet({
        referenceCode: refCode,
        issuedDateLabel: formatCompactDate(new Date().toISOString()),
        originOfficeLabel: actor
          ? `${actor.office.code} — ${actor.office.name}`
          : `${issuedDocs[0].originOffice.code} — ${issuedDocs[0].originOffice.name}`,
        preparedBy: actor?.fullName ?? 'Desk Officer',
        verifyQrPayload: `TRC-QR:VERIFY:${issuedDocs[0].qrToken}`,
        items: issuedDocs.map((d) => {
          const latest = d.latestTransaction;
          return {
            trackingCode: d.trackingCode,
            title: d.title,
            categoryName: d.categoryName,
            formatInfo: d.isHardCopy
              ? d.physicalPageCount
                ? `Hard (${d.physicalPageCount}p)`
                : 'Hard Copy'
              : `Soft (${d.versions.length}v)`,
            destinationLabel: latest ? `${latest.toOffice.code} · ${latest.toUserName}` : d.currentOffice.code,
            isConfidential: d.confidentialityTier === ConfidentialityTier.CONFIDENTIAL,
          };
        }),
      });
      if (!ok) {
        notify('info', 'Android Print Service is unavailable on this device.');
      }
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to print transmittal sheet.');
    } finally {
      setPrintingBatch(false);
    }
  };

  const chosenRecipient = useMemo(
    () => (recipientUserId ? peers.find((p) => p.id === recipientUserId) ?? null : null),
    [peers, recipientUserId],
  );

  const delegateTarget = useMemo(() => {
    if (!chosenRecipient?.delegateId) return null;
    return personnelDirectory.find((p) => p.id === chosenRecipient.delegateId) ?? null;
  }, [chosenRecipient, personnelDirectory]);

  const isRecipientOnLeave = chosenRecipient?.availability === AvailabilityStatus.ON_LEAVE;
  const blockedOnLeave = Boolean(isRecipientOnLeave && (!delegateTarget || !routeToDelegate));
  const selectedCategoryName =
    categories.find((c) => c.id === categoryId)?.name ?? 'General';
  const selectedTierLabel =
    TIER_OPTIONS.find((t) => t.id === tier)?.label ?? 'Standard';

  const similarCustomCategories = useMemo(
    () => (customCategoryName.trim().length >= 2 ? findSimilarCategories(customCategoryName) : []),
    [customCategoryName, findSimilarCategories],
  );

  const handleSaveCustomCategory = async (): Promise<string | null> => {
    const cleanName = customCategoryName.trim().replace(/\s+/g, ' ');
    if (cleanName.length < 2) {
      setFormError('Enter at least 2 characters for the custom category name.');
      return null;
    }
    const existingExact = categories.find(
      (c) => c.name.trim().toLowerCase() === cleanName.toLowerCase(),
    );
    if (existingExact) {
      setCategoryId(existingExact.id);
      if (actor) {
        AsyncStorage.setItem(`${LAST_CATEGORY_PREFIX}${actor.id}`, existingExact.id).catch(
          () => {},
        );
      }
      setCustomCategoryName('');
      setCustomCategoryCode('');
      setShowCustomCategory(false);
      notify('info', `Selected existing category "${existingExact.name}".`);
      return existingExact.id;
    }

    const derivedCode =
      customCategoryCode.trim().toUpperCase() ||
      cleanName
        .replace(/[^A-Za-z0-9\s]+/g, '')
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.slice(0, 4))
        .join('-')
        .slice(0, 12)
        .toUpperCase() ||
      'CUSTOM';

    setSavingCustomCategory(true);
    try {
      const created = await declareCategory(cleanName, derivedCode);
      setCategoryId(created.id);
      if (actor) {
        AsyncStorage.setItem(`${LAST_CATEGORY_PREFIX}${actor.id}`, created.id).catch(() => {});
      }
      setCustomCategoryName('');
      setCustomCategoryCode('');
      setShowCustomCategory(false);
      return created.id;
    } catch {
      return null;
    } finally {
      setSavingCustomCategory(false);
    }
  };

  const handleChooseFile = async () => {
    setFormError(null);
    setHashing(true);
    try {
      const files = await pick({
        type: [types.pdf, types.images],
        mode: 'import',
        allowMultiSelection: true,
      });
      const prepared: PickedSoftFile[] = [];
      for (const file of files) {
        const sha256 = await computeSha256FromUri(file.uri);
        const pickedName = file.name ?? 'document.pdf';
        prepared.push({
          uri: file.uri,
          originalName: pickedName,
          name: pickedName,
          mimeType: file.type ?? 'application/pdf',
          size: file.size ?? 0,
          sha256,
          customTitle: '',
        });
      }
      setPickedFiles((prev) => {
        const seen = new Set(prev.map((item) => `${item.uri}:${item.originalName}`));
        const additions = prepared.filter((item) => !seen.has(`${item.uri}:${item.originalName}`));
        return [...prev, ...additions];
      });
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      notify('error', err instanceof Error ? err.message : 'Unable to pick document file.');
    } finally {
      setHashing(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setPickedFiles([]);
    setPhysicalRef('');
    setPageCountText('');
    setRemarks('');
    setFormError(null);
  };

  const handleSend = async () => {
    setFormError(null);
    if (!actor) {
      const msg = 'Sign in via the Sidebar to upload files or issue live tracking codes.';
      notify('info', msg);
      setFormError(msg);
      return;
    }

    try {
      let resolvedCategoryId = categoryId;
      if (showCustomCategory && customCategoryName.trim().length >= 2) {
        const createdId = await handleSaveCustomCategory();
        if (!createdId) return;
        resolvedCategoryId = createdId;
      }

      if (medium === 'soft_copy') {
        if (pickedFiles.length === 0) {
          setFormError('Select a PDF or image file to upload.');
          return;
        }
        const filesPayload = pickedFiles.map((file) => ({
          fileUri: file.uri,
          fileName: normalizeUploadFileName(file.name, file.originalName),
          mimeType: file.mimeType,
          sizeBytes: file.size,
          sha256Checksum: file.sha256,
          title: file.customTitle.trim() || undefined,
        }));
        if (pickedFiles.length > 1 && multiFileMode === 'batch') {
          const createdBatch = await sendDigitalDocumentBatch({
            title,
            categoryId: resolvedCategoryId,
            confidentialityTier: tier,
            files: filesPayload,
            recipientUserId,
            remarks,
            routeToDelegateIfOnLeave: routeToDelegate,
          });
          persistSendMemory(recipientUserId, resolvedCategoryId);
          resetForm();
          setIssuedDocs(createdBatch);
          setQrModalDoc(null);
        } else {
          const created = await sendDigitalDocumentBundle({
            title,
            categoryId: resolvedCategoryId,
            confidentialityTier: tier,
            files: filesPayload,
            recipientUserId,
            remarks,
            routeToDelegateIfOnLeave: routeToDelegate,
          });
          persistSendMemory(recipientUserId, resolvedCategoryId);
          resetForm();
          setIssuedDocs([created]);
          setQrModalDoc(created);
        }
      } else {
        const parsedPages = pageCountText.trim()
          ? Number.parseInt(pageCountText.trim(), 10)
          : null;
        if (pageCountText.trim() && (!Number.isFinite(parsedPages) || (parsedPages ?? 0) <= 0)) {
          setFormError('Enter a valid whole number for page count.');
          return;
        }
        const created = await registerHardCopyDocument({
          title,
          categoryId: resolvedCategoryId,
          confidentialityTier: tier,
          physicalReference: physicalRef || null,
          physicalPageCount: parsedPages,
          recipientUserId,
          remarks,
          routeToDelegateIfOnLeave: routeToDelegate,
        });
        persistSendMemory(recipientUserId, resolvedCategoryId);
        resetForm();
        setIssuedDocs([created]);
        setQrModalDoc(created);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to send document.');
    }
  };

  const primaryCtaLabel =
    medium === 'soft_copy'
      ? pickedFiles.length > 1
        ? multiFileMode === 'batch'
          ? recipientUserId
            ? `Batch Send (${pickedFiles.length})`
            : `Batch Upload (${pickedFiles.length})`
          : recipientUserId
            ? `Bundle & Send (${pickedFiles.length})`
            : `Upload Bundle (${pickedFiles.length})`
        : recipientUserId
          ? 'Upload & Send'
          : 'Upload Soft Copy'
      : recipientUserId
        ? 'Generate QR & Send'
        : 'Generate QR Slip';

  const isBatchMultiMode =
    medium === 'soft_copy' && pickedFiles.length > 1 && multiFileMode === 'batch';

  const hasValidBatchTitles = pickedFiles.every((file) => {
    const resolvedName = normalizeUploadFileName(file.name, file.originalName);
    const effective =
      file.customTitle.trim() ||
      (title.trim() ? buildBatchItemTitle(title, resolvedName) : '');
    return effective.length >= 3;
  });

  const submitDisabled =
    isBusy ||
    hashing ||
    blockedOnLeave ||
    (isBatchMultiMode ? !hasValidBatchTitles : title.trim().length < 3) ||
    (medium === 'soft_copy' && Boolean(actor) && pickedFiles.length === 0);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
    >
      {/* Clean Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerCopy}>
          <Text style={styles.screenTitle}>Send Document</Text>
          <Text style={styles.screenSub}>Digital upload or physical QR tracking</Text>
        </View>
        <Pressable
          onPress={openSidebar}
          accessibilityLabel="Open navigation sidebar"
          style={styles.menuBtn}
        >
          <Menu size={20} color={SDO_COLORS.navyInk} />
        </Pressable>
      </View>

      {/* Recent Sent / Generated Banner */}
      {issuedDocs.length === 1 ? (
        <View style={styles.issuedBanner}>
          <View style={styles.issuedMeta}>
            <Text style={styles.issuedCode}>{issuedDocs[0].trackingCode}</Text>
            <Text numberOfLines={1} style={styles.issuedTitle}>
              {issuedDocs[0].title}
            </Text>
          </View>
          <View style={styles.issuedActions}>
            <Pressable onPress={() => setQrModalDoc(issuedDocs[0])} style={styles.issuedQrBtn}>
              <QrCode size={13} color="#FFFFFF" />
              <Text style={styles.issuedQrText}>QR Slip</Text>
            </Pressable>
            <Pressable
              onPress={() => openDocument(issuedDocs[0].id)}
              style={styles.issuedOpenBtn}
            >
              <Text style={styles.issuedOpenText}>Open Record</Text>
            </Pressable>
          </View>
        </View>
      ) : issuedDocs.length > 1 ? (
        <View style={styles.issuedBanner}>
          <View style={styles.batchBannerHeader}>
            <Text style={styles.issuedTitle}>{`Batch Issued (${issuedDocs.length})`}</Text>
            <View style={styles.issuedActions}>
              <Pressable
                disabled={printingBatch}
                onPress={() => {
                  handlePrintBatchSlips().catch(() => {});
                }}
                style={[styles.issuedQrBtn, printingBatch && styles.disabled]}
              >
                <Printer size={12} color="#FFFFFF" />
                <Text style={styles.issuedQrText}>
                  {printingBatch ? 'Printing...' : 'Print All Slips'}
                </Text>
              </Pressable>
              <Pressable
                disabled={printingBatch}
                onPress={() => {
                  handlePrintBatchTransmittal().catch(() => {});
                }}
                style={[styles.issuedOpenBtn, printingBatch && styles.disabled]}
              >
                <Text style={styles.issuedOpenText}>Transmittal</Text>
              </Pressable>
            </View>
          </View>
          {issuedDocs.map((docItem) => (
            <View key={docItem.id} style={styles.batchIssuedRow}>
              <View style={styles.fileCopy}>
                <Text style={styles.issuedCode}>{docItem.trackingCode}</Text>
                <Text numberOfLines={1} style={styles.batchIssuedTitle}>
                  {docItem.title}
                </Text>
              </View>
              <View style={styles.issuedActions}>
                <Pressable onPress={() => setQrModalDoc(docItem)} style={styles.issuedQrBtn}>
                  <QrCode size={12} color="#FFFFFF" />
                  <Text style={styles.issuedQrText}>QR</Text>
                </Pressable>
                <Pressable
                  onPress={() => openDocument(docItem.id)}
                  style={styles.issuedOpenBtn}
                >
                  <Text style={styles.issuedOpenText}>Open</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Minimal Segmented Toggle: Soft Copy | Hard Copy */}
      <View style={styles.modeSection}>
        <View style={styles.segmentTrack}>
          <Pressable
            onPress={() => {
              setMedium('soft_copy');
              setFormError(null);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: medium === 'soft_copy' }}
            style={[styles.segmentBtn, medium === 'soft_copy' && styles.segmentBtnActive]}
          >
            <FileText
              size={15}
              color={medium === 'soft_copy' ? SDO_COLORS.navy : SDO_COLORS.textMuted}
            />
            <Text style={[styles.segmentText, medium === 'soft_copy' && styles.segmentTextActive]}>
              Soft Copy
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setMedium('hard_copy');
              setFormError(null);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: medium === 'hard_copy' }}
            style={[styles.segmentBtn, medium === 'hard_copy' && styles.segmentBtnActive]}
          >
            <QrCode
              size={15}
              color={medium === 'hard_copy' ? SDO_COLORS.navy : SDO_COLORS.textMuted}
            />
            <Text style={[styles.segmentText, medium === 'hard_copy' && styles.segmentTextActive]}>
              Hard Copy
            </Text>
          </Pressable>
        </View>

        <Text style={styles.modeHelper}>
          {medium === 'soft_copy'
            ? 'Upload a PDF or image file to share digitally with custody tracking.'
            : 'No upload needed — generates a Tracking Code & QR slip for your paper folder.'}
        </Text>
      </View>

      {formError ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{formError}</Text>
        </View>
      ) : null}

      {/* Title */}
      <View style={styles.field}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>
            {isBatchMultiMode ? 'Title (Optional Default Prefix)' : 'Title'}
          </Text>
          <Text style={styles.counter}>{`${title.length}/140`}</Text>
        </View>
        <TextInput
          value={title}
          onChangeText={(text) => {
            setFormError(null);
            setTitle(text);
          }}
          maxLength={140}
          placeholder={
            isBatchMultiMode
              ? 'Optional prefix for untitled files below'
              : 'e.g. Budget Utilization Request — Q4 Supplies'
          }
          placeholderTextColor={SDO_COLORS.textMuted}
          style={styles.input}
        />
      </View>

      {/* Format-Specific Zone */}
      {medium === 'soft_copy' ? (
        <View style={styles.field}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>
              {pickedFiles.length > 1 ? `Files (${pickedFiles.length})` : 'File'}
            </Text>
            {pickedFiles.length > 0 ? (
              <Pressable disabled={hashing} onPress={handleChooseFile}>
                <Text style={styles.optionsLink}>{hashing ? 'Adding...' : 'Add Files'}</Text>
              </Pressable>
            ) : null}
          </View>

          {pickedFiles.length > 0 ? (
            <View style={styles.fileList}>
              {pickedFiles.map((file, idx) => {
                const resolvedName = normalizeUploadFileName(file.name, file.originalName);
                return (
                  <View key={`${file.uri}-${file.originalName}-${idx}`} style={styles.fileCardWrap}>
                    <View style={styles.fileCardRow}>
                      <FileText size={18} color={SDO_COLORS.emeraldText} />
                      <View style={styles.fileCopy}>
                        <Text numberOfLines={1} style={styles.fileName}>
                          {resolvedName}
                        </Text>
                        <Text numberOfLines={1} style={styles.fileMeta}>
                          {`${formatBytes(file.size)} · Verified${
                            resolvedName !== file.originalName ? ` · Original: ${file.originalName}` : ''
                          }`}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() =>
                          setPickedFiles((prev) => prev.filter((_, itemIdx) => itemIdx !== idx))
                        }
                        hitSlop={8}
                        accessibilityLabel={`Remove ${file.originalName}`}
                        style={styles.removeBtn}
                      >
                        <Trash2 size={15} color={SDO_COLORS.rose} />
                      </Pressable>
                    </View>

                    <View style={styles.renameBlock}>
                      <View style={styles.renameLabelRow}>
                        <Pencil size={11} color={SDO_COLORS.textSecondary} />
                        <Text style={styles.renameLabel}>File Name</Text>
                      </View>
                      <TextInput
                        value={file.name}
                        onChangeText={(text) => {
                          setFormError(null);
                          setPickedFiles((prev) =>
                            prev.map((item, itemIdx) =>
                              itemIdx === idx ? { ...item, name: text } : item,
                            ),
                          );
                        }}
                        maxLength={180}
                        accessibilityLabel={`File name for ${file.originalName}`}
                        placeholder={file.originalName}
                        placeholderTextColor={SDO_COLORS.textMuted}
                        style={styles.fileTitleInput}
                      />
                    </View>

                    {isBatchMultiMode ? (
                      <TextInput
                        value={file.customTitle}
                        onChangeText={(text) => {
                          setFormError(null);
                          setPickedFiles((prev) =>
                            prev.map((item, itemIdx) =>
                              itemIdx === idx ? { ...item, customTitle: text } : item,
                            ),
                          );
                        }}
                        maxLength={140}
                        accessibilityLabel={`Title for ${file.originalName}`}
                        placeholder={
                          title.trim()
                            ? buildBatchItemTitle(title, resolvedName)
                            : `Title for ${resolvedName}`
                        }
                        placeholderTextColor={SDO_COLORS.textMuted}
                        style={styles.fileTitleInput}
                      />
                    ) : null}
                  </View>
                );
              })}

              {pickedFiles.length > 1 ? (
                <View style={styles.multiModeCard}>
                  <View style={styles.segmentTrack}>
                    <Pressable
                      onPress={() => setMultiFileMode('bundle')}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: multiFileMode === 'bundle' }}
                      style={[
                        styles.segmentBtn,
                        multiFileMode === 'bundle' && styles.segmentBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          multiFileMode === 'bundle' && styles.segmentTextActive,
                        ]}
                      >
                        {`One Doc (${pickedFiles.length} files)`}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setMultiFileMode('batch')}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: multiFileMode === 'batch' }}
                      style={[
                        styles.segmentBtn,
                        multiFileMode === 'batch' && styles.segmentBtnActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentText,
                          multiFileMode === 'batch' && styles.segmentTextActive,
                        ]}
                      >
                        {`Separate (${pickedFiles.length} docs)`}
                      </Text>
                    </Pressable>
                  </View>
                  <Text style={styles.modeHelper}>
                    {multiFileMode === 'bundle'
                      ? 'Bundles all selected files under 1 tracking code & QR slip.'
                      : 'Creates 1 separate tracking code & QR slip per file.'}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : (
            <Pressable disabled={hashing} onPress={handleChooseFile} style={styles.uploadDropzone}>
              <FileUp size={18} color={SDO_COLORS.navy} />
              <Text style={styles.uploadText}>
                {hashing ? 'Preparing files...' : 'Select PDF or Image'}
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={styles.twoCol}>
          <View style={[styles.field, styles.flexMain]}>
            <Text style={styles.label}>Folder / Slip Note</Text>
            <TextInput
              value={physicalRef}
              onChangeText={setPhysicalRef}
              maxLength={80}
              placeholder="e.g. Brown folder · Slip #14"
              placeholderTextColor={SDO_COLORS.textMuted}
              style={styles.input}
            />
          </View>
          <View style={[styles.field, styles.pageCol]}>
            <Text style={styles.label}>Pages</Text>
            <TextInput
              value={pageCountText}
              onChangeText={setPageCountText}
              maxLength={4}
              keyboardType="number-pad"
              placeholder="e.g. 6"
              placeholderTextColor={SDO_COLORS.textMuted}
              style={styles.input}
            />
          </View>
        </View>
      )}

      {/* Send To */}
      <View style={styles.field}>
        <Text style={styles.label}>Send To</Text>
        {recentPeers.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentRow}
          >
            <View style={styles.recentLabelWrap}>
              <Clock size={11} color={SDO_COLORS.textMuted} />
              <Text style={styles.recentLabel}>Recent:</Text>
            </View>
            {recentPeers.map((peer) => {
              const selected = peer.id === recipientUserId;
              return (
                <Pressable
                  key={`recent-${peer.id}`}
                  onPress={() => setRecipientUserId(peer.id)}
                  style={[styles.recentChip, selected && styles.recentChipActive]}
                >
                  <Text style={[styles.recentChipText, selected && styles.recentChipTextActive]}>
                    {`${peer.office.code} · ${peer.fullName.split(' ')[0]}`}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Pressable
            onPress={() => setRecipientUserId(null)}
            style={[styles.chip, recipientUserId === null && styles.chipActive]}
          >
            <Text style={[styles.chipText, recipientUserId === null && styles.chipTextActive]}>
              Hold at My Desk
            </Text>
          </Pressable>
          {peers.map((peer) => {
            const selected = peer.id === recipientUserId;
            return (
              <Pressable
                key={peer.id}
                onPress={() => setRecipientUserId(peer.id)}
                style={[styles.chip, selected && styles.chipActive]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                  {`${peer.office.code} · ${peer.fullName.split(' ')[0]}`}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {chosenRecipient ? (
          <View style={styles.recipientRow}>
            <View style={styles.recipientCopy}>
              <Text style={styles.recipientName}>{chosenRecipient.fullName}</Text>
              <Text style={styles.recipientMeta}>{chosenRecipient.office.name}</Text>
            </View>
            <AvailabilityBadge status={chosenRecipient.availability} />
          </View>
        ) : null}

        {isRecipientOnLeave ? (
          <Pressable
            onPress={() => setRouteToDelegate((prev) => !prev)}
            style={styles.delegateNotice}
          >
            <Text style={styles.delegateText}>
              {delegateTarget
                ? `On Leave · ${routeToDelegate ? `Routing to ${delegateTarget.fullName}` : 'Tap to route to delegate'}`
                : 'Recipient is On Leave with no delegate configured.'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {/* Progressive Disclosure: Routing Note (only when sending to a recipient) */}
      {recipientUserId ? (
        <View style={styles.field}>
          <Text style={styles.label}>Note / Disposition (Optional)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentRow}
          >
            {DISPOSITION_REMARK_PRESETS.slice(0, 5).map((preset) => {
              const selected = remarks === preset;
              return (
                <Pressable
                  key={preset}
                  onPress={() => setRemarks(preset)}
                  style={[styles.recentChip, selected && styles.recentChipActive]}
                >
                  <Text style={[styles.recentChipText, selected && styles.recentChipTextActive]}>
                    {preset}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <TextInput
            value={remarks}
            onChangeText={setRemarks}
            maxLength={140}
            placeholder={
              medium === 'hard_copy'
                ? 'e.g. Carried via records liaison'
                : 'e.g. For budget review'
            }
            placeholderTextColor={SDO_COLORS.textMuted}
            style={styles.input}
          />
        </View>
      ) : null}

      {/* Progressive Disclosure: Category & Confidentiality */}
      <View style={styles.optionsWrap}>
        <Pressable
          onPress={() => setShowOptions((prev) => !prev)}
          style={styles.optionsToggleRow}
        >
          <View style={styles.optionsSummary}>
            <SlidersHorizontal size={14} color={SDO_COLORS.textSecondary} />
            <Text style={styles.optionsSummaryText}>
              {`${selectedCategoryName} · ${selectedTierLabel}`}
            </Text>
          </View>
          <Text style={styles.optionsLink}>{showOptions ? 'Hide' : 'Change'}</Text>
        </Pressable>

        {showOptions ? (
          <View style={styles.optionsBody}>
            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Text style={styles.subLabel}>Category</Text>
                <Pressable
                  testID="mobile-send-add-custom-category-btn"
                  onPress={() => setShowCustomCategory((v) => !v)}
                  style={styles.inlineAddCatBtn}
                >
                  <Plus size={12} color={SDO_COLORS.navy} />
                  <Text style={styles.inlineAddCatText}>
                    {showCustomCategory ? 'Close Custom' : 'Add Custom'}
                  </Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {categories.map((cat) => {
                  const selected = cat.id === categoryId && !showCustomCategory;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => {
                        setCategoryId(cat.id);
                        setShowCustomCategory(false);
                        if (actor) {
                          AsyncStorage.setItem(`${LAST_CATEGORY_PREFIX}${actor.id}`, cat.id).catch(
                            () => {},
                          );
                        }
                      }}
                      style={[styles.chip, selected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => setShowCustomCategory((v) => !v)}
                  style={[styles.chip, showCustomCategory && styles.chipActive]}
                >
                  <Text style={[styles.chipText, showCustomCategory && styles.chipTextActive]}>
                    + Custom
                  </Text>
                </Pressable>
              </ScrollView>

              {showCustomCategory ? (
                <View style={styles.customCatCard} testID="mobile-send-custom-category-form">
                  <Text style={styles.customCatTitle}>Add New Global Category</Text>
                  <TextInput
                    testID="mobile-send-custom-cat-name"
                    value={customCategoryName}
                    onChangeText={(text) => {
                      setFormError(null);
                      setCustomCategoryName(text);
                    }}
                    maxLength={120}
                    placeholder="Category name (e.g. School Repair Request)"
                    placeholderTextColor={SDO_COLORS.textMuted}
                    style={styles.customCatInput}
                  />
                  <TextInput
                    testID="mobile-send-custom-cat-code"
                    value={customCategoryCode}
                    onChangeText={(text) => setCustomCategoryCode(text.toUpperCase())}
                    maxLength={16}
                    autoCapitalize="characters"
                    placeholder="Short code (optional, e.g. REP-REQ)"
                    placeholderTextColor={SDO_COLORS.textMuted}
                    style={[styles.customCatInput, styles.customCatCodeInput]}
                  />
                  {similarCustomCategories.length > 0 ? (
                    <View style={styles.similarWrap}>
                      <Text style={styles.similarHint}>
                        Similar category exists — tap to select:
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.recentRow}
                      >
                        {similarCustomCategories.slice(0, 4).map((cat) => (
                          <Pressable
                            key={`sim-${cat.id}`}
                            onPress={() => {
                              setCategoryId(cat.id);
                              setCustomCategoryName('');
                              setCustomCategoryCode('');
                              setShowCustomCategory(false);
                              if (actor) {
                                AsyncStorage.setItem(
                                  `${LAST_CATEGORY_PREFIX}${actor.id}`,
                                  cat.id,
                                ).catch(() => {});
                              }
                            }}
                            style={styles.recentChip}
                          >
                            <Text style={styles.recentChipText}>
                              {`${cat.code} · ${cat.name}`}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>
                  ) : null}
                  <View style={styles.customCatActions}>
                    <Pressable
                      onPress={() => {
                        setShowCustomCategory(false);
                        setCustomCategoryName('');
                        setCustomCategoryCode('');
                      }}
                      style={styles.customCatCancelBtn}
                    >
                      <Text style={styles.customCatCancelText}>Cancel</Text>
                    </Pressable>
                    <Pressable
                      testID="mobile-send-save-custom-cat-btn"
                      disabled={
                        savingCustomCategory || isBusy || customCategoryName.trim().length < 2
                      }
                      onPress={() => {
                        handleSaveCustomCategory().catch(() => {});
                      }}
                      style={[
                        styles.customCatSaveBtn,
                        (savingCustomCategory ||
                          isBusy ||
                          customCategoryName.trim().length < 2) &&
                          styles.disabled,
                      ]}
                    >
                      <Plus size={13} color={SDO_COLORS.navyInk} />
                      <Text style={styles.customCatSaveText}>
                        {savingCustomCategory ? 'Saving...' : 'Save & Select'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.subLabel}>Confidentiality</Text>
              <View style={styles.wrapRow}>
                {TIER_OPTIONS.map((opt) => {
                  const selected = opt.id === tier;
                  return (
                    <Pressable
                      key={opt.id}
                      onPress={() => setTier(opt.id)}
                      style={[styles.chip, selected && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {/* Primary CTA */}
      <View style={styles.ctaBlock}>
        {recipientUserId ? (
          <View style={styles.qrFirstNotice}>
            <Lock size={13} color={SDO_COLORS.navy} />
            <Text style={styles.qrFirstNoticeText}>
              QR-First Custody Unlock: Only the routing QR &amp; notice are sent immediately. The
              recipient must scan the QR or enter the code manually to unlock and view attached
              files.
            </Text>
          </View>
        ) : null}
        <Pressable
          onPress={handleSend}
          disabled={submitDisabled}
          accessibilityRole="button"
          style={[styles.primaryBtn, submitDisabled && styles.disabled]}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              {medium === 'hard_copy' ? (
                <QrCode size={17} color="#FFFFFF" />
              ) : (
                <SendIcon size={16} color="#FFFFFF" />
              )}
              <Text style={styles.primaryBtnText}>{primaryCtaLabel}</Text>
            </>
          )}
        </Pressable>

        {!actor ? (
          <Text style={styles.preAuthHint}>
            Sign in from the Sidebar to upload files or issue live QR slips.
          </Text>
        ) : null}
      </View>

      {qrModalDoc ? (
        <OpaqueQrModal
          open={Boolean(qrModalDoc)}
          qrToken={qrModalDoc.qrToken}
          trackingCode={qrModalDoc.trackingCode}
          isHardCopy={qrModalDoc.isHardCopy}
          document={qrModalDoc}
          onClose={() => setQrModalDoc(null)}
        />
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 32,
    gap: 18,
    backgroundColor: SDO_COLORS.bg,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  screenSub: {
    fontSize: 12,
    color: SDO_COLORS.textMuted,
  },
  menuBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  issuedBanner: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceMuted,
    padding: 15,
    gap: 12,
    overflow: 'hidden',
  },
  issuedMeta: {
    gap: 3,
    minWidth: 0,
  },
  issuedCode: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: SDO_COLORS.navy,
  },
  issuedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  issuedActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  issuedQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.navy,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  issuedQrText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  issuedOpenBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  issuedOpenText: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  modeSection: {
    gap: 8,
  },
  segmentTrack: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  segmentBtnActive: {
    backgroundColor: SDO_COLORS.surface,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
  },
  segmentTextActive: {
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  modeHelper: {
    fontSize: 12,
    lineHeight: 17,
    color: SDO_COLORS.textMuted,
  },
  errorBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SDO_COLORS.roseBorder,
    backgroundColor: SDO_COLORS.roseSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.roseText,
  },
  field: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
  },
  counter: {
    fontSize: 11,
    color: SDO_COLORS.textMuted,
  },
  input: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceMuted,
    paddingHorizontal: 14,
    fontSize: 14,
    color: SDO_COLORS.textPrimary,
  },
  uploadDropzone: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: SDO_COLORS.navy,
    backgroundColor: SDO_COLORS.skySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadText: {
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  fileList: {
    gap: 8,
  },
  multiModeCard: {
    gap: 6,
    marginTop: 2,
  },
  batchIssuedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SDO_COLORS.border,
  },
  batchIssuedTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  fileCardWrap: {
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SDO_COLORS.emeraldBorder,
    backgroundColor: SDO_COLORS.emeraldSoft,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  fileCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  renameBlock: {
    gap: 4,
  },
  renameLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  renameLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  fileTitleInput: {
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 10,
    fontSize: 13,
    color: SDO_COLORS.textPrimary,
  },
  fileCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  fileName: {
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  fileMeta: {
    fontSize: 11,
    color: SDO_COLORS.emeraldText,
  },
  removeBtn: {
    padding: 4,
  },
  twoCol: {
    flexDirection: 'row',
    gap: 10,
  },
  flexMain: {
    flex: 1,
  },
  pageCol: {
    width: 82,
  },
  chipRow: {
    gap: 6,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: {
    borderColor: SDO_COLORS.navy,
    backgroundColor: SDO_COLORS.navy,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
  },
  chipTextActive: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  recipientCopy: {
    flex: 1,
    gap: 1,
  },
  recipientName: {
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  recipientMeta: {
    fontSize: 11,
    color: SDO_COLORS.textMuted,
  },
  delegateNotice: {
    borderRadius: 10,
    backgroundColor: SDO_COLORS.amberSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  delegateText: {
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.amberText,
  },
  optionsWrap: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: SDO_COLORS.border,
    paddingVertical: 12,
    gap: 12,
  },
  optionsToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  optionsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  optionsSummaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
  },
  optionsLink: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  optionsBody: {
    gap: 12,
    paddingTop: 4,
  },
  ctaBlock: {
    gap: 8,
  },
  primaryBtn: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  disabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  preAuthHint: {
    fontSize: 11,
    textAlign: 'center',
    color: SDO_COLORS.textMuted,
  },
  batchBannerHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 2,
  },
  recentLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recentLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textMuted,
  },
  recentChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  recentChipActive: {
    backgroundColor: SDO_COLORS.skySoft,
    borderColor: SDO_COLORS.navy,
  },
  recentChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  recentChipTextActive: {
    color: SDO_COLORS.navy,
  },
  inlineAddCatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.skySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  inlineAddCatText: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  customCatCard: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    padding: 12,
    gap: 8,
  },
  customCatTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.navy,
  },
  customCatInput: {
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 12,
    fontSize: 13,
    color: SDO_COLORS.textPrimary,
  },
  customCatCodeInput: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  similarWrap: {
    gap: 4,
  },
  similarHint: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.amberText,
  },
  customCatActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 2,
  },
  customCatCancelBtn: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customCatCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  customCatSaveBtn: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  customCatSaveText: {
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  qrFirstNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.skySoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  qrFirstNoticeText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    color: SDO_COLORS.navy,
  },
});
