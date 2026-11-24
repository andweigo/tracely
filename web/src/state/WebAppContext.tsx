import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActiveDeviceSession,
  AdminCreateUserPayload,
  AdminUpdateUserPayload,
  AuditLogEntry,
  AvailabilityStatus,
  CommentVisibility,
  ConfidentialityTier,
  DEFAULT_USER_PREFERENCES,
  DesktopPairingSession,
  DesktopPairStatus,
  DocumentCategory,
  DocumentComment,
  DocumentRecord,
  DocumentTrackingSnapshot,
  DocumentUnlockChallenge,
  DocumentUpdatePayload,
  OfficeSummary,
  PaginatedDocumentsResult,
  PendingApprovalStatus,
  PendingRegistrationRecord,
  PendingRegistrationSummary,
  Personnel,
  PresignedDownloadGrant,
  PrivacySafeNotification,
  ProfileUpdatePayload,
  QrResolutionResult,
  RecentScanEntry,
  RoutingTemplate,
  ToastAction,
  ToastMessage,
  TurnaroundAnalyticsReport,
  UserPreferences,
  UserSecurityPreferences,
  WebRoute,
} from '../domain/types';
import {
  AUTH_REQUIRED,
  DEFAULT_API_BASE_URL,
  PRODUCTION_API_BASE_URL,
  STORAGE_KEY_API_URL,
  validateApiBaseUrl,
  WebBackendGateway,
} from '../domain/qrPolicy';
import { AuthInputPolicy, RegistrationValidationInput } from '../domain/authPolicy';
import {
  LaravelSanctumGateway,
  normalizeWebErrorMessage,
} from '../services/webApiClient';
import { buildBatchItemTitle } from '../utils/formatters';
import { formatWebHash, parseWebHash } from '../utils/hashRouter';
import { isPendingReceiptForActor, isPendingSentByActor, selectSentDocuments } from '../utils/sentFilter';

export interface WebContextValue {
  route: WebRoute;
  bootstrapping: boolean;
  firstVisitSkeletonMs: number;
  apiBaseUrl: string;
  actor: Personnel | null;
  isBusy: boolean;
  isRefreshing: boolean;
  offices: ReadonlyArray<OfficeSummary>;
  personnelDirectory: ReadonlyArray<Personnel>;
  documents: ReadonlyArray<DocumentRecord>;
  trackedSnapshots: ReadonlyArray<DocumentTrackingSnapshot>;
  categories: ReadonlyArray<DocumentCategory>;
  notifications: ReadonlyArray<PrivacySafeNotification>;
  unreadNotificationCount: number;
  auditLogs: ReadonlyArray<AuditLogEntry>;
  activeSessions: ReadonlyArray<ActiveDeviceSession>;
  securityPrefs: UserSecurityPreferences;
  userPreferences: UserPreferences;
  recentScans: ReadonlyArray<RecentScanEntry>;
  selectedDocumentId: string | null;
  verifyToken: string | null;
  softCopyUnlockDocId: string | null;
  hardCopyReceiveDocId: string | null;
  batchUsbReceiveOpen: boolean;
  routingTemplates: ReadonlyArray<RoutingTemplate>;
  pendingReceiptCount: number;
  pendingSentCount: number;
  canApproveAccounts: boolean;
  pendingApprovals: ReadonlyArray<Personnel>;
  adminUsers: ReadonlyArray<Personnel>;
  realtimeStatus: 'live' | 'polling';
  realtimeTick: number;
  fcmConfigured: boolean;
  toast: ToastMessage | null;
  requireAuth: boolean;
  pendingRegistration: PendingRegistrationRecord | null;
  prefillLoginIdentifier: string;
  checkPendingRegistrationStatus(silent?: boolean): Promise<PendingApprovalStatus | null>;
  proceedFromPendingToLogin(clearRecord?: boolean): void;
  dismissPendingRegistration(): void;
  navigate(next: WebRoute): void;
  openDocument(documentId: string): void;
  closeDocument(): void;
  openSoftCopyUnlock(doc: DocumentRecord): void;
  closeSoftCopyUnlock(): void;
  openHardCopyReceive(doc: DocumentRecord): void;
  closeHardCopyReceive(): void;
  openBatchUsbReceive(): void;
  closeBatchUsbReceive(): void;
  openSealedDocumentAction(doc: DocumentRecord): void;
  subscribeInstantSync(): () => void;
  requestPasswordReset(identifier: string): Promise<{ message: string; devResetCode?: string }>;
  confirmPasswordReset(identifier: string, resetCode: string, newPassword: string): Promise<string>;
  loadRoutingTemplates(): Promise<ReadonlyArray<RoutingTemplate>>;
  createRoutingTemplate(payload: {
    name: string;
    description?: string;
    categoryId?: string | null;
    isGlobal?: boolean;
    steps: ReadonlyArray<{ officeId: string; defaultRemarks?: string }>;
  }): Promise<RoutingTemplate>;
  deleteRoutingTemplate(templateId: string): Promise<void>;
  getTurnaroundAnalytics(): Promise<TurnaroundAnalyticsReport>;
  listDocumentsPage(params: {
    q?: string;
    status?: string;
    copyFormat?: string;
    categoryId?: string;
    page?: number;
    perPage?: number;
  }): Promise<PaginatedDocumentsResult>;
  verifyPublicTransmittal(token: string): Promise<{
    readonly trackingCode: string;
    readonly lifecycleStatus: string;
    readonly currentOfficeName: string;
    readonly latestChecksumShort: string;
    readonly milestoneCount: number;
  }>;
  hasScreenBeenOpened(screen: WebRoute): boolean;
  markScreenOpened(screen: WebRoute): void;
  notify(tone: ToastMessage['tone'], text: string, action?: ToastAction): void;
  clearToast(): void;
  updateApiBaseUrl(rawUrl: string): void;
  signIn(identifier: string, password: string): Promise<void>;
  registerAccount(input: RegistrationValidationInput): Promise<{ pendingApproval: boolean; message: string }>;
  signOut(): Promise<void>;
  refreshWorkspace(): Promise<void>;
  refreshWorkspaceSilent(): Promise<void>;
  trackByCode(code: string): Promise<DocumentTrackingSnapshot | null>;
  sendDigitalDocument(payload: {
    title: string;
    categoryId: string;
    confidentialityTier: ConfidentialityTier;
    file: File;
    fileName?: string;
    sha256Checksum: string;
    recipientUserId?: string | null;
    remarks?: string;
  }): Promise<DocumentRecord>;
  sendDigitalDocumentBundle(payload: {
    title: string;
    categoryId: string;
    confidentialityTier: ConfidentialityTier;
    files: ReadonlyArray<{ file: File; fileName?: string; sha256Checksum: string }>;
    recipientUserId?: string | null;
    remarks?: string;
  }): Promise<DocumentRecord>;
  sendDigitalDocumentBatch(payload: {
    title: string;
    categoryId: string;
    confidentialityTier: ConfidentialityTier;
    files: ReadonlyArray<{ file: File; fileName?: string; sha256Checksum: string; title?: string }>;
    recipientUserId?: string | null;
    remarks?: string;
  }): Promise<ReadonlyArray<DocumentRecord>>;
  registerHardCopyDocument(payload: {
    title: string;
    categoryId: string;
    confidentialityTier: ConfidentialityTier;
    physicalReference?: string | null;
    physicalPageCount?: number | null;
    recipientUserId?: string | null;
    remarks?: string;
  }): Promise<DocumentRecord>;
  acknowledgeReceipt(
    documentId: string,
    remarks?: string,
    proofPhoto?: { file: File; sha256Checksum: string } | null,
    verificationCode?: string,
    password?: string,
  ): Promise<DocumentRecord>;
  createUnlockChallenge(documentId: string): Promise<DocumentUnlockChallenge>;
  unlockWithPassword(documentId: string, password: string): Promise<DocumentRecord>;
  batchAcknowledgeReceipts(
    items: ReadonlyArray<string | { readonly documentId: string; readonly verificationCode?: string }>,
    remarks?: string,
  ): Promise<number>;
  forwardDocument(documentId: string, recipientUserId: string, remarks: string): Promise<DocumentRecord>;
  batchForwardDocuments(
    documentIds: ReadonlyArray<string>,
    recipientUserId: string,
    remarks: string,
  ): Promise<number>;
  returnForRevision(documentId: string, remarks: string): Promise<DocumentRecord>;
  declineMisrouted(documentId: string, reason: string): Promise<DocumentRecord>;
  recallTransfer(documentId: string): Promise<DocumentRecord>;
  updateDocumentDetails(documentId: string, patch: DocumentUpdatePayload): Promise<DocumentRecord>;
  completeDocument(
    documentId: string,
    status: 'approved' | 'archived',
    remarks?: string,
  ): Promise<DocumentRecord>;
  listDocumentComments(documentId: string): Promise<ReadonlyArray<DocumentComment>>;
  addDocumentComment(
    documentId: string,
    body: string,
    visibility: CommentVisibility,
  ): Promise<DocumentComment>;
  uploadRevision(payload: {
    documentId: string;
    file: File;
    fileName?: string;
    sha256Checksum: string;
    revisionNote: string;
  }): Promise<DocumentRecord>;
  issuePresignedView(documentId: string, versionNumber: number): Promise<PresignedDownloadGrant>;
  issueProofPhotoView(documentId: string, transactionId: string): Promise<PresignedDownloadGrant>;
  resolveQr(rawValue: string): Promise<QrResolutionResult>;
  createDesktopPairSession(draftLabel: string): Promise<DesktopPairingSession>;
  checkDesktopPairStatus(pairToken: string): Promise<DesktopPairStatus>;
  declareCategory(name: string, code: string): Promise<DocumentCategory>;
  markNotificationRead(notificationId: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
  loadAuditLogs(documentId?: string): Promise<void>;
  updateAvailability(
    status: AvailabilityStatus,
    delegateId?: string | null,
    until?: string | null,
  ): Promise<void>;
  updateProfile(patch: ProfileUpdatePayload): Promise<Personnel>;
  updateUserPreferences(patch: Partial<UserPreferences>): Promise<UserPreferences>;
  loadActiveSessions(): Promise<void>;
  revokeOtherSessions(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  loadPendingUsers(): Promise<void>;
  approvePendingUser(userId: string): Promise<void>;
  rejectPendingUser(userId: string, reason?: string): Promise<void>;
  loadAdminUsers(): Promise<void>;
  createAdminUser(payload: AdminCreateUserPayload): Promise<Personnel>;
  updateAdminUser(userId: string, patch: AdminUpdateUserPayload): Promise<void>;
  createAdminOffice(payload: { code: string; name: string }): Promise<void>;
  updateAdminOffice(officeId: string, patch: { code?: string; name?: string }): Promise<void>;
  updateAdminCategory(categoryId: string, patch: { name?: string; code?: string }): Promise<void>;
  deleteAdminCategory(categoryId: string): Promise<void>;
  updateSecurityPrefs(patch: Partial<UserSecurityPreferences>): void;
  clearRecentScans(): void;
}

const WebAppContext = createContext<WebContextValue | null>(null);
const STORAGE_KEY_RECENT_SCANS = '@sdo_doctrack/web_recent_scans';
const STORAGE_KEY_BEARER_TOKEN = '@sdo_doctrack/web_bearer_token';
const STORAGE_KEY_ACTOR = '@sdo_doctrack/web_actor';
const STORAGE_KEY_USER_PREFS = '@sdo_doctrack/web_user_prefs';
const STORAGE_KEY_ANNOUNCED_NOTIFS_PREFIX = '@sdo_doctrack/web_announced_notifs_';
const STORAGE_KEY_PENDING_REGISTRATION = '@sdo_doctrack/web_pending_registration';

function loadStoredPendingRegistration(): PendingRegistrationRecord | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PENDING_REGISTRATION);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingRegistrationRecord> | null;
    if (!parsed || typeof parsed !== 'object') return null;
    if (
      parsed.status !== 'pending' &&
      parsed.status !== 'approved' &&
      parsed.status !== 'rejected'
    ) {
      return null;
    }
    return {
      status: parsed.status,
      statusToken: typeof parsed.statusToken === 'string' ? parsed.statusToken : null,
      message:
        typeof parsed.message === 'string'
          ? parsed.message
          : 'Registration submitted for administrator verification.',
      fullName: typeof parsed.fullName === 'string' ? parsed.fullName : '',
      employeeId: typeof parsed.employeeId === 'string' ? parsed.employeeId : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      position: typeof parsed.position === 'string' ? parsed.position : '',
      officeCode: typeof parsed.officeCode === 'string' ? parsed.officeCode : '',
      officeName: typeof parsed.officeName === 'string' ? parsed.officeName : '',
      submittedAt:
        typeof parsed.submittedAt === 'string' ? parsed.submittedAt : new Date().toISOString(),
      checkedAt: typeof parsed.checkedAt === 'string' ? parsed.checkedAt : null,
    };
  } catch {
    return null;
  }
}

