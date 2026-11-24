import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import { AUTH_REQUIRED, ApiConfig } from '../config/ApiConfig';
import { AuditLogEntry } from '../domain/entities/AuditLogEntry';
import { Document } from '../domain/entities/Document';
import { DocumentCategory } from '../domain/entities/DocumentCategory';
import { OfflineAttachment } from '../domain/entities/OfflineAttachment';
import {
  DEFAULT_USER_WORKFLOW_PREFERENCES,
  OfficeSummary,
  Personnel,
  ProfileUpdatePayload,
  UserWorkflowPreferences,
} from '../domain/entities/Personnel';
import {
  ActiveDeviceSession,
  computeWorkloadSummary,
  DEFAULT_SECURITY_PREFERENCES,
  UserSecurityPreferences,
  WorkloadSummary,
} from '../domain/entities/UserSecurityProfile';
import {
  AvailabilityStatus,
  ConfidentialityTier,
  DocumentCopyFormat,
  SystemRole,
} from '../domain/enums/DomainEnums';
import {
  IImageSanitizer,
  NativeImageSanitizer,
  SanitizedImageResult,
} from '../domain/security/ImageSanitizer';
import { QrPayloadParser, QrResolutionResult } from '../domain/security/QrPayload';
import {
  DocumentTrackingPolicy,
  DocumentTrackingSnapshot,
} from '../domain/security/AccessPolicy';
import { DeviceNotificationBridge } from '../domain/security/DeviceNotificationBridge';
import { DeviceSecurityBridge } from '../domain/security/DeviceSecurityBridge';
import { ApiClient, ApiError } from '../network/ApiClient';
import type { IAuditRepository } from '../repositories/contracts/IAuditRepository';
import type {
  IAuthRepository,
  PendingApprovalStatus,
  PendingRegistrationRecord,
  PendingRegistrationSummary,
} from '../repositories/contracts/IAuthRepository';
import type {
  CommentVisibility,
  CreateDigitalDocumentPayload,
  DocumentComment,
  ForwardDocumentPayload,
  IDocumentRepository,
  PresignedDownloadGrant,
  PrivacySafeNotification,
  RegisterHardCopyPayload,
  UploadRevisionPayload,
} from '../repositories/contracts/IDocumentRepository';
import type { IOfflineQueueStore } from '../repositories/contracts/IOfflineQueueStore';
import type {
  ISecureTokenStore,
  SecureSessionRecord,
} from '../repositories/contracts/ISecureTokenStore';
import type { ISecurityPrefsStore } from '../repositories/contracts/ISecurityPrefsStore';
import { HttpAuditRepository } from '../repositories/http/HttpAuditRepository';
import { HttpAuthRepository } from '../repositories/http/HttpAuthRepository';
import { HttpDocumentRepository } from '../repositories/http/HttpDocumentRepository';
import { AsyncOfflineQueueStore } from '../repositories/storage/AsyncOfflineQueueStore';
import { AsyncSecurityPrefsStore } from '../repositories/storage/AsyncSecurityPrefsStore';
import { AsyncWorkspaceCacheStore } from '../repositories/storage/AsyncWorkspaceCacheStore';
import { KeychainSecureTokenStore } from '../repositories/storage/KeychainSecureTokenStore';
import {
  AuthenticatedSessionOutcome,
  AuthSessionService,
  RegisterAccountInput,
  RegistrationOutcome,
} from '../services/AuthSessionService';

export type { RegisterAccountInput, RegistrationOutcome };
import { CategoryService } from '../services/CategoryService';
import { DocumentRoutingService } from '../services/DocumentRoutingService';
import { EnqueueCaptureInput, OfflineSyncService } from '../services/OfflineSyncService';
import { QrResolutionService } from '../services/QrResolutionService';
import { buildBatchItemTitle } from '../ui/utils/formatters';

export interface DigitalFileInput {
  readonly fileUri: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly sha256Checksum: string;
  readonly title?: string;
}

export interface CreateDigitalBundlePayload {
  readonly title: string;
  readonly categoryId: string;
  readonly confidentialityTier: ConfidentialityTier;
  readonly files: ReadonlyArray<DigitalFileInput>;
  readonly recipientUserId?: string | null;
  readonly remarks?: string;
  readonly routeToDelegateIfOnLeave?: boolean;
}

export type MobileTab =
  | 'dashboard'
  | 'inbox'
  | 'scanner'
  | 'send'
  | 'sent'
  | 'completed'
  | 'document'
  | 'track'
  | 'categories'
  | 'alerts'
  | 'profile'
  | 'user_profile'
  | 'settings'
  | 'pending_approval'
  | 'login';

export interface ToastAction {
  readonly label: string;
  readonly onPress: () => void;
}

export interface ToastMessage {
  readonly id: number;
  readonly tone: 'success' | 'error' | 'info';
  readonly text: string;
  readonly action?: ToastAction;
}

export interface ScannerLaunchTarget {
  readonly documentId: string;
  readonly fromOfficeCode: string;
  readonly fromOfficeName: string;
  readonly fromUserName?: string;
  readonly copyFormat: DocumentCopyFormat;
  readonly autoStartCamera: boolean;
}

export interface RecentScanEntry {
  readonly id: string;
  readonly kind: QrResolutionResult['kind'];
  readonly trackingCode: string;
  readonly label: string;
  readonly subtitle: string;
  readonly documentId?: string;
  readonly scannedAt: string;
}

export interface AppDependencies {
  readonly apiConfig: ApiConfig;
  readonly tokenStore: ISecureTokenStore;
  readonly queueStore: IOfflineQueueStore;
  readonly securityPrefsStore?: ISecurityPrefsStore;
  readonly authRepo: IAuthRepository;
  readonly docRepo: IDocumentRepository;
  readonly auditRepo: IAuditRepository;
  readonly imageSanitizer: IImageSanitizer;
  readonly disableNetInfoListener?: boolean;
  readonly skipOnboarding?: boolean;
  readonly initialTab?: MobileTab;
}

function createDefaultDependencies(onUnauthorized: () => void): AppDependencies {
  const apiConfig = new ApiConfig();
  const tokenStore = new KeychainSecureTokenStore();
  const queueStore = new AsyncOfflineQueueStore();
  const securityPrefsStore = new AsyncSecurityPrefsStore();
  const apiClient = new ApiClient({
    config: apiConfig,
    tokenStore,
    onUnauthorized,
  });

  return {
    apiConfig,
    tokenStore,
    queueStore,
    securityPrefsStore,
    authRepo: new HttpAuthRepository(apiClient),
    docRepo: new HttpDocumentRepository(apiClient),
    auditRepo: new HttpAuditRepository(apiClient),
    imageSanitizer: new NativeImageSanitizer(),
  };
}

