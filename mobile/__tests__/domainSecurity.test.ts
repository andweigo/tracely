/* eslint-env jest */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiConfig } from '../src/config/ApiConfig';
import { ApiClient, ApiError } from '../src/network/ApiClient';
import { AUTH_INPUT_LIMITS } from '../src/domain/security/AuthInputPolicy';
import { DomainRuleError } from '../src/domain/base/DomainRuleError';
import {
  AvailabilityStatus,
  ConfidentialityTier,
  DocumentCopyFormat,
  OfflineQueueStatus,
} from '../src/domain/enums/DomainEnums';
import { DocumentMapper } from '../src/domain/mappers/DocumentMapper';
import {
  DocumentAccessPolicy,
  DocumentTrackingPolicy,
} from '../src/domain/security/AccessPolicy';
import { NativeImageSanitizer } from '../src/domain/security/ImageSanitizer';
import { QrPayloadParser } from '../src/domain/security/QrPayload';
import {
  buildBatchRoutingSlipsPrintHtml,
  buildRoutingSlipPrintHtml,
  buildTransmittalSheetPrintHtml,
} from '../src/domain/security/DocumentViewerBridge';
import { HttpDocumentRepository } from '../src/repositories/http/HttpDocumentRepository';
import { AsyncWorkspaceCacheStore } from '../src/repositories/storage/AsyncWorkspaceCacheStore';
import { normalizeUploadFileName } from '../src/ui/utils/formatters';
import {
  filterAndSortSentDocuments,
  matchesSentDateFilter,
  paginateSentItems,
  selectSentDocuments,
} from '../src/ui/utils/sentFilter';
import { CategoryService } from '../src/services/CategoryService';
import { AuthSessionService } from '../src/services/AuthSessionService';
import { computeWorkloadSummary } from '../src/domain/entities/UserSecurityProfile';
import { DocumentRoutingService } from '../src/services/DocumentRoutingService';
import { OfflineSyncService } from '../src/services/OfflineSyncService';
import { QrResolutionService } from '../src/services/QrResolutionService';
import {
  TestAuthRepository,
  TestDocumentRepository,
  TestOfflineQueueStore,
  TestSecureTokenStore,
} from './fixtures/InMemoryTestRepos';
import { createTestFixtureBundle } from './fixtures/testSeed';

function setupServices(initialUserId = 'usr-budget-1') {
  const bundle = createTestFixtureBundle();
  const authRepo = new TestAuthRepository(bundle.personnel, initialUserId);
  const docRepo = new TestDocumentRepository(bundle, authRepo);
  const queueStore = new TestOfflineQueueStore();
  const policy = new DocumentAccessPolicy();
  const routingService = new DocumentRoutingService(docRepo, policy);

  return {
    bundle,
    authRepo,
    docRepo,
    queueStore,
    policy,
    routingService,
    qrService: new QrResolutionService(docRepo, policy),
    categoryService: new CategoryService(docRepo),
    offlineService: new OfflineSyncService(docRepo, queueStore),
    sanitizer: new NativeImageSanitizer(),
  };
}

