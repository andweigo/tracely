import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  FileUp,
  FolderKanban,
  GitBranch,
  Lock,
  Pencil,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
} from 'lucide-react';
import {
  ConfidentialityTier,
  DesktopPairingSession,
  DesktopPairStatus,
  DISPOSITION_REMARK_PRESETS,
  DocumentRecord,
  RoutingTemplate,
} from '../domain/types';
import { useWebApp } from '../state/WebAppContext';
import {
  BatchQrSlipsModal,
  BatchTransmittalModal,
  ModalDialog,
  OpaqueQrModal,
} from '../components/Modals';
import { QrCodeGraphic } from '../components/QrCodeGraphic';
import {
  buildBatchItemTitle,
  computeFileSha256,
  formatBytes,
  normalizeUploadFileName,
} from '../utils/formatters';

type SendCopyMode = 'soft_copy' | 'hard_copy';

interface PickedWebFile {
  readonly id: string;
  readonly file: File;
  readonly customFileName: string;
  readonly customTitle: string;
  readonly previewUrl: string | null;
}

const RECENT_RECIPIENTS_KEY_PREFIX = '@sdo_doctrack/web_recent_recipients_';
const LAST_CATEGORY_KEY_PREFIX = '@sdo_doctrack/web_last_category_';

function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
}

function isSupportedUploadFile(file: File): boolean {
  return (
    file.type === 'application/pdf' ||
    file.type.startsWith('image/') ||
    /\.(pdf|png|jpe?g|webp)$/i.test(file.name)
  );
}

function createSafePreviewUrl(file: File): string | null {
  if (!isImageFile(file)) return null;
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
  try {
    return URL.createObjectURL(file);
  } catch {
    return null;
  }
}

function revokeSafePreviewUrl(url: string | null): void {
  if (!url) return;
  if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore cleanup error
    }
  }
}