export interface AppContextValue {
  bootstrapping: boolean;
  showOnboarding: boolean;
  requireAuth: boolean;
  pendingRegistration: PendingRegistrationRecord | null;
  prefillLoginIdentifier: string;
  checkPendingRegistrationStatus(silent?: boolean): Promise<PendingApprovalStatus | null>;
  proceedFromPendingToLogin(clearRecord?: boolean): void;
  dismissPendingRegistration(): void;
  isBusy: boolean;
  isRefreshing: boolean;
  apiBaseUrl: string;
  actor: Personnel | null;
  sessionMetadata: SecureSessionRecord | null;
  personnelDirectory: ReadonlyArray<Personnel>;
  offices: ReadonlyArray<OfficeSummary>;
  activeTab: MobileTab;
  selectedDocumentId: string | null;
  isOnline: boolean;
  toast: ToastMessage | null;
  documents: ReadonlyArray<Document>;
  trackedSnapshots: ReadonlyArray<DocumentTrackingSnapshot>;
  categories: ReadonlyArray<DocumentCategory>;
  offlineQueue: ReadonlyArray<OfflineAttachment>;
  pendingOfflineCount: number;
  notifications: ReadonlyArray<PrivacySafeNotification>;
  unreadNotificationCount: number;
  auditLogs: ReadonlyArray<AuditLogEntry>;
  activeSessions: ReadonlyArray<ActiveDeviceSession>;
  securityPrefs: UserSecurityPreferences;
  userPreferences: UserWorkflowPreferences;
  workloadSummary: WorkloadSummary;
  scannerTorchOn: boolean;
  scannerPaused: boolean;
  scannerTarget: ScannerLaunchTarget | null;
  recentScans: ReadonlyArray<RecentScanEntry>;
  sidebarOpen: boolean;
  canApproveAccounts: boolean;
  pendingApprovals: ReadonlyArray<Personnel>;
  adminUsers: ReadonlyArray<Personnel>;
  realtimeStatus: 'live' | 'polling';
  realtimeTick: number;
  fcmConfigured: boolean;
  firstVisitSkeletonMs: number;
  hasScreenBeenOpened(key: string): boolean;
  markScreenOpened(key: string): void;
  setActiveTab(tab: MobileTab): void;
  goBack(): boolean;
  openScannerForDocument(document: Document, autoStartCamera?: boolean): void;
  clearScannerTarget(): void;
  completeOnboarding(targetTab?: MobileTab): Promise<void>;
  openOnboarding(): void;
  openSidebar(): void;
  closeSidebar(): void;
  toggleSidebar(): void;
  setScannerTorchOn(enabled: boolean): void;
  setScannerPaused(paused: boolean): void;
  clearRecentScans(): void;
  openDocument(documentId: string): void;
  closeDocument(): void;
  clearToast(): void;
  notify(tone: ToastMessage['tone'], text: string, action?: ToastAction): void;
  updateApiBaseUrl(url: string): Promise<void>;
  signIn(identifier: string, password: string): Promise<void>;
  registerAccount(input: RegisterAccountInput): Promise<RegistrationOutcome>;
  requestPasswordReset(identifier: string): Promise<{ message: string; devResetCode?: string }>;
  confirmPasswordReset(
    identifier: string,
    resetCode: string,
    newPassword: string,
    confirmPassword: string,
  ): Promise<string>;
  signOutAndWipeCache(): Promise<void>;
  refreshWorkspace(): Promise<void>;
  refreshDocument(documentId: string): Promise<void>;
  updateAvailability(
    status: AvailabilityStatus,
    delegateId?: string | null,
    availabilityUntil?: string | null,
  ): Promise<void>;
  updateProfile(patch: ProfileUpdatePayload): Promise<Personnel>;
  updateUserPreferences(patch: Partial<UserWorkflowPreferences>): Promise<UserWorkflowPreferences>;
  loadActiveSessions(): Promise<void>;
  revokeOtherSessions(): Promise<void>;
  changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<void>;
  updateSecurityPrefs(patch: Partial<UserSecurityPreferences>): Promise<void>;
  acknowledgeReceipt(
    document: Document,
    proofImage?: SanitizedImageResult | null,
    verificationCode?: string,
  ): Promise<void>;
  unlockSoftCopyWithPassword(document: Document, password: string): Promise<Document>;
  batchAcknowledgeReceipts(
    items: ReadonlyArray<
      Document | { readonly document: Document; readonly verificationCode?: string }
    >,
  ): Promise<number>;
  sendDigitalDocument(payload: CreateDigitalDocumentPayload): Promise<Document>;
  sendDigitalDocumentBundle(payload: CreateDigitalBundlePayload): Promise<Document>;
  sendDigitalDocumentBatch(payload: CreateDigitalBundlePayload): Promise<ReadonlyArray<Document>>;
  registerHardCopyDocument(payload: RegisterHardCopyPayload): Promise<Document>;
  forwardDocument(document: Document, payload: ForwardDocumentPayload): Promise<void>;
  batchForwardDocuments(
    documents: ReadonlyArray<Document>,
    payload: Omit<ForwardDocumentPayload, 'documentId'>,
  ): Promise<number>;
  recallTransfer(document: Document): Promise<void>;
  updateDocumentDetails(
    document: Document,
    patch: {
      title?: string;
      categoryId?: string;
      confidentialityTier?: ConfidentialityTier;
      physicalReference?: string | null;
      physicalPageCount?: number | null;
    },
  ): Promise<void>;
  declineMisrouted(document: Document, reason: string): Promise<void>;
  returnForRevision(document: Document, remarks: string): Promise<void>;
  completeDocument(
    document: Document,
    status: 'approved' | 'archived',
    remarks?: string,
  ): Promise<void>;
  listDocumentComments(documentId: string): Promise<ReadonlyArray<DocumentComment>>;
  addDocumentComment(
    documentId: string,
    body: string,
    visibility: CommentVisibility,
  ): Promise<DocumentComment>;
  uploadRevision(document: Document, payload: UploadRevisionPayload): Promise<void>;
  issuePresignedView(document: Document, versionNumber: number): Promise<PresignedDownloadGrant>;
  issueProofPhotoView(documentId: string, transactionId: string): Promise<PresignedDownloadGrant>;
  trackDocumentByCode(trackingCode: string): Promise<DocumentTrackingSnapshot>;
  scanQr(rawValue: string): Promise<QrResolutionResult>;
  sanitizeCapturedPhoto(input: {
    uri: string;
    fileName?: string | null;
    originalBytes?: number | null;
  }): Promise<SanitizedImageResult>;
  computeSha256FromUri(uri: string): Promise<string>;
  captureAndQueuePhoto(input: Omit<EnqueueCaptureInput, 'isOnline'>): Promise<OfflineAttachment>;
  retryOfflineQueue(): Promise<void>;
  findSimilarCategories(candidateName: string): ReadonlyArray<DocumentCategory>;
  declareCategory(name: string, code: string): Promise<DocumentCategory>;
  updateAdminCategory(
    categoryId: string,
    patch: { name?: string; code?: string },
  ): Promise<DocumentCategory>;
  deleteAdminCategory(categoryId: string): Promise<void>;
  markNotificationRead(notificationId: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;
  loadAuditLogs(): Promise<void>;
  loadPendingUsers(): Promise<void>;
  approvePendingUser(userId: string): Promise<void>;
  rejectPendingUser(userId: string, reason?: string): Promise<void>;
  loadAdminUsers(): Promise<void>;
  createAdminUser(payload: {
    fullName: string;
    employeeId: string;
    email: string;
    position: string;
    officeId: string;
    role: string;
    password: string;
  }): Promise<Personnel>;
  updateAdminUser(
    userId: string,
    patch: {
      fullName?: string;
      email?: string;
      role?: string;
      officeId?: string;
      position?: string;
      availability?: AvailabilityStatus;
      active?: boolean;
      newPassword?: string;
    },
  ): Promise<void>;
  createAdminOffice(payload: { code: string; name: string }): Promise<void>;
  updateAdminOffice(officeId: string, patch: { code?: string; name?: string }): Promise<void>;
}

const ONBOARDING_STORAGE_KEY = '@sdo_doctrack/onboarding_done';
const RECENT_SCANS_STORAGE_KEY = '@sdo_doctrack/recent_scans';
const USER_PREFS_STORAGE_KEY = '@sdo_doctrack/user_preferences';
const PENDING_REGISTRATION_STORAGE_KEY = '@sdo_doctrack/mobile_pending_registration';
const AVATAR_COLOR_STORAGE_PREFIX = '@tracely/avatar_color_v1:';

function parseStoredPendingRegistration(raw: string | null): PendingRegistrationRecord | null {
  if (!raw) return null;
  try {
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
const WORKSPACE_POLL_MS = 15_000;
const REALTIME_PULSE_MS = 3_000;

async function readStoredAvatarColor(userId: string): Promise<string | null> {
  try {
    const val = await AsyncStorage.getItem(`${AVATAR_COLOR_STORAGE_PREFIX}${userId}`);
    return val && /^#[0-9A-Fa-f]{6}$/.test(val) ? val : null;
  } catch {
    return null;
  }
}

async function saveStoredAvatarColor(userId: string, hex: string): Promise<void> {
  try {
    await AsyncStorage.setItem(`${AVATAR_COLOR_STORAGE_PREFIX}${userId}`, hex);
  } catch {
    // Non-fatal persistence fallback
  }
}

function isAccountApprover(user: Personnel | null): boolean {
  if (!user) return false;
  if (user.role === SystemRole.ICT_ADMIN || user.role === SystemRole.RECORDS_OFFICER) {
    return true;
  }
  const officeCode = user.office.code.toUpperCase();
  return (
    user.role === SystemRole.UNIT_HEAD &&
    (officeCode === 'HR' ||
      officeCode === 'EXEC' ||
      officeCode === 'ADMIN' ||
      officeCode === 'OSDS' ||
      officeCode === 'ICT')
  );
}

function parseStoredRecentScans(raw: string | null): ReadonlyArray<RecentScanEntry> {
  if (!raw) return [];
  try {
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

const AppServiceContext = createContext<AppContextValue | null>(null);
const DEFAULT_MOBILE_SKELETON_MS = typeof jest !== 'undefined' ? 0 : 260;

export const AppServiceProvider: React.FC<{
  children: React.ReactNode;
  dependencies?: AppDependencies;
  requireAuth?: boolean;
  firstVisitSkeletonMs?: number;
}> = ({
  children,
  dependencies,
  requireAuth = AUTH_REQUIRED,
  firstVisitSkeletonMs = DEFAULT_MOBILE_SKELETON_MS,
}) => {
  const [bootstrapping, setBootstrapping] = useState(true);
  const openedScreensRef = useRef<Set<string>>(new Set());
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actor, setActor] = useState<Personnel | null>(null);
  const [sessionMetadata, setSessionMetadata] = useState<SecureSessionRecord | null>(null);
  const [pendingRegistration, setPendingRegistration] =
    useState<PendingRegistrationRecord | null>(null);
  const [prefillLoginIdentifier, setPrefillLoginIdentifier] = useState<string>('');
  const pendingRegistrationRef = useRef<PendingRegistrationRecord | null>(null);
  pendingRegistrationRef.current = pendingRegistration;
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const defaultLandingTab: MobileTab =
    dependencies?.initialTab ?? (dependencies ? 'inbox' : 'dashboard');
  const [activeTab, setActiveTab] = useState<MobileTab>(defaultLandingTab);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const navHistoryRef = useRef<MobileTab[]>([]);
  const activeTabRef = useRef<MobileTab>(defaultLandingTab);
  const selectedDocumentIdRef = useRef<string | null>(null);
  const sidebarOpenRef = useRef<boolean>(false);
  activeTabRef.current = activeTab;
  selectedDocumentIdRef.current = selectedDocumentId;
  const [isOnline, setIsOnline] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [offices, setOffices] = useState<ReadonlyArray<OfficeSummary>>([]);
  const [personnelDirectory, setPersonnelDirectory] = useState<ReadonlyArray<Personnel>>([]);
  const [documents, setDocuments] = useState<ReadonlyArray<Document>>([]);
  const [trackedSnapshots, setTrackedSnapshots] = useState<
    ReadonlyArray<DocumentTrackingSnapshot>
  >([]);
  const [categories, setCategories] = useState<ReadonlyArray<DocumentCategory>>([]);
  const [offlineQueue, setOfflineQueue] = useState<ReadonlyArray<OfflineAttachment>>([]);
  const [notifications, setNotifications] = useState<ReadonlyArray<PrivacySafeNotification>>([]);
  const [auditLogs, setAuditLogs] = useState<ReadonlyArray<AuditLogEntry>>([]);
  const [activeSessions, setActiveSessions] = useState<ReadonlyArray<ActiveDeviceSession>>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ReadonlyArray<Personnel>>([]);
  const [adminUsers, setAdminUsers] = useState<ReadonlyArray<Personnel>>([]);
  const [realtimeStatus, setRealtimeStatus] = useState<'live' | 'polling'>('polling');
  const [realtimeTick, setRealtimeTick] = useState(0);
  const [fcmConfigured, setFcmConfigured] = useState(false);
  const realtimeCursorRef = useRef<number>(0);
  const [securityPrefs, setSecurityPrefs] = useState<UserSecurityPreferences>(
    DEFAULT_SECURITY_PREFERENCES,
  );
  const [userPreferences, setUserPreferences] = useState<UserWorkflowPreferences>(
    DEFAULT_USER_WORKFLOW_PREFERENCES,
  );
  const [scannerTorchOn, setScannerTorchOn] = useState(false);
  const [scannerPaused, setScannerPaused] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<ScannerLaunchTarget | null>(null);
  const [recentScans, setRecentScans] = useState<ReadonlyArray<RecentScanEntry>>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  sidebarOpenRef.current = sidebarOpen;
  const lastNotifSyncKeyRef = useRef<string>('');
  const [notificationsHydratedActorId, setNotificationsHydratedActorId] = useState<string | null>(
    null,
  );
  const notifBaselineSyncedActorRef = useRef<string | null>(null);

  const navigateToTab = useCallback(
    (nextTab: MobileTab) => {
      setSidebarOpen(false);
      setSelectedDocumentId(null);
      if (nextTab !== 'scanner') {
        setScannerTarget(null);
      }
      const current = activeTabRef.current;
      if (nextTab === defaultLandingTab) {
        navHistoryRef.current = [];
      } else if (nextTab !== current && current !== 'login') {
        const stack = navHistoryRef.current;
        if (stack[stack.length - 1] !== current) {
          navHistoryRef.current = [...stack.slice(-24), current];
        }
      }
      setActiveTab(nextTab);
    },
    [defaultLandingTab],
  );

  const goBack = useCallback((): boolean => {
    if (sidebarOpenRef.current) {
      setSidebarOpen(false);
      return true;
    }
    if (selectedDocumentIdRef.current) {
      setSelectedDocumentId(null);
      if (activeTabRef.current === 'document') {
        const prevTab = navHistoryRef.current.pop() ?? defaultLandingTab;
        setActiveTab(prevTab);
      }
      return true;
    }
    if (navHistoryRef.current.length > 0) {
      const prevTab = navHistoryRef.current.pop()!;
      if (prevTab !== 'scanner') {
        setScannerTarget(null);
      }
      setActiveTab(prevTab);
      return true;
    }
    if (activeTabRef.current !== defaultLandingTab) {
      if (defaultLandingTab !== 'scanner') {
        setScannerTarget(null);
      }
      setActiveTab(defaultLandingTab);
      return true;
    }
    return false;
  }, [defaultLandingTab]);

  const hasScreenBeenOpened = useCallback(
    (key: string) => openedScreensRef.current.has(key),
    [],
  );

  const markScreenOpened = useCallback((key: string) => {
    openedScreensRef.current.add(key);
  }, []);

  const notify = useCallback(
    (tone: ToastMessage['tone'], text: string, action?: ToastAction) => {
      setToast({ id: Date.now(), tone, text, action });
    },
    [],
  );

  const clearToast = useCallback(() => setToast(null), []);

  const handleUnauthorized = useCallback(() => {
    setActor(null);
    setSessionMetadata(null);
    setDocuments([]);
    setNotifications([]);
    setNotificationsHydratedActorId(null);
    notifBaselineSyncedActorRef.current = null;
    lastNotifSyncKeyRef.current = '';
    setSelectedDocumentId(null);
    notify('error', 'Your session expired. Please sign in again.');
  }, [notify]);

  const services = useMemo(() => {
    const deps = dependencies ?? createDefaultDependencies(handleUnauthorized);
    return {
      deps,
      prefsStore: deps.securityPrefsStore ?? new AsyncSecurityPrefsStore(),
      authService: new AuthSessionService(deps.authRepo, deps.tokenStore),
      routingService: new DocumentRoutingService(deps.docRepo),
      qrService: new QrResolutionService(deps.docRepo),
      categoryService: new CategoryService(deps.docRepo),
      offlineService: new OfflineSyncService(deps.docRepo, deps.queueStore),
    };
  }, [dependencies, handleUnauthorized]);

  const hydrateWorkspace = useCallback(
    async (currentActor: Personnel) => {
      try {
        // Stagger requests into two small batches to prevent socket contention on local PHP CLI server
        const [docs, tracked, alerts] = await Promise.all([
          services.routingService.listAccessibleDocuments(currentActor),
          services.routingService.listTrackedDocuments(currentActor),
          services.deps.docRepo.listNotifications(),
        ]);
        const [cats, officeList, staffList] = await Promise.all([
          services.categoryService.listCategories(),
          services.routingService.listOffices(),
          services.routingService.listPersonnel(),
        ]);
        setDocuments(docs);
        setTrackedSnapshots(tracked);
        setNotifications(alerts);
        setNotificationsHydratedActorId(currentActor.id);
        setCategories(cats);
        setOffices(officeList);
        setPersonnelDirectory(staffList);
        const freshSelf = staffList.find((p) => p.id === currentActor.id);
        if (freshSelf) {
          const savedColor = await readStoredAvatarColor(freshSelf.id);
          if (savedColor && freshSelf.avatarColor === '#0D3472') {
            freshSelf.updateProfileInfo({ avatarColor: savedColor });
          } else if (freshSelf.avatarColor && freshSelf.avatarColor !== '#0D3472') {
            saveStoredAvatarColor(freshSelf.id, freshSelf.avatarColor).catch(() => {});
          }
          setActor(freshSelf);
          setUserPreferences(freshSelf.preferences);
        }
        AsyncWorkspaceCacheStore.save(currentActor.id, {
          trackedSnapshots: tracked,
          categories: cats,
          offices: officeList,
        }).catch(() => {});
      } catch (err) {
        const cached = await AsyncWorkspaceCacheStore.load(currentActor.id);
        if (cached) {
          setTrackedSnapshots(cached.trackedSnapshots);
          setCategories(cached.categories);
          setOffices(cached.offices);
          notify('info', 'Offline mode — showing cached office tracking & categories.');
          return;
        }
        throw err;
      }
    },
    [notify, services],
  );

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const loadedUrl = await services.deps.apiConfig.loadSavedBaseUrl();
        const persistedQueue = await services.offlineService.loadPersistedQueue();
        const loadedPrefs = await services.prefsStore.loadPrefs();
        const savedScans = parseStoredRecentScans(
          await AsyncStorage.getItem(RECENT_SCANS_STORAGE_KEY).catch(() => null),
        );
        const onboardingDone = services.deps.skipOnboarding
          ? true
          : (await AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)) === 'true';
        if (!mounted) return;
        setApiBaseUrl(loadedUrl);
        setOfflineQueue(persistedQueue);
        setSecurityPrefs(loadedPrefs);
        setRecentScans(savedScans);
        DeviceSecurityBridge.applyScreenshotShield(loadedPrefs.screenshotShieldEnabled);
        setShowOnboarding(!onboardingDone);

        const restored = await services.authService.restoreSession();
        if (!mounted) return;
        if (restored) {
          const savedColor = await readStoredAvatarColor(restored.actor.id);
          if (savedColor && restored.actor.avatarColor === '#0D3472') {
            restored.actor.updateProfileInfo({ avatarColor: savedColor });
          }
          setActor(restored.actor);
          setSessionMetadata(restored.session);
          setPendingRegistration(null);
          if (!services.deps.disableNetInfoListener) {
            DeviceNotificationBridge.requestPermission().catch(() => false);
          }
          await hydrateWorkspace(restored.actor);
        } else if (!dependencies) {
          const savedPending = parseStoredPendingRegistration(
            await AsyncStorage.getItem(PENDING_REGISTRATION_STORAGE_KEY).catch(() => null),
          );
          if (mounted && savedPending) {
            setPendingRegistration(savedPending);
          }
        }
      } catch {
        // Unauthenticated or unreachable at boot: keep user cleanly at LoginScreen
      } finally {
        if (mounted) setBootstrapping(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [services, hydrateWorkspace]);

  useEffect(() => {
    if (services.deps.disableNetInfoListener) return;
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setIsOnline(online);
      if (online && actor && services.offlineService.getPendingCount() > 0) {
        services.offlineService.retryAllPending(true).then(() => {
          setOfflineQueue(services.offlineService.listQueue());
        });
      }
    });
    return () => unsubscribe();
  }, [services, actor]);

  useEffect(() => {
    if (services.deps.disableNetInfoListener) return;

    const syncOnActive = () => {
      if (!isOnline) return;
      if (actor && services.offlineService.getPendingCount() > 0) {
        services.offlineService.retryAllPending(true).then(() => {
          setOfflineQueue(services.offlineService.listQueue());
        });
      }
      if (actor) {
        hydrateWorkspace(actor).catch(() => {});
      }
    };

    const appSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncOnActive();
      }
    });