function saveStoredPendingRegistration(record: PendingRegistrationRecord | null): void {
  try {
    if (!record) {
      window.localStorage.removeItem(STORAGE_KEY_PENDING_REGISTRATION);
    } else {
      window.localStorage.setItem(STORAGE_KEY_PENDING_REGISTRATION, JSON.stringify(record));
    }
  } catch {
    // Ignore storage restriction
  }
}

function loadStoredUserPrefs(): UserPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_USER_PREFS);
    if (!raw) return DEFAULT_USER_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return { ...DEFAULT_USER_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_USER_PREFERENCES;
  }
}

function saveStoredUserPrefs(prefs: UserPreferences): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_USER_PREFS, JSON.stringify(prefs));
  } catch {
    // Ignore storage restriction
  }
}
const WEB_WORKSPACE_POLL_MS = 15_000;
const WEB_REALTIME_PULSE_MS = 3_000;
const MAX_ANNOUNCED_NOTIFS_STORED = 200;

function isAccountApprover(user: Personnel | null): boolean {
  if (!user) return false;
  const role = user.role?.toLowerCase() ?? '';
  if (role === 'ict_admin' || role === 'records_officer') return true;
  if (user.roleLabel === 'ICT Admin' || user.roleLabel === 'Records Officer') return true;
  const officeCode = user.office.code.toUpperCase();
  return (
    (role === 'unit_head' || user.roleLabel === 'Unit Head') &&
    (officeCode === 'HR' || officeCode === 'EXEC' || officeCode === 'ADMIN' || officeCode === 'OSDS' || officeCode === 'ICT')
  );
}

function loadAnnouncedNotifIds(actorId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_KEY_ANNOUNCED_NOTIFS_PREFIX}${actorId}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === 'string'));
  } catch {
    return new Set();
  }
}

function saveAnnouncedNotifIds(actorId: string, ids: Set<string>, activeUnreadIds: ReadonlyArray<string>): void {
  try {
    const ordered = Array.from(ids);
    const trimmed =
      ordered.length > MAX_ANNOUNCED_NOTIFS_STORED
        ? Array.from(new Set([...activeUnreadIds, ...ordered.slice(-MAX_ANNOUNCED_NOTIFS_STORED)])).slice(
            0,
            MAX_ANNOUNCED_NOTIFS_STORED,
          )
        : ordered;
    window.localStorage.setItem(
      `${STORAGE_KEY_ANNOUNCED_NOTIFS_PREFIX}${actorId}`,
      JSON.stringify(trimmed),
    );
  } catch {
    // Ignore storage restriction
  }
}
const DEFAULT_WEB_FIRST_VISIT_SKELETON_MS =
  (import.meta as unknown as { env?: { MODE?: string } }).env?.MODE === 'test' ? 0 : 260;

function loadStoredBearerToken(): string | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_BEARER_TOKEN);
    return raw && raw.trim() ? raw.trim() : null;
  } catch {
    return null;
  }
}

function loadStoredActor(): Personnel | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_ACTOR);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Personnel | null;
    return parsed && typeof parsed.id === 'string' && parsed.office?.id ? parsed : null;
  } catch {
    return null;
  }
}

function saveStoredWebSession(token: string, user: Personnel): void {
  try {
    window.localStorage.setItem(STORAGE_KEY_BEARER_TOKEN, token);
    window.localStorage.setItem(STORAGE_KEY_ACTOR, JSON.stringify(user));
  } catch {
    // Ignore storage quota or disabled storage
  }
}

function clearStoredWebSession(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY_BEARER_TOKEN);
    window.localStorage.removeItem(STORAGE_KEY_ACTOR);
  } catch {
    // Ignore storage error
  }
}

const STORAGE_KEY_AVATAR_COLOR_PREFIX = 'tracely_avatar_color_v1:';

function loadStoredAvatarColor(userId: string): string | null {
  try {
    const val = window.localStorage.getItem(`${STORAGE_KEY_AVATAR_COLOR_PREFIX}${userId}`);
    return val && /^#[0-9A-Fa-f]{6}$/.test(val) ? val : null;
  } catch {
    return null;
  }
}

function saveStoredAvatarColor(userId: string, hex: string): void {
  try {
    window.localStorage.setItem(`${STORAGE_KEY_AVATAR_COLOR_PREFIX}${userId}`, hex);
  } catch {
    // Ignore storage error
  }
}

function loadStoredApiUrl(): string {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY_API_URL);
    if (!saved) return DEFAULT_API_BASE_URL;
    const validated = validateApiBaseUrl(saved);
    if (DEFAULT_API_BASE_URL !== PRODUCTION_API_BASE_URL && validated === PRODUCTION_API_BASE_URL) {
      window.localStorage.removeItem(STORAGE_KEY_API_URL);
      return DEFAULT_API_BASE_URL;
    }
    return validated;
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}

function loadStoredRecentScans(): ReadonlyArray<RecentScanEntry> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_RECENT_SCANS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentScanEntry =>
          Boolean(
            item &&
              typeof item === 'object' &&
              typeof (item as RecentScanEntry).id === 'string' &&
              typeof (item as RecentScanEntry).trackingCode === 'string',
          ),
      )
      .slice(0, 15);
  } catch {
    return [];
  }
}

export interface WebAppProviderProps {
  children: React.ReactNode;
  gateway?: WebBackendGateway;
  initialActor?: Personnel | null;
  requireAuth?: boolean;
  firstVisitSkeletonMs?: number;
}