function loadRecentRecipientIds(actorId: string | undefined): ReadonlyArray<string> {
  if (!actorId) return [];
  try {
    const raw = window.localStorage.getItem(`${RECENT_RECIPIENTS_KEY_PREFIX}${actorId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === 'string').slice(0, 4)
      : [];
  } catch {
    return [];
  }
}

function saveRecentRecipientId(actorId: string | undefined, recipientId: string): ReadonlyArray<string> {
  if (!actorId || !recipientId) return [];
  const existing = loadRecentRecipientIds(actorId);
  const next = [recipientId, ...existing.filter((id) => id !== recipientId)].slice(0, 4);
  try {
    window.localStorage.setItem(`${RECENT_RECIPIENTS_KEY_PREFIX}${actorId}`, JSON.stringify(next));
  } catch {
    // Ignore storage quota
  }
  return next;
}

function loadLastCategoryId(actorId: string | undefined): string {
  if (!actorId) return '';
  try {
    return window.localStorage.getItem(`${LAST_CATEGORY_KEY_PREFIX}${actorId}`) ?? '';
  } catch {
    return '';
  }
}

function saveLastCategoryId(actorId: string | undefined, categoryId: string): void {
  if (!actorId || !categoryId) return;
  try {
    window.localStorage.setItem(`${LAST_CATEGORY_KEY_PREFIX}${actorId}`, categoryId);
  } catch {
    // Ignore storage quota
  }
}

const TIER_LABEL: Record<ConfidentialityTier, string> = {
  standard_internal: 'Standard',
  restricted: 'Restricted',
  confidential: 'Confidential',
};

/**
 * Minimalist flat "Send Document" workspace matching mobile's segmented Soft Copy | Hard Copy flow:
 * progressive disclosure for optional Note and Category/Confidentiality settings, plus printable QR slip.
 */
export const SendPage: React.FC = () => {
  const {
    actor,
    offices,
    categories,
    personnelDirectory,
    routingTemplates,
    userPreferences,
    sendDigitalDocumentBundle,
    sendDigitalDocumentBatch,
    registerHardCopyDocument,
    declareCategory,
    loadRoutingTemplates,
    createRoutingTemplate,
    deleteRoutingTemplate,
    createDesktopPairSession,
    checkDesktopPairStatus,
    openDocument,
    isBusy,
    notify,
  } = useWebApp();

  const [copyMode, setCopyMode] = useState<SendCopyMode>(() =>
    userPreferences.defaultCopyFormat === 'hard_copy' ? 'hard_copy' : 'soft_copy',
  );
  const [multiFileMode, setMultiFileMode] = useState<'bundle' | 'batch'>('bundle');
  const [title, setTitle] = useState('');
  const [pickedFiles, setPickedFiles] = useState<ReadonlyArray<PickedWebFile>>([]);
  const [physicalReference, setPhysicalReference] = useState('');
  const [physicalPageCount, setPhysicalPageCount] = useState('');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [remarks, setRemarks] = useState(() => userPreferences.defaultRemarks || '');
  const [categoryId, setCategoryId] = useState(() => loadLastCategoryId(actor?.id));
  const [showCustomCategory, setShowCustomCategory] = useState(false);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [customCategoryCode, setCustomCategoryCode] = useState('');
  const [savingCustomCategory, setSavingCustomCategory] = useState(false);
  const [appliedTemplate, setAppliedTemplate] = useState<RoutingTemplate | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplDescription, setTplDescription] = useState('');
  const [tplSteps, setTplSteps] = useState<Array<{ officeId: string; defaultRemarks: string }>>([]);
  const [tplGlobal, setTplGlobal] = useState(true);
  const [tier, setTier] = useState<ConfidentialityTier>('standard_internal');
  const [showOptions, setShowOptions] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [recentRecipientIds, setRecentRecipientIds] = useState<ReadonlyArray<string>>(() =>
    loadRecentRecipientIds(actor?.id),
  );

  const [issuedDocs, setIssuedDocs] = useState<ReadonlyArray<DocumentRecord>>([]);
  const [qrModalDoc, setQrModalDoc] = useState<DocumentRecord | null>(null);
  const [batchPrintOpen, setBatchPrintOpen] = useState(false);
  const [transmittalOpen, setTransmittalOpen] = useState(false);
  const [pairSession, setPairSession] = useState<DesktopPairingSession | null>(null);
  const [pairStatus, setPairStatus] = useState<DesktopPairStatus | null>(null);
  const [pairRemainingSec, setPairRemainingSec] = useState(0);
  const [checkingPair, setCheckingPair] = useState(false);

  const pickedFilesRef = useRef(pickedFiles);
  pickedFilesRef.current = pickedFiles;

  useEffect(() => {
    setRecentRecipientIds(loadRecentRecipientIds(actor?.id));
    const savedCat = loadLastCategoryId(actor?.id);
    if (savedCat) {
      setCategoryId(savedCat);
    }
    if (actor) {
      void loadRoutingTemplates();
    }
  }, [actor, loadRoutingTemplates]);

  useEffect(() => {
    return () => {
      for (const item of pickedFilesRef.current) {
        revokeSafePreviewUrl(item.previewUrl);
      }
    };
  }, []);

  const recipients = useMemo(
    () => personnelDirectory.filter((person) => person.id !== actor?.id),
    [personnelDirectory, actor],
  );

  const recentRecipients = useMemo(
    () =>
      recentRecipientIds
        .map((id) => recipients.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => Boolean(p)),
    [recentRecipientIds, recipients],
  );

  const stageChosenFiles = useCallback(
    (incoming: ReadonlyArray<File>) => {
      if (incoming.length === 0) return;
      const valid = incoming.filter(isSupportedUploadFile);
      if (valid.length < incoming.length) {
        notify('error', 'Only PDF and image files (PNG, JPG, WebP) can be uploaded.');
      }
      if (valid.length === 0) return;
      setPickedFiles((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const additions: PickedWebFile[] = [];
        for (const file of valid) {
          const id = `${file.name}-${file.size}-${file.lastModified}`;
          if (!seen.has(id)) {
            seen.add(id);
            additions.push({
              id,
              file,
              customFileName: file.name,
              customTitle: '',
              previewUrl: createSafePreviewUrl(file),
            });
          }
        }
        return [...prev, ...additions];
      });
    },
    [notify],
  );

  const effectiveCategoryId =
    (categoryId && categories.some((c) => c.id === categoryId) ? categoryId : '') ||
    categories[0]?.id ||
    'cat-memo';
  const selectedCategoryName =
    categories.find((c) => c.id === effectiveCategoryId)?.name ?? 'Office Memo';

  const matchingCustomCategories = useMemo(() => {
    const q = customCategoryName.trim().toLowerCase();
    if (q.length < 2) return [];
    return categories.filter(
      (cat) => cat.name.toLowerCase().includes(q) || cat.code.toLowerCase().includes(q),
    );
  }, [categories, customCategoryName]);

  const handleSaveCustomCategory = useCallback(async (): Promise<string | null> => {
    const cleanName = customCategoryName.trim().replace(/\s+/g, ' ');
    if (cleanName.length < 2) {
      notify('error', 'Enter at least 2 characters for the custom category name.');
      return null;
    }
    const existingExact = categories.find(
      (c) => c.name.trim().toLowerCase() === cleanName.toLowerCase(),
    );
    if (existingExact) {
      setCategoryId(existingExact.id);
      saveLastCategoryId(actor?.id, existingExact.id);
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
      saveLastCategoryId(actor?.id, created.id);
      setCustomCategoryName('');
      setCustomCategoryCode('');
      setShowCustomCategory(false);
      return created.id;
    } catch {
      return null;
    } finally {
      setSavingCustomCategory(false);
    }
  }, [actor?.id, categories, customCategoryCode, customCategoryName, declareCategory, notify]);

  const parsedPages = useMemo(() => {
    const clean = physicalPageCount.trim();
    if (!clean) return null;
    const n = Number(clean);
    return Number.isInteger(n) && n > 0 ? n : null;
  }, [physicalPageCount]);

  const isBatchMultiMode =
    copyMode === 'soft_copy' && pickedFiles.length > 1 && multiFileMode === 'batch';

  const hasValidBatchTitles =
    pickedFiles.length > 0 &&
    pickedFiles.every((item) => {
      const effectiveName = normalizeUploadFileName(item.customFileName, item.file.name);
      const effective =
        item.customTitle.trim() ||
        (title.trim() ? buildBatchItemTitle(title, effectiveName) : '');
      return effective.length > 0;
    });

  const canSubmit =
    !isBusy &&
    (isBatchMultiMode
      ? hasValidBatchTitles
      : title.trim().length > 0 && (copyMode === 'soft_copy' ? pickedFiles.length > 0 : true));

  const handleOpenPhonePair = async () => {
    try {
      const session = await createDesktopPairSession(
        title.trim() || 'Desktop Scan Attachment',
      );
      setPairStatus(null);
      setPairSession(session);
    } catch {
      // Fallback preview pairing notice handled by notify in context
    }
  };

  const pollPairStatus = useCallback(
    async (pairToken: string) => {
      setCheckingPair(true);
      try {
        const status = await checkDesktopPairStatus(pairToken);
        setPairStatus(status);
      } catch {
        // Ignore transient polling error
      } finally {
        setCheckingPair(false);
      }
    },
    [checkDesktopPairStatus],
  );

  useEffect(() => {
    if (!pairSession) {
      setPairRemainingSec(0);
      return;
    }

    const updateCountdown = () => {
      const diffSec = Math.max(
        0,
        Math.floor((Date.parse(pairSession.expiresAt) - Date.now()) / 1000),
      );
      setPairRemainingSec(diffSec);
    };
    updateCountdown();

    const countdownId = window.setInterval(updateCountdown, 1000);
    if (pairStatus?.attached) {
      return () => window.clearInterval(countdownId);
    }

    const pollId = window.setInterval(() => {
      void pollPairStatus(pairSession.pairToken);
    }, 2500);

    return () => {
      window.clearInterval(countdownId);
      window.clearInterval(pollId);
    };
  }, [pairSession, pairStatus?.attached, pollPairStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    let resolvedCategoryId = effectiveCategoryId;
    if (showCustomCategory && customCategoryName.trim().length >= 2) {
      const createdId = await handleSaveCustomCategory();
      if (!createdId) return;
      resolvedCategoryId = createdId;
    }

    if (copyMode === 'soft_copy') {
      if (pickedFiles.length === 0) {
        notify('error', 'Choose a PDF or scanned image before dispatching.');
        return;
      }
      const hashedFiles = await Promise.all(
        pickedFiles.map(async (item) => ({
          file: item.file,
          fileName: normalizeUploadFileName(item.customFileName, item.file.name),
          sha256Checksum: await computeFileSha256(item.file),
          title: item.customTitle.trim() || undefined,
        })),
      );
      if (hashedFiles.length > 1 && multiFileMode === 'batch') {
        const createdBatch = await sendDigitalDocumentBatch({
          title: title.trim(),
          categoryId: resolvedCategoryId,
          confidentialityTier: tier,
          files: hashedFiles,
          recipientUserId: recipientUserId || null,
          remarks: remarks.trim() || undefined,
        });
        setIssuedDocs(createdBatch);
        setQrModalDoc(null);
      } else {
        const created = await sendDigitalDocumentBundle({
          title: title.trim(),
          categoryId: resolvedCategoryId,
          confidentialityTier: tier,
          files: hashedFiles,
          recipientUserId: recipientUserId || null,
          remarks: remarks.trim() || undefined,
        });
        setIssuedDocs([created]);
        setQrModalDoc(created);
      }
      if (recipientUserId) {
        setRecentRecipientIds(saveRecentRecipientId(actor?.id, recipientUserId));
      }
      saveLastCategoryId(actor?.id, resolvedCategoryId);
      for (const item of pickedFiles) {
        revokeSafePreviewUrl(item.previewUrl);
      }
      setTitle('');
      setPickedFiles([]);
      setRemarks('');
      setRecipientUserId('');
      return;
    }

    const created = await registerHardCopyDocument({
      title: title.trim(),
      categoryId: resolvedCategoryId,
      confidentialityTier: tier,
      physicalReference: physicalReference.trim() || null,
      physicalPageCount: parsedPages,
      recipientUserId: recipientUserId || null,
      remarks: remarks.trim() || undefined,
    });
    if (recipientUserId) {
      setRecentRecipientIds(saveRecentRecipientId(actor?.id, recipientUserId));
    }
    saveLastCategoryId(actor?.id, resolvedCategoryId);
    setIssuedDocs([created]);
    setQrModalDoc(created);
    setTitle('');
    setPhysicalReference('');
    setPhysicalPageCount('');
    setRemarks('');
    setRecipientUserId('');
  };

  const submitLabel =
    copyMode === 'soft_copy'
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

  const selectedRecipient = recipients.find((p) => p.id === recipientUserId) ?? null;

  return (
    <div className="send-workspace">
      <div className="send-main">
        <div className="section-header-row">
          <h3 className="section-title" style={{ fontSize: 16 }}>New Document</h3>

          <button type="button" className="btn btn-outline" onClick={() => void handleOpenPhonePair()}>
            <Smartphone size={15} /> Pair Mobile Camera
          </button>
        </div>

        <form className="send-card" onSubmit={(e) => void handleSubmit(e)}>
        <div className="segmented-control" role="tablist" aria-label="Copy format">
          <button
            type="button"
            role="tab"
            aria-selected={copyMode === 'soft_copy'}
            className={`segment-btn ${copyMode === 'soft_copy' ? 'segment-btn-active' : ''}`}
            onClick={() => setCopyMode('soft_copy')}
          >
            <FileUp size={15} /> Soft Copy
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={copyMode === 'hard_copy'}
            className={`segment-btn ${copyMode === 'hard_copy' ? 'segment-btn-active' : ''}`}
            onClick={() => setCopyMode('hard_copy')}
          >
            <FolderKanban size={15} /> Hard Copy
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
          {copyMode === 'soft_copy'
            ? 'Upload a digital PDF or photo for direct tracking.'
            : 'No upload needed — generates a Tracking Code & QR slip for your paper folder.'}
        </p>

        <div className="field-group">
          <div className="field-label-row">
            <label className="field-label" htmlFor="send-doc-title">
              Document Title
            </label>
            {isBatchMultiMode ? (
              <span className="field-hint">Optional default prefix for untitled files</span>
            ) : null}
          </div>
          <input
            id="send-doc-title"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              isBatchMultiMode
                ? 'Optional prefix when file titles are entered below'
                : 'e.g. Budget Utilization Request — Q4 Supplies'
            }
          />
        </div>

        {copyMode === 'soft_copy' ? (
          <div className="field-group">
            <span className="field-label">
              {pickedFiles.length > 1
                ? `Attachments (${pickedFiles.length} files)`
                : 'Attachment (PDF or Image)'}
            </span>
            <label
              data-testid="send-file-dropzone"
              className={`file-drop-zone ${pickedFiles.length > 0 ? 'file-drop-zone-filled' : ''} ${
                isDragging ? 'file-drop-zone-dragging' : ''
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!isDragging) setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDragging(false);
                stageChosenFiles(Array.from(e.dataTransfer?.files ?? []));
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {isDragging
                    ? 'Drop PDF or image files here'
                    : pickedFiles.length === 1
                      ? normalizeUploadFileName(pickedFiles[0].customFileName, pickedFiles[0].file.name)
                      : pickedFiles.length > 1
                        ? `${pickedFiles.length} files selected`
                        : 'Drag & drop or select PDF / Image'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {pickedFiles.length > 0
                    ? `${formatBytes(pickedFiles.reduce((acc, item) => acc + item.file.size, 0))} total · Ready for SHA-256 verification`
                    : 'Drop one or multiple PDFs/images here or click Browse Files'}
                </div>
              </div>
              <input
                type="file"
                accept=".pdf,image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => {
                  stageChosenFiles(Array.from(e.target.files ?? []));
                  e.target.value = '';
                }}
              />
              <span className="btn btn-outline" style={{ pointerEvents: 'none' }}>
                {pickedFiles.length > 0 ? 'Add Files' : 'Browse Files'}
              </span>
            </label>

            {pickedFiles.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pickedFiles.map((item, idx) => {
                  const resolvedName = normalizeUploadFileName(item.customFileName, item.file.name);
                  return (
                    <div
                      key={item.id}
                      className="card-soft"
                      style={{
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          {item.previewUrl ? (
                            <img
                              src={item.previewUrl}
                              alt={`Preview of ${resolvedName}`}
                              className="staged-file-thumb"
                            />
                          ) : (
                            <span className="staged-file-pdf-badge" aria-hidden="true">
                              <FileText size={16} />
                            </span>
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {resolvedName}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                              {formatBytes(item.file.size)}
                              {resolvedName !== item.file.name ? ` · Original: ${item.file.name}` : ''}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="icon-circle-btn"
                          aria-label={`Remove ${item.file.name}`}
                          onClick={() => {
                            revokeSafePreviewUrl(item.previewUrl);
                            setPickedFiles((prev) => prev.filter((_, itemIdx) => itemIdx !== idx));
                          }}
                        >
                          <Trash2 size={14} color="var(--rose-text)" />
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label
                          htmlFor={`file-rename-${idx}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--text-secondary)',
                          }}
                        >
                          <Pencil size={11} /> File Name
                        </label>
                        <input
                          id={`file-rename-${idx}`}
                          type="text"
                          className="input"
                          maxLength={180}
                          aria-label={`File name for ${item.file.name}`}
                          value={item.customFileName}
                          onChange={(e) => {
                            const nextName = e.target.value;
                            setPickedFiles((prev) =>
                              prev.map((entry, itemIdx) =>
                                itemIdx === idx ? { ...entry, customFileName: nextName } : entry,
                              ),
                            );
                          }}
                          placeholder={item.file.name}
                          style={{ padding: '7px 10px', fontSize: 12, background: 'var(--surface)' }}
                        />
                      </div>

                      {isBatchMultiMode ? (
                        <input
                          type="text"
                          className="input"
                          maxLength={140}
                          aria-label={`Title for ${item.file.name}`}
                          value={item.customTitle}
                          onChange={(e) => {
                            const nextTitle = e.target.value;
                            setPickedFiles((prev) =>
                              prev.map((entry, itemIdx) =>
                                itemIdx === idx ? { ...entry, customTitle: nextTitle } : entry,
                              ),
                            );
                          }}
                          placeholder={
                            title.trim()
                              ? buildBatchItemTitle(title, resolvedName)
                              : `Title for ${resolvedName}`
                          }
                          style={{ padding: '7px 10px', fontSize: 12, background: 'var(--surface)' }}
                        />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {pickedFiles.length > 1 ? (
              <div className="card-soft" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="segmented-control" role="tablist" aria-label="Multi-file dispatch mode">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={multiFileMode === 'bundle'}
                    className={`segment-btn ${multiFileMode === 'bundle' ? 'segment-btn-active' : ''}`}
                    onClick={() => setMultiFileMode('bundle')}
                  >
                    {`One Document (${pickedFiles.length} files)`}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={multiFileMode === 'batch'}
                    className={`segment-btn ${multiFileMode === 'batch' ? 'segment-btn-active' : ''}`}
                    onClick={() => setMultiFileMode('batch')}
                  >
                    {`Separate Docs (${pickedFiles.length} codes)`}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {multiFileMode === 'bundle'
                    ? 'Bundles all selected files under 1 tracking code & QR slip.'
                    : 'Creates 1 independent tracking code & QR slip for each file.'}
                </div>
              </div>
            ) : null}
            {pairStatus?.attached ? (
              <div
                className="card-soft"
                style={{
                  borderColor: 'var(--emerald-border)',
                  background: 'var(--emerald-soft)',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--emerald-text)' }}>
                    Synced from Mobile: {pairStatus.fileName ?? 'Scanned attachment'}
                  </div>
                  {pairStatus.sha256Checksum ? (
                    <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      SHA-256: {pairStatus.sha256Checksum.slice(0, 12)}...
                      {pairStatus.compressedBytes ? ` · ${formatBytes(pairStatus.compressedBytes)}` : ''}
                    </div>
                  ) : null}
                </div>
                <CheckCircle2 size={16} color="var(--emerald-text)" />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="hardcopy-row">
            <div className="field-group">
              <label className="field-label" htmlFor="hardcopy-ref">
                Folder / Slip Note
              </label>
              <input
                id="hardcopy-ref"
                className="input"
                value={physicalReference}
                onChange={(e) => setPhysicalReference(e.target.value)}
                placeholder="e.g. Brown folder · Slip #14"
              />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="hardcopy-pages">
                Pages
              </label>
              <input
                id="hardcopy-pages"
                className="input"
                inputMode="numeric"
                value={physicalPageCount}
                onChange={(e) => setPhysicalPageCount(e.target.value)}
                placeholder="e.g. 6"
              />
            </div>
          </div>
        )}

        <div className="field-group">
          <div className="field-label-row">
            <span className="field-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <GitBranch size={13} color="var(--navy)" /> Routing Templates
            </span>
            <button
              type="button"
              className="btn btn-soft"
              data-testid="web-send-new-template-btn"
              style={{ minHeight: 28, padding: '2px 10px', fontSize: 11.5 }}
              onClick={() => {
                setTplName('');
                setTplDescription('');
                setTplSteps(
                  offices.length > 0
                    ? [{ officeId: offices[0].id, defaultRemarks: remarks || '' }]
                    : [],
                );
                setShowTemplateModal(true);
              }}
            >
              <Plus size={12} /> Save Template
            </button>
          </div>
          {routingTemplates.length > 0 ? (
            <div className="chip-row" data-testid="web-routing-templates-strip">
              {routingTemplates.map((tpl) => {
                const isActive = appliedTemplate?.id === tpl.id;
                return (
                  <div key={tpl.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <button
                      type="button"
                      className={`sub-chip ${isActive ? 'sub-chip-active' : ''}`}
                      onClick={() => {
                        setAppliedTemplate(tpl);
                        if (tpl.categoryId) setCategoryId(tpl.categoryId);
                        const firstStep = tpl.steps[0];
                        if (firstStep) {
                          const match = recipients.find((p) => p.office.id === firstStep.officeId);
                          if (match) setRecipientUserId(match.id);
                          if (firstStep.defaultRemarks) setRemarks(firstStep.defaultRemarks);
                        }
                        notify('info', `Applied routing template "${tpl.name}".`);
                      }}
                    >
                      {tpl.name} ({tpl.steps.map((s) => s.officeCode).join(' → ')})
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete template ${tpl.name}`}
                      className="sealed-qr-decline-link"
                      style={{ padding: '2px 4px' }}
                      onClick={() => {
                        if (appliedTemplate?.id === tpl.id) setAppliedTemplate(null);
                        void deleteRoutingTemplate(tpl.id);
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="field-hint">
              Save reusable multi-office routing sequences to auto-fill recipients and remarks.
            </span>
          )}
          {appliedTemplate ? (
            <div className="routing-template-bar" data-testid="web-applied-template-banner">
              <span>
                <strong>Planned Route:</strong>{' '}
                {appliedTemplate.steps.map((s) => s.officeCode).join(' → ')}
              </span>
              <button
                type="button"
                className="sealed-qr-decline-link"
                onClick={() => setAppliedTemplate(null)}
              >
                Clear
              </button>
            </div>
          ) : null}
        </div>

        <div className="field-group">
          <div className="field-label-row">
            <span className="field-label">Send To</span>
            <span className="field-hint">Optional — leave Keep local to file only</span>
          </div>
          {recentRecipients.length > 0 ? (
            <div className="recent-recipients-bar" aria-label="Recent recipients">
              <span className="field-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> Recent:
              </span>
              {recentRecipients.map((person) => (
                <button
                  key={`recent-${person.id}`}
                  type="button"
                  className={`sub-chip ${recipientUserId === person.id ? 'sub-chip-active' : ''}`}
                  onClick={() => setRecipientUserId(person.id)}
                >
                  {person.office.code} · {person.fullName.split(' ')[0]}
                </button>
              ))}
            </div>
          ) : null}
          <div className="recipient-strip">
            <button
              type="button"
              className={`recipient-chip ${!recipientUserId ? 'recipient-chip-active' : ''}`}
              onClick={() => setRecipientUserId('')}
            >
              Keep local
            </button>
            {recipients.map((person) => (
              <button
                key={person.id}
                type="button"
                className={`recipient-chip ${
                  recipientUserId === person.id ? 'recipient-chip-active' : ''
                }`}
                onClick={() => setRecipientUserId(person.id)}
              >
                {person.office.code} · {person.fullName.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        {recipientUserId ? (
          <div className="field-group">
            <label className="field-label" htmlFor="send-note">
              Note / Disposition (Optional)
            </label>
            <div className="chip-row" style={{ marginBottom: 4 }}>
              {DISPOSITION_REMARK_PRESETS.slice(0, 5).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`sub-chip ${remarks === preset ? 'sub-chip-active' : ''}`}
                  onClick={() => setRemarks(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              id="send-note"
              className="input"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Routing instruction for receiving office..."
            />
          </div>
        ) : null}

        <button
          type="button"
          className="options-toggle-row"
          onClick={() => setShowOptions((v) => !v)}
        >
          <span>
            {selectedCategoryName} · <strong>{TIER_LABEL[tier]}</strong>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700, color: 'var(--navy)' }}>
            {showOptions ? 'Hide' : 'Change'}
            {showOptions ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </span>
        </button>

        {showOptions ? (
          <div className="options-panel">
            <div className="field-group">
              <div className="field-label-row">
                <span className="field-label">Category</span>
                <button
                  type="button"
                  className="sub-chip"
                  data-testid="web-send-add-custom-category-btn"
                  onClick={() => setShowCustomCategory((v) => !v)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Plus size={12} /> {showCustomCategory ? 'Close Custom' : 'Add Custom Category'}
                </button>
              </div>
              <div className="chip-row">
                {categories.length === 0 ? (
                  <span className="field-hint">
                    No categories loaded yet — add a custom category below.
                  </span>
                ) : (
                  categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`recipient-chip ${
                        effectiveCategoryId === cat.id && !showCustomCategory ? 'recipient-chip-active' : ''
                      }`}
                      onClick={() => {
                        setCategoryId(cat.id);
                        setShowCustomCategory(false);
                        saveLastCategoryId(actor?.id, cat.id);
                      }}
                    >
                      {cat.name}
                    </button>
                  ))
                )}
                <button
                  type="button"
                  className={`recipient-chip ${showCustomCategory ? 'recipient-chip-active' : ''}`}
                  onClick={() => setShowCustomCategory((v) => !v)}
                >
                  + Custom
                </button>
              </div>

              {showCustomCategory ? (
                <div
                  className="card-soft"
                  data-testid="web-send-custom-category-form"
                  style={{
                    marginTop: 8,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    background: 'var(--surface)',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)' }}>
                    Add New Global Document Category
                  </div>
                  <div className="hardcopy-row">
                    <div className="field-group">
                      <label className="field-label" htmlFor="send-custom-cat-name">
                        Category Name
                      </label>
                      <input
                        id="send-custom-cat-name"
                        className="input"
                        maxLength={120}
                        value={customCategoryName}
                        onChange={(e) => setCustomCategoryName(e.target.value)}
                        placeholder="e.g. School Repair Request"
                      />
                    </div>
                    <div className="field-group">
                      <label className="field-label" htmlFor="send-custom-cat-code">
                        Short Code (Optional)
                      </label>
                      <input
                        id="send-custom-cat-code"
                        className="input mono"
                        maxLength={16}
                        value={customCategoryCode}
                        onChange={(e) => setCustomCategoryCode(e.target.value.toUpperCase())}
                        placeholder="e.g. REP-REQ"
                      />
                    </div>
                  </div>
                  {matchingCustomCategories.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span className="field-hint" style={{ color: 'var(--amber-text)', fontWeight: 600 }}>
                        Similar existing categories — tap to use instead:
                      </span>
                      <div className="chip-row">
                        {matchingCustomCategories.slice(0, 4).map((cat) => (
                          <button
                            key={`match-${cat.id}`}
                            type="button"
                            className="sub-chip"
                            onClick={() => {
                              setCategoryId(cat.id);
                              saveLastCategoryId(actor?.id, cat.id);
                              setCustomCategoryName('');
                              setCustomCategoryCode('');
                              setShowCustomCategory(false);
                            }}
                          >
                            {cat.code} · {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ minHeight: 34, fontSize: 12 }}
                      onClick={() => {
                        setShowCustomCategory(false);
                        setCustomCategoryName('');
                        setCustomCategoryCode('');
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-amber"
                      style={{ minHeight: 34, fontSize: 12 }}
                      disabled={savingCustomCategory || isBusy || customCategoryName.trim().length < 2}
                      onClick={() => void handleSaveCustomCategory()}
                    >
                      <Plus size={13} /> {savingCustomCategory ? 'Saving...' : 'Save & Select Category'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="field-group">
              <span className="field-label">Confidentiality</span>
              <div className="chip-row">
                {(
                  [
                    { id: 'standard_internal', label: 'Standard' },
                    { id: 'restricted', label: 'Restricted' },
                    { id: 'confidential', label: 'Confidential' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`recipient-chip ${
                      tier === item.id ? 'recipient-chip-active' : ''
                    }`}
                    onClick={() => setTier(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {recipientUserId ? (
          <div
            className="card-soft"
            style={{
              background: 'var(--sky-soft)',
              borderColor: 'var(--sky-border)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              padding: '10px 12px',
              fontSize: 12,
              color: 'var(--navy)',
              lineHeight: 1.45,
            }}
          >
            <Lock size={14} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              <strong>QR-First Custody Unlock:</strong> Sending dispatches the Routing QR &amp;
              notice only. The recipient must scan the QR slip or enter the code manually before
              they can view or download attached files.
            </span>
          </div>
        ) : null}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!canSubmit}
          style={{ minHeight: 48, fontSize: 14, width: '100%' }}
        >
          <Send size={16} />
          <span>{submitLabel}</span>
        </button>
      </form>
      </div>

      <aside className="send-aside">
        {issuedDocs.length === 1 ? (
          <div
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              borderColor: 'var(--emerald-border)',
              background: 'var(--emerald-soft)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ fontSize: 12, fontWeight: 800, color: 'var(--emerald-text)' }}>
                {issuedDocs[0].trackingCode}
              </span>
              <span className="pill pill-emerald">Issued</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>
              {issuedDocs[0].title}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-amber" style={{ flex: 1 }} onClick={() => setQrModalDoc(issuedDocs[0])}>
                <QrCode size={14} /> QR Slip
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => openDocument(issuedDocs[0].id)}
              >
                Open Record
              </button>
            </div>
          </div>
        ) : issuedDocs.length > 1 ? (
          <div
            className="card"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              borderColor: 'var(--emerald-border)',
              background: 'var(--emerald-soft)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--emerald-text)' }}>
                {`Batch Issued (${issuedDocs.length} documents)`}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
                  onClick={() => setBatchPrintOpen(true)}
                >
                  <Printer size={13} /> Print All Slips
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
                  onClick={() => setTransmittalOpen(true)}
                >
                  <FileText size={13} /> Transmittal Sheet
                </button>
              </div>
            </div>
            {issuedDocs.map((docItem) => (
              <div
                key={docItem.id}
                className="card-soft"
                style={{
                  background: 'var(--surface)',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div className="mono" style={{ fontSize: 12, fontWeight: 800, color: 'var(--navy)' }}>
                  {docItem.trackingCode}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {docItem.title}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-amber"
                    style={{ minHeight: 32, padding: '4px 10px', fontSize: 12, flex: 1 }}
                    onClick={() => setQrModalDoc(docItem)}
                  >
                    <QrCode size={13} /> QR Slip
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ minHeight: 32, padding: '4px 10px', fontSize: 12 }}
                    onClick={() => openDocument(docItem.id)}
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h4 className="section-title" style={{ fontSize: 14 }}>
            Dispatch Summary
          </h4>
          <div>
            <div className="summary-spec-row">
              <span style={{ color: 'var(--text-muted)' }}>Origin Unit</span>
              <strong style={{ color: 'var(--text-primary)' }}>{actor ? actor.office.code : 'Pre-Auth'}</strong>
            </div>
            <div className="summary-spec-row">
              <span style={{ color: 'var(--text-muted)' }}>Copy Medium</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {copyMode === 'soft_copy' ? 'Soft Copy (Digital)' : 'Hard Copy (Physical)'}
              </strong>
            </div>
            <div className="summary-spec-row">
              <span style={{ color: 'var(--text-muted)' }}>Category</span>
              <strong style={{ color: 'var(--text-primary)' }}>{selectedCategoryName}</strong>
            </div>
            <div className="summary-spec-row">
              <span style={{ color: 'var(--text-muted)' }}>Security Tier</span>
              <strong style={{ color: 'var(--text-primary)' }}>{TIER_LABEL[tier]}</strong>
            </div>
            <div className="summary-spec-row">
              <span style={{ color: 'var(--text-muted)' }}>Destination</span>
              <strong style={{ color: 'var(--text-primary)' }}>
                {selectedRecipient
                  ? `${selectedRecipient.office.code} · ${selectedRecipient.fullName}`
                  : 'Keep local in office'}
              </strong>
            </div>
            {copyMode === 'soft_copy' ? (
              <div className="summary-spec-row">
                <span style={{ color: 'var(--text-muted)' }}>Files Staged</span>
                <strong className="tabular" style={{ color: 'var(--text-primary)' }}>
                  {pickedFiles.length === 0 ? 'None yet' : `${pickedFiles.length} (${multiFileMode})`}
                </strong>
              </div>
            ) : null}
          </div>
          <p className="field-hint" style={{ margin: '2px 0 0' }}>
            Every dispatch issues a verifiable opaque QR token and SHA-256 checksum audit entry.
          </p>
        </div>
      </aside>

      {qrModalDoc ? (
        <OpaqueQrModal
          open={Boolean(qrModalDoc)}
          trackingCode={qrModalDoc.trackingCode}
          qrToken={qrModalDoc.qrToken}
          title={qrModalDoc.title}
          document={qrModalDoc}
          subtitle={
            qrModalDoc.copyFormat === 'hard_copy'
              ? 'Print or attach this routing slip to your physical folder to track every desk handoff.'
              : 'Print or scan this routing slip across offices.'
          }
          onClose={() => setQrModalDoc(null)}
        />
      ) : null}

      <BatchQrSlipsModal
        open={batchPrintOpen && issuedDocs.length > 1}
        documents={issuedDocs}
        onClose={() => setBatchPrintOpen(false)}
      />

      <BatchTransmittalModal
        open={transmittalOpen && issuedDocs.length > 0}
        documents={issuedDocs}
        originLabel={actor ? `${actor.office.code} — ${actor.office.name}` : undefined}
        preparedBy={actor?.fullName}
        onClose={() => setTransmittalOpen(false)}
      />

      <ModalDialog
        open={Boolean(pairSession)}
        onClose={() => setPairSession(null)}
        title="Pair Mobile Camera"
        subtitle="Scan with the Tracely mobile app to attach paper photos directly"
      >
        {pairSession ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <QrCodeGraphic value={`TRC-QR:PAIR:${pairSession.pairToken}`} size={180} />
            <div className="mono" style={{ fontSize: 12, color: 'var(--navy)', fontWeight: 700 }}>
              TRC-QR:PAIR:{pairSession.pairToken}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Draft target: {pairSession.draftLabel}
            </div>

            {pairStatus?.attached ? (
              <div
                className="card-soft"
                style={{
                  width: '100%',
                  background: 'var(--emerald-soft)',
                  borderColor: 'var(--emerald-border)',
                  padding: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 800, color: 'var(--emerald-text)' }}>
                  <CheckCircle2 size={15} /> Photo Attached from Mobile
                </div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {pairStatus.fileName ?? 'Sanitized mobile capture'}
                  {pairStatus.compressedBytes ? ` (${formatBytes(pairStatus.compressedBytes)})` : ''}
                </div>
                {pairStatus.sha256Checksum ? (
                  <div className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    SHA-256: {pairStatus.sha256Checksum}
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                <span className="pill pill-slate">
                  {pairRemainingSec > 0
                    ? `Waiting for phone · ${Math.floor(pairRemainingSec / 60)}:${String(pairRemainingSec % 60).padStart(2, '0')}`
                    : 'Pairing session expired'}
                </span>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ minHeight: 34, padding: '4px 12px', fontSize: 12 }}
                  disabled={checkingPair}
                  onClick={() => void pollPairStatus(pairSession.pairToken)}
                >
                  <RefreshCw size={13} /> {checkingPair ? 'Checking...' : 'Check Sync'}
                </button>
              </div>
            )}
          </div>
        ) : null}
      </ModalDialog>

      <ModalDialog
        open={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        title="Save Routing Template"
        subtitle="Create a reusable multi-office routing sequence for recurring document types"
      >
        <form
          data-testid="web-routing-template-form"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!tplName.trim() || tplSteps.length === 0) return;
            const created = await createRoutingTemplate({
              name: tplName.trim(),
              description: tplDescription.trim() || undefined,
              categoryId: categoryId || null,
              isGlobal: tplGlobal,
              steps: tplSteps,
            });
            setAppliedTemplate(created);
            setShowTemplateModal(false);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div className="field-group">
            <label className="field-label" htmlFor="tpl-name-input">
              Template Name
            </label>
            <input
              id="tpl-name-input"
              className="input"
              value={tplName}
              onChange={(e) => setTplName(e.target.value)}
              placeholder="e.g. Budget Clearance Route"
              autoFocus
            />
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="tpl-desc-input">
              Description (Optional)
            </label>
            <input
              id="tpl-desc-input"
              className="input"
              value={tplDescription}
              onChange={(e) => setTplDescription(e.target.value)}
              placeholder="e.g. Budget -> Accounting -> Executive"
            />
          </div>
          <div className="field-group">
            <div className="field-label-row">
              <span className="field-label">Routing Steps ({tplSteps.length})</span>
              {offices.length > 0 ? (
                <button
                  type="button"
                  className="btn btn-soft"
                  style={{ minHeight: 28, padding: '2px 10px', fontSize: 11.5 }}
                  onClick={() =>
                    setTplSteps((prev) => [
                      ...prev,
                      { officeId: offices[Math.min(prev.length, offices.length - 1)].id, defaultRemarks: '' },
                    ])
                  }
                >
                  <Plus size={12} /> Add Step
                </button>
              ) : null}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tplSteps.map((step, idx) => (
                <div key={`tpl-step-${idx}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="mono" style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--text-muted)' }}>
                    #{idx + 1}
                  </span>
                  <select
                    aria-label={`Step ${idx + 1} Office`}
                    className="select"
                    value={step.officeId}
                    onChange={(e) =>
                      setTplSteps((prev) =>
                        prev.map((s, sIdx) => (sIdx === idx ? { ...s, officeId: e.target.value } : s)),
                      )
                    }
                    style={{ flex: 1 }}
                  >
                    {offices.map((off) => (
                      <option key={off.id} value={off.id}>
                        {off.code} — {off.name}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`Step ${idx + 1} Remarks`}
                    className="input"
                    value={step.defaultRemarks}
                    onChange={(e) =>
                      setTplSteps((prev) =>
                        prev.map((s, sIdx) =>
                          sIdx === idx ? { ...s, defaultRemarks: e.target.value } : s,
                        ),
                      )
                    }
                    placeholder="Default note"
                    style={{ flex: 1 }}
                  />
                  {tplSteps.length > 1 ? (
                    <button
                      type="button"
                      className="icon-circle-btn"
                      aria-label={`Remove step ${idx + 1}`}
                      onClick={() => setTplSteps((prev) => prev.filter((_, sIdx) => sIdx !== idx))}
                    >
                      <Trash2 size={13} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-secondary)' }}>
            <input
              type="checkbox"
              checked={tplGlobal}
              onChange={(e) => setTplGlobal(e.target.checked)}
            />
            Share template across all offices
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={() => setShowTemplateModal(false)}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-amber"
              data-testid="web-routing-template-save-btn"
              disabled={!tplName.trim() || tplSteps.length === 0 || isBusy}
            >
              Save Template
            </button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};