describe('Production OOP Domain & RA 10173 Security Rules', () => {
  test('blocks Confidential documents from unrelated offices (including ICT & Records)', async () => {
    const { docRepo, policy, bundle } = setupServices();
    const confidentialDoc = await docRepo.getDocumentById('doc-099');
    const budgetOfficer = bundle.personnel.find((p) => p.id === 'usr-budget-1')!;
    const ictAdmin = bundle.personnel.find((p) => p.id === 'usr-ict-1')!;
    const recordsOfficer = bundle.personnel.find((p) => p.id === 'usr-records-1')!;
    const legalOfficer = bundle.personnel.find((p) => p.id === 'usr-legal-1')!;

    expect(policy.authorize(budgetOfficer, confidentialDoc).allowed).toBe(false);
    expect(policy.authorize(ictAdmin, confidentialDoc).allowed).toBe(false);
    expect(policy.authorize(recordsOfficer, confidentialDoc).allowed).toBe(false);
    expect(policy.authorize(legalOfficer, confidentialDoc).allowed).toBe(true);
  });

  test('enforces recall before receipt and blocks recall after acknowledgment', async () => {
    const { docRepo, routingService, bundle } = setupServices('usr-records-1');
    const recordsOfficer = bundle.personnel.find((p) => p.id === 'usr-records-1')!;
    const sgodHead = bundle.personnel.find((p) => p.id === 'usr-sgod-1')!;

    let doc138 = await docRepo.getDocumentById('doc-138');
    doc138 = await routingService.recallLatestTransfer(recordsOfficer, doc138);
    expect(doc138.currentOffice.code).toBe('RECORDS');

    doc138 = await routingService.forwardDocument(
      recordsOfficer,
      doc138,
      {
        documentId: 'doc-138',
        recipientUserId: 'usr-sgod-1',
        remarks: 'Resending for SGOD endorsement',
      },
      bundle.personnel,
    );

    doc138 = await routingService.acknowledgeReceipt(sgodHead, doc138);

    await expect(
      routingService.recallLatestTransfer(recordsOfficer, doc138),
    ).rejects.toThrow(DomainRuleError);
  });

  test('computes real FIPS 180-4 SHA-256 digests and flushes persisted offline queue when online', async () => {
    const { offlineService, sanitizer, docRepo, queueStore } = setupServices();
    const sampleBytes = new Uint8Array([0x53, 0x44, 0x4f, 0x2d, 0x51, 0x52]);
    const sha256Checksum = sanitizer.computeSha256Bytes(sampleBytes);
    expect(sha256Checksum).toMatch(/^[0-9a-f]{64}$/);

    const queued = await offlineService.captureAndEnqueueOrSync({
      targetType: 'receipt_proof',
      targetId: 'doc-142',
      targetLabel: 'SDO-OM-2026-000142',
      image: {
        uri: 'file:///cache/receipt_proof_142.jpg',
        fileName: 'receipt_proof_142.jpg',
        mimeType: 'image/jpeg',
        originalBytes: 1_900_000,
        compressedBytes: 195_000,
        sha256Checksum,
        exifStripped: true,
      },
      isOnline: false,
    });

    expect(queued.status).toBe(OfflineQueueStatus.QUEUED);
    expect((await queueStore.loadQueue()).length).toBe(1);

    const syncedCount = await offlineService.retryAllPending(true);
    expect(syncedCount).toBe(1);
    expect(queued.status).toBe(OfflineQueueStatus.SYNCED);
    expect(docRepo.uploadedPhotos).toHaveLength(1);
  });

  test('polymorphically resolves QR workflows and enforces On Leave delegate rules', async () => {
    const { docRepo, qrService, routingService, bundle } = setupServices('usr-budget-1');
    const budgetOfficer = bundle.personnel.find((p) => p.id === 'usr-budget-1')!;
    const staffOnLeave = bundle.personnel.find((p) => p.id === 'usr-budget-2')!;
    const sgodHead = bundle.personnel.find((p) => p.id === 'usr-sgod-1')!;
    const confidentialDoc = await docRepo.getDocumentById('doc-099');
    const doc142 = await docRepo.getDocumentById('doc-142');

    const denied = await qrService.resolveRawQr(
      budgetOfficer,
      `SDO-QR:DOC:${confidentialDoc.qrToken}`,
    );
    expect(denied.kind).toBe('document_denied');

    const verified = await qrService.resolveRawQr(
      sgodHead,
      `SDO-QR:VERIFY:${doc142.qrToken}`,
    );
    expect(verified.kind).toBe('transmittal_verified');

    const ackDoc = await routingService.acknowledgeReceipt(budgetOfficer, doc142);

    await expect(
      routingService.forwardDocument(
        budgetOfficer,
        ackDoc,
        {
          documentId: 'doc-142',
          recipientUserId: staffOnLeave.id,
          remarks: 'Direct attempt to staff on leave',
          routeToDelegateIfOnLeave: false,
        },
        bundle.personnel,
      ),
    ).rejects.toThrow(DomainRuleError);

    expect(staffOnLeave.availability).toBe(AvailabilityStatus.ON_LEAVE);
  });

  test('validates HTTPS endpoint transport rules and hydrates Laravel API DTOs', async () => {
    expect(() => ApiConfig.normalizeAndValidate('http://doctrack.example.com/api/v1')).toThrow(
      DomainRuleError,
    );
    expect(ApiConfig.normalizeAndValidate('http://localhost:8000/api/v1/')).toBe(
      'http://localhost:8000/api/v1',
    );
    expect(ApiConfig.normalizeAndValidate('http://192.168.1.51:8000/api/v1/')).toBe(
      'http://192.168.1.51:8000/api/v1',
    );
    expect(ApiConfig.normalizeAndValidate('https://doctrack.depedormin.gov.ph/api/v1/')).toBe(
      'https://doctrack.depedormin.gov.ph/api/v1',
    );

    const freshConfig = new ApiConfig();
    await freshConfig.setBaseUrl('https://doctrack.depedormin.gov.ph/api/v1');
    expect(await freshConfig.loadSavedBaseUrl()).toBe('http://127.0.0.1:8000/api/v1');

    // In release builds (!__DEV__), stale dev loopback URLs saved in AsyncStorage must auto-reset to Railway production
    const globalWithDev = globalThis as { __DEV__?: boolean };
    const previousDev = globalWithDev.__DEV__;
    try {
      await AsyncStorage.setItem('@sdo_doctrack/api_base_url', 'http://127.0.0.1:8000/api/v1');
      globalWithDev.__DEV__ = false;
      const prodConfig = new ApiConfig();
      expect(await prodConfig.loadSavedBaseUrl()).toBe(
        'https://backend-production-43015d9a.up.railway.app/api/v1',
      );
    } finally {
      globalWithDev.__DEV__ = previousDev;
    }

    const personnel = DocumentMapper.toPersonnel({
      id: 'usr-api-1',
      employee_id: 'SDO-9001',
      full_name: 'Maria Clara',
      position: 'Records Officer II',
      office: { id: 'off-records', code: 'RECORDS', name: 'Records Section' },
      role: 'records_officer' as never,
      email: 'maria.clara@deped.gov.ph',
      availability: AvailabilityStatus.AVAILABLE,
    });
    expect(personnel.fullName).toBe('Maria Clara');
    expect(personnel.initials).toBe('MC');
  });

  test('displays live office location to office staff while limiting full PDF/content access to authorized roles', async () => {
    const { docRepo, bundle, routingService } = setupServices('usr-budget-2');
    const trackingPolicy = new DocumentTrackingPolicy();

    const budgetHead = bundle.personnel.find((p) => p.id === 'usr-budget-1')!;
    const budgetStaff = bundle.personnel.find((p) => p.id === 'usr-budget-2')!;
    const sgodHead = bundle.personnel.find((p) => p.id === 'usr-sgod-1')!;
    const restrictedDoc = await docRepo.getDocumentById('doc-115');
    const confidentialDoc = await docRepo.getDocumentById('doc-099');

    // Restricted doc: Unit Head gets full custody, same-office Staff sees location only (masked), unrelated office is denied
    const headSnap = trackingPolicy.toTrackingSnapshot(budgetHead, restrictedDoc);
    expect(headSnap?.visibility).toBe('full_custody');
    expect(headSnap?.canOpenFullRecord).toBe(true);
    expect(headSnap?.displayTitle).toBe('Teacher I Reclassification & Service Record Endorsement');
    expect(headSnap?.currentHolderName).toBe('Marco Villareal');

    const staffSnap = trackingPolicy.toTrackingSnapshot(budgetStaff, restrictedDoc);
    expect(staffSnap?.visibility).toBe('location_only');
    expect(staffSnap?.canOpenFullRecord).toBe(false);
    expect(staffSnap?.currentOffice.code).toBe('BUDGET');
    expect(staffSnap?.displayTitle).not.toContain('Teacher I');
    expect(staffSnap?.currentHolderName).toBeNull();

    expect(trackingPolicy.toTrackingSnapshot(sgodHead, restrictedDoc)).toBeNull();

    // Confidential doc: hidden even in location tracking for non-participants
    await expect(routingService.trackDocumentByCode(confidentialDoc.trackingCode)).rejects.toThrow(
      DomainRuleError,
    );

    // Budget staff can track doc-115 by tracking code and see only masked location
    const lookupSnap = await routingService.trackDocumentByCode('SDO-OM-2026-000115');
    expect(lookupSnap.visibility).toBe('location_only');
    expect(lookupSnap.currentOffice.code).toBe('BUDGET');

    // Sending office staff automatically list documents sent by their office without typing tracking codes
    const recordsUser = bundle.personnel.find((p) => p.id === 'usr-records-1')!;
    const recordsTracked = await routingService.listTrackedDocuments(recordsUser);
    const doc138Snap = recordsTracked.find((s) => s.documentId === 'doc-138');
    expect(doc138Snap?.sentByActorOffice).toBe(true);
    expect(doc138Snap?.currentOffice.code).toBe('SGOD');
    expect(doc138Snap?.receivedAt).toBeNull();
    expect(doc138Snap?.isInternalOfficeStage).toBe(false);

    // Budget acknowledged doc-115 -> receivedAt timestamp is recorded
    expect(headSnap?.receivedAt).toBeTruthy();
    expect(headSnap?.isInternalOfficeStage).toBe(false);
    expect(headSnap?.timelineEvents.some((e) => e.label.includes('Received by BUDGET'))).toBe(true);

    // Internal-office forwarding marks isInternalOfficeStage true for intra-unit tracking
    const {
      bundle: internalBundle,
      docRepo: internalDocRepo,
      routingService: internalRouting,
    } = setupServices('usr-budget-1');
    const budgetChief = internalBundle.personnel.find((p) => p.id === 'usr-budget-1')!;
    const budgetClerk = internalBundle.personnel.find((p) => p.id === 'usr-budget-2')!;
    budgetClerk.setAvailability(AvailabilityStatus.AVAILABLE);
    const acked115 = await internalDocRepo.getDocumentById('doc-115');
    await internalRouting.forwardDocument(
      budgetChief,
      acked115,
      {
        documentId: 'doc-115',
        recipientUserId: budgetClerk.id,
        remarks: 'Checking sub-allotment computation inside Budget unit',
      },
      internalBundle.personnel,
    );
    const internalTracked = await internalRouting.listTrackedDocuments(budgetChief);
    const internal115Snap = internalTracked.find((s) => s.documentId === 'doc-115');
    expect(internal115Snap?.isInternalOfficeStage).toBe(true);
    expect(internal115Snap?.timelineEvents.some((e) => e.isInternal)).toBe(true);
  });

  test('enforces Profile identity minimization, password validation, session revocation, and real workload metrics', async () => {
    const { bundle, routingService } = setupServices('usr-budget-1');
    const authRepo = new TestAuthRepository(bundle.personnel, 'usr-budget-1');
    const authService = new AuthSessionService(authRepo, new TestSecureTokenStore());

    const budgetHead = bundle.personnel.find((p) => p.id === 'usr-budget-1')!;
    const peerSummary = budgetHead.toPeerDirectorySummary();
    expect(peerSummary.fullName).toBe('Marco Villareal');
    expect('email' in peerSummary).toBe(false);
    expect('employeeId' in peerSummary).toBe(false);

    // Weak or reused passwords fail domain validation
    await expect(authService.changePassword('OldPass123!', 'short', 'short')).rejects.toThrow(
      DomainRuleError,
    );
    await expect(
      authService.changePassword('OldPass123!', 'OldPass123!', 'OldPass123!'),
    ).rejects.toThrow(DomainRuleError);

    // Valid strong password passes and active sessions revoke cleanly
    await expect(
      authService.changePassword('OldPass123!', 'StrongSdoPass2026!', 'StrongSdoPass2026!'),
    ).resolves.toBeUndefined();

    expect((await authService.listActiveSessions()).length).toBe(2);
    expect(await authService.revokeOtherSessions()).toBe(1);
    expect((await authService.listActiveSessions()).length).toBe(1);

    // Workload summary computes live queue counts dynamically
    const docs = await routingService.listAccessibleDocuments(budgetHead);
    const tracked = await routingService.listTrackedDocuments(budgetHead);
    const summary = computeWorkloadSummary(budgetHead, docs, tracked);
    expect(summary.pendingReceiptCount).toBe(1);
    expect(summary.onTimeSlaPercent).toBe(100);
  });

  test('validates SDO registration rules, handles pending approval, and wipes session cleanly on sign-out', async () => {
    const { bundle } = setupServices('usr-budget-1');
    const pendingTokenStore = new TestSecureTokenStore();
    const pendingAuthRepo = new TestAuthRepository(bundle.personnel, 'usr-budget-1', false);
    const pendingAuthService = new AuthSessionService(pendingAuthRepo, pendingTokenStore);

    // Pre-auth signOut skips server logout when no bearer token is stored
    const logoutSpy = jest.spyOn(pendingAuthRepo, 'logout');
    await pendingAuthService.signOutAndWipeCache();
    expect(logoutSpy).not.toHaveBeenCalled();

    // Missing required fields, length bounds, unsafe markup, and password rules fail domain validation
    await expect(
      pendingAuthService.register({
        fullName: '',
        employeeId: 'EMP-2026-0888',
        email: 'new.user@deped.gov.ph',
        position: 'AO II',
        officeCode: 'RECORDS',
        password: 'SdoTrack#2026!',
        confirmPassword: 'SdoTrack#2026!',
      }),
    ).rejects.toThrow(DomainRuleError);

    await expect(
      pendingAuthService.register({
        fullName: 'A'.repeat(AUTH_INPUT_LIMITS.fullNameMax + 1),
        employeeId: 'EMP-2026-0888',
        email: 'juan.delacrus@deped.gov.ph',
        position: 'AO II',
        officeCode: 'RECORDS',
        password: 'SdoTrack#2026!',
        confirmPassword: 'SdoTrack#2026!',
      }),
    ).rejects.toThrow('Full Name must be between 2 and 50 characters.');

    await expect(
      pendingAuthService.register({
        fullName: '<script>Juan</script>',
        employeeId: 'EMP-2026-0888',
        email: 'juan.delacrus@deped.gov.ph',
        position: 'AO II',
        officeCode: 'RECORDS',
        password: 'SdoTrack#2026!',
        confirmPassword: 'SdoTrack#2026!',
      }),
    ).rejects.toThrow('Full Name may only contain');

    await expect(
      pendingAuthService.register({
        fullName: 'Juan Dela Crus',
        employeeId: 'EMP-2026-0888',
        email: 'invalid-email',
        position: 'AO II',
        officeCode: 'RECORDS',
        password: 'SdoTrack#2026!',
        confirmPassword: 'SdoTrack#2026!',
      }),
    ).rejects.toThrow('Enter a valid official email address.');

    await expect(
      pendingAuthService.register({
        fullName: 'Juan Dela Crus',
        employeeId: 'EMP-2026-0888',
        email: 'juan.delacrus@deped.gov.ph',
        position: 'AO II',
        officeCode: 'RECORDS',
        password: 'short',
        confirmPassword: 'short',
      }),
    ).rejects.toThrow('Password must be at least 8 characters long.');

    await expect(
      pendingAuthService.register({
        fullName: 'Juan Dela Crus',
        employeeId: 'EMP-2026-0888',
        email: 'juan.delacrus@deped.gov.ph',
        position: 'AO II',
        officeCode: 'RECORDS',
        password: 'A'.repeat(AUTH_INPUT_LIMITS.passwordMax + 1),
        confirmPassword: 'A'.repeat(AUTH_INPUT_LIMITS.passwordMax + 1),
      }),
    ).rejects.toThrow('Password must not exceed 32 characters.');

    await expect(
      pendingAuthService.register({
        fullName: 'Juan Dela Crus',
        employeeId: 'EMP-2026-0888',
        email: 'juan.delacrus@deped.gov.ph',
        position: 'AO II',
        officeCode: 'RECORDS',
        password: 'LowerUpper123',
        confirmPassword: 'LowerUpper123',
      }),
    ).rejects.toThrow('uppercase, lowercase, number, and symbol');

    await expect(
      pendingAuthService.register({
        fullName: 'Juan Dela Crus',
        employeeId: 'EMP-2026-0888',
        email: 'juan.delacrus@deped.gov.ph',
        position: 'AO II',
        officeCode: 'RECORDS',
        password: 'SdoTrack#2026!',
        confirmPassword: 'Different#2026!',
      }),
    ).rejects.toThrow('Password confirmation does not match.');

    // Custom unlisted office requires full custom office name when selected
    await expect(
      pendingAuthService.register({
        fullName: 'Juan Dela Crus',
        employeeId: 'EMP-2026-0888',
        email: 'juan.delacrus@deped.gov.ph',
        position: 'Supply Officer I',
        officeCode: 'SUPPLY',
        isCustomOffice: true,
        customOfficeName: '',
        password: 'SdoTrack#2026!',
        confirmPassword: 'SdoTrack#2026!',
      }),
    ).rejects.toThrow('Enter the full name of your unlisted Office / Unit.');

    // Pending approval submission accepts an exact 8-character strong password cleanly
    const pendingOutcome = await pendingAuthService.register({
      fullName: 'Juan Dela Crus',
      employeeId: 'EMP-2026-0888',
      email: 'juan.delacrus@deped.gov.ph',
      position: 'Administrative Officer II',
      officeCode: 'SUPPLY',
      isCustomOffice: true,
      customOfficeName: 'Supply and Property Unit',
      password: 'Sdo#2026',
      confirmPassword: 'Sdo#2026',
    });
    expect(pendingOutcome.pendingApproval).toBe(true);
    expect(pendingOutcome.authSession).toBeNull();
    expect(await pendingTokenStore.getSession()).toBeNull();

    // Immediate session registration persists custom office + Keystore session and wipes on sign-out
    const activeTokenStore = new TestSecureTokenStore();
    const activeAuthRepo = new TestAuthRepository(bundle.personnel, 'usr-budget-1', true);
    const activeAuthService = new AuthSessionService(activeAuthRepo, activeTokenStore);
    const activeLogoutSpy = jest.spyOn(activeAuthRepo, 'logout');

    const activeOutcome = await activeAuthService.register({
      fullName: 'Lito Pangilinan',
      employeeId: 'EMP-2026-0991',
      email: 'lito.pangilinan@deped.gov.ph',
      position: 'Supply Officer II',
      officeCode: 'SUPPLY',
      isCustomOffice: true,
      customOfficeName: 'Supply and Property Unit',
      password: 'SdoTrack#2026!',
      confirmPassword: 'SdoTrack#2026!',
    });
    expect(activeOutcome.pendingApproval).toBe(false);
    expect(activeOutcome.authSession?.actor.fullName).toBe('Lito Pangilinan');
    expect(activeOutcome.authSession?.actor.office.code).toBe('SUPPLY');
    expect(activeOutcome.authSession?.actor.office.name).toBe('Supply and Property Unit');
    expect(await activeTokenStore.getBearerToken()).toBeTruthy();

    await activeAuthService.signOutAndWipeCache();
    expect(activeLogoutSpy).toHaveBeenCalledTimes(1);
    expect(await activeTokenStore.getBearerToken()).toBeNull();
  });

  test('enforces DDoS burst rate-limiting, 429 cooldown, and oversized payload guard', async () => {
    const { bundle } = setupServices('usr-budget-1');
    const tokenStore = new TestSecureTokenStore();
    const authRepo = new TestAuthRepository(bundle.personnel, 'usr-budget-1', false);
    const authService = new AuthSessionService(authRepo, tokenStore);
    const loginSpy = jest.spyOn(authRepo, 'login');

    for (let i = 0; i < 5; i += 1) {
      await authService.login('budget.head@deped.gov.ph', 'SdoTrack#2026!');
    }
    expect(loginSpy).toHaveBeenCalledTimes(5);

    // 6th rapid flood attempt is blocked client-side before touching the server
    await expect(
      authService.login('budget.head@deped.gov.ph', 'SdoTrack#2026!'),
    ).rejects.toThrow('Too many authentication attempts');
    expect(loginSpy).toHaveBeenCalledTimes(5);

    // Server 429 response enforces server Retry-After cooldown immediately
    const limitedAuthRepo = new TestAuthRepository(bundle.personnel, 'usr-budget-1', false);
    jest
      .spyOn(limitedAuthRepo, 'login')
      .mockRejectedValueOnce(new ApiError(429, 'RATE_LIMITED', 'Too many requests', 45));
    const limitedService = new AuthSessionService(limitedAuthRepo, new TestSecureTokenStore());
    await expect(
      limitedService.login('budget.head@deped.gov.ph', 'SdoTrack#2026!'),
    ).rejects.toThrow('Too many requests');
    await expect(
      limitedService.login('budget.head@deped.gov.ph', 'SdoTrack#2026!'),
    ).rejects.toThrow('Try again in');

    // ApiClient rejects oversized outbound JSON payloads locally before making HTTP calls
    const apiClient = new ApiClient({
      config: new ApiConfig(),
      tokenStore,
    });
    await expect(
      apiClient.post('/auth/register', { blob: 'x'.repeat(300 * 1024) }),
    ).rejects.toThrow('Request payload exceeds maximum allowed size');
  });

  test('tracks physical Hard Copy documents without digital files, supports slip receipt proof, and upgrades to Hybrid on scan v1', async () => {
    const { bundle, authRepo, docRepo, routingService, sanitizer } = setupServices('usr-records-1');
    const recordsOfficer = bundle.personnel.find((p) => p.id === 'usr-records-1')!;
    const budgetHead = bundle.personnel.find((p) => p.id === 'usr-budget-1')!;
    const categoryId = bundle.categories[0].id;

    // Register pure physical hard copy with zero uploaded files & dispatch to Budget
    const hardDoc = await routingService.registerHardCopyDocument(
      recordsOfficer,
      {
        title: 'Wet-Signed MOA Transmittal — School Rehab',
        categoryId,
        confidentialityTier: ConfidentialityTier.RESTRICTED,
        recipientUserId: budgetHead.id,
        remarks: 'Walk-in messenger carrying sealed envelope',
        physicalReference: 'Sealed Envelope #9',
        physicalPageCount: 12,
      },
      bundle.personnel,
    );

    expect(hardDoc.copyFormat).toBe(DocumentCopyFormat.HARD_COPY);
    expect(hardDoc.hasDigitalFile).toBe(false);
    expect(hardDoc.latestVersionOrNull).toBeNull();
    expect(hardDoc.physicalSummary).toBe('Sealed Envelope #9 · 12 pg(s)');

    const transmittalVerify = await docRepo.verifyTransmittalQr(hardDoc.qrToken);
    expect(transmittalVerify.latestChecksumShort).toBe('PHYSICAL-ONLY');
    expect(transmittalVerify.trackingCode).toBe(hardDoc.trackingCode);

    // Tracking lookup preserves CopyFormat while sealing pending incoming details until QR receipt is acknowledged
    await authRepo.login(budgetHead.email, 'SdoTrack#2026!');
    const budgetHeadSnapBeforeScan = await routingService.trackDocumentByCode(hardDoc.trackingCode);
    expect(budgetHeadSnapBeforeScan.copyFormat).toBe(DocumentCopyFormat.HARD_COPY);
    expect(budgetHeadSnapBeforeScan.hasDigitalFile).toBe(false);
    expect(budgetHeadSnapBeforeScan.physicalSummary).toBeNull();
    expect(budgetHeadSnapBeforeScan.canOpenFullRecord).toBe(false);
    expect(budgetHeadSnapBeforeScan.displayTitle).toBe('Sealed Incoming Document');

    const slipSha = sanitizer.computeSha256Bytes(new Uint8Array([0x73, 0x6c, 0x69, 0x70]));
    const receivedDoc = await routingService.acknowledgeReceipt(
      budgetHead,
      hardDoc,
      {
        uri: 'file:///cache/signed_slip_9.jpg',
        fileName: 'signed_slip_9.jpg',
        mimeType: 'image/jpeg',
        compressedBytes: 94_000,
        sha256Checksum: slipSha,
        exifStripped: true,
      },
      hardDoc.qrToken,
    );
    expect(receivedDoc.latestTransaction?.acknowledgedByName).toBe(budgetHead.fullName);
    expect(receivedDoc.latestTransaction?.proofPhoto?.exifStripped).toBe(true);

    // Once QR-acknowledged, physical summary is revealed in tracking snapshot
    const budgetHeadSnap = await routingService.trackDocumentByCode(hardDoc.trackingCode);
    expect(budgetHeadSnap.physicalSummary).toBe('Sealed Envelope #9 · 12 pg(s)');
    expect(budgetHeadSnap.canOpenFullRecord).toBe(true);

    // Later attaching an optional Scan v1 converts Hard Copy -> Hybrid cleanly
    const scanSha = sanitizer.computeSha256Bytes(new Uint8Array([0x70, 0x64, 0x66]));
    const hybridDoc = await routingService.uploadRevisionVersion(budgetHead, receivedDoc, {
      documentId: receivedDoc.id,
      fileUri: 'file:///cache/moa_scan_v1.pdf',
      fileName: 'moa_scan_v1.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 512_000,
      sha256Checksum: scanSha,
      revisionNote: 'Scanned after Budget Unit wet stamp',
    });
    expect(hybridDoc.copyFormat).toBe(DocumentCopyFormat.HYBRID);
    expect(hybridDoc.hasDigitalFile).toBe(true);
    expect(hybridDoc.latestVersion.versionNumber).toBe(1);

    // Originating a Soft Copy document validates SHA-256 and sets Digital copyFormat + v1
    await expect(
      routingService.createDigitalDocument(
        recordsOfficer,
        {
          title: 'Missing Checksum Upload',
          categoryId,
          confidentialityTier: ConfidentialityTier.STANDARD_INTERNAL,
          fileUri: 'file:///cache/doc.pdf',
          fileName: 'doc.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 12000,
          sha256Checksum: 'bad-sha',
        },
        bundle.personnel,
      ),
    ).rejects.toThrow('Valid SHA-256 checksum');

    const digitalDoc = await routingService.createDigitalDocument(
      recordsOfficer,
      {
        title: 'Division Memorandum — ICT Audit',
        categoryId,
        confidentialityTier: ConfidentialityTier.STANDARD_INTERNAL,
        fileUri: 'file:///cache/memo.pdf',
        fileName: 'memo.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 340000,
        sha256Checksum: scanSha,
        recipientUserId: budgetHead.id,
        remarks: 'Soft-copy transmittal for review',
      },
      bundle.personnel,
    );
    expect(digitalDoc.copyFormat).toBe(DocumentCopyFormat.DIGITAL);
    expect(digitalDoc.hasDigitalFile).toBe(true);
    expect(digitalDoc.latestVersion.versionNumber).toBe(1);
    expect(digitalDoc.latestVersion.fileName).toBe('memo.pdf');
  });

  test('retries transient GET network failures once and resets stale depedormin URLs in dev', async () => {
    await AsyncStorage.setItem('@sdo_doctrack/api_base_url', 'https://doctrack.depedormin.gov.ph/spi/v1');
    const cfg = new ApiConfig();
    const loaded = await cfg.loadSavedBaseUrl();
    expect(loaded).toBe('http://127.0.0.1:8000/api/v1');

    const tokenStore = new TestSecureTokenStore();
    const client = new ApiClient({ config: cfg, tokenStore });
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: ['ok'] }),
      } as unknown as Response);

    const res = await client.get<{ data: string[] }>('/offices');
    expect(res.data).toEqual(['ok']);
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // POST requests must never retry on network error
    fetchSpy.mockClear();
    fetchSpy.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(client.post('/documents', { title: 'Test' })).rejects.toThrow(
      'Unable to reach Tracely server',
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // Dev auth requests automatically fall back to Metro tunnel proxy if 127.0.0.1:8000 is unreachable
    fetchSpy.mockClear();
    fetchSpy
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ token: 'tok-proxy-1' }),
      } as unknown as Response);
    const authRes = await client.post<{ token: string }>('/auth/login', {
      identifier: 'records@deped.gov.ph',
      password: 'Secret#123',
    });
    expect(authRes.token).toBe('tok-proxy-1');
    expect(fetchSpy.mock.calls[1]?.[0]).toBe('http://127.0.0.1:8081/__doctrack_api/v1/auth/login');
    fetchSpy.mockRestore();

    // Verify 8000 <-> 8080 dev fallback symmetry so artisan on :8000 or :8080 works automatically
    expect(ApiConfig.getDevFallbackBaseUrls('http://127.0.0.1:8000/api/v1')).toEqual(
      expect.arrayContaining([
        'http://127.0.0.1:8081/__doctrack_api/v1',
        'http://127.0.0.1:8080/api/v1',
        'http://10.0.2.2:8080/api/v1',
      ]),
    );
    expect(ApiConfig.getDevFallbackBaseUrls('http://127.0.0.1:8080/api/v1')).toEqual(
      expect.arrayContaining([
        'http://127.0.0.1:8081/__doctrack_api/v1',
        'http://127.0.0.1:8000/api/v1',
      ]),
    );

    const freshClient = new ApiClient({ config: cfg, tokenStore });
    const direct8080Spy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ token: 'tok-8080-1' }),
      } as unknown as Response);
    const directRes = await freshClient.post<{ token: string }>('/auth/login', {
      identifier: 'records@deped.gov.ph',
      password: 'Secret#123',
    });
    expect(directRes.token).toBe('tok-8080-1');
    expect(direct8080Spy.mock.calls[0]?.[0]).toBe('http://127.0.0.1:8000/api/v1/auth/login');
    expect(direct8080Spy.mock.calls[1]?.[0]).toBe('http://127.0.0.1:8081/__doctrack_api/v1/auth/login');
    expect(direct8080Spy.mock.calls[2]?.[0]).toBe('http://127.0.0.1:8080/api/v1/auth/login');
    direct8080Spy.mockRestore();

    // Even if an already-running Metro proxy returns HTTP 502 BACKEND_UNREACHABLE (:8000),
    // ApiClient must continue falling back to direct :8080 instead of failing login.
    const staleMetroClient = new ApiClient({ config: cfg, tokenStore });
    const staleMetroSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Network request failed'))
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () =>
          JSON.stringify({
            code: 'BACKEND_UNREACHABLE',
            message: 'DocsTracker Laravel backend (:8000) is not running on this host.',
          }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ token: 'tok-8080-after-502' }),
      } as unknown as Response);
    const staleMetroRes = await staleMetroClient.post<{ token: string }>('/auth/login', {
      identifier: 'records@deped.gov.ph',
      password: 'Secret#123',
    });
    expect(staleMetroRes.token).toBe('tok-8080-after-502');
    expect(staleMetroSpy.mock.calls[1]?.[0]).toBe('http://127.0.0.1:8081/__doctrack_api/v1/auth/login');
    expect(staleMetroSpy.mock.calls[2]?.[0]).toBe('http://127.0.0.1:8080/api/v1/auth/login');
    staleMetroSpy.mockRestore();
  });

  test('normalizes renamed upload filenames, builds clean routing slip HTML, and rewrites signed viewer URLs to active dev host', async () => {
    expect(normalizeUploadFileName('Q4_Budget_Signed', 'scan_0042.pdf')).toBe(
      'Q4_Budget_Signed.pdf',
    );
    expect(normalizeUploadFileName('Q4_Budget_Signed.pdf', 'scan_0042.pdf')).toBe(
      'Q4_Budget_Signed.pdf',
    );
    expect(normalizeUploadFileName('../bad:name*?.jpg', 'IMG_01.JPG')).toBe('bad name .jpg');
    expect(normalizeUploadFileName('   ', 'original_scan.png')).toBe('original_scan.png');

    const html = buildRoutingSlipPrintHtml({
      qrPayload: 'SDO-QR:DOC:opaque123',
      trackingCode: 'SDO-OM-2026-000512',
      title: 'Budget Allocation Memo',
      categoryName: 'Office Memo',
      copyFormatLabel: 'Hard Copy',
      originOfficeLabel: 'BUDGET — Budget Unit',
      currentOfficeLabel: 'SGOD — SGOD Office',
      classificationLabel: 'Standard Internal',
      issuedDateLabel: "19 Nov, '26",
    });
    expect(html).toContain('OFFICIAL DOCUMENT ROUTING SLIP');
    expect(html).toContain('SDO-OM-2026-000512');
    expect(html).toContain('<svg');
    expect(html).toContain('Budget Allocation Memo');
    expect(html).toContain('RECEIVING OFFICE ACKNOWLEDGMENT');
    expect(html).toContain('Receiving Office Remarks / Action Taken');

    const confidentialHtml = buildRoutingSlipPrintHtml({
      qrPayload: 'SDO-QR:DOC:secret999',
      trackingCode: 'SDO-OM-2026-000999',
      title: 'Sensitive HR Case',
      isConfidential: true,
    });
    expect(confidentialHtml).not.toContain('Sensitive HR Case');
    expect(confidentialHtml).toContain('Confidential Record');

    const cfg8080 = new ApiConfig('http://127.0.0.1:8080/api/v1');
    const tokenStore = new TestSecureTokenStore();
    const apiClient = new ApiClient({ config: cfg8080, tokenStore });
    const repo = new HttpDocumentRepository(apiClient);
    const grantSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          url: 'http://127.0.0.1:8000/api/v1/documents/doc-1/versions/1/stream?expires=999&signature=abc',
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          ttl_seconds: 60,
          version: {
            id: 'ver-1',
            version_number: 1,
            file_name: 'Q4_Budget_Signed.pdf',
            mime_type: 'application/pdf',
            size_bytes: 1024,
            sha256_checksum: 'a'.repeat(64),
            uploaded_by_id: 'usr-1',
            uploaded_by_name: 'Marco Villanueva',
            uploaded_at: new Date().toISOString(),
            revision_note: 'Initial upload',
            storage_key: 'docs/doc-1/v1.pdf',
          },
        }),
    } as unknown as Response);

    try {
      const grant = await repo.issuePresignedViewGrant('doc-1', 1);
      expect(grant.url).toBe(
        'http://127.0.0.1:8080/api/v1/documents/doc-1/versions/1/stream?expires=999&signature=abc',
      );
      expect(grant.version.fileName).toBe('Q4_Budget_Signed.pdf');
    } finally {
      grantSpy.mockRestore();
    }
  });

  test('blocks sender self-dispatch/self-receipt on QR scan and supports Sent sorting & pagination', async () => {
    const { bundle, routingService, qrService, docRepo } = setupServices('usr-records-1');
    const recordsOfficer = bundle.personnel.find((p) => p.id === 'usr-records-1')!;
    const budgetHead = bundle.personnel.find((p) => p.id === 'usr-budget-1')!;

    // 1. Self-dispatch is blocked by DocumentRoutingService
    await expect(
      routingService.registerHardCopyDocument(
        recordsOfficer,
        {
          title: 'Self Dispatch Block Test',
          categoryId: bundle.categories[0].id,
          confidentialityTier: ConfidentialityTier.STANDARD_INTERNAL,
          recipientUserId: recordsOfficer.id,
        },
        bundle.personnel,
      ),
    ).rejects.toMatchObject({ code: 'SELF_DISPATCH_NOT_ALLOWED' });

    // 2. Dispatch a hard-copy doc from Records Officer to Budget Head, then scan its QR as Records Officer
    const sentDoc = await routingService.registerHardCopyDocument(
      recordsOfficer,
      {
        title: 'Alpha Sent Memo',
        categoryId: bundle.categories[0].id,
        confidentialityTier: ConfidentialityTier.STANDARD_INTERNAL,
        recipientUserId: budgetHead.id,
      },
      bundle.personnel,
    );

    const scanAsSender = await qrService.resolveRawQr(
      recordsOfficer,
      `SDO-QR:DOC:${sentDoc.qrToken}`,
    );
    expect(scanAsSender.kind).toBe('document_authorized');
    if (scanAsSender.kind === 'document_authorized') {
      expect(scanAsSender.sentByActor).toBe(true);
      expect(scanAsSender.pendingForActorOffice).toBe(false);
    }

    await expect(routingService.acknowledgeReceipt(recordsOfficer, sentDoc)).rejects.toMatchObject({
      code: 'SELF_RECEIPT_NOT_ALLOWED',
    });

    // 3. Recipient CAN scan & receive cleanly
    const scanAsRecipient = await qrService.resolveRawQr(
      budgetHead,
      `SDO-QR:DOC:${sentDoc.qrToken}`,
    );
    expect(scanAsRecipient.kind).toBe('document_authorized');
    if (scanAsRecipient.kind === 'document_authorized') {
      expect(scanAsRecipient.sentByActor).toBe(false);
      expect(scanAsRecipient.pendingForActorOffice).toBe(true);
    }

    // 4. Sent sorting & pagination
    await routingService.registerHardCopyDocument(
      recordsOfficer,
      {
        title: 'Zulu Sent Memo',
        categoryId: bundle.categories[0].id,
        confidentialityTier: ConfidentialityTier.STANDARD_INTERNAL,
        recipientUserId: budgetHead.id,
      },
      bundle.personnel,
    );

    const allDocs = await docRepo.listDocuments();
    const sentItems = selectSentDocuments(allDocs, recordsOfficer);
    expect(sentItems.length).toBeGreaterThanOrEqual(2);

    const asc = filterAndSortSentDocuments(sentItems, {
      statusFilter: 'all',
      query: '',
      sortMode: 'title_asc',
    });
    expect(asc[0].doc.title <= asc[asc.length - 1].doc.title).toBe(true);

    const page1 = paginateSentItems(asc, 1, 1);
    expect(page1.pageItems).toHaveLength(1);
    expect(page1.totalPages).toBe(asc.length);
    const page2 = paginateSentItems(asc, 2, 1);
    expect(page2.safePage).toBe(2);
    expect(page2.pageItems[0].doc.id).not.toBe(page1.pageItems[0].doc.id);

    // 5. Sent date-range filtering, 15/page default bounds, human status copy, and 2-up batch slips HTML
    const nowMs = Date.parse('2026-11-19T10:00:00Z');
    expect(matchesSentDateFilter('2026-11-19T08:30:00Z', 'today', nowMs)).toBe(true);
    expect(matchesSentDateFilter('2026-11-15T08:30:00Z', 'today', nowMs)).toBe(false);
    expect(matchesSentDateFilter('2026-11-15T08:30:00Z', 'week', nowMs)).toBe(true);
    expect(matchesSentDateFilter('2026-10-01T08:30:00Z', 'month', nowMs)).toBe(false);
    expect(sentItems[0].statusSummary).toMatch(/Waiting for|Received by|Held locally/);

    const emptyPagination = paginateSentItems([], 1, 15);
    expect(emptyPagination.totalPages).toBe(1);
    expect(emptyPagination.safePage).toBe(1);
    expect(emptyPagination.startIndex).toBe(0);

    const batchHtml = buildBatchRoutingSlipsPrintHtml([
      {
        qrPayload: 'SDO-QR:DOC:batch-1',
        trackingCode: 'SDO-OM-2026-001001',
        title: 'Batch Slip One',
      },
      {
        qrPayload: 'SDO-QR:DOC:batch-2',
        trackingCode: 'SDO-OM-2026-001002',
        title: 'Batch Slip Two',
      },
      {
        qrPayload: 'SDO-QR:DOC:batch-3',
        trackingCode: 'SDO-OM-2026-001003',
        title: 'Batch Slip Three',
      },
    ]);
    expect(batchHtml).toContain('1 OF 3');
    expect(batchHtml).toContain('2 OF 3');
    expect(batchHtml).toContain('3 OF 3');
    expect(batchHtml).toContain('cutline page-break');

    // 6. Official A4 Transmittal Sheet (Batch Manifest) masks confidential titles & renders QR + signatories
    const transmittalHtml = buildTransmittalSheetPrintHtml({
      referenceCode: 'TRM-20261119-01',
      issuedDateLabel: "19 Nov, '26",
      originOfficeLabel: 'RECORDS — Records Section',
      preparedBy: 'Elena Cruz',
      verifyQrPayload: 'SDO-QR:VERIFY:opaque123',
      items: [
        {
          trackingCode: 'SDO-OM-2026-001001',
          title: 'Division Memo on Budget Realignment',
          categoryName: 'Office Memo',
          formatInfo: 'Hard Copy · 4 pg(s)',
          destinationLabel: 'BUDGET — Budget Unit',
          receivedLabel: 'Pending',
          isConfidential: false,
        },
        {
          trackingCode: 'SDO-OM-2026-001002',
          title: 'Strictly Confidential HR Investigation File',
          categoryName: 'Legal Case',
          formatInfo: 'Digital',
          destinationLabel: 'LEGAL — Legal Unit',
          receivedLabel: '',
          isConfidential: true,
        },
      ],
    });
    expect(transmittalHtml).toContain('OFFICIAL DOCUMENT TRANSMITTAL SHEET');
    expect(transmittalHtml).toContain('TRM-20261119-01');
    expect(transmittalHtml).toContain('Division Memo on Budget Realignment');
    expect(transmittalHtml).not.toContain('Strictly Confidential HR Investigation File');
    expect(transmittalHtml).toContain('Confidential Record — Verify via Tracely QR');
    expect(transmittalHtml).toContain('<svg');
    expect(transmittalHtml).toContain('Released / Transmitted By');
    expect(transmittalHtml).toContain('Received Complete &amp; Verified By');
  });

  test('blocks pending recipient from presigned file view until QR/tracking-code receipt is confirmed', async () => {
    const { docRepo, qrService, routingService, bundle } = setupServices('usr-budget-1');
    const budgetOfficer = bundle.personnel.find((p) => p.id === 'usr-budget-1')!;
    const pendingDoc = await docRepo.getDocumentById('doc-142');

    // Pending recipient cannot open presigned file before confirming receipt
    await expect(
      routingService.issuePresignedViewGrant(budgetOfficer, pendingDoc, 1),
    ).rejects.toThrow(DomainRuleError);

    // Manual tracking code resolution (case-insensitive) + raw hex token both work cleanly
    const byTracking = await qrService.resolveRawQr(budgetOfficer, 'sdo-om-2026-000142');
    expect(byTracking.kind).toBe('document_authorized');
    if (byTracking.kind === 'document_authorized') {
      expect(byTracking.pendingForActorOffice).toBe(true);
      expect(byTracking.document.id).toBe('doc-142');
    }

    const byRawHex = await qrService.resolveRawQr(budgetOfficer, pendingDoc.qrToken);
    expect(byRawHex.kind).toBe('document_authorized');

    await expect(
      qrService.resolveRawQr(budgetOfficer, 'https://malicious.example.com'),
    ).rejects.toThrow(DomainRuleError);

    // After acknowledging receipt, presigned viewing immediately succeeds
    const unlocked = await routingService.acknowledgeReceipt(budgetOfficer, pendingDoc);
    const grant = await routingService.issuePresignedViewGrant(budgetOfficer, unlocked, 1);
    expect(grant.url).toContain('/presigned/doc-142/v1');
  });

  test('supports paired Tracely Web Unlock QR, 6-char short code, and Soft Copy password fallback while blocking Hard Copy password unlock', async () => {
    const { authRepo, docRepo, qrService, routingService, bundle } = setupServices('usr-budget-1');
    const budgetOfficer = bundle.personnel.find((p) => p.id === 'usr-budget-1')!;
    const recordsOfficer = bundle.personnel.find((p) => p.id === 'usr-records-1')!;

    // 1. Parser recognizes TRC-QR:UNLOCK: payloads and 6-character Web short codes
    const parsedQr = QrPayloadParser.parse('TRC-QR:UNLOCK:abcdef1234567890');
    expect(parsedQr.scenario).toBe('unlock_challenge');
    expect(parsedQr.opaqueToken).toBe('abcdef1234567890');

    const parsedShort = QrPayloadParser.parse('k7p492');
    expect(parsedShort.scenario).toBe('unlock_challenge');
    expect(parsedShort.opaqueToken).toBe('K7P-492');

    // 2. Consuming a seeded challenge unlocks doc-142 in one step & blocks replay
    docRepo.seedUnlockChallenge({
      documentId: 'doc-142',
      userId: budgetOfficer.id,
      token: 'abcdef1234567890',
      shortCode: 'K7P-492',
    });

    const synced = await qrService.resolveRawQr(budgetOfficer, 'K7P-492');
    expect(synced.kind).toBe('document_authorized');
    if (synced.kind === 'document_authorized') {
      expect(synced.unlockedViaSync).toBe(true);
      expect(synced.pendingForActorOffice).toBe(false);
      expect(synced.document.id).toBe('doc-142');
    }

    await expect(qrService.resolveRawQr(budgetOfficer, 'K7P-492')).rejects.toThrow(
      'already been used',
    );

    // 3. Hard Copy rejects password unlock while Soft Copy accepts password unlock
    await authRepo.login(recordsOfficer.email, 'Tracely#2026');
    const hardDoc = await routingService.registerHardCopyDocument(
      recordsOfficer,
      {
        title: 'Physical Routing Folder — No Password Bypass',
        categoryId: bundle.categories[0].id,
        confidentialityTier: ConfidentialityTier.STANDARD_INTERNAL,
        recipientUserId: budgetOfficer.id,
      },
      bundle.personnel,
    );

    const softDoc = await routingService.createDigitalDocument(
      recordsOfficer,
      {
        title: 'Soft Copy Memo — Password Fallback Ready',
        categoryId: bundle.categories[0].id,
        confidentialityTier: ConfidentialityTier.STANDARD_INTERNAL,
        fileUri: 'file:///cache/memo_pw.pdf',
        fileName: 'memo_pw.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 12000,
        sha256Checksum: 'a'.repeat(64),
        recipientUserId: budgetOfficer.id,
      },
      bundle.personnel,
    );

    await authRepo.login(budgetOfficer.email, 'Tracely#2026');
    await expect(
      routingService.acknowledgeReceipt(budgetOfficer, hardDoc, null, undefined, 'Tracely#2026'),
    ).rejects.toMatchObject({ code: 'PASSWORD_UNLOCK_NOT_ALLOWED' });

    const unlockedViaPassword = await routingService.acknowledgeReceipt(
      budgetOfficer,
      softDoc,
      null,
      undefined,
      'Tracely#2026',
    );
    expect(unlockedViaPassword.latestTransaction?.acknowledgedByName).toBe(budgetOfficer.fullName);
  });

  test('persists per-user offline workspace cache and supports self-service password reset', async () => {
    const { bundle, routingService } = setupServices('usr-budget-1');
    const budgetOfficer = bundle.personnel.find((p) => p.id === 'usr-budget-1')!;
    const tracked = await routingService.listTrackedDocuments(budgetOfficer);

    await AsyncWorkspaceCacheStore.save(budgetOfficer.id, {
      trackedSnapshots: tracked,
      categories: bundle.categories,
      offices: bundle.offices,
    });
    const hydrated = await AsyncWorkspaceCacheStore.load(budgetOfficer.id);
    expect(hydrated).not.toBeNull();
    expect(hydrated!.trackedSnapshots.length).toBe(tracked.length);
    expect(hydrated!.categories.length).toBe(bundle.categories.length);
    expect(hydrated!.offices.length).toBe(bundle.offices.length);

    // Clearing cache removes it cleanly (e.g., on sign-out)
    await AsyncWorkspaceCacheStore.clear(budgetOfficer.id);
    expect(await AsyncWorkspaceCacheStore.load(budgetOfficer.id)).toBeNull();

    // Self-service password reset validates reset code and strong password
    const authRepo = new TestAuthRepository(bundle.personnel, 'usr-budget-1');
    const authService = new AuthSessionService(authRepo, new TestSecureTokenStore());
    const req = await authService.requestPasswordReset('budget@tracely.app');
    expect(req.devResetCode).toBe('K7P-492');

    await expect(
      authService.confirmPasswordReset('budget@tracely.app', 'K7P-492', 'weak', 'weak'),
    ).rejects.toThrow(DomainRuleError);

    const msg = await authService.confirmPasswordReset(
      'budget@tracely.app',
      'K7P-492',
      'StrongReset#2026!',
      'StrongReset#2026!',
    );
    expect(msg).toContain('Password reset successful');
  });
});