    const hasPulse = typeof services.deps.docRepo.pollRealtimePulse === 'function';
    let alive = true;

    const triggerLiveRefresh = () => {
      if (!actor) return;
      hydrateWorkspace(actor)
        .then(() => {
          if (alive) setRealtimeTick((t) => t + 1);
        })
        .catch(() => {});
    };

    const runPulse = async () => {
      if (!alive || !actor || !isOnline || AppState.currentState !== 'active') return;
      if (!services.deps.docRepo.pollRealtimePulse) return;
      try {
        const res = await services.deps.docRepo.pollRealtimePulse(realtimeCursorRef.current);
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

    // Seed initial cursor immediately so the next backend event syncs live without waiting
    if (actor && isOnline && hasPulse) {
      runPulse().catch(() => {});
    }

    const pulseId =
      actor && isOnline && hasPulse
        ? setInterval(() => {
            runPulse().catch(() => {});
          }, REALTIME_PULSE_MS)
        : null;

    const intervalId =
      actor && isOnline
        ? setInterval(() => {
            if (AppState.currentState !== 'active') return;
            triggerLiveRefresh();
          }, WORKSPACE_POLL_MS)
        : null;

    return () => {
      alive = false;
      appSub.remove();
      if (pulseId !== null) clearInterval(pulseId);
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [services, actor, isOnline, hydrateWorkspace]);

  useEffect(() => {
    // Do not wipe device notifications or announced history before session restoration finishes
    if (bootstrapping) {
      return;
    }
    if (!actor) {
      notifBaselineSyncedActorRef.current = null;
      if (lastNotifSyncKeyRef.current !== '__cleared__') {
        lastNotifSyncKeyRef.current = '__cleared__';
        DeviceNotificationBridge.clearNotifications();
      }
      return;
    }
    if (notificationsHydratedActorId !== actor.id) {
      return;
    }
    const unread = notifications.filter((n) => !n.read);
    const showDetails = !securityPrefs.hideLockScreenTitles;
    const isInitialSessionSync = notifBaselineSyncedActorRef.current !== actor.id;
    const syncKey = `${actor.id}:${showDetails ? '1' : '0'}:${isInitialSessionSync ? 'init' : 'live'}:${unread.map((n) => n.id).join(',')}`;
    if (syncKey === lastNotifSyncKeyRef.current) {
      return;
    }
    lastNotifSyncKeyRef.current = syncKey;
    if (isInitialSessionSync) {
      notifBaselineSyncedActorRef.current = actor.id;
    }
    DeviceNotificationBridge.syncNotifications(
      unread.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        lockScreenPreview: n.lockScreenPreview,
        authenticatedDetail: n.authenticatedDetail,
      })),
      unread.length,
      showDetails,
      isInitialSessionSync,
    );
  }, [
    actor,
    bootstrapping,
    notifications,
    notificationsHydratedActorId,
    securityPrefs.hideLockScreenTitles,
  ]);

  const runAsyncAction = useCallback(
    async <T,>(fn: () => Promise<T>, successMessage?: string): Promise<T> => {
      setIsBusy(true);
      try {
        const result = await fn();
        if (successMessage) notify('success', successMessage);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Request failed.';
        notify('error', message);
        throw err;
      } finally {
        setIsBusy(false);
      }
    },
    [notify],
  );

  const trackingPolicy = useMemo(() => new DocumentTrackingPolicy(), []);

  const upsertDocument = useCallback(
    (updated: Document) => {
      setDocuments((prev) => {
        const idx = prev.findIndex((d) => d.id === updated.id);
        if (idx === -1) return [updated, ...prev];
        const next = [...prev];
        next[idx] = updated;
        return next;
      });
      if (actor) {
        const snap = trackingPolicy.toTrackingSnapshot(actor, updated);
        if (snap) {
          setTrackedSnapshots((prev) => {
            const idx = prev.findIndex((s) => s.documentId === snap.documentId);
            if (idx === -1) return [snap, ...prev];
            const next = [...prev];
            next[idx] = snap;
            return next;
          });
        }
      }
    },
    [actor, trackingPolicy],
  );

  const applyAuthenticatedSession = useCallback(
    async (auth: AuthenticatedSessionOutcome) => {
      navHistoryRef.current = [];
      setActor(auth.actor);
      setSessionMetadata(auth.session);
      setActiveTab(defaultLandingTab);
      setSelectedDocumentId(null);
      if (!services.deps.disableNetInfoListener) {
        DeviceNotificationBridge.requestPermission().catch(() => false);
      }
      await hydrateWorkspace(auth.actor);
    },
    [defaultLandingTab, hydrateWorkspace, services.deps.disableNetInfoListener],
  );

  const workloadSummary = useMemo(
    () => computeWorkloadSummary(actor, documents, trackedSnapshots),
    [actor, documents, trackedSnapshots],
  );

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
          subtitle: resolved.unlockedViaSync
            ? `Unlocked & synced with Tracely Web · ${resolved.document.currentOffice.name}`
            : `In ${resolved.document.currentOffice.name}${
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
      AsyncStorage.setItem(RECENT_SCANS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const canApproveAccounts = useMemo(() => isAccountApprover(actor), [actor]);

  const recallTransferDocument = useCallback(
    async (document: Document) => {
      if (!actor) return;
      await runAsyncAction(async () => {
        const updated = await services.routingService.recallLatestTransfer(actor, document);
        upsertDocument(updated);
      }, 'Pending transfer recalled before acceptance.');
    },
    [actor, runAsyncAction, services.routingService, upsertDocument],
  );

  const notifyWithOptionalRecall = useCallback(
    (doc: Document, message: string) => {
      const canRecall = Boolean(actor && doc.latestTransaction?.canBeRecalledBy(actor.id));
      if (canRecall) {
        notify('success', message, {
          label: 'Recall',
          onPress: () => {
            recallTransferDocument(doc).catch(() => {});
          },
        });
      } else {
        notify('success', message);
      }
    },
    [actor, notify, recallTransferDocument],
  );

  const listDocumentCommentsStable = useCallback(
    async (documentId: string): Promise<ReadonlyArray<DocumentComment>> => {
      if (!services.deps.docRepo.listDocumentComments) return [];
      return services.deps.docRepo.listDocumentComments(documentId);
    },
    [services.deps.docRepo],
  );

  const persistPendingRegistration = useCallback(
    (next: PendingRegistrationRecord | null) => {
      setPendingRegistration(next);
      if (!dependencies) {
        if (!next) {
          AsyncStorage.removeItem(PENDING_REGISTRATION_STORAGE_KEY).catch(() => {});
        } else {
          AsyncStorage.setItem(PENDING_REGISTRATION_STORAGE_KEY, JSON.stringify(next)).catch(
            () => {},
          );
        }
      }
    },
    [dependencies],
  );

  const checkPendingRegistrationStatusStable = useCallback(
    async (silent = false): Promise<PendingApprovalStatus | null> => {
      const current = pendingRegistrationRef.current;
      if (!current) return null;
      if (!current.statusToken) {
        if (!silent) {
          notify(
            'info',
            'Your registration is awaiting administrator verification. Try signing in once approved.',
          );
        }
        return current.status;
      }
      try {
        const res = await services.authService.checkRegistrationStatus(current.statusToken);
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
            err instanceof Error ? err.message : 'Unable to check registration status.',
          );
        }
        return null;
      }
    },
    [notify, persistPendingRegistration, services.authService],
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
      setActiveTab('login');
    },
    [persistPendingRegistration],
  );

  const dismissPendingRegistrationStable = useCallback(() => {
    persistPendingRegistration(null);
    setActiveTab('login');
  }, [persistPendingRegistration]);

  const value: AppContextValue = {
    bootstrapping,
    showOnboarding,
    requireAuth,
    pendingRegistration,
    prefillLoginIdentifier,
    checkPendingRegistrationStatus: checkPendingRegistrationStatusStable,
    proceedFromPendingToLogin: proceedFromPendingToLoginStable,
    dismissPendingRegistration: dismissPendingRegistrationStable,
    isBusy,
    isRefreshing,
    apiBaseUrl,
    actor,
    sessionMetadata,
    personnelDirectory,
    offices,
    activeTab,
    selectedDocumentId,
    isOnline,
    toast,
    documents,
    trackedSnapshots,
    categories,
    offlineQueue,
    pendingOfflineCount: offlineQueue.filter((i) => i.status !== 'synced').length,
    notifications,
    unreadNotificationCount: notifications.filter((n) => !n.read).length,
    auditLogs,
    activeSessions,
    securityPrefs,
    userPreferences,
    workloadSummary,
    scannerTorchOn,
    scannerPaused,
    scannerTarget,
    recentScans,
    sidebarOpen,
    canApproveAccounts,
    pendingApprovals,
    adminUsers,
    realtimeStatus,
    realtimeTick,
    fcmConfigured,
    firstVisitSkeletonMs,
    hasScreenBeenOpened,
    markScreenOpened,
    setActiveTab: navigateToTab,
    goBack,
    openScannerForDocument: (doc, autoStartCamera = true) => {
      const latest = doc.latestTransaction;
      const fromOffice = latest?.fromOffice ?? doc.originOffice;
      setSidebarOpen(false);
      setSelectedDocumentId(null);
      setScannerPaused(false);
      setScannerTarget({
        documentId: doc.id,
        fromOfficeCode: fromOffice.code,
        fromOfficeName: fromOffice.name,
        fromUserName: latest?.fromUserName,
        copyFormat: doc.copyFormat,
        autoStartCamera,
      });
      navigateToTab('scanner');
    },
    clearScannerTarget: () => setScannerTarget(null),
    completeOnboarding: async (targetTab) => {
      try {
        await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
      } catch {
        // Proceed into workspace or sign-in even if preference storage fails
      }
      setShowOnboarding(false);
      if (targetTab) {
        navHistoryRef.current = [];
        setSelectedDocumentId(null);
        setActiveTab(targetTab);
      }
    },
    openOnboarding: () => {
      setSidebarOpen(false);
      setShowOnboarding(true);
    },
    openSidebar: () => setSidebarOpen(true),
    closeSidebar: () => setSidebarOpen(false),
    toggleSidebar: () => setSidebarOpen((v) => !v),
    setScannerTorchOn,
    setScannerPaused,
    clearRecentScans: () => {
      setRecentScans([]);
      AsyncStorage.removeItem(RECENT_SCANS_STORAGE_KEY).catch(() => {});
    },
    openDocument: (documentId) => {
      setSidebarOpen(false);
      setSelectedDocumentId(documentId);
    },
    closeDocument: () => {
      setSelectedDocumentId(null);
      if (activeTabRef.current === 'document') {
        const prevTab = navHistoryRef.current.pop() ?? defaultLandingTab;
        setActiveTab(prevTab);
      }
    },
    clearToast,
    notify,
    updateApiBaseUrl: async (url) => {
      await runAsyncAction(async () => {
        const saved = await services.deps.apiConfig.setBaseUrl(url);
        setApiBaseUrl(saved);
      }, 'Server API URL saved.');
    },
    signIn: async (identifier, password) => {
      setIsBusy(true);
      try {
        const result = await services.authService.login(identifier, password);
        persistPendingRegistration(null);
        await applyAuthenticatedSession(result);
        notify('success', 'Signed in securely.');
      } catch (err) {
        if (
          err instanceof ApiError &&
          (err.code === 'ACCOUNT_PENDING_APPROVAL' || err.code === 'ACCOUNT_REJECTED')
        ) {
          const status: PendingApprovalStatus =
            err.code === 'ACCOUNT_REJECTED' ? 'rejected' : 'pending';
          const rawSub = err.payload?.submitted as Record<string, unknown> | undefined;
          const submitted: PendingRegistrationSummary | null = rawSub
            ? {
                fullName: typeof rawSub.full_name === 'string' ? rawSub.full_name : '',
                employeeId: typeof rawSub.employee_id === 'string' ? rawSub.employee_id : '',
                email: typeof rawSub.email === 'string' ? rawSub.email : '',
                position: typeof rawSub.position === 'string' ? rawSub.position : '',
                officeCode: typeof rawSub.office_code === 'string' ? rawSub.office_code : '',
                officeName: typeof rawSub.office_name === 'string' ? rawSub.office_name : '',
                submittedAt:
                  typeof rawSub.submitted_at === 'string'
                    ? rawSub.submitted_at
                    : new Date().toISOString(),
              }
            : null;
          const trimmedId = identifier.trim();
          persistPendingRegistration({
            status,
            statusToken:
              typeof err.payload?.status_token === 'string' ? err.payload.status_token : null,
            message: err.message,
            fullName: submitted?.fullName || '',
            employeeId:
              submitted?.employeeId || (trimmedId.includes('@') ? '' : trimmedId.toUpperCase()),
            email: submitted?.email || (trimmedId.includes('@') ? trimmedId.toLowerCase() : ''),
            position: submitted?.position || '',
            officeCode: submitted?.officeCode || '',
            officeName: submitted?.officeName || '',
            submittedAt: submitted?.submittedAt || new Date().toISOString(),
            checkedAt: new Date().toISOString(),
          });
          setActiveTab('pending_approval');
          notify(status === 'rejected' ? 'error' : 'info', err.message);
          return;
        }
        const message = err instanceof Error ? err.message : 'Unable to complete action.';
        notify('error', message);
        throw err;
      } finally {
        setIsBusy(false);
      }
    },
    registerAccount: async (input) =>
      runAsyncAction(async () => {
        const outcome = await services.authService.register(input);
        if (outcome.authSession) {
          persistPendingRegistration(null);
          await applyAuthenticatedSession(outcome.authSession);
          notify('success', outcome.message);
        } else {
          const matchedOffice = offices.find(
            (o) => o.code.toUpperCase() === input.officeCode.trim().toUpperCase(),
          );
          const submitted = outcome.submitted;
          persistPendingRegistration({
            status: 'pending',
            statusToken: outcome.statusToken ?? null,
            message: outcome.message,
            fullName: submitted?.fullName || input.fullName.trim(),
            employeeId: submitted?.employeeId || input.employeeId.trim().toUpperCase(),
            email: submitted?.email || input.email.trim().toLowerCase(),
            position: submitted?.position || input.position.trim(),
            officeCode: submitted?.officeCode || input.officeCode.trim().toUpperCase(),
            officeName:
              submitted?.officeName ||
              input.customOfficeName?.trim() ||
              matchedOffice?.name ||
              input.officeCode.trim().toUpperCase(),
            submittedAt: submitted?.submittedAt || new Date().toISOString(),
            checkedAt: null,
          });
          setActiveTab('pending_approval');
          notify('info', outcome.message);
        }
        return outcome;
      }),
    requestPasswordReset: async (identifier) =>
      runAsyncAction(() => services.authService.requestPasswordReset(identifier)),
    confirmPasswordReset: async (identifier, resetCode, newPassword, confirmPassword) =>
      runAsyncAction(
        () =>
          services.authService.confirmPasswordReset(
            identifier,
            resetCode,
            newPassword,
            confirmPassword,
          ),
        'Password reset successful. Sign in with your new password.',
      ),
    signOutAndWipeCache: async () => {
      const hadActor = Boolean(actor);
      const prevActorId = actor?.id;
      await runAsyncAction(
        async () => {
          await services.authService.signOutAndWipeCache();
          await services.offlineService.clearLocalQueue();
          await AsyncWorkspaceCacheStore.clear(prevActorId);
          await AsyncStorage.removeItem(RECENT_SCANS_STORAGE_KEY).catch(() => {});
          navHistoryRef.current = [];
          setActor(null);
          setSessionMetadata(null);
          setDocuments([]);
          setTrackedSnapshots([]);
          setNotifications([]);
          setNotificationsHydratedActorId(null);
          notifBaselineSyncedActorRef.current = null;
          lastNotifSyncKeyRef.current = '__cleared__';
          DeviceNotificationBridge.clearNotifications();
          setAuditLogs([]);
          setActiveSessions([]);
          setPendingApprovals([]);
          setAdminUsers([]);
          realtimeCursorRef.current = 0;
          setRealtimeStatus('polling');
          setRecentScans([]);
          setScannerTorchOn(false);
          setScannerPaused(false);
          setSidebarOpen(false);
          setOfflineQueue([]);
          setSelectedDocumentId(null);
          setActiveTab('login');
        },
        hadActor
          ? 'Signed out and wiped Keystore token & local cache.'
          : 'Local session cleared. Ready to sign in.',
      );
    },
    refreshWorkspace: async () => {
      if (!actor) {
        notify(
          'info',
          'Authentication is deferred. Configure your Tracely server in Profile when ready.',
        );
        return;
      }
      setIsRefreshing(true);
      try {
        await hydrateWorkspace(actor);
      } catch (err) {
        notify('error', err instanceof Error ? err.message : 'Unable to refresh documents.');
      } finally {
        setIsRefreshing(false);
      }
    },
    refreshDocument: async (documentId) => {
      if (!actor) return;
      const updated = await services.routingService.refreshDocument(actor, documentId);
      upsertDocument(updated);
    },
    updateAvailability: async (status, delegateId, availabilityUntil) => {
      await runAsyncAction(async () => {
        const updated = await services.authService.updateAvailability(
          status,
          delegateId,
          availabilityUntil,
        );
        setActor(updated);
      }, 'Availability status updated.');
    },
    updateProfile: async (patch) => {
      if (!actor) {
        throw new Error('Sign in with your Tracely account to update your personal profile.');
      }
      return runAsyncAction(async () => {
        const updated = await services.authService.updateProfile(patch);
        const resolvedColor = patch.avatarColor ?? updated.avatarColor;
        if (resolvedColor) {
          updated.updateProfileInfo({ avatarColor: resolvedColor });
          await saveStoredAvatarColor(updated.id, resolvedColor);
        }
        setActor(updated);
        setPersonnelDirectory((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p)),
        );
        return updated;
      }, 'User profile information updated.');
    },
    updateUserPreferences: async (patch) => {
      return runAsyncAction(async () => {
        const merged: UserWorkflowPreferences = Object.freeze({
          ...userPreferences,
          ...patch,
        });
        setUserPreferences(merged);
        AsyncStorage.setItem(USER_PREFS_STORAGE_KEY, JSON.stringify(merged)).catch(() => {});
        if (patch.hideLockScreenTitles !== undefined) {
          const nextSec = Object.freeze({
            ...securityPrefs,
            hideLockScreenTitles: patch.hideLockScreenTitles,
          });
          setSecurityPrefs(nextSec);
          await services.prefsStore.savePrefs(nextSec);
        }
        if (actor) {
          try {
            const res = await services.authService.updatePreferences(patch);
            setActor(res.user);
            setUserPreferences(res.preferences);
            AsyncStorage.setItem(USER_PREFS_STORAGE_KEY, JSON.stringify(res.preferences)).catch(
              () => {},
            );
            return res.preferences;
          } catch {
            actor.updatePreferences(patch);
          }
        }
        return merged;
      }, 'User preferences saved.');
    },
    loadActiveSessions: async () => {
      if (!actor) return;
      const sessions = await runAsyncAction(() => services.authService.listActiveSessions());
      setActiveSessions(sessions);
    },
    revokeOtherSessions: async () => {
      if (!actor) return;
      const count = await runAsyncAction(() => services.authService.revokeOtherSessions());
      const sessions = await services.authService.listActiveSessions();
      setActiveSessions(sessions);
      notify('success', `Revoked ${count} other active device session(s).`);
    },
    changePassword: async (currentPassword, newPassword, confirmPassword) => {
      if (!actor) {
        throw new Error('Sign in with an active account to change your password.');
      }
      await runAsyncAction(
        () => services.authService.changePassword(currentPassword, newPassword, confirmPassword),
        'Password updated across Tracely.',
      );
    },
    updateSecurityPrefs: async (patch) => {
      const next = Object.freeze({ ...securityPrefs, ...patch });
      setSecurityPrefs(next);
      if (patch.screenshotShieldEnabled !== undefined) {
        DeviceSecurityBridge.applyScreenshotShield(next.screenshotShieldEnabled);
      }
      await services.prefsStore.savePrefs(next);
      notify('success', 'Device security preferences saved.');
    },
    acknowledgeReceipt: async (document, proofImage, verificationCode) => {
      if (!actor) return;
      await runAsyncAction(
        async () => {
          const updated = await services.routingService.acknowledgeReceipt(
            actor,
            document,
            proofImage
              ? {
                  uri: proofImage.uri,
                  fileName: proofImage.fileName,
                  mimeType: proofImage.mimeType,
                  compressedBytes: proofImage.compressedBytes,
                  sha256Checksum: proofImage.sha256Checksum,
                  exifStripped: proofImage.exifStripped,
                }
              : null,
            verificationCode,
          );
          upsertDocument(updated);
          setScannerTarget((curr) => (curr?.documentId === document.id ? null : curr));
        },
        document.isHardCopy
          ? 'QR verified — physical receipt confirmed & unlocked.'
          : 'QR verified — document unlocked & custody confirmed.',
      );
    },
    unlockSoftCopyWithPassword: async (document, password) => {
      if (!actor) {
        throw new Error('Sign in with your Tracely account to confirm receipt.');
      }
      return runAsyncAction(
        async () => {
          const updated = await services.routingService.acknowledgeReceipt(
            actor,
            document,
            null,
            undefined,
            password,
          );
          upsertDocument(updated);
          setScannerTarget((curr) => (curr?.documentId === document.id ? null : curr));
          return updated;
        },
        'Password verified — receipt logged in Track & document unlocked.',
      );
    },
    batchAcknowledgeReceipts: async (items) => {
      if (!actor || items.length === 0) return 0;
      return runAsyncAction(async () => {
        let count = 0;
        for (const item of items) {
          const doc = item instanceof Document ? item : item.document;
          const code = item instanceof Document ? undefined : item.verificationCode;
          const updated = await services.routingService.acknowledgeReceipt(actor, doc, null, code);
          upsertDocument(updated);
          count += 1;
        }
        setScannerTarget(null);
        notify('success', `Confirmed receipt & unlocked ${count} document(s).`);
        return count;
      });
    },
    sendDigitalDocument: async (payload) => {
      if (!actor) {
        const msg = 'Sign in with your Tracely account to upload and dispatch documents.';
        notify('info', msg);
        throw new Error(msg);
      }
      return runAsyncAction(async () => {
        const created = await services.routingService.createDigitalDocument(
          actor,
          payload,
          personnelDirectory,
        );
        upsertDocument(created);
        notifyWithOptionalRecall(
          created,
          payload.recipientUserId
            ? `Dispatched ${created.trackingCode} with routing QR slip.`
            : 'Soft-copy document uploaded.',
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
        throw new Error('Select at least one PDF or image file to upload.');
      }
      return runAsyncAction(async () => {
        const [firstFile, ...extraFiles] = payload.files;
        if (extraFiles.length === 0) {
          const single = await services.routingService.createDigitalDocument(
            actor,
            {
              title: payload.title,
              categoryId: payload.categoryId,
              confidentialityTier: payload.confidentialityTier,
              fileUri: firstFile.fileUri,
              fileName: firstFile.fileName,
              mimeType: firstFile.mimeType,
              sizeBytes: firstFile.sizeBytes,
              sha256Checksum: firstFile.sha256Checksum,
              recipientUserId: payload.recipientUserId,
              remarks: payload.remarks,
              routeToDelegateIfOnLeave: payload.routeToDelegateIfOnLeave,
            },
            personnelDirectory,
          );
          upsertDocument(single);
          notifyWithOptionalRecall(
            single,
            payload.recipientUserId
              ? `Dispatched ${single.trackingCode} with routing QR slip.`
              : 'Soft-copy document uploaded & dispatched.',
          );
          return single;
        }

        // Create locally first so extra bundle files attach before dispatching to recipient
        let currentDoc = await services.routingService.createDigitalDocument(
          actor,
          {
            title: payload.title,
            categoryId: payload.categoryId,
            confidentialityTier: payload.confidentialityTier,
            fileUri: firstFile.fileUri,
            fileName: firstFile.fileName,
            mimeType: firstFile.mimeType,
            sizeBytes: firstFile.sizeBytes,
            sha256Checksum: firstFile.sha256Checksum,
            recipientUserId: null,
            remarks: payload.remarks,
            routeToDelegateIfOnLeave: payload.routeToDelegateIfOnLeave,
          },
          personnelDirectory,
        );

        for (let i = 0; i < extraFiles.length; i += 1) {
          const file = extraFiles[i];
          currentDoc = await services.routingService.uploadRevisionVersion(actor, currentDoc, {
            documentId: currentDoc.id,
            fileUri: file.fileUri,
            fileName: file.fileName,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            sha256Checksum: file.sha256Checksum,
            revisionNote: `Supporting attachment (${i + 2} of ${payload.files.length})`,
          });
        }

        if (payload.recipientUserId) {
          currentDoc = await services.routingService.forwardDocument(
            actor,
            currentDoc,
            {
              documentId: currentDoc.id,
              recipientUserId: payload.recipientUserId,
              remarks: payload.remarks ?? '',
              routeToDelegateIfOnLeave: payload.routeToDelegateIfOnLeave,
            },
            personnelDirectory,
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
        throw new Error('Select at least one PDF or image file to upload.');
      }
      return runAsyncAction(async () => {
        const createdList: Document[] = [];
        for (const file of payload.files) {
          const customTitle = file.title?.trim();
          const itemTitle = customTitle
            ? customTitle
            : payload.files.length === 1
              ? payload.title
              : payload.title.trim()
                ? buildBatchItemTitle(payload.title, file.fileName)
                : file.fileName.replace(/\.[^.]+$/, '').trim() || file.fileName;
          const created = await services.routingService.createDigitalDocument(
            actor,
            {
              title: itemTitle,
              categoryId: payload.categoryId,
              confidentialityTier: payload.confidentialityTier,
              fileUri: file.fileUri,
              fileName: file.fileName,
              mimeType: file.mimeType,
              sizeBytes: file.sizeBytes,
              sha256Checksum: file.sha256Checksum,
              recipientUserId: payload.recipientUserId,
              remarks: payload.remarks,
              routeToDelegateIfOnLeave: payload.routeToDelegateIfOnLeave,
            },
            personnelDirectory,
          );
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
      return runAsyncAction(async () => {
        const created = await services.routingService.registerHardCopyDocument(
          actor,
          payload,
          personnelDirectory,
        );
        upsertDocument(created);
        notifyWithOptionalRecall(
          created,
          payload.recipientUserId
            ? `Hard-copy ${created.trackingCode} dispatched with QR slip.`
            : 'Hard-copy record logged. Attach its QR slip before dispatch.',
        );
        return created;
      });
    },
    forwardDocument: async (document, payload) => {
      if (!actor) return;
      await runAsyncAction(async () => {
        const updated = await services.routingService.forwardDocument(
          actor,
          document,
          payload,
          personnelDirectory,
        );
        upsertDocument(updated);
        notifyWithOptionalRecall(updated, `Document ${updated.trackingCode} forwarded.`);
      });
    },
    batchForwardDocuments: async (targetDocs, payload) => {
      if (!actor || targetDocs.length === 0) return 0;
      return runAsyncAction(async () => {
        let count = 0;
        for (const doc of targetDocs) {
          const updated = await services.routingService.forwardDocument(
            actor,
            doc,
            { ...payload, documentId: doc.id },
            personnelDirectory,
          );
          upsertDocument(updated);
          count += 1;
        }
        notify('success', `Forwarded ${count} document(s).`);
        return count;
      });
    },
    recallTransfer: recallTransferDocument,
    updateDocumentDetails: async (document, patch) => {
      if (!actor) return;
      await runAsyncAction(async () => {
        if (services.deps.docRepo.updateDocumentDetails) {
          const updated = await services.deps.docRepo.updateDocumentDetails(document.id, patch);
          upsertDocument(updated);
          return;
        }
        const matchedCat = patch.categoryId
          ? categories.find((c) => c.id === patch.categoryId)
          : undefined;
        document.updateDetails({
          ...patch,
          categoryName: matchedCat?.name,
        });
        upsertDocument(document);
      }, 'Document details updated.');
    },
    declineMisrouted: async (document, reason) => {
      if (!actor) return;
      await runAsyncAction(async () => {
        const updated = await services.routingService.declineMisrouted(actor, document, reason);
        upsertDocument(updated);
      }, 'Transfer declined and flagged as misrouted.');
    },
    returnForRevision: async (document, remarks) => {
      if (!actor) return;
      await runAsyncAction(async () => {
        const updated = await services.routingService.returnForRevision(actor, document, remarks);
        upsertDocument(updated);
      }, 'Document returned for revision.');
    },
    completeDocument: async (document, status, remarks) => {
      if (!actor || !services.deps.docRepo.completeDocument) {
        throw new Error('Document completion endpoint is unavailable.');
      }
      await runAsyncAction(async () => {
        const updated = await services.deps.docRepo.completeDocument!(document.id, status, remarks);
        upsertDocument(updated);
      }, status === 'approved' ? 'Document marked Approved & Released.' : 'Document archived cleanly.');
    },
    listDocumentComments: listDocumentCommentsStable,
    addDocumentComment: async (documentId, body, visibility) => {
      if (!services.deps.docRepo.addDocumentComment) {
        throw new Error('Comments endpoint is unavailable.');
      }
      return runAsyncAction(
        () => services.deps.docRepo.addDocumentComment!(documentId, body, visibility),
        visibility === 'internal_office'
          ? 'Internal office note added.'
          : 'Cross-office note posted.',
      );
    },
    uploadRevision: async (document, payload) => {
      if (!actor) return;
      await runAsyncAction(async () => {
        const updated = await services.routingService.uploadRevisionVersion(
          actor,
          document,
          payload,
        );
        upsertDocument(updated);
      }, 'New non-destructive revision published.');
    },
    issuePresignedView: async (document, versionNumber) => {
      if (!actor) throw new Error('Authentication required.');
      return runAsyncAction(() =>
        services.routingService.issuePresignedViewGrant(actor, document, versionNumber),
      );
    },
    issueProofPhotoView: async (documentId, transactionId) => {
      if (!actor || !services.deps.docRepo.issueProofPhotoViewGrant) {
        throw new Error('Proof photo viewer endpoint is unavailable.');
      }
      return runAsyncAction(() =>
        services.deps.docRepo.issueProofPhotoViewGrant!(documentId, transactionId),
      );
    },
    trackDocumentByCode: async (trackingCode) =>
      runAsyncAction(() => services.routingService.trackDocumentByCode(trackingCode)),
    scanQr: async (rawValue) => {
      if (!actor) {
        const parsed = QrPayloadParser.parse(rawValue);
        if (parsed.scenario === 'transmittal_verify') {
          return runAsyncAction(async () => {
            const verification = await services.deps.docRepo.verifyTransmittalQr(
              parsed.opaqueToken,
            );
            const result: QrResolutionResult = {
              kind: 'transmittal_verified',
              ...verification,
            };
            recordScanEntry(result);
            return result;
          });
        }
        const message =
          'Backend server authentication is required to resolve document or desktop pairing tokens.';
        notify('info', message);
        throw new Error(message);
      }
      return runAsyncAction(async () => {
        const resolved = await services.qrService.resolveRawQr(actor, rawValue);
        if (resolved.kind === 'document_authorized') {
          if (!resolved.pendingForActorOffice) {
            upsertDocument(resolved.document);
          }
          if (resolved.unlockedViaSync) {
            setScannerTarget((curr) =>
              curr?.documentId === resolved.document.id ? null : curr,
            );
            notify('success', 'Soft Copy unlocked & synced with Tracely Web.');
          } else if (resolved.sentByActor) {
            notify(
              'info',
              'You sent this transfer — senders cannot confirm receipt of their own QR.',
            );
          }
        }
        recordScanEntry(resolved);
        return resolved;
      });
    },
    sanitizeCapturedPhoto: (input) => services.deps.imageSanitizer.sanitizeImageAsset(input),
    computeSha256FromUri: (uri) => services.deps.imageSanitizer.computeSha256FromUri(uri),
    captureAndQueuePhoto: async (input) => {
      const attachment = await runAsyncAction(() =>
        services.offlineService.captureAndEnqueueOrSync({
          ...input,
          isOnline,
        }),
      );
      setOfflineQueue(services.offlineService.listQueue());
      notify(
        attachment.status === 'synced' ? 'success' : 'info',
        attachment.status === 'synced'
          ? `Compressed & EXIF-stripped photo uploaded (${attachment.compressionPercent}% smaller).`
          : 'Saved to persistent offline retry queue until connected.',
      );
      return attachment;
    },
    retryOfflineQueue: async () => {
      if (!isOnline) {
        notify('error', 'Device is offline. Uploads will retry automatically once connected.');
        return;
      }
      const synced = await runAsyncAction(() => services.offlineService.retryAllPending(isOnline));
      setOfflineQueue(services.offlineService.listQueue());
      notify('success', `Synced ${synced} queued attachment(s).`);
    },
    findSimilarCategories: (candidateName) =>
      services.categoryService.findSimilarWarnings(categories, candidateName),
    declareCategory: async (name, code) => {
      const created = await runAsyncAction(async () => {
        const saved = await services.categoryService.declareCategory(categories, name, code);
        setCategories((prev) => [saved, ...prev]);
        return saved;
      }, 'Shared category saved across all offices.');
      return created;
    },
    updateAdminCategory: async (categoryId, patch) => {
      const updated = await runAsyncAction(async () => {
        if (!services.deps.docRepo.updateAdminCategory) {
          const existing = categories.find((c) => c.id === categoryId);
          const fallback = new DocumentCategory({
            id: categoryId,
            name: patch.name?.trim() || existing?.name || 'Updated Category',
            code: patch.code?.trim().toUpperCase() || existing?.code || 'CAT',
            declaredByOfficeCode: existing?.declaredByOfficeCode ?? actor?.office.code ?? 'ICT',
            declaredByOfficeName: existing?.declaredByOfficeName ?? actor?.office.name ?? 'ICT Unit',
            usageCount: existing?.usageCount ?? 0,
          });
          setCategories((prev) => prev.map((c) => (c.id === categoryId ? fallback : c)));
          return fallback;
        }
        const saved = await services.deps.docRepo.updateAdminCategory(categoryId, patch);
        setCategories((prev) => prev.map((c) => (c.id === categoryId ? saved : c)));
        return saved;
      }, 'Global category updated.');
      return updated;
    },
    deleteAdminCategory: async (categoryId) => {
      await runAsyncAction(async () => {
        if (services.deps.docRepo.deleteAdminCategory) {
          await services.deps.docRepo.deleteAdminCategory(categoryId);
        }
        setCategories((prev) => prev.filter((c) => c.id !== categoryId));
      }, 'Unused category removed from global taxonomy.');
    },
    markNotificationRead: async (notificationId) => {
      const existing = notifications.find((n) => n.id === notificationId);
      if (!existing || existing.read) return;
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      );
      try {
        await services.deps.docRepo.markNotificationRead(notificationId);
      } catch {
        // Keep responsive optimistic UI even under transient offline conditions
      }
    },
    markAllNotificationsRead: async () => {
      await runAsyncAction(async () => {
        await services.deps.docRepo.markAllNotificationsRead();
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      });
    },
    loadAuditLogs: async () => {
      const entries = await runAsyncAction(() => services.deps.auditRepo.listAll());
      setAuditLogs(entries);
    },
    loadPendingUsers: async () => {
      if (!actor || !canApproveAccounts) {
        setPendingApprovals([]);
        return;
      }
      await runAsyncAction(async () => {
        const pending = await services.authService.listPendingUsers();
        setPendingApprovals(pending);
      });
    },
    approvePendingUser: async (userId) => {
      await runAsyncAction(async () => {
        const approved = await services.authService.approveUser(userId);
        setPendingApprovals((prev) => prev.filter((u) => u.id !== userId));
        setPersonnelDirectory((prev) =>
          prev.some((p) => p.id === approved.id) ? prev : [...prev, approved],
        );
      }, 'Account approved — user can now sign in.');
    },
    rejectPendingUser: async (userId, reason) => {
      await runAsyncAction(async () => {
        await services.authService.rejectUser(userId, reason);
        setPendingApprovals((prev) => prev.filter((u) => u.id !== userId));
      }, 'Registration request rejected.');
    },
    loadAdminUsers: async () => {
      if (!actor || !canApproveAccounts) {
        setAdminUsers([]);
        return;
      }
      await runAsyncAction(async () => {
        const list = await services.authService.listAdminUsers();
        setAdminUsers(list);
      });
    },
    createAdminUser: async (payload) => {
      const created = await runAsyncAction(async () => {
        const saved = await services.authService.createAdminUser(payload);
        setAdminUsers((prev) => [saved, ...prev]);
        setPersonnelDirectory((prev) => [saved, ...prev]);
        return saved;
      }, `Provisioned verified account for ${payload.fullName}.`);
      return created;
    },
    updateAdminUser: async (userId, patch) => {
      await runAsyncAction(
        async () => {
          const updated = await services.authService.updateAdminUser(userId, patch);
          setAdminUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
          setPersonnelDirectory((prev) =>
            !updated.isActive
              ? prev.filter((p) => p.id !== userId)
              : prev.some((p) => p.id === userId)
                ? prev.map((p) => (p.id === userId ? updated : p))
                : [...prev, updated],
          );
        },
        patch.active === false
          ? 'Account deactivated and tokens revoked.'
          : patch.newPassword
            ? 'Password reset and existing device tokens revoked.'
            : 'Personnel assignment updated.',
      );
    },
    createAdminOffice: async (payload) => {
      await runAsyncAction(async () => {
        const created = await services.authService.createAdminOffice(payload);
        setOffices((prev) => [...prev, created]);
      }, `Office ${payload.code.toUpperCase()} added to directory.`);
    },
    updateAdminOffice: async (officeId, patch) => {
      await runAsyncAction(async () => {
        const updated = await services.authService.updateAdminOffice(officeId, patch);
        setOffices((prev) => prev.map((o) => (o.id === officeId ? updated : o)));
      }, 'Office details updated.');
    },
  };

  return <AppServiceContext.Provider value={value}>{children}</AppServiceContext.Provider>;
};

export function useAppServices(): AppContextValue {
  const ctx = useContext(AppServiceContext);
  if (!ctx) throw new Error('useAppServices must be used inside AppServiceProvider.');
  return ctx;
}