export const WebAppProvider: React.FC<WebAppProviderProps> = ({
  children,
  gateway,
  initialActor = null,
  requireAuth = AUTH_REQUIRED,
  firstVisitSkeletonMs = DEFAULT_WEB_FIRST_VISIT_SKELETON_MS,
}) => {
  const initialHash = useMemo(
    () =>
      typeof window !== 'undefined'
        ? parseWebHash(window.location.hash)
        : { route: 'dashboard' as WebRoute, documentId: null, verifyToken: null },
    [],
  );

  const restoredSession = useMemo(() => {
    if (gateway || initialActor) {
      return { token: null as string | null, user: initialActor };
    }
    const token = loadStoredBearerToken();
    const user = token ? loadStoredActor() : null;
    if (!token || !user) {
      return { token: null as string | null, user: null as Personnel | null };
    }
    const savedColor = loadStoredAvatarColor(user.id);
    const mergedUser =
      savedColor && (!user.avatarColor || user.avatarColor === '#0D3472')
        ? { ...user, avatarColor: savedColor }
        : user;
    return { token, user: mergedUser };
  }, [gateway, initialActor]);

  const shouldBootstrap = Boolean(!gateway && !initialActor && restoredSession.token);
  const [bootstrapping, setBootstrapping] = useState<boolean>(shouldBootstrap);
  const [route, setRoute] = useState<WebRoute>(initialHash.route);
  const [pendingRegistration, setPendingRegistration] = useState<PendingRegistrationRecord | null>(
    () => (gateway || initialActor || restoredSession.user ? null : loadStoredPendingRegistration()),
  );
  const [prefillLoginIdentifier, setPrefillLoginIdentifier] = useState<string>('');
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(loadStoredApiUrl);
  const [actor, setActor] = useState<Personnel | null>(restoredSession.user);
  const apiBaseUrlRef = useRef<string>(apiBaseUrl);
  const bearerTokenRef = useRef<string | null>(restoredSession.token);
  const actorIdRef = useRef<string | null>(restoredSession.user?.id ?? null);
  actorIdRef.current = actor?.id ?? null;
  const initialBootDoneRef = useRef<boolean>(!shouldBootstrap);
  const announcedNotifIdsRef = useRef<Set<string>>(new Set());
  const loadedAnnouncedActorIdRef = useRef<string | null>(null);
  const openedScreensRef = useRef<Set<WebRoute>>(new Set());
  const hasScreenBeenOpened = useCallback(
    (screen: WebRoute) => openedScreensRef.current.has(screen),
    [],
  );
  const markScreenOpened = useCallback((screen: WebRoute) => {
    openedScreensRef.current.add(screen);
  }, []);
  apiBaseUrlRef.current = apiBaseUrl;

  const [isBusy, setIsBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [offices, setOffices] = useState<ReadonlyArray<OfficeSummary>>([]);
  const [personnelDirectory, setPersonnelDirectory] = useState<ReadonlyArray<Personnel>>([]);
  const [documents, setDocuments] = useState<ReadonlyArray<DocumentRecord>>([]);
  const [trackedSnapshots, setTrackedSnapshots] = useState<ReadonlyArray<DocumentTrackingSnapshot>>([]);
  const [categories, setCategories] = useState<ReadonlyArray<DocumentCategory>>([]);
  const [notifications, setNotifications] = useState<ReadonlyArray<PrivacySafeNotification>>([]);
  const [auditLogs, setAuditLogs] = useState<ReadonlyArray<AuditLogEntry>>([]);
  const [activeSessions, setActiveSessions] = useState<ReadonlyArray<ActiveDeviceSession>>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ReadonlyArray<Personnel>>([]);
  const [adminUsers, setAdminUsers] = useState<ReadonlyArray<Personnel>>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<'live' | 'polling'>('polling');
  const [realtimeTick, setRealtimeTick] = useState(0);
  const [fcmConfigured, setFcmConfigured] = useState(false);
  const realtimeCursorRef = useRef<number>(0);
  const [recentScans, setRecentScans] = useState<ReadonlyArray<RecentScanEntry>>(loadStoredRecentScans);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(initialHash.documentId);
  const [verifyToken, setVerifyToken] = useState<string | null>(initialHash.verifyToken);
  const [softCopyUnlockDocId, setSoftCopyUnlockDocId] = useState<string | null>(null);
  const [hardCopyReceiveDocId, setHardCopyReceiveDocId] = useState<string | null>(null);
  const [batchUsbReceiveOpen, setBatchUsbReceiveOpen] = useState(false);
  const [routingTemplates, setRoutingTemplates] = useState<ReadonlyArray<RoutingTemplate>>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [securityPrefs, setSecurityPrefs] = useState<UserSecurityPreferences>({
    biometricLock: true,
    screenshotShield: true,
  });
  const [userPreferences, setUserPreferences] = useState<UserPreferences>(() => {
    const stored = loadStoredUserPrefs();
    return restoredSession.user?.preferences
      ? { ...stored, ...restoredSession.user.preferences }
      : stored;
  });

  const activeGateway = useMemo(
    () =>
      gateway ??
      new LaravelSanctumGateway(
        () => apiBaseUrlRef.current,
        () => bearerTokenRef.current,
      ),
    [gateway],
  );

  const notify = useCallback(
    (tone: ToastMessage['tone'], text: string, action?: ToastAction) => {
      setToast({ id: Date.now(), tone, text, action });
    },
    [],
  );

  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!toast) return;
    const durationMs = toast.action ? 30000 : 4500;
    const id = window.setTimeout(() => {
      setToast((curr) => (curr?.id === toast.id ? null : curr));
    }, durationMs);
    return () => window.clearTimeout(id);
  }, [toast]);

  const runAction = useCallback(
    async <T,>(fn: () => Promise<T>, successMessage?: string): Promise<T> => {
      setIsBusy(true);
      try {
        const result = await fn();
        if (successMessage) notify('success', successMessage);
        return result;
      } catch (err) {
        notify('error', normalizeWebErrorMessage(err, 'Request failed.'));
        throw err;
      } finally {
        setIsBusy(false);
      }
    },
    [notify],
  );

  const upsertDocument = useCallback((doc: DocumentRecord) => {
    setDocuments((prev) => {
      const idx = prev.findIndex((item) => item.id === doc.id);
      if (idx === -1) return [doc, ...prev];
      const next = [...prev];
      next[idx] = doc;
      return next;
    });
  }, []);

  const wipeLocalSession = useCallback(() => {
    bearerTokenRef.current = null;
    actorIdRef.current = null;
    loadedAnnouncedActorIdRef.current = null;
    announcedNotifIdsRef.current.clear();
    setActor(null);
    setDocuments([]);
    setTrackedSnapshots([]);
    setNotifications([]);
    setAuditLogs([]);
    setActiveSessions([]);
    setPendingApprovals([]);
    setAdminUsers([]);
    realtimeCursorRef.current = 0;
    setRealtimeStatus('polling');
    clearStoredWebSession();
  }, []);

  const hydrateWorkspace = useCallback(
    async (options?: { silentNotifications?: boolean; actorIdOverride?: string }) => {
      try {
        const data = await activeGateway.listWorkspace();
        const silentActorId = options?.actorIdOverride ?? actorIdRef.current;
        if (options?.silentNotifications && silentActorId) {
          const unreadIds = data.notifications.filter((n) => !n.read).map((n) => n.id);
          if (unreadIds.length > 0) {
            const existing = loadAnnouncedNotifIds(silentActorId);
            for (const id of unreadIds) {
              existing.add(id);
              announcedNotifIdsRef.current.add(id);
            }
            loadedAnnouncedActorIdRef.current = silentActorId;
            saveAnnouncedNotifIds(silentActorId, existing, unreadIds);
          }
        }
        setOffices(data.offices);
        setPersonnelDirectory(data.personnel);
        setDocuments(data.documents);
        setTrackedSnapshots(data.trackedSnapshots);
        setCategories(data.categories);
        setNotifications(data.notifications);
        setActor((prev) => {
          if (!prev) return prev;
          const fresh = data.personnel.find((p) => p.id === prev.id);
          if (!fresh) return prev;
          const savedColor = loadStoredAvatarColor(fresh.id);
          const mergedFresh =
            savedColor && (!fresh.avatarColor || fresh.avatarColor === '#0D3472')
              ? { ...fresh, avatarColor: savedColor }
              : fresh;
          if (mergedFresh.avatarColor && mergedFresh.avatarColor !== '#0D3472') {
            saveStoredAvatarColor(mergedFresh.id, mergedFresh.avatarColor);
          }
          if (mergedFresh.preferences) {
            setUserPreferences(mergedFresh.preferences);
            saveStoredUserPrefs(mergedFresh.preferences);
          }
          if (!gateway && bearerTokenRef.current) {
            saveStoredWebSession(bearerTokenRef.current, mergedFresh);
          }
          return mergedFresh;
        });
      } catch (err) {
        const status = (err as { status?: number } | null)?.status;
        if (status === 401 && bearerTokenRef.current) {
          wipeLocalSession();
        }
        throw err;
      }
    },
    [activeGateway, gateway, wipeLocalSession],
  );

  const applyRoute = useCallback((nextRoute: WebRoute, nextDocId: string | null) => {
    setSelectedDocumentId(nextDocId);
    setRoute(nextRoute);
    if (typeof window !== 'undefined') {
      const targetHash = formatWebHash(nextRoute, nextDocId);
      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
      }
    }
  }, []);

  const documentsRef = useRef<ReadonlyArray<DocumentRecord>>(documents);
  documentsRef.current = documents;

  const openSoftCopyUnlock = useCallback((doc: DocumentRecord) => {
    setHardCopyReceiveDocId(null);
    setSoftCopyUnlockDocId(doc.id);
  }, []);

  const closeSoftCopyUnlock = useCallback(() => {
    setSoftCopyUnlockDocId(null);
  }, []);

  const openHardCopyReceive = useCallback((doc: DocumentRecord) => {
    setSoftCopyUnlockDocId(null);
    setHardCopyReceiveDocId(doc.id);
  }, []);

  const closeHardCopyReceive = useCallback(() => {
    setHardCopyReceiveDocId(null);
  }, []);

  const openBatchUsbReceive = useCallback(() => {
    setBatchUsbReceiveOpen(true);
  }, []);

  const closeBatchUsbReceive = useCallback(() => {
    setBatchUsbReceiveOpen(false);
  }, []);

  const openSealedDocumentAction = useCallback((doc: DocumentRecord) => {
    if (doc.copyFormat === 'digital') {
      setHardCopyReceiveDocId(null);
      setSoftCopyUnlockDocId(doc.id);
    } else {
      setSoftCopyUnlockDocId(null);
      setHardCopyReceiveDocId(doc.id);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHashChange = () => {
      const parsed = parseWebHash(window.location.hash);
      setRoute(parsed.route);
      setSelectedDocumentId(parsed.documentId);
      setVerifyToken(parsed.verifyToken);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    if (!actor) {
      loadedAnnouncedActorIdRef.current = null;
      announcedNotifIdsRef.current.clear();
      return;
    }
    if (loadedAnnouncedActorIdRef.current !== actor.id) {
      loadedAnnouncedActorIdRef.current = actor.id;
      announcedNotifIdsRef.current = loadAnnouncedNotifIds(actor.id);
    }
  }, [actor]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const unread = actor ? notifications.filter((n) => !n.read) : [];
    const unreadCount = unread.length;
    document.title = unreadCount > 0 ? `(${unreadCount}) Tracely` : 'Tracely';

    const nav =
      typeof navigator !== 'undefined'
        ? (navigator as Navigator & {
            setAppBadge?: (contents?: number) => Promise<void>;
            clearAppBadge?: () => Promise<void>;
          })
        : null;
    if (nav) {
      if (unreadCount > 0 && typeof nav.setAppBadge === 'function') {
        nav.setAppBadge(unreadCount).catch(() => {});
      } else if (unreadCount === 0 && typeof nav.clearAppBadge === 'function') {
        nav.clearAppBadge().catch(() => {});
      }
    }

    if (
      !actor ||
      !userPreferences.desktopNotifications ||
      typeof window === 'undefined' ||
      !window.Notification ||
      window.Notification.permission !== 'granted'
    ) {
      return;
    }

    let announcedChanged = false;
    for (const item of unread) {
      if (announcedNotifIdsRef.current.has(item.id)) continue;
      announcedNotifIdsRef.current.add(item.id);
      announcedChanged = true;
      try {
        const nativeNotif = new window.Notification(item.title, {
          body: item.content,
          tag: item.id,
        });
        nativeNotif.onclick = () => {
          window.focus?.();
          const matchedDoc = documentsRef.current.find((d) => d.id === item.documentId);
          if (matchedDoc && (isPendingReceiptForActor(matchedDoc, actor) || Boolean(matchedDoc.isSealed))) {
            openSealedDocumentAction(matchedDoc);
          } else {
            applyRoute('document', item.documentId);
          }
        };
      } catch {
        // Ignore Notification constructor errors in restricted browser contexts
      }
    }
    if (announcedChanged) {
      saveAnnouncedNotifIds(
        actor.id,
        announcedNotifIdsRef.current,
        unread.map((u) => u.id),
      );
    }
  }, [actor, notifications, applyRoute, openSealedDocumentAction, userPreferences.desktopNotifications]);

  useEffect(() => {
    if (!shouldBootstrap || initialBootDoneRef.current) return;
    let mounted = true;
    hydrateWorkspace({ silentNotifications: true })
      .catch(() => {})
      .finally(() => {
        initialBootDoneRef.current = true;
        if (mounted) setBootstrapping(false);
      });
    return () => {
      mounted = false;
    };
  }, [shouldBootstrap, hydrateWorkspace]);

  useEffect(() => {
    if (!actor) return;
    const hasPulse = typeof activeGateway.pollRealtimePulse === 'function';
    let alive = true;

    const triggerLiveRefresh = () => {
      hydrateWorkspace()
        .then(() => {
          if (alive) setRealtimeTick((t) => t + 1);
        })
        .catch(() => {});
    };

    const runPulse = async () => {
      if (!alive || (typeof document !== 'undefined' && document.hidden)) return;
      if (!activeGateway.pollRealtimePulse) return;
      try {
        const res = await activeGateway.pollRealtimePulse(realtimeCursorRef.current);
        if (!alive) return;
        setRealtimeStatus('live');
        setFcmConfigured(res.fcmConfigured);
        const hadCursor = realtimeCursorRef.current > 0;
        if (res.cursor > realtimeCursorRef.current) {
          realtimeCursorRef.current = res.cursor;
          if (hadCursor && res.changed) {
            triggerLiveRefresh();
          }
        }
      } catch {
        if (alive) setRealtimeStatus('polling');
      }
    };

    // Seed initial cursor immediately on mount so the very next server event syncs without delay
    if (hasPulse) {
      void runPulse();
    }

    const pulseId = hasPulse ? window.setInterval(() => void runPulse(), WEB_REALTIME_PULSE_MS) : null;
    const fallbackId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      triggerLiveRefresh();
    }, WEB_WORKSPACE_POLL_MS);

    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        triggerLiveRefresh();
        if (hasPulse) void runPulse();
      }
    };
    const onFocusOrOnline = () => {
      if (hasPulse) {
        void runPulse();
      } else {
        triggerLiveRefresh();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocusOrOnline);
      window.addEventListener('online', onFocusOrOnline);
    }

    return () => {
      alive = false;
      if (pulseId !== null) window.clearInterval(pulseId);
      window.clearInterval(fallbackId);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocusOrOnline);
        window.removeEventListener('online', onFocusOrOnline);
      }
    };
  }, [actor, activeGateway, hydrateWorkspace]);

  const recordScanEntry = useCallback((resolved: QrResolutionResult) => {
    const id = `scan-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
    const scannedAt = new Date().toISOString();
    let entry: RecentScanEntry;

    switch (resolved.kind) {
      case 'document_authorized':
        entry = {
          id,
          kind: resolved.kind,
          trackingCode: resolved.document.trackingCode,
          label: resolved.document.title,
          subtitle: `In ${resolved.document.currentOffice.name}${
            resolved.pendingForActorOffice ? ' · Awaiting receipt' : ''
          }`,
          documentId: resolved.document.id,
          scannedAt,
        };
        break;
      case 'document_denied':
        entry = {
          id,
          kind: resolved.kind,
          trackingCode: resolved.trackingCode,
          label: 'Access Restricted',
          subtitle: resolved.reason,
          scannedAt,
        };
        break;
      case 'desktop_pair_ready':
        entry = {
          id,
          kind: resolved.kind,
          trackingCode: resolved.pairing.pairToken,
          label: resolved.pairing.draftLabel,
          subtitle: 'Desktop photo attach paired',
          scannedAt,
        };
        break;
      case 'transmittal_verified':
        entry = {
          id,
          kind: resolved.kind,
          trackingCode: resolved.trackingCode,
          label: 'Authentic A4 Transmittal',
          subtitle: `${resolved.currentOfficeName} · ${resolved.milestoneCount} checkpoints`,
          scannedAt,
        };
        break;
    }

    setRecentScans((prev) => {
      const next = [entry, ...prev].slice(0, 15);
      try {
        window.localStorage.setItem(STORAGE_KEY_RECENT_SCANS, JSON.stringify(next));
      } catch {
        // Ignore storage quota or disabled storage
      }
      return next;
    });
  }, []);

  const pendingReceiptCount = useMemo(
    () => (actor ? documents.filter((d) => isPendingReceiptForActor(d, actor)).length : 0),
    [actor, documents],
  );

  const pendingSentCount = useMemo(
    () => selectSentDocuments(documents, actor).filter((item) => item.status === 'pending').length,
    [actor, documents],
  );

  const canApproveAccounts = useMemo(() => isAccountApprover(actor), [actor]);

  const recallTransferById = useCallback(
    async (documentId: string) =>
      runAction(async () => {
        const updated = await activeGateway.recallTransfer(documentId);
        upsertDocument(updated);
        return updated;
      }, 'Pending transfer recalled.'),
    [activeGateway, runAction, upsertDocument],
  );

  const notifyWithOptionalRecall = useCallback(
    (doc: DocumentRecord, message: string) => {
      const latest = doc.transactions[doc.transactions.length - 1];
      const canRecall = Boolean(latest && latest.status === 'pending');
      if (canRecall) {
        notify('success', message, {
          label: 'Recall',
          onClick: () => {
            void recallTransferById(doc.id);
          },
        });
      } else {
        notify('success', message);
      }
    },
    [notify, recallTransferById],
  );

  const listDocumentCommentsStable = useCallback(
    async (documentId: string): Promise<ReadonlyArray<DocumentComment>> => {
      if (!activeGateway.listDocumentComments) return [];
      return activeGateway.listDocumentComments(documentId);
    },
    [activeGateway],
  );

  const refreshWorkspaceSilentStable = useCallback(async (): Promise<void> => {
    try {
      await hydrateWorkspace();
    } catch {
      // Ignore silent background sync errors while modal is open
    }
  }, [hydrateWorkspace]);

  const subscribeInstantSync = useCallback((): (() => void) => {
    let alive = true;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const canStream = Boolean(activeGateway.streamRealtimeEvents && controller);

    const runSseLoop = async () => {
      if (!canStream || !controller || !activeGateway.streamRealtimeEvents) return;
      while (alive && !controller.signal.aborted) {
        try {
          await activeGateway.streamRealtimeEvents(
            realtimeCursorRef.current,
            controller.signal,
            (nextCursor) => {
              if (!alive) return;
              if (nextCursor > realtimeCursorRef.current) {
                realtimeCursorRef.current = nextCursor;
              }
              setRealtimeStatus('live');
              void hydrateWorkspace().then(() => {
                if (alive) setRealtimeTick((t) => t + 1);
              });
            },
          );
        } catch {
          if (!alive || controller.signal.aborted) break;
          await new Promise<void>((resolve) => {
            window.setTimeout(resolve, 1500);
          });
        }
      }
    };

    if (canStream) {
      void runSseLoop();
    }

    const fallbackTimer = window.setInterval(() => {
      if (alive) {
        void refreshWorkspaceSilentStable();
      }
    }, 2500);

    return () => {
      alive = false;
      controller?.abort();
      window.clearInterval(fallbackTimer);
    };
  }, [activeGateway, hydrateWorkspace, refreshWorkspaceSilentStable]);

  const loadRoutingTemplatesStable = useCallback(async (): Promise<ReadonlyArray<RoutingTemplate>> => {
    if (!activeGateway.listRoutingTemplates) {
      return [];
    }
    try {
      const list = await activeGateway.listRoutingTemplates();
      setRoutingTemplates(list);
      return list;
    } catch {
      return [];
    }
  }, [activeGateway]);

  const getTurnaroundAnalyticsStable = useCallback(async (): Promise<TurnaroundAnalyticsReport> => {
    if (activeGateway.getTurnaroundAnalytics) {
      return activeGateway.getTurnaroundAnalytics();
    }
    const docs = documentsRef.current;
    const completed = docs.filter((d) => d.lifecycleStatus === 'approved' || d.lifecycleStatus === 'archived');
    const active = docs.filter((d) => d.lifecycleStatus !== 'approved' && d.lifecycleStatus !== 'archived');
    const overdue = active.filter((d) => d.slaState === 'overdue');
    const atRisk = active.filter((d) => d.slaState === 'at_risk');
    const onTrack = active.filter((d) => d.slaState === 'on_track');

    const officeStats = new Map<
      string,
      { officeId: string; officeCode: string; officeName: string; handledCount: number; pendingCount: number; overdueCount: number; avgHours: number }
    >();
    for (const d of docs) {
      const off = d.currentOffice;
      const cur = officeStats.get(off.id) ?? {
        officeId: off.id,
        officeCode: off.code,
        officeName: off.name,
        handledCount: 0,
        pendingCount: 0,
        overdueCount: 0,
        avgHours: 0,
      };
      if (d.lifecycleStatus === 'approved' || d.lifecycleStatus === 'archived') {
        cur.handledCount += 1;
      } else {
        cur.pendingCount += 1;
        if (d.slaState === 'overdue') cur.overdueCount += 1;
      }
      officeStats.set(off.id, cur);
    }

    return {
      generatedAt: new Date().toISOString(),
      summary: {
        totalDocuments: docs.length,
        activeCount: active.length,
        completedCount: completed.length,
        stalledCount: overdue.length,
        overdueCount: overdue.length,
        atRiskCount: atRisk.length,
        onTrackCount: onTrack.length,
        avgTurnaroundHours: completed.length > 0 ? 4.2 : 0,
        onTimeRatePercent: docs.length > 0 ? Math.round(((docs.length - overdue.length) / docs.length) * 100) : 100,
      },
      byFormat: {
        digital: docs.filter((d) => d.copyFormat === 'digital').length,
        hardCopy: docs.filter((d) => d.copyFormat === 'hard_copy').length,
        hybrid: docs.filter((d) => d.copyFormat === 'hybrid').length,
      },
      byOffice: Array.from(officeStats.values()),
      monthlyThroughput: [
        {
          month: new Date().toISOString().slice(0, 7),
          label: 'Current Month',
          createdCount: docs.length,
          completedCount: completed.length,
        },
      ],
    };
  }, [activeGateway]);

  const verifyPublicTransmittalStable = useCallback(
    async (token: string) => {
      if (activeGateway.verifyPublicTransmittal) {
        return activeGateway.verifyPublicTransmittal(token);
      }
      const res = await activeGateway.resolveQr(
        token.toUpperCase().startsWith('TRC-QR:VERIFY:') || token.toUpperCase().startsWith('SDO-QR:VERIFY:')
          ? token
          : `TRC-QR:VERIFY:${token}`,
      );
      if (res.kind === 'transmittal_verified') {
        return {
          trackingCode: res.trackingCode,
          lifecycleStatus: res.lifecycleStatus,
          currentOfficeName: res.currentOfficeName,
          latestChecksumShort: res.latestChecksumShort,
          milestoneCount: res.milestoneCount,
        };
      }
      throw new Error('Unable to verify transmittal QR token.');
    },
    [activeGateway],
  );

  const createUnlockChallengeStable = useCallback(
    async (documentId: string): Promise<DocumentUnlockChallenge> => {
      if (!activeGateway.createUnlockChallenge) {
        throw new Error('Unlock QR generation is not supported by this server gateway.');
      }
      return activeGateway.createUnlockChallenge(documentId);
    },
    [activeGateway],
  );

  const pendingRegistrationRef = useRef<PendingRegistrationRecord | null>(pendingRegistration);
  pendingRegistrationRef.current = pendingRegistration;

  const persistPendingRegistration = useCallback(
    (next: PendingRegistrationRecord | null) => {
      setPendingRegistration(next);
      if (!gateway) {
        saveStoredPendingRegistration(next);
      }
    },
    [gateway],
  );

  const checkPendingRegistrationStatusStable = useCallback(
    async (silent = false): Promise<PendingApprovalStatus | null> => {
      const current = pendingRegistrationRef.current;
      if (!current) return null;
      if (!current.statusToken || !activeGateway.checkRegistrationStatus) {
        if (!silent) {
          notify(
            'info',
            'Your registration is awaiting administrator verification. Please check back or try signing in once approved.',
          );
        }
        return current.status;
      }

      try {
        const res = await activeGateway.checkRegistrationStatus(current.statusToken);
        const updated: PendingRegistrationRecord = {
          ...current,
          status: res.status,
          message: res.message,
          fullName: res.submitted?.fullName || current.fullName,
          employeeId: res.submitted?.employeeId || current.employeeId,
          email: res.submitted?.email || current.email,
          position: res.submitted?.position || current.position,
          officeCode: res.submitted?.officeCode || current.officeCode,
          officeName: res.submitted?.officeName || current.officeName,
          submittedAt: res.submitted?.submittedAt || current.submittedAt,
          checkedAt: new Date().toISOString(),
        };
        persistPendingRegistration(updated);

        if (res.status === 'approved') {
          if (!silent || current.status !== 'approved') {
            notify('success', 'Your account has been approved! You can now sign in.');
          }
        } else if (res.status === 'rejected') {
          if (!silent || current.status !== 'rejected') {
            notify('error', res.message);
          }
        } else if (!silent) {
          notify('info', 'Still awaiting administrator approval.');
        }

        return res.status;
      } catch (err) {
        if (!silent) {
          notify(
            'error',
            normalizeWebErrorMessage(err, 'Unable to check registration status.'),
          );
        }
        return null;
      }
    },
    [activeGateway, notify, persistPendingRegistration],
  );

  const proceedFromPendingToLoginStable = useCallback(
    (clearRecord = true) => {
      const current = pendingRegistrationRef.current;
      if (current) {
        const nextId = current.email || current.employeeId;
        if (nextId) {
          setPrefillLoginIdentifier(nextId);
        }
      }
      if (clearRecord) {
        persistPendingRegistration(null);
      }
      applyRoute('login', null);
    },
    [applyRoute, persistPendingRegistration],
  );

  const dismissPendingRegistrationStable = useCallback(() => {
    persistPendingRegistration(null);
    applyRoute('login', null);
  }, [applyRoute, persistPendingRegistration]);

  const signInAction = async (identifier: string, password: string) => {
    const clean = AuthInputPolicy.validateLogin(identifier, password);
    setIsBusy(true);
    try {
      const res = await activeGateway.login(clean.identifier, clean.password);
      bearerTokenRef.current = res.bearerToken;
      setActor(res.user);
      persistPendingRegistration(null);
      if (!gateway) {
        saveStoredWebSession(res.bearerToken, res.user);
      }
      const targetLanding: WebRoute =
        typeof window !== 'undefined' && window.location.hash === '#/inbox'
          ? 'inbox'
          : 'dashboard';
      applyRoute(targetLanding, null);
      await hydrateWorkspace({ silentNotifications: true, actorIdOverride: res.user.id });
      notify('success', 'Signed in securely.');
    } catch (err) {
      const typedErr = err as Error & {
        code?: string;
        approvalStatus?: PendingApprovalStatus;
        statusToken?: string | null;
        submitted?: PendingRegistrationSummary | null;
      };
      if (
        typedErr.code === 'ACCOUNT_PENDING_APPROVAL' ||
        typedErr.code === 'ACCOUNT_REJECTED'
      ) {
        const status: PendingApprovalStatus =
          typedErr.code === 'ACCOUNT_REJECTED' ? 'rejected' : 'pending';
        const submitted = typedErr.submitted;
        persistPendingRegistration({
          status,
          statusToken: typedErr.statusToken ?? null,
          message: typedErr.message,
          fullName: submitted?.fullName || '',
          employeeId:
            submitted?.employeeId ||
            (clean.identifier.includes('@') ? '' : clean.identifier.toUpperCase()),
          email:
            submitted?.email ||
            (clean.identifier.includes('@') ? clean.identifier.toLowerCase() : ''),
          position: submitted?.position || '',
          officeCode: submitted?.officeCode || '',
          officeName: submitted?.officeName || '',
          submittedAt: submitted?.submittedAt || new Date().toISOString(),
          checkedAt: new Date().toISOString(),
        });
        applyRoute('pending_approval', null);
        notify(status === 'rejected' ? 'error' : 'info', typedErr.message);
        return;
      }
      notify('error', normalizeWebErrorMessage(err, 'Request failed.'));
      throw err;
    } finally {
      setIsBusy(false);
    }
  };

  const value: WebContextValue = {
    route,
    bootstrapping,
    firstVisitSkeletonMs,
    apiBaseUrl,
    actor,
    isBusy,
    isRefreshing,
    offices,
    personnelDirectory,
    documents,
    trackedSnapshots,
    categories,
    notifications,
    unreadNotificationCount: notifications.filter((n) => !n.read).length,
    auditLogs,
    activeSessions,
    securityPrefs,
    userPreferences,
    recentScans,
    selectedDocumentId,
    verifyToken,
    softCopyUnlockDocId,
    hardCopyReceiveDocId,
    batchUsbReceiveOpen,
    routingTemplates,
    pendingReceiptCount,
    pendingSentCount,
    canApproveAccounts,
    pendingApprovals,
    adminUsers,
    realtimeStatus,
    realtimeTick,
    fcmConfigured,
    toast,
    requireAuth,
    pendingRegistration,
    prefillLoginIdentifier,
    checkPendingRegistrationStatus: checkPendingRegistrationStatusStable,
    proceedFromPendingToLogin: proceedFromPendingToLoginStable,
    dismissPendingRegistration: dismissPendingRegistrationStable,
    navigate: (next) => {
      applyRoute(next, next === 'document' ? selectedDocumentId : null);
    },
    openDocument: (documentId) => {
      applyRoute('document', documentId);
    },
    closeDocument: () => {
      applyRoute('inbox', null);
    },
    openSoftCopyUnlock,
    closeSoftCopyUnlock,
    openHardCopyReceive,
    closeHardCopyReceive,
    openBatchUsbReceive,
    closeBatchUsbReceive,
    openSealedDocumentAction,
    subscribeInstantSync,
    requestPasswordReset: async (identifier) => {
      if (!activeGateway.requestPasswordReset) {
        return {
          message:
            'If an active Tracely account matches that Employee ID or email, a 15-minute reset code has been issued.',
        };
      }
      return runAction(() => activeGateway.requestPasswordReset!(identifier));
    },
    confirmPasswordReset: async (identifier, resetCode, newPassword) => {
      if (!activeGateway.confirmPasswordReset) {
        throw new Error('Password reset endpoint is unavailable.');
      }
      return runAction(
        () => activeGateway.confirmPasswordReset!(identifier, resetCode, newPassword),
        'Password reset successful. Sign in with your new password.',
      );
    },
    loadRoutingTemplates: loadRoutingTemplatesStable,
    createRoutingTemplate: async (payload) =>
      runAction(async () => {
        if (activeGateway.createRoutingTemplate) {
          const created = await activeGateway.createRoutingTemplate(payload);
          setRoutingTemplates((prev) => [created, ...prev]);
          return created;
        }
        const local: RoutingTemplate = {
          id: `tpl-${Date.now()}`,
          name: payload.name.trim(),
          description: payload.description?.trim() || null,
          categoryId: payload.categoryId ?? null,
          categoryName: categories.find((c) => c.id === payload.categoryId)?.name ?? null,
          officeId: actor?.office.id ?? 'off-1',
          officeCode: actor?.office.code ?? 'UNIT',
          officeName: actor?.office.name ?? 'Office Unit',
          createdByUserId: actor?.id ?? 'usr-1',
          createdByName: actor?.fullName ?? 'Tracely User',
          isGlobal: Boolean(payload.isGlobal),
          steps: payload.steps.map((s, i) => {
            const off = offices.find((o) => o.id === s.officeId);
            return {
              order: i + 1,
              officeId: s.officeId,
              officeCode: off?.code ?? 'UNIT',
              officeName: off?.name ?? 'Office Unit',
              defaultRemarks: s.defaultRemarks ?? '',
            };
          }),
          createdAt: new Date().toISOString(),
        };
        setRoutingTemplates((prev) => [local, ...prev]);
        return local;
      }, 'Routing template saved.'),
    deleteRoutingTemplate: async (templateId) => {
      await runAction(async () => {
        if (activeGateway.deleteRoutingTemplate) {
          await activeGateway.deleteRoutingTemplate(templateId);
        }
        setRoutingTemplates((prev) => prev.filter((t) => t.id !== templateId));
      }, 'Routing template removed.');
    },
    getTurnaroundAnalytics: getTurnaroundAnalyticsStable,
    listDocumentsPage: async (params) => {
      if (activeGateway.listDocumentsPage) {
        return activeGateway.listDocumentsPage(params);
      }
      const perPage = params.perPage ?? 15;
      const page = params.page ?? 1;
      const q = (params.q ?? '').trim().toLowerCase();
      const filtered = documentsRef.current.filter((d) => {
        if (params.status && d.lifecycleStatus !== params.status) return false;
        if (params.copyFormat && d.copyFormat !== params.copyFormat) return false;
        if (params.categoryId && d.categoryId !== params.categoryId) return false;
        if (q) {
          const hay = `${d.trackingCode} ${d.title} ${d.categoryName} ${d.currentOffice.code}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      const lastPage = Math.max(1, Math.ceil(filtered.length / perPage));
      const safePage = Math.min(Math.max(1, page), lastPage);
      return {
        data: filtered.slice((safePage - 1) * perPage, safePage * perPage),
        meta: {
          currentPage: safePage,
          lastPage,
          perPage,
          total: filtered.length,
        },
      };
    },
    verifyPublicTransmittal: verifyPublicTransmittalStable,
    hasScreenBeenOpened,
    markScreenOpened,
    notify,
    clearToast,
    updateApiBaseUrl: (rawUrl) => {
      const validated = validateApiBaseUrl(rawUrl);
      apiBaseUrlRef.current = validated;
      setApiBaseUrl(validated);
      try {
        window.localStorage.setItem(STORAGE_KEY_API_URL, validated);
      } catch {
        // Ignore storage restriction
      }
      notify('success', 'Server API URL saved.');
    },
    signIn: signInAction,
    registerAccount: async (input) => {
      const clean = AuthInputPolicy.validateRegistration(input);
      return runAction(async () => {
        const outcome = await activeGateway.register({
          ...clean,
          password: input.password,
        });
        if (!outcome.pendingApproval && outcome.user && outcome.bearerToken) {
          bearerTokenRef.current = outcome.bearerToken;
          setActor(outcome.user);
          persistPendingRegistration(null);
          if (!gateway) {
            saveStoredWebSession(outcome.bearerToken, outcome.user);
          }
          const targetLanding: WebRoute =
            typeof window !== 'undefined' && window.location.hash === '#/inbox'
              ? 'inbox'
              : 'dashboard';
          applyRoute(targetLanding, null);
          await hydrateWorkspace({
            silentNotifications: true,
            actorIdOverride: outcome.user.id,
          });
        } else if (outcome.pendingApproval) {
          const matchedOffice = offices.find(
            (o) => o.code.toUpperCase() === clean.officeCode.toUpperCase(),
          );
          const submitted = outcome.submitted;
          persistPendingRegistration({
            status: 'pending',
            statusToken: outcome.statusToken ?? null,
            message: outcome.message,
            fullName: submitted?.fullName || clean.fullName,
            employeeId: submitted?.employeeId || clean.employeeId,
            email: submitted?.email || clean.email,
            position: submitted?.position || clean.position,
            officeCode: submitted?.officeCode || clean.officeCode,
            officeName:
              submitted?.officeName ||
              clean.customOfficeName ||
              matchedOffice?.name ||
              clean.officeCode,
            submittedAt: submitted?.submittedAt || new Date().toISOString(),
            checkedAt: null,
          });
          applyRoute('pending_approval', null);
        }
        notify('info', outcome.message);
        return { pendingApproval: outcome.pendingApproval, message: outcome.message };
      });
    },
    signOut: async () => {
      await runAction(async () => {
        if (bearerTokenRef.current) {
          try {
            await activeGateway.logout();
          } catch {
            // Continue wiping local session
          }
        }
        wipeLocalSession();
        setSoftCopyUnlockDocId(null);
        setHardCopyReceiveDocId(null);
        setRecentScans([]);
        try {
          window.localStorage.removeItem(STORAGE_KEY_RECENT_SCANS);
        } catch {
          // Ignore storage error
        }
        applyRoute('login', null);
      }, 'Signed out of Tracely.');
    },
    refreshWorkspace: async () => {
      if (!actor) {
        notify('info', 'Authentication is deferred. Connect your Laravel API server in Profile.');
        return;
      }
      setIsRefreshing(true);
      try {
        await hydrateWorkspace();
        notify('success', 'Workspace synced.');
      } catch (err) {
        notify('error', normalizeWebErrorMessage(err, 'Unable to sync workspace.'));
      } finally {
        setIsRefreshing(false);
      }
    },
    trackByCode: async (code) => {
      const trimmed = code.trim();
      if (!trimmed) {
        notify('error', 'Enter a document tracking code to look up.');
        return null;
      }
      if (!actor) {
        notify('info', 'Sign in to look up live custody on the Laravel server.');
        return null;
      }
      return runAction(() => activeGateway.trackByCode(trimmed));
    },
    sendDigitalDocument: async (payload) => {
      if (!actor) {
        const msg = 'Sign in with your Tracely account to upload and dispatch documents.';
        notify('info', msg);
        throw new Error(msg);
      }
      return runAction(async () => {
        const created = await activeGateway.createDigitalDocument(payload);
        upsertDocument(created);
        notifyWithOptionalRecall(
          created,
          payload.recipientUserId
            ? `Dispatched ${created.trackingCode} with routing QR slip.`
            : 'Document uploaded with routing QR slip.',
        );
        return created;
      });
    },
    sendDigitalDocumentBundle: async (payload) => {
      if (!actor) {
        const msg = 'Sign in with your Tracely account to upload and dispatch documents.';
        notify('info', msg);
        throw new Error(msg);
      }
      if (payload.files.length === 0) {
        throw new Error('Choose at least one PDF or scanned image before dispatching.');
      }
      return runAction(async () => {
        const [first, ...rest] = payload.files;
        if (rest.length === 0) {
          const single = await activeGateway.createDigitalDocument({
            title: payload.title,
            categoryId: payload.categoryId,
            confidentialityTier: payload.confidentialityTier,
            file: first.file,
            fileName: first.fileName,
            sha256Checksum: first.sha256Checksum,
            recipientUserId: payload.recipientUserId,
            remarks: payload.remarks,
          });
          upsertDocument(single);
          notifyWithOptionalRecall(
            single,
            payload.recipientUserId
              ? `Dispatched ${single.trackingCode} with routing QR slip.`
              : 'Document uploaded with routing QR slip.',
          );
          return single;
        }

        let currentDoc = await activeGateway.createDigitalDocument({
          title: payload.title,
          categoryId: payload.categoryId,
          confidentialityTier: payload.confidentialityTier,
          file: first.file,
          fileName: first.fileName,
          sha256Checksum: first.sha256Checksum,
          recipientUserId: null,
          remarks: payload.remarks,
        });

        for (let i = 0; i < rest.length; i += 1) {
          currentDoc = await activeGateway.uploadRevision({
            documentId: currentDoc.id,
            file: rest[i].file,
            fileName: rest[i].fileName,
            sha256Checksum: rest[i].sha256Checksum,
            revisionNote: `Supporting attachment (${i + 2} of ${payload.files.length})`,
          });
        }

        if (payload.recipientUserId) {
          currentDoc = await activeGateway.forwardDocument(
            currentDoc.id,
            payload.recipientUserId,
            payload.remarks ?? '',
          );
        }

        upsertDocument(currentDoc);
        notifyWithOptionalRecall(
          currentDoc,
          `Bundled ${payload.files.length} files into ${currentDoc.trackingCode}.`,
        );
        return currentDoc;
      });
    },
    sendDigitalDocumentBatch: async (payload) => {
      if (!actor) {
        const msg = 'Sign in with your Tracely account to upload and dispatch documents.';
        notify('info', msg);
        throw new Error(msg);
      }
      if (payload.files.length === 0) {
        throw new Error('Choose at least one PDF or scanned image before dispatching.');
      }
      return runAction(async () => {
        const createdList: DocumentRecord[] = [];
        for (const item of payload.files) {
          const customTitle = item.title?.trim();
          const effectiveName = item.fileName?.trim() || item.file.name;
          const itemTitle = customTitle
            ? customTitle
            : payload.files.length === 1
              ? payload.title
              : payload.title.trim()
                ? buildBatchItemTitle(payload.title, effectiveName)
                : effectiveName.replace(/\.[^.]+$/, '').trim() || effectiveName;
          const created = await activeGateway.createDigitalDocument({
            title: itemTitle,
            categoryId: payload.categoryId,
            confidentialityTier: payload.confidentialityTier,
            file: item.file,
            fileName: item.fileName,
            sha256Checksum: item.sha256Checksum,
            recipientUserId: payload.recipientUserId,
            remarks: payload.remarks,
          });
          upsertDocument(created);
          createdList.push(created);
        }
        notify('success', `Dispatched ${createdList.length} document(s).`);
        return createdList;
      });
    },
    registerHardCopyDocument: async (payload) => {
      if (!actor) {
        const msg = 'Sign in with your Tracely account to log hard-copy records and generate QR slips.';
        notify('info', msg);
        throw new Error(msg);
      }
      return runAction(async () => {
        const created = await activeGateway.registerHardCopyDocument(payload);
        upsertDocument(created);
        notifyWithOptionalRecall(
          created,
          payload.recipientUserId
            ? `Hard-copy ${created.trackingCode} dispatched with QR slip.`
            : 'Hard-copy record registered with QR slip.',
        );
        return created;
      });
    },
    refreshWorkspaceSilent: refreshWorkspaceSilentStable,
    acknowledgeReceipt: async (documentId, remarks, proofPhoto, verificationCode, password) =>
      runAction(async () => {
        const updated = await activeGateway.acknowledgeReceipt(
          documentId,
          remarks,
          proofPhoto,
          verificationCode,
          password,
        );
        upsertDocument(updated);
        setSoftCopyUnlockDocId((curr) => (curr === documentId ? null : curr));
        setHardCopyReceiveDocId((curr) => (curr === documentId ? null : curr));
        return updated;
      }, proofPhoto ? 'Custody receipt confirmed with verified proof photo.' : password ? 'Password verified — document unlocked & saved in Track.' : 'Receipt verified — document unlocked & custody confirmed.'),
    createUnlockChallenge: createUnlockChallengeStable,
    unlockWithPassword: async (documentId, password) =>
      runAction(async () => {
        const updated = await activeGateway.acknowledgeReceipt(
          documentId,
          undefined,
          undefined,
          undefined,
          password,
        );
        upsertDocument(updated);
        setSoftCopyUnlockDocId((curr) => (curr === documentId ? null : curr));
        setHardCopyReceiveDocId((curr) => (curr === documentId ? null : curr));
        return updated;
      }, 'Password verified — receipt logged in Track & document unlocked.'),
    batchAcknowledgeReceipts: async (items, remarks) => {
      if (items.length === 0) return 0;
      return runAction(async () => {
        let count = 0;
        for (const item of items) {
          const documentId = typeof item === 'string' ? item : item.documentId;
          const verificationCode = typeof item === 'string' ? undefined : item.verificationCode;
          const updated = await activeGateway.acknowledgeReceipt(
            documentId,
            remarks,
            undefined,
            verificationCode,
          );
          upsertDocument(updated);
          count += 1;
        }
        setHardCopyReceiveDocId(null);
        notify('success', `Confirmed receipt & unlocked ${count} document(s).`);
        return count;
      });
    },
    forwardDocument: async (documentId, recipientUserId, remarks) =>
      runAction(async () => {
        const updated = await activeGateway.forwardDocument(documentId, recipientUserId, remarks);
        upsertDocument(updated);
        notifyWithOptionalRecall(updated, `Document ${updated.trackingCode} forwarded.`);
        return updated;
      }),
    batchForwardDocuments: async (documentIds, recipientUserId, remarks) => {
      if (documentIds.length === 0) return 0;
      return runAction(async () => {
        let count = 0;
        for (const id of documentIds) {
          const updated = await activeGateway.forwardDocument(id, recipientUserId, remarks);
          upsertDocument(updated);
          count += 1;
        }
        notify('success', `Forwarded ${count} document(s).`);
        return count;
      });
    },
    returnForRevision: async (documentId, remarks) =>
      runAction(async () => {
        const updated = await activeGateway.returnForRevision(documentId, remarks);
        upsertDocument(updated);
        return updated;
      }, 'Returned for revision.'),
    declineMisrouted: async (documentId, reason) =>
      runAction(async () => {
        const updated = await activeGateway.declineMisrouted(documentId, reason);
        upsertDocument(updated);
        return updated;
      }, 'Document flagged as misrouted.'),
    recallTransfer: recallTransferById,
    updateDocumentDetails: async (documentId, patch) =>
      runAction(async () => {
        if (activeGateway.updateDocumentDetails) {
          const updated = await activeGateway.updateDocumentDetails(documentId, patch);
          upsertDocument(updated);
          return updated;
        }
        const existing = documents.find((d) => d.id === documentId);
        if (!existing) {
          throw new Error('Document not found.');
        }
        const matchedCat = patch.categoryId
          ? categories.find((c) => c.id === patch.categoryId)
          : undefined;
        const updated: DocumentRecord = {
          ...existing,
          title: patch.title !== undefined ? patch.title.trim() || existing.title : existing.title,
          categoryId: patch.categoryId ?? existing.categoryId,
          categoryName: matchedCat?.name ?? existing.categoryName,
          confidentialityTier: patch.confidentialityTier ?? existing.confidentialityTier,
          physicalReference:
            patch.physicalReference !== undefined
              ? patch.physicalReference
              : existing.physicalReference,
          physicalPageCount:
            patch.physicalPageCount !== undefined
              ? patch.physicalPageCount
              : existing.physicalPageCount,
        };
        upsertDocument(updated);
        return updated;
      }, 'Document details updated.'),
    completeDocument: async (documentId, status, remarks) => {
      if (!activeGateway.completeDocument) {
        throw new Error('Document completion endpoint is unavailable.');
      }
      return runAction(async () => {
        const updated = await activeGateway.completeDocument!(documentId, status, remarks);
        upsertDocument(updated);
        return updated;
      }, status === 'approved' ? 'Document marked Approved & Released.' : 'Document archived cleanly.');
    },
    listDocumentComments: listDocumentCommentsStable,
    addDocumentComment: async (documentId, body, visibility) => {
      if (!activeGateway.addDocumentComment) {
        throw new Error('Comments endpoint is unavailable.');
      }
      return runAction(
        () => activeGateway.addDocumentComment!(documentId, body, visibility),
        visibility === 'internal_office'
          ? 'Internal office note added.'
          : 'Cross-office note posted.',
      );
    },
    uploadRevision: async (payload) =>
      runAction(async () => {
        const updated = await activeGateway.uploadRevision(payload);
        upsertDocument(updated);
        return updated;
      }, 'New version uploaded and verified.'),
    issuePresignedView: async (documentId, versionNumber) =>
      runAction(() => activeGateway.issuePresignedView(documentId, versionNumber)),
    issueProofPhotoView: async (documentId, transactionId) => {
      if (!activeGateway.issueProofPhotoView) {
        throw new Error('Proof photo viewer endpoint is unavailable.');
      }
      return runAction(() => activeGateway.issueProofPhotoView!(documentId, transactionId));
    },
    resolveQr: async (rawValue) =>
      runAction(async () => {
        const rawResolved = await activeGateway.resolveQr(rawValue);
        let resolved: QrResolutionResult = rawResolved;
        if (rawResolved.kind === 'document_authorized') {
          const sentByActor = Boolean(
            rawResolved.sentByActor || isPendingSentByActor(rawResolved.document, actor),
          );
          const pendingForActorOffice = sentByActor
            ? false
            : Boolean(
                rawResolved.pendingForActorOffice &&
                  (!actor || isPendingReceiptForActor(rawResolved.document, actor)),
              );
          resolved = {
            ...rawResolved,
            pendingForActorOffice,
            sentByActor,
            verificationCode: rawResolved.verificationCode ?? rawValue.trim(),
          };
          if (!pendingForActorOffice) {
            upsertDocument(rawResolved.document);
          }
          if (sentByActor) {
            notify(
              'info',
              'You sent this transfer — senders cannot confirm receipt of their own QR.',
            );
          }
        }
        recordScanEntry(resolved);
        return resolved;
      }),
    createDesktopPairSession: async (draftLabel) =>
      runAction(() => activeGateway.createDesktopPairSession(draftLabel)),
    checkDesktopPairStatus: async (pairToken) => {
      if (!activeGateway.getDesktopPairStatus) {
        return { pairToken, attached: false };
      }
      return activeGateway.getDesktopPairStatus(pairToken);
    },
    declareCategory: async (name, code) =>
      runAction(async () => {
        const created = await activeGateway.declareCategory(name, code);
        setCategories((prev) => [...prev, created]);
        return created;
      }, 'Shared category saved across all offices.'),
    markNotificationRead: async (notificationId) => {
      const target = notifications.find((n) => n.id === notificationId);
      if (!target || target.read) return;
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
      if (actor && activeGateway.markNotificationRead) {
        try {
          await activeGateway.markNotificationRead(notificationId);
        } catch {
          // Keep optimistic UI responsive
        }
      }
    },
    markAllNotificationsRead: async () =>
      runAction(async () => {
        await activeGateway.markAllNotificationsRead();
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      }, 'Alerts marked as read.'),
    loadAuditLogs: async (documentId) =>
      runAction(async () => {
        const logs = await activeGateway.listAuditLogs(documentId ?? '');
        setAuditLogs(logs);
      }),
    updateAvailability: async (status, delegateId, until) =>
      runAction(async () => {
        const updated = await activeGateway.updateAvailability(status, delegateId, until);
        setActor(updated);
      }, 'Routing availability updated.'),
    updateProfile: async (patch) =>
      runAction(async () => {
        if (!actor) {
          throw new Error('Sign in to update your personal profile.');
        }
        let updated: Personnel;
        if (activeGateway.updateProfile) {
          updated = await activeGateway.updateProfile(patch);
        } else {
          const fullName = patch.fullName?.trim() || actor.fullName;
          const parts = fullName.split(/\s+/).filter(Boolean);
          const initials =
            parts.length === 0
              ? 'SD'
              : parts.length === 1
                ? parts[0].slice(0, 2).toUpperCase()
                : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
          updated = {
            ...actor,
            fullName,
            email: actor.email,
            position: patch.position?.trim() || actor.position,
            contactNumber:
              patch.contactNumber !== undefined ? patch.contactNumber : actor.contactNumber,
            deskNote: patch.deskNote !== undefined ? patch.deskNote : actor.deskNote,
            avatarColor: patch.avatarColor ?? actor.avatarColor ?? '#0D3472',
            initials,
          };
        }
        const resolvedColor = patch.avatarColor ?? updated.avatarColor;
        const finalUpdated = resolvedColor ? { ...updated, avatarColor: resolvedColor } : updated;
        if (resolvedColor) {
          saveStoredAvatarColor(finalUpdated.id, resolvedColor);
        }
        setActor(finalUpdated);
        setPersonnelDirectory((prev) =>
          prev.map((p) => (p.id === finalUpdated.id ? finalUpdated : p)),
        );
        if (!gateway && bearerTokenRef.current) {
          saveStoredWebSession(bearerTokenRef.current, finalUpdated);
        }
        return finalUpdated;
      }, 'User profile information updated.'),
    updateUserPreferences: async (patch) =>
      runAction(async () => {
        const merged: UserPreferences = { ...userPreferences, ...patch };
        setUserPreferences(merged);
        saveStoredUserPrefs(merged);
        if (actor && activeGateway.updatePreferences) {
          const res = await activeGateway.updatePreferences(patch);
          setActor(res.user);
          setUserPreferences(res.preferences);
          saveStoredUserPrefs(res.preferences);
          if (!gateway && bearerTokenRef.current) {
            saveStoredWebSession(bearerTokenRef.current, res.user);
          }
          return res.preferences;
        }
        if (actor) {
          const nextActor: Personnel = { ...actor, preferences: merged };
          setActor(nextActor);
          if (!gateway && bearerTokenRef.current) {
            saveStoredWebSession(bearerTokenRef.current, nextActor);
          }
        }
        return merged;
      }, 'User preferences saved.'),
    loadActiveSessions: async () =>
      runAction(async () => {
        const sessions = await activeGateway.listActiveSessions();
        setActiveSessions(sessions);
      }),
    revokeOtherSessions: async () =>
      runAction(async () => {
        await activeGateway.revokeOtherSessions();
        setActiveSessions((prev) => prev.filter((s) => s.current));
      }, 'Other sessions revoked.'),
    changePassword: async (currentPassword, newPassword) =>
      runAction(async () => {
        await activeGateway.changePassword(currentPassword, newPassword);
        setActor((prev) => (prev ? { ...prev, mustChangePassword: false } : prev));
      }, 'Password updated across Tracely.'),
    loadPendingUsers: async () => {
      if (!actor || !canApproveAccounts || !activeGateway.listPendingUsers) {
        setPendingApprovals([]);
        return;
      }
      await runAction(async () => {
        const pending = await activeGateway.listPendingUsers!();
        setPendingApprovals(pending);
      });
    },
    approvePendingUser: async (userId) => {
      if (!activeGateway.approveUser) return;
      await runAction(async () => {
        const approved = await activeGateway.approveUser!(userId);
        setPendingApprovals((prev) => prev.filter((u) => u.id !== userId));
        setPersonnelDirectory((prev) =>
          prev.some((p) => p.id === approved.id) ? prev : [...prev, approved],
        );
      }, 'Account approved — user can now sign in.');
    },
    rejectPendingUser: async (userId, reason) => {
      if (!activeGateway.rejectUser) return;
      await runAction(async () => {
        await activeGateway.rejectUser!(userId, reason);
        setPendingApprovals((prev) => prev.filter((u) => u.id !== userId));
      }, 'Registration request rejected.');
    },
    loadAdminUsers: async () => {
      if (!actor || !canApproveAccounts || !activeGateway.listAdminUsers) {
        setAdminUsers([]);
        return;
      }
      await runAction(async () => {
        const list = await activeGateway.listAdminUsers!();
        setAdminUsers(list);
      });
    },
    createAdminUser: async (payload) =>
      runAction(async () => {
        if (!activeGateway.createAdminUser) {
          const office = offices.find((o) => o.id === payload.officeId) ??
            offices[0] ?? { id: 'off-1', code: 'HQ', name: 'Main Office' };
          const parts = payload.fullName.trim().split(/\s+/).filter(Boolean);
          const initials =
            parts.length === 0
              ? 'SD'
              : parts.length === 1
                ? parts[0].slice(0, 2).toUpperCase()
                : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
          const fallbackUser: Personnel = {
            id: `usr-${Date.now()}`,
            fullName: payload.fullName.trim(),
            employeeId: payload.employeeId.trim().toUpperCase(),
            email: payload.email.trim().toLowerCase(),
            position: payload.position.trim(),
            role: payload.role,
            roleLabel: payload.role.replace(/_/g, ' '),
            office,
            availability: 'available',
            active: true,
            approvalStatus: 'approved',
            initials,
          };
          setAdminUsers((prev) => [fallbackUser, ...prev]);
          setPersonnelDirectory((prev) => [fallbackUser, ...prev]);
          return fallbackUser;
        }
        const created = await activeGateway.createAdminUser(payload);
        setAdminUsers((prev) => [created, ...prev]);
        setPersonnelDirectory((prev) => [created, ...prev]);
        return created;
      }, `Provisioned verified account for ${payload.fullName}.`),
    updateAdminUser: async (userId, patch) => {
      if (!activeGateway.updateAdminUser) return;
      await runAction(async () => {
        const updated = await activeGateway.updateAdminUser!(userId, patch);
        setAdminUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
        setPersonnelDirectory((prev) =>
          updated.active === false
            ? prev.filter((p) => p.id !== userId)
            : prev.some((p) => p.id === userId)
              ? prev.map((p) => (p.id === userId ? updated : p))
              : [...prev, updated],
        );
      }, patch.active === false ? 'Account deactivated and active sessions revoked.' : patch.newPassword ? 'Account password reset and sessions revoked.' : 'Personnel assignment updated.');
    },
    createAdminOffice: async (payload) => {
      if (!activeGateway.createAdminOffice) return;
      await runAction(async () => {
        const created = await activeGateway.createAdminOffice!(payload);
        setOffices((prev) => [...prev, created]);
      }, `Office ${payload.code.toUpperCase()} added to directory.`);
    },
    updateAdminOffice: async (officeId, patch) => {
      if (!activeGateway.updateAdminOffice) return;
      await runAction(async () => {
        const updated = await activeGateway.updateAdminOffice!(officeId, patch);
        setOffices((prev) => prev.map((o) => (o.id === officeId ? updated : o)));
      }, 'Office details updated.');
    },
    updateAdminCategory: async (categoryId, patch) => {
      await runAction(async () => {
        if (activeGateway.updateAdminCategory) {
          const updated = await activeGateway.updateAdminCategory(categoryId, patch);
          setCategories((prev) => prev.map((c) => (c.id === categoryId ? updated : c)));
          return;
        }
        setCategories((prev) =>
          prev.map((c) =>
            c.id === categoryId
              ? {
                  ...c,
                  name: patch.name?.trim() || c.name,
                  code: patch.code?.trim().toUpperCase() || c.code,
                }
              : c,
          ),
        );
      }, 'Global category updated.');
    },
    deleteAdminCategory: async (categoryId) => {
      await runAction(async () => {
        if (activeGateway.deleteAdminCategory) {
          await activeGateway.deleteAdminCategory(categoryId);
        }
        setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      }, 'Unused global category removed.');
    },
    updateSecurityPrefs: (patch) => {
      setSecurityPrefs((prev) => ({ ...prev, ...patch }));
      notify('success', 'Device security preferences updated.');
    },
    clearRecentScans: () => {
      setRecentScans([]);
      try {
        window.localStorage.removeItem(STORAGE_KEY_RECENT_SCANS);
      } catch {
        // Ignore storage restriction
      }
    },
  };

  return <WebAppContext.Provider value={value}>{children}</WebAppContext.Provider>;
};

export function useWebApp(): WebContextValue {
  const ctx = useContext(WebAppContext);
  if (!ctx) throw new Error('useWebApp must be used inside WebAppProvider.');
  return ctx;
}
