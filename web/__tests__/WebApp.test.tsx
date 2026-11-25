import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from '../src/App';
import FuseButton from '../src/components/FuseButton';
import { parseOpaqueQrToken, WebBackendGateway } from '../src/domain/qrPolicy';
import { getWebDevFallbackBaseUrls, LaravelSanctumGateway } from '../src/services/webApiClient';
import {
  DocumentCategory,
  DocumentRecord,
  DocumentTrackingSnapshot,
  Personnel,
} from '../src/domain/types';

function createMockGateway(overrides: Partial<WebBackendGateway> = {}): WebBackendGateway {
  const actor: Personnel = {
    id: 'usr-1',
    fullName: 'Marco Villanueva',
    employeeId: 'EMP-2026-0142',
    email: 'marco.villanueva@deped.gov.ph',
    position: 'Administrative Officer IV',
    roleLabel: 'Unit Head',
    office: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
    availability: 'available',
    initials: 'MV',
  };

  const docs: DocumentRecord[] = [];

  return {
    login: async () => ({ bearerToken: 'token-123', user: actor }),
    register: async () => ({
      pendingApproval: true,
      message: 'Registration submitted for SDO ICT/HR verification.',
    }),
    logout: async () => {},
    listWorkspace: async () => ({
      offices: [actor.office],
      personnel: [actor],
      documents: docs,
      trackedSnapshots: [],
      categories: [
        {
          id: 'cat-bur',
          name: 'Budget Utilization Request',
          code: 'BUR',
          declaredByOfficeCode: 'BUDGET',
          isGlobal: true,
        },
      ],
      notifications: [],
    }),
    trackByCode: async () => null,
    createDigitalDocument: async () => {
      throw new Error('Not needed in test');
    },
    registerHardCopyDocument: async (payload) => {
      const created: DocumentRecord = {
        id: 'doc-hc-1',
        trackingCode: 'SDO-OM-2026-000501',
        qrToken: 'opaque-hc-token-1',
        title: payload.title,
        categoryId: payload.categoryId,
        categoryName: 'Budget Utilization Request',
        confidentialityTier: payload.confidentialityTier,
        copyFormat: 'hard_copy',
        lifecycleStatus: 'registered',
        slaState: 'on_track',
        slaDueAt: null,
        originOffice: actor.office,
        currentOffice: actor.office,
        submittedSchoolName: null,
        submittedSchoolId: null,
        physicalReference: payload.physicalReference ?? null,
        physicalPageCount: payload.physicalPageCount ?? null,
        versions: [],
        transactions: [],
        createdAt: new Date().toISOString(),
      };
      docs.push(created);
      return created;
    },
    acknowledgeReceipt: async () => docs[0],
    forwardDocument: async () => docs[0],
    returnForRevision: async () => docs[0],
    declineMisrouted: async () => docs[0],
    recallTransfer: async () => docs[0],
    uploadRevision: async () => docs[0],
    issuePresignedView: async () => {
      throw new Error('No version');
    },
    resolveQr: async () => ({
      kind: 'transmittal_verified',
      trackingCode: 'SDO-OM-2026-000142',
      lifecycleStatus: 'in_review',
      currentOfficeName: 'Budget Unit',
      latestChecksumShort: 'abcd1234',
      milestoneCount: 2,
    }),
    createDesktopPairSession: async (draftLabel) => ({
      pairToken: 'pair-token-1',
      draftLabel,
      expiresAt: new Date().toISOString(),
    }),
    createUnlockChallenge: async (documentId) => ({
      challengeId: `chl-${documentId}`,
      documentId,
      token: `unlocktoken${documentId.replace(/[^a-z0-9]/gi, '')}123456`,
      qrPayload: `TRC-QR:UNLOCK:unlocktoken${documentId.replace(/[^a-z0-9]/gi, '')}123456`,
      shortCode: 'K7P-492',
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    }),
    consumeUnlockChallenge: async () => docs[0],
    declareCategory: async (name, code) => ({
      id: `cat-${code}`,
      name,
      code,
      declaredByOfficeCode: 'BUDGET',
      isGlobal: true,
    }),
    markAllNotificationsRead: async () => {},
    listAuditLogs: async () => [],
    updateAvailability: async () => actor,
    listActiveSessions: async () => [],
    revokeOtherSessions: async () => 0,
    changePassword: async () => {},
    ...overrides,
  };
}

describe('DocsTracker Web App', () => {
  beforeEach(() => {
    window.location.hash = '#/inbox';
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.location.hash = '';
    window.localStorage.clear();
  });

  it('opens Dashboard automatically on initial open (empty hash) and falls back legacy #/scanner hash to Inbox', () => {
    window.location.hash = '';
    const gateway = createMockGateway();
    render(<App gateway={gateway} requireAuth={false} firstVisitSkeletonMs={0} />);

    expect(screen.getByText('Tracely')).toBeTruthy();
    expect(screen.getByTestId('web-dashboard-page')).toBeTruthy();
    expect(screen.getByTestId('web-dashboard-wallet-card-lanyard-stage')).toBeTruthy();
    expect(screen.queryByTestId('web-qr-camera')).toBeNull();
    expect(screen.queryByRole('button', { name: /QR Scanner/i })).toBeNull();

    // Legacy #/scanner URL gracefully falls back to Inbox
    act(() => {
      window.location.hash = '#/scanner';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByText('Desk Queue Overview')).toBeTruthy();
    expect(screen.getByTestId('web-mobile-companion-card')).toBeTruthy();
  });

  it('supports minimalist Send Document flow with Hard Copy QR slip generation', async () => {
    const actor: Personnel = {
      id: 'usr-1',
      fullName: 'Marco Villanueva',
      employeeId: 'EMP-2026-0142',
      email: 'marco.villanueva@deped.gov.ph',
      position: 'Administrative Officer IV',
      roleLabel: 'Unit Head',
      office: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
      availability: 'available',
      initials: 'MV',
    };

    const gateway = createMockGateway();
    render(<App gateway={gateway} initialActor={actor} />);

    // Open highlighted Send Document view from Sidebar
    const sendButtons = screen.getAllByRole('button', { name: /Send Document/i });
    fireEvent.click(sendButtons[0]);

    expect(screen.getByRole('tab', { name: /Soft Copy/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Hard Copy/i })).toBeTruthy();

    // Switch to Hard Copy
    fireEvent.click(screen.getByRole('tab', { name: /Hard Copy/i }));
    expect(screen.getByLabelText('Folder / Slip Note')).toBeTruthy();

    // Expand progressive-disclosure options
    fireEvent.click(screen.getByRole('button', { name: /Change/i }));
    expect(screen.getByText('Confidentiality')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Document Title'), {
      target: { value: 'Wet-Signed Payroll Transmittal Batch' },
    });
    fireEvent.change(screen.getByLabelText('Folder / Slip Note'), {
      target: { value: 'Green folder · Slip #7' },
    });
    fireEvent.change(screen.getByLabelText('Pages'), { target: { value: '14' } });

    fireEvent.click(screen.getByRole('button', { name: /Generate QR Slip/i }));

    await waitFor(() => {
      expect(screen.getByText('Routing Slip QR')).toBeTruthy();
    });
    expect(screen.getByText('TRC-QR:DOC:opaque-hc-token-1')).toBeTruthy();
  });

  it('validates registration fields, custom offices, and typing-only password rules in LoginPage', () => {
    const gateway = createMockGateway();
    render(<App gateway={gateway} requireAuth />);

    expect(screen.getByText('Tracely')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Create Account/i }));

    // Live Identity Wallet Card auto-fills in sync as the user types registration fields
    expect(screen.getByTestId('web-register-live-card')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Full Name'), {
      target: { value: 'Michael Adams' },
    });
    fireEvent.change(screen.getByLabelText('Employee ID'), {
      target: { value: 'EMP-2026-5678' },
    });
    fireEvent.change(screen.getByLabelText('Designation / Position'), {
      target: { value: 'Senior Records Specialist' },
    });
    expect(screen.getByTestId('web-register-live-card-name').textContent).toBe('Michael Adams');
    expect(screen.getByTestId('web-register-live-card-employee-id').textContent).toBe(
      'EMP-2026-5678',
    );
    expect(screen.getByTestId('web-register-live-card-position').textContent).toBe(
      'Senior Records Specialist',
    );
    fireEvent.click(screen.getByTestId('web-register-live-card-mask-btn'));
    expect(screen.getByTestId('web-register-live-card-employee-id').textContent).toContain('5678');
    fireEvent.click(screen.getByTestId('web-register-live-card-mask-btn'));

    expect(screen.queryByText('Upper & lower')).toBeNull();

    fireEvent.change(screen.getByLabelText('Create Password'), {
      target: { value: 'Sdo#2026' },
    });
    expect(screen.getByText('8–32 chars')).toBeTruthy();
    expect(screen.getByText('Upper & lower')).toBeTruthy();

    fireEvent.change(screen.getByTestId('web-register-office-select'), {
      target: { value: '__CUSTOM__' },
    });
    expect(screen.getByLabelText('Custom Office / Unit Code')).toBeTruthy();
    expect(screen.getByLabelText('Custom Office / Unit Name')).toBeTruthy();
  });

  it('syncs URL hash, supports USB scanner + batch queue, and persists Recent Scans in localStorage', async () => {
    const sampleDoc: DocumentRecord = {
      id: 'doc-142',
      trackingCode: 'SDO-OM-2026-000142',
      qrToken: 'tok-142',
      title: 'DRRM Funding Request',
      categoryId: 'cat-bur',
      categoryName: 'Budget Utilization Request',
      confidentialityTier: 'standard_internal',
      copyFormat: 'hard_copy',
      lifecycleStatus: 'in_transit',
      slaState: 'at_risk',
      slaDueAt: new Date(Date.now() + 3600_000).toISOString(),
      originOffice: { id: 'off-sgod', code: 'SGOD', name: 'SGOD' },
      currentOffice: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
      submittedSchoolName: null,
      submittedSchoolId: null,
      physicalReference: 'Folder #2',
      physicalPageCount: 5,
      versions: [],
      transactions: [
        {
          id: 'tx-1',
          fromOffice: { id: 'off-sgod', code: 'SGOD', name: 'SGOD' },
          toOffice: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
          recipientName: 'Marco Villanueva',
          scope: 'inter_office',
          status: 'pending',
          remarks: 'For ORS',
          sentAt: new Date().toISOString(),
          receivedAt: null,
          receivedByName: null,
        },
      ],
      createdAt: new Date().toISOString(),
    };
    const actor: Personnel = {
      id: 'usr-1',
      fullName: 'Marco Villanueva',
      employeeId: 'EMP-2026-0142',
      email: 'marco.villanueva@deped.gov.ph',
      position: 'Administrative Officer IV',
      roleLabel: 'Unit Head',
      office: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
      availability: 'available',
      initials: 'MV',
    };

    const unlockedSampleDoc: DocumentRecord = {
      ...sampleDoc,
      lifecycleStatus: 'in_review',
      transactions: [
        {
          ...sampleDoc.transactions[0],
          status: 'acknowledged',
          receivedAt: new Date().toISOString(),
          receivedByName: actor.fullName,
        },
      ],
    };

    const acknowledgeReceipt = vi.fn(async () => unlockedSampleDoc);

    const gateway = createMockGateway({
      listWorkspace: async () => ({
        offices: [actor.office],
        personnel: [actor],
        documents: [sampleDoc],
        trackedSnapshots: [],
        categories: [],
        notifications: [],
      }),
      resolveQr: async () => ({
        kind: 'document_authorized',
        document: sampleDoc,
        pendingForActorOffice: true,
        verificationCode: 'tok-142',
      }),
      acknowledgeReceipt,
    });

    const firstRender = render(<App gateway={gateway} initialActor={actor} firstVisitSkeletonMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: /^Sync$/i }));

    // Clicking sealed Hard Copy card opens Receive Hard Copy modal accepting USB QR scanner input
    const trigger = await screen.findByTestId('sealed-qr-trigger-doc-142');
    fireEvent.click(trigger);

    expect(await screen.findByTestId('web-hard-copy-receive-modal')).toBeTruthy();
    const usbInput = screen.getByLabelText('Tracking Code Input');
    fireEvent.change(usbInput, { target: { value: 'TRC-QR:DOC:tok-142' } });
    fireEvent.submit(screen.getByTestId('web-hard-copy-code-form'));

    await waitFor(() => {
      expect(acknowledgeReceipt).toHaveBeenCalledWith(
        'doc-142',
        undefined,
        undefined,
        'tok-142',
        undefined,
      );
    });
    expect(window.location.hash).toBe('#/document/doc-142');

    // Navigating to Track Docs updates hash and restores cleanly across reload
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    fireEvent.click(within(nav).getByRole('button', { name: /Track Docs/i }));
    expect(window.location.hash).toBe('#/track');

    firstRender.unmount();

    render(<App gateway={gateway} initialActor={actor} firstVisitSkeletonMs={0} />);
    expect(screen.getByText('Track Documents')).toBeTruthy();
  });

  it('supports SLA banner, Inbox filters/bulk confirm, CSV export, and Session Lock on Confidential 60s view', async () => {
    const actor: Personnel = {
      id: 'usr-1',
      fullName: 'Marco Villanueva',
      employeeId: 'EMP-2026-0142',
      email: 'marco.villanueva@deped.gov.ph',
      position: 'Administrative Officer IV',
      roleLabel: 'Unit Head',
      office: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
      availability: 'available',
      initials: 'MV',
    };

    const pendingDoc: DocumentRecord = {
      id: 'doc-142',
      trackingCode: 'SDO-OM-2026-000142',
      qrToken: 'tok-142',
      title: 'DRRM Funding Request',
      categoryId: 'cat-bur',
      categoryName: 'Budget Utilization Request',
      confidentialityTier: 'standard_internal',
      copyFormat: 'hard_copy',
      lifecycleStatus: 'in_transit',
      slaState: 'at_risk',
      slaDueAt: new Date(Date.now() + 3600_000).toISOString(),
      originOffice: { id: 'off-sgod', code: 'SGOD', name: 'SGOD' },
      currentOffice: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
      submittedSchoolName: null,
      submittedSchoolId: null,
      physicalReference: 'Folder #2',
      physicalPageCount: 5,
      versions: [],
      transactions: [
        {
          id: 'tx-1',
          fromOffice: { id: 'off-sgod', code: 'SGOD', name: 'SGOD' },
          toOffice: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
          recipientName: 'Marco Villanueva',
          scope: 'inter_office',
          status: 'pending',
          remarks: 'For ORS',
          sentAt: new Date().toISOString(),
          receivedAt: null,
          receivedByName: null,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const restrictedDoc: DocumentRecord = {
      id: 'doc-115',
      trackingCode: 'SDO-OM-2026-000115',
      qrToken: 'tok-115',
      title: 'Confidential Personnel Record',
      categoryId: 'cat-bur',
      categoryName: 'Budget Utilization Request',
      confidentialityTier: 'restricted',
      copyFormat: 'digital',
      lifecycleStatus: 'in_review',
      slaState: 'on_track',
      slaDueAt: new Date(Date.now() + 86_400_000).toISOString(),
      originOffice: actor.office,
      currentOffice: actor.office,
      submittedSchoolName: null,
      submittedSchoolId: null,
      physicalReference: null,
      physicalPageCount: null,
      versions: [
        {
          versionNumber: 1,
          fileName: 'restricted_pack.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 12000,
          sha256Checksum: 'abcdef0123456789',
          uploadedAt: new Date().toISOString(),
          uploadedByName: 'Marco Villanueva',
          note: 'Initial upload',
        },
      ],
      transactions: [],
      createdAt: new Date().toISOString(),
    };

    const acknowledgeReceipt = vi.fn(async () => ({
      ...pendingDoc,
      lifecycleStatus: 'in_review' as const,
      transactions: [{ ...pendingDoc.transactions[0], status: 'acknowledged' as const }],
    }));

    const gateway = createMockGateway({
      listWorkspace: async () => ({
        offices: [actor.office],
        personnel: [actor],
        documents: [pendingDoc, restrictedDoc],
        trackedSnapshots: [],
        categories: [
          {
            id: 'cat-bur',
            name: 'Budget Utilization Request',
            code: 'BUR',
            declaredByOfficeCode: 'BUDGET',
            isGlobal: true,
          },
        ],
        notifications: [],
      }),
      acknowledgeReceipt,
      issuePresignedView: async () => ({
        url: 'https://files.example.test/signed.pdf',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        ttlSeconds: 60,
        version: restrictedDoc.versions[0],
      }),
    });

    render(<App gateway={gateway} initialActor={actor} />);
    fireEvent.click(screen.getByRole('button', { name: /^Sync$/i }));

    // Pending incoming doc is sealed as a clickable QR card (hiding real code & title until scanned)
    await waitFor(() => {
      expect(screen.getByTestId('sealed-qr-card-doc-142')).toBeTruthy();
    });
    expect(screen.queryByText('SDO-OM-2026-000142')).toBeNull();
    expect(screen.queryByText('DRRM Funding Request')).toBeNull();
    expect(screen.getByText('Sealed Incoming Document')).toBeTruthy();
    expect(screen.getByText('1 due soon')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Filters/i }));
    expect(screen.getByRole('button', { name: 'Hard Copy' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sort: SLA Urgent' })).toBeTruthy();

    // Bulk Select never allows non-scan Confirm on sealed incoming docs; surfaces Sealed Incoming instead
    fireEvent.click(screen.getByRole('button', { name: /^Select$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Select Unlocked/i }));
    expect(screen.queryByRole('button', { name: /^Confirm \(1\)$/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Sealed Incoming \(1\)/i })).toBeTruthy();
    expect(acknowledgeReceipt).not.toHaveBeenCalled();

    // Exit Select mode and open Restricted document -> Session lock gates 60s signed Open File link
    fireEvent.click(screen.getByRole('button', { name: /^Done$/i }));
    fireEvent.click(screen.getByText('SDO-OM-2026-000115'));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^View$/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /^View$/i }));

    await waitFor(() => {
      expect(screen.getByText('Session Verification Required')).toBeTruthy();
    });
    expect(screen.queryByText('Open File')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Confirm Access as Marco Villanueva/i }));
    expect(screen.getByText('Open File')).toBeTruthy();
    expect(screen.getByTestId('web-viewer-watermark')).toBeTruthy();
  });

  it('auto-checks desktop mobile pairing attachment status in SendPage', async () => {
    const gateway = createMockGateway({
      getDesktopPairStatus: async (pairToken) => ({
        pairToken,
        attached: true,
        fileName: 'phone_scan.jpg',
        sha256Checksum: 'deadbeef12345678',
        compressedBytes: 98_000,
      }),
    });

    render(<App gateway={gateway} requireAuth={false} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Send Document/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Pair Mobile Camera/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Check Sync/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /Check Sync/i }));

    await waitFor(() => {
      expect(screen.getByText('Photo Attached from Mobile')).toBeTruthy();
    });
    expect(screen.getByText(/Synced from Mobile: phone_scan\.jpg/i)).toBeTruthy();
  });

  it('supports multi-file Soft Copy Bundle (1 QR) and Separate Docs Batch Send on SendPage', async () => {
    const actor: Personnel = {
      id: 'usr-1',
      fullName: 'Marco Villanueva',
      employeeId: 'EMP-2026-0142',
      email: 'marco.villanueva@deped.gov.ph',
      position: 'Administrative Officer IV',
      roleLabel: 'Unit Head',
      office: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
      availability: 'available',
      initials: 'MV',
    };

    let docSeq = 600;
    const docsMap = new Map<string, DocumentRecord>();
    const createDigitalDocument = vi.fn(async (payload) => {
      docSeq += 1;
      const created: DocumentRecord = {
        id: `doc-sc-${docSeq}`,
        trackingCode: `SDO-OM-2026-000${docSeq}`,
        qrToken: `opaque-sc-${docSeq}`,
        title: payload.title,
        categoryId: payload.categoryId,
        categoryName: 'Budget Utilization Request',
        confidentialityTier: payload.confidentialityTier,
        copyFormat: 'digital',
        lifecycleStatus: 'in_review',
        slaState: 'on_track',
        slaDueAt: null,
        originOffice: actor.office,
        currentOffice: actor.office,
        submittedSchoolName: null,
        submittedSchoolId: null,
        physicalReference: null,
        physicalPageCount: null,
        versions: [
          {
            versionNumber: 1,
            fileName: payload.file.name,
            mimeType: payload.file.type || 'application/pdf',
            sizeBytes: payload.file.size,
            sha256Checksum: payload.sha256Checksum,
            uploadedAt: new Date().toISOString(),
            uploadedByName: actor.fullName,
            note: 'Initial upload',
          },
        ],
        transactions: [],
        createdAt: new Date().toISOString(),
      };
      docsMap.set(created.id, created);
      return created;
    });
    const uploadRevision = vi.fn(async (payload) => {
      const existing = docsMap.get(payload.documentId)!;
      const updated: DocumentRecord = {
        ...existing,
        versions: [
          ...existing.versions,
          {
            versionNumber: existing.versions.length + 1,
            fileName: payload.file.name,
            mimeType: payload.file.type || 'image/png',
            sizeBytes: payload.file.size,
            sha256Checksum: payload.sha256Checksum,
            uploadedAt: new Date().toISOString(),
            uploadedByName: actor.fullName,
            note: payload.revisionNote,
          },
        ],
      };
      docsMap.set(updated.id, updated);
      return updated;
    });

    const gateway = createMockGateway({ createDigitalDocument, uploadRevision });
    const { container } = render(<App gateway={gateway} initialActor={actor} />);

    fireEvent.click(screen.getAllByRole('button', { name: /Send Document/i })[0]);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const f1 = new File(['hello'], 'memo.pdf', { type: 'application/pdf' });
    const f2 = new File(['world'], 'annex.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [f1, f2] } });

    expect(screen.getByRole('tab', { name: /One Document \(2 files\)/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Separate Docs \(2 codes\)/i })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Document Title'), {
      target: { value: 'Bundled Q4 Request' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Upload Bundle \(2\)/i }));

    await waitFor(() => {
      expect(screen.getByText('Routing Slip QR')).toBeTruthy();
    });
    expect(createDigitalDocument).toHaveBeenCalledTimes(1);
    expect(uploadRevision).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /^Done$/i }));

    // Now test Separate Docs (Batch Send) with per-file custom titles
    const o1 = new File(['a'], 'order1.pdf', { type: 'application/pdf' });
    const o2 = new File(['b'], 'order2.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [o1, o2] } });
    fireEvent.click(screen.getByRole('tab', { name: /Separate Docs \(2 codes\)/i }));
    fireEvent.change(screen.getByLabelText(/Document Title/i), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Title for order1.pdf'), {
      target: { value: 'SGOD Memo Endorsement' },
    });
    fireEvent.change(screen.getByLabelText('Title for order2.pdf'), {
      target: { value: 'Division Travel Order' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Batch Upload \(2\)/i }));

    await waitFor(() => {
      expect(screen.getByText('Batch Issued (2 documents)')).toBeTruthy();
    });
    expect(screen.getByText('SGOD Memo Endorsement')).toBeTruthy();
    expect(screen.getByText('Division Travel Order')).toBeTruthy();
    expect(createDigitalDocument).toHaveBeenCalledTimes(3);
  });

  it('sends Bearer token synchronously on immediate post-login workspace hydration and mirrors mobile sidebar screens without highlighting Send Document', async () => {
    const authHeadersSeen: Array<{ path: string; auth: string | null }> = [];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const headers = new Headers(init?.headers);
      const auth = headers.get('Authorization');
      authHeadersSeen.push({ path: url, auth });

      if (url.endsWith('/auth/login')) {
        return new Response(
          JSON.stringify({
            token: 'sanctum-token-live-1',
            bearer_token: 'sanctum-token-live-1',
            user: {
              id: 'usr-99',
              employee_id: 'EMP-2026-0099',
              full_name: 'Elena Reyes',
              position: 'Records Officer III',
              office: { id: 'off-records', code: 'RECORDS', name: 'Records Section' },
              role: 'records_officer',
              email: 'elena.reyes@deped.gov.ph',
              availability: 'available',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }

      if (!auth || auth !== 'Bearer sanctum-token-live-1') {
        return new Response(JSON.stringify({ message: 'Unauthenticated.' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    render(<App requireAuth={false} />);

    // Verify Web sidebar screens are present (without QR Scanner), Track Docs is included, Categories is not in mobile bottom nav, and Send Document is not highlighted
    const sidebarNav = screen.getByRole('navigation', { name: 'Main navigation' });
    for (const label of [
      'Inbox',
      'Send Document',
      'Sent Files',
      'Completed',
      'Document Detail',
      'Track Docs',
      'Categories',
      'Alerts & Sync',
      'Profile',
    ]) {
      expect(sidebarNav.textContent).toContain(label);
    }
    expect(sidebarNav.textContent).not.toContain('QR Scanner');
    const mobileBottomNav = screen.getByRole('navigation', { name: 'Mobile quick navigation' });
    expect(mobileBottomNav.textContent).toContain('Track');
    expect(mobileBottomNav.textContent).not.toContain('Categories');
    expect(screen.queryByRole('button', { name: /Track Code/i })).toBeNull();
    const sidebarSendBtn = screen.getAllByRole('button', { name: /Send Document/i })[0];
    expect(sidebarSendBtn.className).not.toContain('nav-item-featured');

    // Open Login and sign in via real LaravelSanctumGateway + fetch
    fireEvent.click(screen.getByRole('button', { name: /Sign In \/ Register/i }));
    fireEvent.change(screen.getByLabelText(/Employee ID or Work Email/i), {
      target: { value: 'EMP-2026-0099' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Strong#Pass1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In to Tracely/i }));

    await waitFor(() => {
      expect(screen.getByText('Signed in securely.')).toBeTruthy();
    });
    expect(screen.queryByText('Unauthenticated.')).toBeNull();

    const workspaceCalls = authHeadersSeen.filter((c) => !c.path.endsWith('/auth/login'));
    expect(workspaceCalls.length).toBeGreaterThanOrEqual(6);
    for (const call of workspaceCalls) {
      expect(call.auth).toBe('Bearer sanctum-token-live-1');
    }
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('renders WebBootSkeleton on first boot hydration and never displays it again after a screen opens', async () => {
    window.localStorage.setItem('@sdo_doctrack/web_bearer_token', 'boot-token-1');
    window.localStorage.setItem(
      '@sdo_doctrack/web_actor',
      JSON.stringify({
        id: 'usr-1',
        fullName: 'Elena Reyes',
        employeeId: 'EMP-2026-0099',
        email: 'elena.reyes@deped.gov.ph',
        position: 'Records Officer III',
        roleLabel: 'Records Officer',
        office: { id: 'off-records', code: 'RECORDS', name: 'Records Section' },
        availability: 'available',
        initials: 'ER',
      }),
    );

    let releaseWorkspace!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseWorkspace = resolve;
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      await gate;
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    render(<App requireAuth={false} />);
    expect(screen.getByTestId('web-boot-skeleton')).toBeTruthy();

    releaseWorkspace();
    await waitFor(() => {
      expect(screen.queryByTestId('web-boot-skeleton')).toBeNull();
    });
    expect(screen.getByText('Needs your action')).toBeTruthy();

    // Switching screens must never show the boot skeleton again
    fireEvent.click(screen.getAllByRole('button', { name: /^Track Docs$/i })[0]);
    expect(screen.queryByTestId('web-boot-skeleton')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: /^Categories$/i })[0]);
    expect(screen.queryByTestId('web-boot-skeleton')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: /^Inbox/i })[0]);
    expect(screen.queryByTestId('web-boot-skeleton')).toBeNull();
  });

  it('shows per-screen first-render skeletons once per screen and navigates Track tab cleanly without Track Code badge', async () => {
    const { act } = await import('@testing-library/react');
    vi.useFakeTimers();
    try {
      const gw = createMockGateway();
      render(
        <App
          gateway={gw}
          initialActor={{
            id: 'usr-1',
            fullName: 'Elena Reyes',
            employeeId: 'EMP-2026-0099',
            email: 'elena.reyes@deped.gov.ph',
            position: 'Records Officer III',
            roleLabel: 'Records Officer',
            office: { id: 'off-records', code: 'RECORDS', name: 'Records Section' },
            availability: 'available',
            initials: 'ER',
          }}
          firstVisitSkeletonMs={250}
        />,
      );

      // Initial render shows Inbox boot skeleton, never renders Track Code badge
      expect(screen.getByTestId('web-boot-skeleton')).toBeTruthy();

      await act(async () => {
        vi.advanceTimersByTime(260);
      });
      expect(screen.queryByTestId('web-boot-skeleton')).toBeNull();
      expect(screen.getByText('Needs your action')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /Track Code/i })).toBeNull();

      // Switch to Track via mobile quick nav button — first visit shows track skeleton once
      const bottomNav = screen.getByRole('navigation', { name: 'Mobile quick navigation' });
      const trackTabBtn = Array.from(bottomNav.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Track'),
      )!;
      expect(trackTabBtn).toBeTruthy();

      fireEvent.click(trackTabBtn);
      expect(screen.getByTestId('web-skeleton-track')).toBeTruthy();
      await act(async () => {
        vi.advanceTimersByTime(260);
      });
      expect(screen.queryByTestId('web-skeleton-track')).toBeNull();
      expect(screen.getByRole('button', { name: /Lookup Code/i })).toBeTruthy();

      // Check remaining workspace screens display their skeleton once on first open
      const screenChecks: Array<{ btnPattern: RegExp; testId: string }> = [
        { btnPattern: /^Send Document$/i, testId: 'web-skeleton-send' },
        { btnPattern: /^Document Detail$/i, testId: 'web-skeleton-document' },
        { btnPattern: /^Categories$/i, testId: 'web-skeleton-categories' },
        { btnPattern: /^Alerts & Sync/i, testId: 'web-skeleton-alerts' },
        { btnPattern: /^Profile$/i, testId: 'web-skeleton-profile' },
      ];

      for (const check of screenChecks) {
        const nav = screen.getByRole('navigation', { name: 'Main navigation' });
        const navBtn = Array.from(nav.querySelectorAll('button')).find((b) =>
          check.btnPattern.test(b.textContent ?? ''),
        )!;
        fireEvent.click(navBtn);
        expect(screen.getByTestId(check.testId)).toBeTruthy();
        await act(async () => {
          vi.advanceTimersByTime(260);
        });
        expect(screen.queryByTestId(check.testId)).toBeNull();
      }

      // Revisiting already-opened screens must never show any skeleton again
      fireEvent.click(screen.getAllByRole('button', { name: /^Inbox/i })[0]);
      expect(screen.queryByTestId('web-boot-skeleton')).toBeNull();
      fireEvent.click(screen.getAllByRole('button', { name: /^Track Docs$/i })[0]);
      expect(screen.queryByTestId('web-skeleton-track')).toBeNull();
      fireEvent.click(screen.getAllByRole('button', { name: /^Categories$/i })[0]);
      expect(screen.queryByTestId('web-skeleton-categories')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('enforces LoginPage security auth gate by default when unauthenticated', () => {
    const gateway = createMockGateway();
    render(<App gateway={gateway} />);

    expect(screen.getByText('Tracely')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Sign In to Tracely/i })).toBeTruthy();
    expect(screen.queryByText('Dashboard & Inbox')).toBeNull();
    expect(screen.queryByText('Needs your action')).toBeNull();
  });

  it('shows notification title, content, unread badges across UI + browser tab/device APIs, and marks single read', async () => {
    const dispatchedNotifications: Array<{ title: string; options?: NotificationOptions }> = [];
    class MockBrowserNotification {
      static permission = 'granted';
      static requestPermission = vi.fn(async () => 'granted');
      onclick: (() => void) | null = null;
      constructor(title: string, options?: NotificationOptions) {
        dispatchedNotifications.push({ title, options });
      }
    }
    const prevNotification = globalThis.Notification;
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: MockBrowserNotification,
    });

    const setAppBadge = vi.fn(async () => {});
    const clearAppBadge = vi.fn(async () => {});
    Object.defineProperty(globalThis.navigator, 'setAppBadge', {
      configurable: true,
      value: setAppBadge,
    });
    Object.defineProperty(globalThis.navigator, 'clearAppBadge', {
      configurable: true,
      value: clearAppBadge,
    });

    const markNotificationRead = vi.fn(async () => {});
    const gw = createMockGateway({
      markNotificationRead,
      listWorkspace: async () => ({
        offices: [],
        personnel: [],
        documents: [],
        trackedSnapshots: [],
        categories: [],
        notifications: [
          {
            id: 'notif-web-1',
            documentId: 'doc-142',
            title: 'Incoming Document · SDO-OM-2026-000142',
            content: 'Q4 DRRM Minor Repair Funding Request forwarded from SGOD for approval.',
            lockScreenPreview: 'New incoming SDO document awaits receipt.',
            authenticatedDetail: 'SDO-OM-2026-000142 routed from SGOD.',
            receivedAt: new Date().toISOString(),
            read: false,
          },
        ],
      }),
    });

    try {
      render(
        <App
          gateway={gw}
          initialActor={{
            id: 'usr-1',
            fullName: 'Elena Reyes',
            employeeId: 'EMP-2026-0099',
            email: 'elena.reyes@deped.gov.ph',
            position: 'Records Officer III',
            roleLabel: 'Records Officer',
            office: { id: 'off-records', code: 'RECORDS', name: 'Records Section' },
            availability: 'available',
            initials: 'ER',
          }}
        />,
      );

      fireEvent.click(screen.getByRole('button', { name: /^Sync$/i }));

      await waitFor(() => {
        expect(screen.getByTestId('topbar-alerts-badge').textContent).toBe('1');
      });
      expect(document.title).toContain('(1)');
      expect(setAppBadge).toHaveBeenCalledWith(1);
      expect(dispatchedNotifications).toHaveLength(1);
      expect(dispatchedNotifications[0].title).toBe('Incoming Document · SDO-OM-2026-000142');
      expect(dispatchedNotifications[0].options?.body).toContain(
        'Q4 DRRM Minor Repair Funding Request forwarded from SGOD for approval.',
      );

      fireEvent.click(screen.getByRole('button', { name: 'Open notifications' }));
      await waitFor(() => {
        expect(screen.getByTestId('web-alerts-unread-badge').textContent).toBe('1 Unread');
      });
      expect(screen.getByText('Incoming Document · SDO-OM-2026-000142')).toBeTruthy();
      expect(
        screen.getByText('Q4 DRRM Minor Repair Funding Request forwarded from SGOD for approval.'),
      ).toBeTruthy();

      fireEvent.click(screen.getByText('Incoming Document · SDO-OM-2026-000142'));
      await waitFor(() => {
        expect(markNotificationRead).toHaveBeenCalledWith('notif-web-1');
      });
      await waitFor(() => {
        expect(screen.queryByTestId('topbar-alerts-badge')).toBeNull();
      });
      expect(clearAppBadge).toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, 'Notification', {
        configurable: true,
        value: prevNotification,
      });
    }
  });

  it('auto-falls back between Laravel ports 8000 and 8080 and the Vite dev proxy', async () => {
    expect(
      getWebDevFallbackBaseUrls('http://127.0.0.1:8000/api/v1', true, 'http://localhost:5173'),
    ).toEqual([
      'http://127.0.0.1:8080/api/v1',
      'http://localhost:5173/__doctrack_api/v1',
    ]);
    expect(
      getWebDevFallbackBaseUrls('http://127.0.0.1:8080/api/v1', true, 'http://localhost:5173'),
    ).toEqual([
      'http://127.0.0.1:8000/api/v1',
      'http://localhost:5173/__doctrack_api/v1',
    ]);
    expect(
      getWebDevFallbackBaseUrls(
        'https://doctrack.depedormin.gov.ph/api/v1',
        true,
        'http://localhost:5173',
      ),
    ).toEqual([]);
    expect(
      getWebDevFallbackBaseUrls('http://127.0.0.1:8000/api/v1', false, 'http://localhost:5173'),
    ).toEqual([]);

    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            bearer_token: 'tok-8080-web',
            user: {
              id: 'usr-1',
              full_name: 'Elena Reyes',
              employee_id: 'EMP-2026-0099',
              email: 'elena.reyes@deped.gov.ph',
              position: 'Records Officer III',
              role: 'records_officer',
              office: { id: 'off-records', code: 'RECORDS', name: 'Records Section' },
              availability: 'available',
            },
          }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ message: 'Logged out.' }),
      } as unknown as Response)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ message: 'Logged out on 8000.' }),
      } as unknown as Response);

    try {
      const gateway = new LaravelSanctumGateway(
        () => 'http://127.0.0.1:8000/api/v1',
        () => 'tok-8080-web',
        true,
      );
      const loginRes = await gateway.login('elena.reyes@deped.gov.ph', 'Secret#123');
      expect(loginRes.bearerToken).toBe('tok-8080-web');
      expect(fetchSpy.mock.calls[0]?.[0]).toBe('http://127.0.0.1:8000/api/v1/auth/login');
      expect(fetchSpy.mock.calls[1]?.[0]).toBe('http://127.0.0.1:8080/api/v1/auth/login');

      await gateway.logout();
      expect(fetchSpy.mock.calls[2]?.[0]).toBe('http://127.0.0.1:8080/api/v1/auth/logout');

      // If :8080 later stops and artisan restarts on :8000, cached fallback resets cleanly
      await gateway.logout();
      expect(fetchSpy.mock.calls[3]?.[0]).toBe('http://127.0.0.1:8080/api/v1/auth/logout');
      expect(fetchSpy.mock.calls[4]?.[0]).toBe('http://127.0.0.1:8000/api/v1/auth/logout');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('supports renaming staged filenames, in-app PDF viewing, and isolated professional routing slip printing', async () => {
    const uploadedFileNames: string[] = [];
    const createdDoc: DocumentRecord = {
      id: 'doc-viewer-1',
      trackingCode: 'SDO-OM-2026-000777',
      qrToken: 'opaque-slip-token-777',
      title: 'Division Memo 045 — Q4 Budget',
      categoryId: 'cat-bur',
      categoryName: 'Budget Utilization Request',
      confidentialityTier: 'standard_internal',
      copyFormat: 'digital',
      lifecycleStatus: 'in_review',
      slaState: 'on_track',
      slaDueAt: null,
      originOffice: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
      currentOffice: { id: 'off-sgod', code: 'SGOD', name: 'SGOD Office' },
      submittedSchoolName: null,
      submittedSchoolId: null,
      physicalReference: null,
      physicalPageCount: null,
      versions: [
        {
          versionNumber: 1,
          fileName: 'Q4_Budget_Signed.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 24576,
          sha256Checksum: 'a'.repeat(64),
          uploadedByName: 'Marco Villanueva',
          uploadedAt: new Date().toISOString(),
          note: 'Initial upload',
        },
      ],
      transactions: [],
      createdAt: new Date().toISOString(),
    };

    const gw = createMockGateway({
      createDigitalDocument: async (payload) => {
        uploadedFileNames.push(payload.fileName ?? payload.file.name);
        return {
          ...createdDoc,
          title: payload.title,
          versions: [
            {
              ...createdDoc.versions[0],
              fileName: payload.fileName ?? payload.file.name,
            },
          ],
        };
      },
      issuePresignedView: async () => ({
        url: 'http://127.0.0.1:8080/api/v1/documents/doc-viewer-1/versions/1/stream?signature=sig777',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        ttlSeconds: 60,
        version: createdDoc.versions[0],
      }),
    });

    const actor: Personnel = {
      id: 'usr-1',
      fullName: 'Marco Villanueva',
      employeeId: 'EMP-2026-0142',
      email: 'marco.villanueva@deped.gov.ph',
      position: 'Administrative Officer IV',
      roleLabel: 'Unit Head',
      office: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
      availability: 'available',
      initials: 'MV',
    };

    let sawIsolatedPrintRoot = false;
    let sawBodyPrintClass = false;
    const prevPrint = window.print;
    window.print = vi.fn(() => {
      const printRoot = document.getElementById('doctrack-print-root');
      sawIsolatedPrintRoot = Boolean(printRoot?.querySelector('.qr-print-slip'));
      sawBodyPrintClass = document.body.classList.contains('printing-routing-slip');
    });

    try {
      render(<App gateway={gw} initialActor={actor} />);
      fireEvent.click(screen.getAllByRole('button', { name: /Send Document/i })[0]);

      const titleInput = await screen.findByLabelText(/Document Title/i);
      fireEvent.change(titleInput, { target: { value: 'Division Memo 045 — Q4 Budget' } });

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const pdfFile = new File(['%PDF-1.4\nhello'], 'scan_0042.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [pdfFile] } });

      const renameInput = await screen.findByLabelText('File name for scan_0042.pdf');
      fireEvent.change(renameInput, { target: { value: 'Q4_Budget_Signed' } });

      fireEvent.click(screen.getByRole('button', { name: /Upload Soft Copy/i }));

      await waitFor(() => {
        expect(uploadedFileNames).toEqual(['Q4_Budget_Signed.pdf']);
      });

      // QR Routing Slip modal opens with institutional slip info + multi-office receiving remarks log and prints ONLY the isolated slip
      const slipEl = await screen.findByTestId('routing-print-slip');
      expect(slipEl.textContent).toContain('OFFICIAL DOCUMENT ROUTING SLIP');
      expect(slipEl.textContent).toContain('SDO-OM-2026-000777');
      expect(slipEl.textContent).toContain('Budget Utilization Request');
      expect(slipEl.textContent).toContain('RECEIVING OFFICE ACKNOWLEDGMENT');
      expect(slipEl.textContent).toContain('Receiving Office Remarks / Action Taken');
      expect(screen.getAllByTestId(/^routing-slip-office-row-/).length).toBe(6);

      // Switching to 10 Offices expands the multi-office remarks log before printing
      fireEvent.click(screen.getByRole('button', { name: /10 Offices/i }));
      expect(screen.getAllByTestId(/^routing-slip-office-row-/).length).toBe(10);

      fireEvent.click(screen.getByRole('button', { name: /Print Slip/i }));
      expect(window.print).toHaveBeenCalledTimes(1);
      expect(sawIsolatedPrintRoot).toBe(true);
      expect(sawBodyPrintClass).toBe(true);

      // Close QR modal, open document detail, and open in-app PDF viewer
      fireEvent.click(screen.getByRole('button', { name: /^Done$/i }));
      fireEvent.click(screen.getByRole('button', { name: /^Open Record$/i }));

      const viewBtn = await screen.findByRole('button', { name: /^View$/i });
      fireEvent.click(viewBtn);

      const iframe = await screen.findByTestId('web-pdf-viewer-iframe');
      expect(iframe.getAttribute('src')).toContain('/documents/doc-viewer-1/versions/1/stream');
      expect(screen.getByRole('button', { name: /Download/i })).toBeTruthy();
    } finally {
      window.print = prevPrint;
    }
  });

  it('blocks sender self-receipt on QR scan and provides a sortable, paginated Sent Files page', async () => {
    const actor: Personnel = {
      id: 'usr-1',
      fullName: 'Marco Villanueva',
      employeeId: 'EMP-2026-0142',
      email: 'marco.villanueva@deped.gov.ph',
      position: 'Administrative Officer IV',
      roleLabel: 'Unit Head',
      office: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
      availability: 'available',
      initials: 'MV',
    };
    const sgodOffice = { id: 'off-sgod', code: 'SGOD', name: 'SGOD Office' };

    const sentDocs: DocumentRecord[] = Array.from({ length: 17 }, (_, i) => {
      const idx = i + 1;
      const isPending = idx <= 3;
      const sentTime = new Date(Date.UTC(2026, 10, 1 + idx, 9, 0, 0)).toISOString();
      return {
        id: `doc-sent-${idx}`,
        trackingCode: `SDO-OM-2026-${String(800 + idx).padStart(6, '0')}`,
        qrToken: `opaque-sent-token-${idx}`,
        title: `${String.fromCharCode(82 - idx)} Document Batch Item ${idx}`,
        categoryId: 'cat-bur',
        categoryName: 'Budget Utilization Request',
        confidentialityTier: 'standard_internal',
        copyFormat: 'digital',
        lifecycleStatus: isPending ? 'in_transit' : 'in_review',
        slaState: 'on_track',
        slaDueAt: null,
        originUserId: actor.id,
        originUserName: actor.fullName,
        originOffice: actor.office,
        currentOffice: idx === 1 ? actor.office : sgodOffice,
        submittedSchoolName: null,
        submittedSchoolId: null,
        physicalReference: null,
        physicalPageCount: null,
        versions: [
          {
            versionNumber: 1,
            fileName: `sent_file_${idx}.pdf`,
            mimeType: 'application/pdf',
            sizeBytes: 12000 + idx * 100,
            sha256Checksum: 'b'.repeat(64),
            uploadedByName: actor.fullName,
            uploadedAt: sentTime,
            note: 'Initial upload',
          },
        ],
        transactions: [
          {
            id: `tx-sent-${idx}`,
            fromUserId: actor.id,
            fromUserName: actor.fullName,
            fromOffice: actor.office,
            toUserId: idx === 1 ? 'usr-budget-2' : 'usr-sgod-1',
            toOffice: idx === 1 ? actor.office : sgodOffice,
            recipientName: idx === 1 ? 'Teresa Dizon' : 'Ramon Santos',
            scope: idx === 1 ? 'internal_office' : 'inter_office',
            status: isPending ? 'pending' : 'acknowledged',
            remarks: 'Dispatched',
            sentAt: sentTime,
            receivedAt: isPending ? null : sentTime,
            receivedByName: isPending ? null : 'Ramon Santos',
          },
        ],
        createdAt: sentTime,
      };
    });

    const gw = createMockGateway({
      listWorkspace: async () => ({
        offices: [actor.office, sgodOffice],
        personnel: [actor],
        documents: sentDocs,
        trackedSnapshots: [],
        categories: [
          {
            id: 'cat-bur',
            name: 'Budget Utilization Request',
            code: 'BUR',
            declaredByOfficeCode: 'BUDGET',
            isGlobal: true,
          },
        ],
        notifications: [],
      }),
      resolveQr: async () => ({
        kind: 'document_authorized',
        document: sentDocs[0],
        pendingForActorOffice: true, // Even if a gateway reports true, client enforces self-sent guard
      }),
    });

    render(<App gateway={gw} initialActor={actor} />);
    fireEvent.click(screen.getByRole('button', { name: /^Sync$/i }));

    await waitFor(() => {
      expect(screen.getByTestId('web-inbox-pagination').textContent).toContain(
        'Showing 1–15 of 17 documents · Page 1 of 2',
      );
    });

    // Opening own pending dispatch (even to same office) shows self-sent guard and blocks Confirm Receipt
    window.location.hash = '#/document/doc-sent-1';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(await screen.findByTestId('self-sent-guard-banner')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Confirm Receipt/i })).toBeNull();

    // Navigate to Sent Files page and verify sorting + pagination
    fireEvent.click(screen.getByRole('button', { name: /Sent Files/i }));
    await waitFor(() => {
      expect(screen.getByTestId('web-sent-list')).toBeTruthy();
    });

    // Fixed 15 per page (no per-page selector rendered) -> Page 1 shows 15 of 17, Page 2 shows 2 of 17
    expect(screen.queryByLabelText('Sent items per page')).toBeNull();
    expect(screen.getByTestId('web-sent-pagination').textContent).toContain(
      'Showing 1–15 of 17 sent files',
    );
    expect(screen.getAllByTestId(/^sent-row-/).length).toBe(15);

    // Sort by Title (A–Z) -> item 17 ('A Document Batch Item 17') moves to top
    fireEvent.change(screen.getByLabelText('Sort sent documents'), {
      target: { value: 'title_asc' },
    });
    expect(screen.getAllByTestId(/^sent-row-/)[0].textContent).toContain(
      'A Document Batch Item 17',
    );

    // Navigate to Page 2
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));
    expect(screen.getByTestId('web-sent-pagination').textContent).toContain(
      'Showing 16–17 of 17 sent files',
    );
    expect(screen.getAllByTestId(/^sent-row-/).length).toBe(2);
  });

  it('defaults Sent Files to 15/page, keeps pagination visible even when empty, filters by date, and does not re-fire unread browser notifications across reload', async () => {
    const dispatchedNotifications: Array<{ title: string; body?: string }> = [];
    class MockNotification {
      public static permission: NotificationPermission = 'granted';
      public onclick: (() => void) | null = null;
      constructor(title: string, options?: NotificationOptions) {
        dispatchedNotifications.push({ title, body: options?.body });
      }
    }
    const prevNotification = window.Notification;
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      writable: true,
      value: MockNotification,
    });

    try {
      const actor: Personnel = {
        id: 'usr-notif-dedupe',
        fullName: 'Arvin Soriano',
        employeeId: 'SDO-0801',
        email: 'ict@deped.gov.ph',
        position: 'Information Technology Officer I',
        role: 'ict_admin',
        roleLabel: 'ICT Admin',
        office: { id: 'off-ict', code: 'ICT', name: 'ICT Unit' },
        availability: 'available',
        initials: 'AS',
      };

      const pendingCandidate: Personnel = {
        id: 'usr-pending-99',
        fullName: 'Clarissa Mendoza',
        employeeId: 'SDO-9101',
        email: 'clarissa@deped.gov.ph',
        position: 'Administrative Aide VI',
        role: 'staff',
        roleLabel: 'Staff',
        office: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
        availability: 'available',
        initials: 'CM',
      };

      const approvedIds: string[] = [];
      const recalledIds: string[] = [];

      const sgodOffice = { id: 'off-sgod', code: 'SGOD', name: 'SGOD Unit' };
      const sgodRecipient: Personnel = {
        id: 'usr-sgod-1',
        fullName: 'Rafael Manalo',
        employeeId: 'SDO-0312',
        email: 'sgod@deped.gov.ph',
        position: 'SEPS',
        role: 'unit_head',
        roleLabel: 'Unit Head',
        office: sgodOffice,
        availability: 'available',
        initials: 'RM',
      };

      const gw = createMockGateway({
        listWorkspace: async () => ({
          offices: [actor.office, sgodOffice],
          personnel: [actor, sgodRecipient],
          documents: [],
          trackedSnapshots: [],
          categories: [
            {
              id: 'cat-bur',
              name: 'Budget Utilization Request',
              code: 'BUR',
              declaredByOfficeCode: 'BUDGET',
              isGlobal: true,
            },
          ],
          notifications: [
            {
              id: 'notif-sticky-1',
              documentId: 'doc-999',
              title: 'New Incoming Document',
              content: 'Budget forwarded SDO-OM-2026-000999.',
              lockScreenPreview: '1 new custody update awaits review.',
              authenticatedDetail: 'Budget forwarded SDO-OM-2026-000999.',
              receivedAt: new Date().toISOString(),
              read: false,
            },
          ],
        }),
        registerHardCopyDocument: async (payload) => ({
          id: 'doc-undo-1',
          trackingCode: 'SDO-OM-2026-000901',
          qrToken: 'opaque-undo-1',
          title: payload.title,
          categoryId: payload.categoryId,
          categoryName: 'Budget Utilization Request',
          confidentialityTier: payload.confidentialityTier,
          copyFormat: 'hard_copy',
          lifecycleStatus: 'in_transit',
          slaState: 'on_track',
          slaDueAt: new Date(Date.now() + 86_400_000).toISOString(),
          originUserId: actor.id,
          originUserName: actor.fullName,
          originOffice: actor.office,
          currentOffice: sgodOffice,
          submittedSchoolName: null,
          submittedSchoolId: null,
          physicalReference: null,
          physicalPageCount: 2,
          versions: [],
          transactions: [
            {
              id: 'tx-undo-1',
              fromUserId: actor.id,
              fromUserName: actor.fullName,
              fromOffice: actor.office,
              toUserId: sgodRecipient.id,
              toOffice: sgodOffice,
              recipientName: sgodRecipient.fullName,
              scope: 'inter_office',
              status: 'pending',
              remarks: 'Quick dispatch',
              sentAt: new Date().toISOString(),
              receivedAt: null,
              receivedByName: null,
            },
          ],
          createdAt: new Date().toISOString(),
        }),
        recallTransfer: async (documentId) => {
          recalledIds.push(documentId);
          return {
            id: documentId,
            trackingCode: 'SDO-OM-2026-000901',
            qrToken: 'opaque-undo-1',
            title: 'Quick Recall Hard Copy',
            categoryId: 'cat-bur',
            categoryName: 'Budget Utilization Request',
            confidentialityTier: 'standard_internal',
            copyFormat: 'hard_copy',
            lifecycleStatus: 'registered',
            slaState: 'on_track',
            slaDueAt: new Date(Date.now() + 86_400_000).toISOString(),
            originUserId: actor.id,
            originUserName: actor.fullName,
            originOffice: actor.office,
            currentOffice: actor.office,
            submittedSchoolName: null,
            submittedSchoolId: null,
            physicalReference: null,
            physicalPageCount: 2,
            versions: [],
            transactions: [],
            createdAt: new Date().toISOString(),
          };
        },
        listPendingUsers: async () => [pendingCandidate],
        approveUser: async (userId) => {
          approvedIds.push(userId);
          return pendingCandidate;
        },
      });

      const firstRender = render(<App gateway={gw} initialActor={actor} />);
      fireEvent.click(screen.getByRole('button', { name: /^Sync$/i }));

      await waitFor(() => {
        expect(dispatchedNotifications).toHaveLength(1);
      });
      expect(document.title).toBe('(1) Tracely');

      // Simulate full page reload with the same unread notification — badge remains, popup does NOT re-fire!
      firstRender.unmount();
      render(<App gateway={gw} initialActor={actor} />);
      fireEvent.click(screen.getByRole('button', { name: /^Sync$/i }));

      await waitFor(() => {
        expect(document.title).toBe('(1) Tracely');
      });
      expect(dispatchedNotifications).toHaveLength(1);

      // Sent Files: fixed 15 per page (no per-page selector) and keeps pagination bar visible even with 0 items
      fireEvent.click(screen.getByRole('button', { name: /Sent Files/i }));
      await waitFor(() => {
        expect(screen.getByTestId('web-sent-pagination')).toBeTruthy();
      });
      expect(screen.queryByLabelText('Sent items per page')).toBeNull();
      expect(screen.getByTestId('web-sent-pagination').textContent).toContain(
        'Showing 0 of 0 sent files · Page 1 of 1',
      );

      // Send Document -> dispatch to SGOD -> toast shows inline Recall undo button
      fireEvent.click(screen.getAllByRole('button', { name: /Send Document/i })[0]);
      fireEvent.click(await screen.findByRole('tab', { name: /Hard Copy/i }));
      fireEvent.change(screen.getByLabelText(/Document Title/i), {
        target: { value: 'Quick Recall Hard Copy' },
      });
      fireEvent.click(screen.getByRole('button', { name: /SGOD · Rafael/i }));
      fireEvent.click(screen.getByRole('button', { name: /Generate QR & Send/i }));

      const recallToastBtn = await screen.findByRole('button', { name: /^Recall$/i });
      fireEvent.click(recallToastBtn);
      await waitFor(() => {
        expect(recalledIds).toEqual(['doc-undo-1']);
      });

      // Profile -> ICT Admin sees Pending Account Approvals and approves Clarissa Mendoza
      fireEvent.click(screen.getByRole('button', { name: /^Profile$/i }));
      const approvalCard = await screen.findByTestId('web-admin-approvals');
      expect(approvalCard.textContent).toContain('Clarissa Mendoza');
      fireEvent.click(screen.getByRole('button', { name: /^Approve$/i }));
      await waitFor(() => {
        expect(approvedIds).toEqual(['usr-pending-99']);
      });
    } finally {
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        writable: true,
        value: prevNotification,
      });
    }
  });

  it('supports Approve/Archive completion, document notes, receive-proof viewing, A4 transmittal manifest, and ICT/HR Admin Console', async () => {
    const actor: Personnel = {
      id: 'usr-ict-admin',
      fullName: 'Arvin Soriano',
      employeeId: 'SDO-0801',
      email: 'ict@deped.gov.ph',
      position: 'Information Technology Officer I',
      role: 'ict_admin',
      roleLabel: 'ICT Admin',
      office: { id: 'off-ict', code: 'ICT', name: 'ICT Unit' },
      availability: 'available',
      active: true,
      initials: 'AS',
    };
    const staffPeer: Personnel = {
      id: 'usr-staff-2',
      fullName: 'Teresa Bautista',
      employeeId: 'SDO-0205',
      email: 'teresa@deped.gov.ph',
      position: 'Admin Asst III',
      role: 'staff',
      roleLabel: 'Staff',
      office: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
      availability: 'available',
      active: true,
      initials: 'TB',
    };

    const sampleDoc: DocumentRecord = {
      id: 'doc-complete-1',
      trackingCode: 'SDO-OM-2026-000955',
      qrToken: 'opaque-complete-955',
      title: 'ICT Equipment Requisition Packet',
      categoryId: 'cat-bur',
      categoryName: 'Budget Utilization Request',
      confidentialityTier: 'standard_internal',
      copyFormat: 'hard_copy',
      lifecycleStatus: 'in_review',
      slaState: 'on_track',
      slaDueAt: new Date(Date.now() + 86_400_000).toISOString(),
      originUserId: actor.id,
      originUserName: actor.fullName,
      originOffice: actor.office,
      currentOffice: actor.office,
      submittedSchoolName: null,
      submittedSchoolId: null,
      physicalReference: 'Folder #12',
      physicalPageCount: 8,
      versions: [],
      transactions: [
        {
          id: 'tx-proof-1',
          fromUserId: staffPeer.id,
          fromUserName: staffPeer.fullName,
          fromOffice: staffPeer.office,
          toUserId: actor.id,
          toOffice: actor.office,
          recipientName: actor.fullName,
          scope: 'inter_office',
          status: 'acknowledged',
          remarks: 'For Signature',
          sentAt: new Date().toISOString(),
          receivedAt: new Date().toISOString(),
          receivedByName: actor.fullName,
          proofPhoto: {
            fileName: 'stamped_folder.png',
            compressedBytes: 24500,
            sha256Checksum: 'a'.repeat(64),
            exifStripped: true,
            capturedAt: new Date().toISOString(),
          },
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const postedComments: Array<{ body: string; visibility: string }> = [];
    const createdOffices: Array<{ code: string; name: string }> = [];
    const updatedUsers: Array<{ userId: string; active?: boolean }> = [];
    let completedStatus = '';
    let viewedProofTxId = '';

    const gw = createMockGateway({
      listWorkspace: async () => ({
        offices: [actor.office, staffPeer.office],
        personnel: [actor, staffPeer],
        documents: [sampleDoc],
        trackedSnapshots: [],
        categories: [
          {
            id: 'cat-bur',
            name: 'Budget Utilization Request',
            code: 'BUR',
            declaredByOfficeCode: 'BUDGET',
            isGlobal: true,
          },
        ],
        notifications: [],
      }),
      listDocumentComments: async () => [],
      addDocumentComment: async (docId, body, visibility) => {
        postedComments.push({ body, visibility });
        return {
          id: 'cmt-1',
          documentId: docId,
          authorId: actor.id,
          authorName: actor.fullName,
          authorOfficeId: actor.office.id,
          authorOfficeCode: actor.office.code,
          authorPosition: actor.position,
          visibility,
          body,
          createdAt: new Date().toISOString(),
        };
      },
      completeDocument: async (_docId, status) => {
        completedStatus = status;
        return { ...sampleDoc, lifecycleStatus: status };
      },
      issueProofPhotoView: async (_docId, txId) => {
        viewedProofTxId = txId;
        return {
          url: 'http://127.0.0.1:8000/api/v1/documents/doc-complete-1/transactions/tx-proof-1/proof-stream?signature=ok',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          ttlSeconds: 60,
          version: {
            versionNumber: 0,
            fileName: 'stamped_folder.png',
            mimeType: 'image/png',
            sizeBytes: 24500,
            sha256Checksum: 'a'.repeat(64),
            uploadedAt: new Date().toISOString(),
            uploadedByName: actor.fullName,
            note: 'Signed slip receive-proof photo',
          },
        };
      },
      listPendingUsers: async () => [],
      listAdminUsers: async () => [actor, staffPeer],
      updateAdminUser: async (userId, patch) => {
        updatedUsers.push({ userId, active: patch.active });
        return { ...staffPeer, active: patch.active ?? staffPeer.active };
      },
      createAdminOffice: async (payload) => {
        createdOffices.push(payload);
        return { id: 'off-cashier', code: payload.code, name: payload.name };
      },
    });

    render(<App gateway={gw} initialActor={actor} />);
    fireEvent.click(screen.getByRole('button', { name: /^Sync$/i }));

    await waitFor(() => {
      expect(screen.getByText('ICT Equipment Requisition Packet')).toBeTruthy();
    });

    // Open Sent Files -> open Official A4 Transmittal Sheet
    fireEvent.click(screen.getByRole('button', { name: /Sent Files/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Transmittal Sheet/i }));
    expect(await screen.findByTestId('web-batch-transmittal-sheet')).toBeTruthy();
    expect(screen.getByTestId('web-batch-transmittal-sheet').textContent).toContain(
      'OFFICIAL DOCUMENT TRANSMITTAL SHEET',
    );
    fireEvent.click(screen.getByRole('button', { name: /^Done$/i }));

    // Open Document Detail -> view Proof Photo, post Internal Office Note, and Approve & Release
    fireEvent.click(screen.getByRole('button', { name: /^Open$/i }));
    const viewProofBtn = await screen.findByRole('button', { name: /View Proof Photo/i });
    fireEvent.click(viewProofBtn);
    await waitFor(() => {
      expect(viewedProofTxId).toBe('tx-proof-1');
    });
    fireEvent.click(screen.getByRole('button', { name: /^Close$/i }));

    // Post an internal office note
    fireEvent.click(screen.getByRole('button', { name: /Internal \(ICT Only\)/i }));
    fireEvent.change(screen.getByLabelText('Add document note'), {
      target: { value: 'Verified hardware serial numbers internally.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Post Note/i }));
    await waitFor(() => {
      expect(postedComments).toEqual([
        { body: 'Verified hardware serial numbers internally.', visibility: 'internal_office' },
      ]);
    });

    // Finalize document -> Approved & Released
    fireEvent.click(screen.getByRole('button', { name: /Approve \/ Archive/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Mark Approved & Released/i }));
    await waitFor(() => {
      expect(completedStatus).toBe('approved');
      expect(screen.getByTestId('doc-finalized-banner')).toBeTruthy();
    });

    // Profile -> ICT/HR Admin Console: Deactivate staff & Add new SDO office
    fireEvent.click(screen.getByRole('button', { name: /^Profile$/i }));
    fireEvent.click(await screen.findByRole('tab', { name: /Personnel/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^Deactivate$/i }));
    await waitFor(() => {
      expect(updatedUsers).toEqual([{ userId: 'usr-staff-2', active: false }]);
    });

    fireEvent.click(screen.getByRole('tab', { name: /Offices/i }));
    fireEvent.change(screen.getByLabelText('New office code'), { target: { value: 'CASHIER' } });
    fireEvent.change(screen.getByLabelText('New office name'), {
      target: { value: 'Cashier & Disbursement Unit' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Add Office/i }));
    await waitFor(() => {
      expect(createdOffices).toEqual([
        { code: 'CASHIER', name: 'Cashier & Disbursement Unit' },
      ]);
    });
  });

  it('separates dedicated User Profile (Personal Info, Preferences, Settings) from Desk & Office Profile', async () => {
    const actor: Personnel = {
      id: 'usr-budget-1',
      fullName: 'Marco Villareal',
      employeeId: 'SDO-1002',
      email: 'budget@deped.gov.ph',
      position: 'Administrative Officer V',
      role: 'unit_head',
      roleLabel: 'Unit Head',
      office: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
      availability: 'available',
      initials: 'MV',
    };

    const profileUpdates: Array<{
      fullName?: string;
      email?: string;
      position?: string;
      contactNumber?: string | null;
      deskNote?: string | null;
      avatarColor?: string;
    }> = [];
    const prefUpdates: Array<Record<string, unknown>> = [];

    const gw = createMockGateway({
      updateProfile: async (patch) => {
        profileUpdates.push(patch);
        return {
          ...actor,
          fullName: patch.fullName ?? actor.fullName,
          email: patch.email ?? actor.email,
          position: patch.position ?? actor.position,
          contactNumber: patch.contactNumber ?? null,
          deskNote: patch.deskNote ?? null,
          avatarColor: patch.avatarColor ?? '#0D3472',
        };
      },
      updatePreferences: async (patch) => {
        prefUpdates.push(patch as Record<string, unknown>);
        const merged = {
          defaultCopyFormat: patch.defaultCopyFormat ?? 'digital',
          defaultRoutingScope: patch.defaultRoutingScope ?? 'inter_office',
          defaultRemarks: patch.defaultRemarks ?? '',
          defaultLandingScreen: patch.defaultLandingScreen ?? 'inbox',
          compactDensity: patch.compactDensity ?? false,
          desktopNotifications: patch.desktopNotifications ?? true,
          notificationSound: patch.notificationSound ?? true,
          hideLockScreenTitles: patch.hideLockScreenTitles ?? true,
        } as const;
        return {
          user: { ...actor, preferences: merged },
          preferences: merged,
        };
      },
    });

    render(<App gateway={gw} initialActor={actor} firstVisitSkeletonMs={0} />);

    // Open current Desk & Office Profile first -> verify button to jump to separated User Profile
    fireEvent.click(screen.getByRole('button', { name: /^Profile$/i }));
    const editProfileBtn = await screen.findByRole('button', {
      name: /Edit User Profile & Settings/i,
    });
    fireEvent.click(editProfileBtn);

    expect(await screen.findByTestId('web-user-profile-page')).toBeTruthy();

    // 1. Update Personal Info (email must be read-only & HR-Assigned Plantilla card removed)
    const emailInput = screen.getByLabelText('Profile Official Email') as HTMLInputElement;
    expect(emailInput.disabled).toBe(true);
    expect(screen.queryByText(/HR-Assigned Plantilla Record/i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Avatar color Teal/i }));
    fireEvent.change(screen.getByLabelText('Profile Full Name'), {
      target: { value: 'Marco A. Villareal' },
    });
    fireEvent.change(screen.getByLabelText('Profile Position'), {
      target: { value: 'Supervising Budget Officer' },
    });
    fireEvent.change(screen.getByLabelText('Profile Contact Number'), {
      target: { value: '+63 917 555 0142' },
    });
    fireEvent.change(screen.getByLabelText('Profile Desk Note'), {
      target: { value: '2nd Floor Finance Wing · Window 3' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Profile Info/i }));

    await waitFor(() => {
      expect(profileUpdates).toEqual([
        {
          fullName: 'Marco A. Villareal',
          email: 'budget@deped.gov.ph',
          position: 'Supervising Budget Officer',
          contactNumber: '+63 917 555 0142',
          deskNote: '2nd Floor Finance Wing · Window 3',
          avatarColor: '#0F766E',
        },
      ]);
    });

    // Verify saved color persists to topbar user icon & Dashboard Lanyard
    expect(
      (screen.getByTestId('web-dashboard-user-avatar') as HTMLButtonElement).style.background,
    ).toContain('15, 118, 110');
    expect(
      screen.getByTestId('web-user-profile-wallet-card').getAttribute('data-accent-color'),
    ).toBe('#0f766e');

    // 2. Switch to Preferences tab and save workflow defaults
    fireEvent.click(screen.getByRole('tab', { name: /Preferences/i }));
    fireEvent.change(screen.getByLabelText('Default Send Document Format'), {
      target: { value: 'hard_copy' },
    });
    fireEvent.change(screen.getByLabelText('Default Disposition Remark'), {
      target: { value: 'For Budget Certification' },
    });
    fireEvent.click(screen.getByLabelText('Compact Table & Card Density'));
    fireEvent.click(screen.getByRole('button', { name: /Save Preferences/i }));

    await waitFor(() => {
      expect(prefUpdates).toHaveLength(1);
      expect(prefUpdates[0]?.defaultCopyFormat).toBe('hard_copy');
      expect(prefUpdates[0]?.defaultRemarks).toBe('For Budget Certification');
      expect(prefUpdates[0]?.compactDensity).toBe(true);
    });

    // 3. Switch to Settings tab and verify account password + session controls exist
    fireEvent.click(screen.getByRole('tab', { name: /Settings/i }));
    expect(screen.getByLabelText('Current account password')).toBeTruthy();
    expect(screen.getByText(/Active Devices & Sanctum Sessions/i)).toBeTruthy();
  });

  it('paginates Inbox, Track, Notifications, Categories, and Scanner lists cleanly across pages', async () => {
    const actor: Personnel = {
      id: 'usr-budget-1',
      fullName: 'Marco Villareal',
      employeeId: 'SDO-0204',
      email: 'budget@deped.gov.ph',
      position: 'Budget Officer II',
      role: 'unit_head',
      roleLabel: 'Unit Head',
      office: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
      availability: 'available',
      initials: 'MV',
    };

    const manyDocs: DocumentRecord[] = Array.from({ length: 18 }, (_, i) => ({
      id: `doc-pg-${i + 1}`,
      trackingCode: `SDO-OM-2026-${String(2000 + i).padStart(6, '0')}`,
      qrToken: `tok-pg-${i + 1}`,
      title: `Budget Record #${i + 1}`,
      categoryId: 'cat-pg-1',
      categoryName: 'Budget Utilization',
      confidentialityTier: 'standard_internal',
      copyFormat: 'digital',
      lifecycleStatus: 'in_transit',
      slaState: 'on_track',
      slaDueAt: new Date(Date.now() + (i + 10) * 3_600_000).toISOString(),
      createdAt: new Date(Date.now() - i * 60_000).toISOString(),
      originOffice: { id: 'off-records', code: 'RECORDS', name: 'Records Section' },
      currentOffice: actor.office,
      submittedSchoolName: null,
      submittedSchoolId: null,
      physicalReference: null,
      physicalPageCount: null,
      versions: [],
      transactions: [
        {
          id: `tx-pg-${i + 1}`,
          fromUserId: 'usr-records-1',
          fromOffice: { id: 'off-records', code: 'RECORDS', name: 'Records Section' },
          toUserId: actor.id,
          toOffice: actor.office,
          recipientName: actor.fullName,
          scope: 'inter_office',
          status: 'pending',
          remarks: 'For action',
          sentAt: new Date(Date.now() - i * 60_000).toISOString(),
          receivedAt: null,
          receivedByName: null,
        },
      ],
      externalMilestones: [],
    }));

    const manyTracked: DocumentTrackingSnapshot[] = Array.from({ length: 12 }, (_, i) => ({
      documentId: `doc-pg-${i + 1}`,
      trackingCode: `SDO-OM-2026-${String(2000 + i).padStart(6, '0')}`,
      displayTitle: `Tracked Record #${i + 1}`,
      copyFormat: 'digital',
      lifecycleStatus: 'in_transit',
      slaState: 'on_track',
      currentOffice: { id: 'off-acct', code: 'ACCT', name: 'Accounting Unit' },
      currentHolderName: 'Danilo Reyes',
      receivedAt: null,
      lastUpdatedAt: new Date().toISOString(),
      visibility: 'full',
      isInternalOfficeStage: false,
      physicalSummary: null,
      milestones: [],
    }));

    const manyCategories: DocumentCategory[] = Array.from({ length: 14 }, (_, i) => ({
      id: `cat-pg-${i + 1}`,
      name: `Category Type ${i + 1}`,
      code: `CAT${i + 1}`,
      declaredByOfficeCode: 'RECORDS',
      isGlobal: true,
    }));

    const manyNotifications = Array.from({ length: 15 }, (_, i) => ({
      id: `notif-pg-${i + 1}`,
      documentId: 'doc-pg-1',
      title: `Routing Notice #${i + 1}`,
      content: `Document update #${i + 1}`,
      lockScreenPreview: 'New SDO update',
      authenticatedDetail: `Detail #${i + 1}`,
      receivedAt: new Date(Date.now() - i * 60_000).toISOString(),
      read: i > 2,
    }));

    const gw = createMockGateway({
      listWorkspace: async () => ({
        offices: [actor.office],
        personnel: [actor],
        documents: manyDocs,
        trackedSnapshots: manyTracked,
        categories: manyCategories,
        notifications: manyNotifications,
      }),
    });

    render(<App gateway={gw} initialActor={actor} firstVisitSkeletonMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: /^Sync$/i }));

    // 1. Inbox paginates 18 documents -> 15 on Page 1, 3 on Page 2
    const inboxPager = await screen.findByTestId('web-inbox-pagination');
    await waitFor(() => {
      expect(inboxPager.textContent).toContain('Showing 1–15 of 18 documents · Page 1 of 2');
    });
    fireEvent.click(within(inboxPager).getByRole('button', { name: /Next/i }));
    expect(inboxPager.textContent).toContain('Showing 16–18 of 18 documents · Page 2 of 2');

    const mainNav = screen.getByRole('navigation', { name: /Main navigation/i });

    // 2. Track page renders connected-dot progress rail + expandable vertical timeline and paginates 12 tracked documents
    fireEvent.click(within(mainNav).getByRole('button', { name: /Track Docs/i }));
    const trackPager = await screen.findByTestId('web-track-pagination');
    expect(trackPager.textContent).toContain('Showing 1–10 of 12 tracked documents · Page 1 of 2');
    expect(screen.getByTestId('tracking-rail-doc-pg-1')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Toggle timeline for SDO-OM-2026-002000/i }));
    expect(screen.getByTestId('tracking-timeline-doc-pg-1').textContent).toContain(
      'Custody Journey Checkpoints',
    );
    fireEvent.click(within(trackPager).getByRole('button', { name: /Next/i }));
    expect(trackPager.textContent).toContain('Showing 11–12 of 12 tracked documents · Page 2 of 2');

    // 3. Alerts / Notifications page paginates 15 notifications -> 12 on Page 1, 3 on Page 2
    fireEvent.click(within(mainNav).getByRole('button', { name: /Alerts/i }));
    const notifPager = await screen.findByTestId('web-notifications-pagination');
    expect(notifPager.textContent).toContain('Showing 1–12 of 15 notifications · Page 1 of 2');
    fireEvent.click(within(notifPager).getByRole('button', { name: /Next/i }));
    expect(notifPager.textContent).toContain('Showing 13–15 of 15 notifications · Page 2 of 2');

    // 4. Categories page paginates 14 categories -> 12 on Page 1, 2 on Page 2
    fireEvent.click(within(mainNav).getByRole('button', { name: /Categories/i }));
    const catPager = await screen.findByTestId('web-categories-pagination');
    expect(catPager.textContent).toContain('Showing 1–12 of 14 categories · Page 1 of 2');
    fireEvent.click(within(catPager).getByRole('button', { name: /Next/i }));
    expect(catPager.textContent).toContain('Showing 13–14 of 14 categories · Page 2 of 2');
  });

  it('enforces QR-gated file access until manual tracking code entry unlocks receipt and supports custom categories in SendPage', async () => {
    // 1. Flexible manual code parser supports Tracking Codes, raw tokens, and SDO-QR prefixes while rejecting garbage
    expect(parseOpaqueQrToken('sdo-om-2026-000142')).toEqual({
      kind: 'document',
      opaqueToken: 'SDO-OM-2026-000142',
    });
    expect(parseOpaqueQrToken('9f4a8b12c7e04a3d91f2a77c8d04142a')).toEqual({
      kind: 'document',
      opaqueToken: '9f4a8b12c7e04a3d91f2a77c8d04142a',
    });
    expect(() => parseOpaqueQrToken('https://evil.example.com')).toThrow();

    const actor: Personnel = {
      id: 'usr-1',
      fullName: 'Marco Villanueva',
      employeeId: 'EMP-2026-0142',
      email: 'marco.villanueva@deped.gov.ph',
      position: 'Administrative Officer IV',
      roleLabel: 'Unit Head',
      office: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
      availability: 'available',
      initials: 'MV',
    };

    const pendingSoftDoc: DocumentRecord = {
      id: 'doc-locked-1',
      trackingCode: 'SDO-OM-2026-000777',
      qrToken: '9f4a8b12c7e04a3d91f2a77c8d041777',
      title: 'Locked Q4 Disbursement Voucher',
      categoryId: 'cat-bur',
      categoryName: 'Budget Utilization Request',
      confidentialityTier: 'standard_internal',
      copyFormat: 'digital',
      lifecycleStatus: 'in_transit',
      slaState: 'on_track',
      slaDueAt: new Date(Date.now() + 86_400_000).toISOString(),
      originOffice: { id: 'off-sgod', code: 'SGOD', name: 'SGOD' },
      currentOffice: actor.office,
      submittedSchoolName: null,
      submittedSchoolId: null,
      physicalReference: null,
      physicalPageCount: null,
      versions: [
        {
          versionNumber: 1,
          fileName: 'voucher_q4.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 24500,
          sha256Checksum: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
          uploadedAt: new Date().toISOString(),
          uploadedByName: 'SGOD Head',
          note: 'For budget review',
        },
      ],
      transactions: [
        {
          id: 'tx-lock-1',
          fromUserId: 'usr-sgod-1',
          fromOffice: { id: 'off-sgod', code: 'SGOD', name: 'SGOD' },
          toUserId: actor.id,
          toOffice: actor.office,
          recipientName: actor.fullName,
          scope: 'inter_office',
          status: 'pending',
          remarks: 'Scan QR slip to unlock',
          sentAt: new Date().toISOString(),
          receivedAt: null,
          receivedByName: null,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const unlockedDoc: DocumentRecord = {
      ...pendingSoftDoc,
      lifecycleStatus: 'in_review',
      transactions: [
        {
          ...pendingSoftDoc.transactions[0],
          status: 'acknowledged',
          receivedAt: new Date().toISOString(),
          receivedByName: actor.fullName,
        },
      ],
    };

    const pendingHardDoc: DocumentRecord = {
      ...pendingSoftDoc,
      id: 'doc-locked-hard',
      trackingCode: 'TRC-2026-000779',
      qrToken: '8a3b7c12d9e04f3a91e2b88c7d041779',
      title: 'Locked Hard Copy Routing Folder',
      copyFormat: 'hard_copy',
      physicalReference: 'Blue Folder #4',
      physicalPageCount: 6,
      versions: [],
    };

    const unlockedHardDoc: DocumentRecord = {
      ...pendingHardDoc,
      lifecycleStatus: 'in_review',
      transactions: [
        {
          ...pendingHardDoc.transactions[0],
          status: 'acknowledged',
          receivedAt: new Date().toISOString(),
          receivedByName: actor.fullName,
        },
      ],
    };

    const createUnlockChallenge = vi.fn(async (documentId: string) => ({
      challengeId: `chl-${documentId}`,
      documentId,
      token: 'abcdef1234567890abcdef1234567890',
      qrPayload: 'TRC-QR:UNLOCK:abcdef1234567890abcdef1234567890',
      shortCode: 'K7P-492',
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    }));
    const acknowledgeReceipt = vi.fn(async (docId: string) =>
      docId === 'doc-locked-hard' ? unlockedHardDoc : unlockedDoc,
    );
    const declareCategory = vi.fn(async (name: string, code: string) => ({
      id: 'cat-custom-repair',
      name,
      code,
      declaredByOfficeCode: 'BUDGET',
      isGlobal: true,
    }));
    const registerHardCopyDocument = vi.fn(async (payload) => ({
      ...unlockedDoc,
      id: 'doc-new-custom-cat',
      trackingCode: 'SDO-OM-2026-000778',
      title: payload.title,
      categoryId: payload.categoryId,
      categoryName: 'School Repair Request',
      copyFormat: 'hard_copy' as const,
      versions: [],
      transactions: [],
    }));

    const gw = createMockGateway({
      listWorkspace: async () => ({
        offices: [actor.office],
        personnel: [actor],
        documents: [pendingSoftDoc, pendingHardDoc],
        trackedSnapshots: [],
        categories: [
          {
            id: 'cat-bur',
            name: 'Budget Utilization Request',
            code: 'BUR',
            declaredByOfficeCode: 'BUDGET',
            isGlobal: true,
          },
        ],
        notifications: [],
      }),
      createUnlockChallenge,
      resolveQr: async (raw) => {
        const parsed = parseOpaqueQrToken(raw);
        if (parsed.opaqueToken === 'SDO-OM-2026-000777') {
          return {
            kind: 'document_authorized',
            document: pendingSoftDoc,
            pendingForActorOffice: true,
            sentByActor: false,
            verificationCode: pendingSoftDoc.qrToken,
          };
        }
        if (parsed.opaqueToken === 'TRC-2026-000779') {
          return {
            kind: 'document_authorized',
            document: pendingHardDoc,
            pendingForActorOffice: true,
            sentByActor: false,
            verificationCode: pendingHardDoc.qrToken,
          };
        }
        throw new Error('No document matches this QR token or tracking code.');
      },
      acknowledgeReceipt,
      declareCategory,
      registerHardCopyDocument,
    });

    render(<App gateway={gw} initialActor={actor} firstVisitSkeletonMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: /^Sync$/i }));

    // Pending incoming documents render as sealed QR cards (hiding real titles & tracking codes until unlocked)
    await waitFor(() => {
      expect(screen.getByTestId('sealed-qr-card-doc-locked-1')).toBeTruthy();
      expect(screen.getByTestId('sealed-qr-card-doc-locked-hard')).toBeTruthy();
    });
    expect(screen.queryByText('Locked Q4 Disbursement Voucher')).toBeNull();
    expect(screen.queryByText('SDO-OM-2026-000777')).toBeNull();
    expect(screen.queryByText('Locked Hard Copy Routing Folder')).toBeNull();

    // 1A. Hard Copy sealed card shows "Receive Hard Copy" and opens the camera-free HardCopyReceiveModal
    expect(
      within(screen.getByTestId('sealed-qr-card-doc-locked-hard')).getByRole('button', {
        name: /^Receive Hard Copy$/i,
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByTestId('sealed-qr-trigger-doc-locked-hard'));
    expect(await screen.findByTestId('web-hard-copy-receive-modal')).toBeTruthy();
    expect(screen.getByText(/Scan the printed routing slip with Tracely Mobile/i)).toBeTruthy();
    expect(screen.queryByTestId('web-unlock-password-toggle')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Close Receive Hard Copy/i }));

    // Hard Copy direct Detail URL stays locked behind QR gate and unlocks via Receive Hard Copy modal or manual code
    window.location.hash = '#/document/doc-locked-hard';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(await screen.findByTestId('web-qr-lock-gate')).toBeTruthy();
    expect(screen.getByTestId('web-attachments-locked-card')).toBeTruthy();
    expect(screen.queryByText('Locked Hard Copy Routing Folder')).toBeNull();
    expect(screen.queryByRole('button', { name: /Routing QR Slip/i })).toBeNull();

    fireEvent.click(screen.getByTestId('sealed-detail-qr-trigger-doc-locked-hard'));
    expect(await screen.findByTestId('web-hard-copy-receive-modal')).toBeTruthy();
    const hardCopyInput = screen.getByLabelText('Tracking Code Input');
    fireEvent.change(hardCopyInput, { target: { value: 'trc-2026-000779' } });
    fireEvent.click(screen.getByTestId('web-hard-copy-code-submit'));

    await waitFor(() => {
      expect(acknowledgeReceipt).toHaveBeenCalledWith(
        'doc-locked-hard',
        undefined,
        undefined,
        '8a3b7c12d9e04f3a91e2b88c7d041779',
        undefined,
      );
    });
    await waitFor(() => {
      expect(screen.queryByTestId('web-hard-copy-receive-modal')).toBeNull();
      expect(screen.queryByTestId('web-qr-lock-gate')).toBeNull();
      expect(screen.getByText('Locked Hard Copy Routing Folder')).toBeTruthy();
    });

    // 1B. Soft Copy sealed card shows "Show Unlock QR", opens live Desktop Unlock QR Modal + 6-char code + Password Fallback
    window.location.hash = '#/inbox';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await waitFor(() => {
      expect(screen.getByTestId('sealed-qr-card-doc-locked-1')).toBeTruthy();
    });
    expect(
      within(screen.getByTestId('sealed-qr-card-doc-locked-1')).getByRole('button', {
        name: /^Show Unlock QR$/i,
      }),
    ).toBeTruthy();

    fireEvent.click(screen.getByTestId('sealed-qr-trigger-doc-locked-1'));
    expect(await screen.findByTestId('web-soft-copy-unlock-modal')).toBeTruthy();
    expect(createUnlockChallenge).toHaveBeenCalledWith('doc-locked-1');
    expect(screen.getByText(/Scan with Tracely Mobile/i)).toBeTruthy();
    expect(await screen.findByTestId('web-unlock-short-code')).toBeTruthy();
    expect(screen.getByTestId('web-unlock-short-code').textContent).toContain('K7P-492');

    // Expand password fallback inside modal and confirm receipt with account password
    fireEvent.click(screen.getByTestId('web-unlock-password-toggle'));
    const pwInput = await screen.findByLabelText(/Account Password/i);
    fireEvent.change(pwInput, { target: { value: 'Tracely#2026' } });
    fireEvent.click(screen.getByTestId('web-unlock-password-submit'));

    await waitFor(() => {
      expect(acknowledgeReceipt).toHaveBeenCalledWith(
        'doc-locked-1',
        undefined,
        undefined,
        undefined,
        'Tracely#2026',
      );
    });
    await waitFor(() => {
      expect(screen.queryByTestId('web-soft-copy-unlock-modal')).toBeNull();
      expect(screen.queryByTestId('web-qr-lock-gate')).toBeNull();
      expect(screen.getByText('Locked Q4 Disbursement Voucher')).toBeTruthy();
      expect(screen.getByRole('button', { name: /^View$/i })).toBeTruthy();
    });

    // Verify unlock challenge QR & 6-char short code parser support
    expect(parseOpaqueQrToken('TRC-QR:UNLOCK:abcdef123456')).toEqual({
      kind: 'unlock_challenge',
      opaqueToken: 'abcdef123456',
    });
    expect(parseOpaqueQrToken('k7p-492')).toEqual({
      kind: 'unlock_challenge',
      opaqueToken: 'K7P492',
    });

    // 2. Inline Custom Category creation inside Send Document
    const mainNav = screen.getByRole('navigation', { name: /Main navigation/i });
    fireEvent.click(within(mainNav).getByRole('button', { name: /Send Document/i }));
    fireEvent.click(screen.getByRole('tab', { name: /Hard Copy/i }));
    fireEvent.click(screen.getByRole('button', { name: /Change/i }));
    fireEvent.click(screen.getByTestId('web-send-add-custom-category-btn'));

    fireEvent.change(screen.getByLabelText('Category Name'), {
      target: { value: 'School Repair Request' },
    });
    fireEvent.change(screen.getByLabelText('Short Code (Optional)'), {
      target: { value: 'REP-REQ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save & Select Category/i }));

    await waitFor(() => {
      expect(declareCategory).toHaveBeenCalledWith('School Repair Request', 'REP-REQ');
    });

    fireEvent.change(screen.getByLabelText('Document Title'), {
      target: { value: 'Roof Repair Request Batch' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Generate QR Slip/i }));

    await waitFor(() => {
      expect(registerHardCopyDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Roof Repair Request Batch',
          categoryId: 'cat-custom-repair',
        }),
      );
    });
  });

  it('supports FuseButton Recall with Undo/Escape cancellation and fuseEnd commit on Sent and Document Detail', async () => {
    const onCommit = vi.fn();
    const onUndo = vi.fn();
    const onFuseEnd = vi.fn();

    try {
      vi.useFakeTimers();

      // 1. Standalone FuseButton defaults to Recall, cancels via Undo/Escape, and commits on fuseEnd
      const standalone = render(
        <FuseButton
          commitOn="fuseEnd"
          undoWindow={4000}
          testId="standalone-recall-fuse"
          onCommit={onCommit}
          onUndo={onUndo}
          onFuseEnd={onFuseEnd}
        />,
      );

      const pill = screen.getByTestId('standalone-recall-fuse');
      expect(pill.getAttribute('data-phase')).toBe('idle');

      fireEvent.click(within(pill).getByRole('button', { name: /^Recall$/i }));
      expect(pill.getAttribute('data-phase')).toBe('armed');
      expect(onCommit).not.toHaveBeenCalled();

      // Undo via button click cancels commit
      fireEvent.click(within(pill).getByRole('button', { name: /^Undo$/i }));
      expect(pill.getAttribute('data-phase')).toBe('idle');
      expect(onUndo).toHaveBeenCalledTimes(1);
      act(() => {
        vi.advanceTimersByTime(4500);
      });
      expect(onCommit).not.toHaveBeenCalled();

      // Undo via Escape key cancels commit
      fireEvent.click(within(pill).getByRole('button', { name: /^Recall$/i }));
      expect(pill.getAttribute('data-phase')).toBe('armed');
      fireEvent.keyDown(pill, { key: 'Escape' });
      expect(pill.getAttribute('data-phase')).toBe('idle');
      expect(onUndo).toHaveBeenCalledTimes(2);
      act(() => {
        vi.advanceTimersByTime(4500);
      });
      expect(onCommit).not.toHaveBeenCalled();

      // Letting fuse burn to completion fires onFuseEnd and onCommit('fuseEnd')
      fireEvent.click(within(pill).getByRole('button', { name: /^Recall$/i }));
      expect(pill.getAttribute('data-phase')).toBe('armed');
      act(() => {
        vi.advanceTimersByTime(4100);
      });
      expect(onFuseEnd).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith('fuseEnd');
      expect(pill.getAttribute('data-phase')).toBe('idle');

      standalone.unmount();
    } finally {
      vi.useRealTimers();
    }

    // 2. End-to-end integration on Sent Files and Document Detail
    const actor: Personnel = {
      id: 'usr-sender-1',
      fullName: 'Marco Villanueva',
      employeeId: 'EMP-2026-0142',
      email: 'marco.villanueva@deped.gov.ph',
      position: 'Administrative Officer IV',
      roleLabel: 'Unit Head',
      office: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
      availability: 'available',
      initials: 'MV',
    };

    const recipientOffice = { id: 'off-sgod', code: 'SGOD', name: 'SGOD' };

    const pendingSentDoc: DocumentRecord = {
      id: 'doc-fuse-1',
      trackingCode: 'SDO-OM-2026-000888',
      qrToken: '9f4a8b12c7e04a3d91f2a77c8d041888',
      title: 'Pending Memo for Fuse Recall',
      categoryId: 'cat-memo',
      categoryName: 'Office Memorandum',
      confidentialityTier: 'standard_internal',
      copyFormat: 'hard_copy',
      lifecycleStatus: 'in_transit',
      slaState: 'on_track',
      slaDueAt: new Date(Date.now() + 86_400_000).toISOString(),
      originOffice: actor.office,
      currentOffice: recipientOffice,
      submittedSchoolName: null,
      submittedSchoolId: null,
      physicalReference: 'Folder #888',
      physicalPageCount: 4,
      versions: [],
      transactions: [
        {
          id: 'tx-fuse-1',
          fromUserId: actor.id,
          fromOffice: actor.office,
          toUserId: 'usr-sgod-2',
          toOffice: recipientOffice,
          recipientName: 'Rafael Cruz',
          scope: 'inter_office',
          status: 'pending',
          remarks: 'Pending recipient QR scan',
          sentAt: '2026-06-01T08:05:00Z',
          receivedAt: null,
          receivedByName: null,
        },
      ],
      createdAt: '2026-06-01T08:00:00Z',
    };

    const recalledDoc: DocumentRecord = {
      ...pendingSentDoc,
      lifecycleStatus: 'in_review',
      currentOffice: actor.office,
      transactions: [
        {
          ...pendingSentDoc.transactions[0],
          status: 'recalled',
        },
      ],
    };

    let currentDoc = pendingSentDoc;
    const recallTransfer = vi.fn(async () => {
      currentDoc = recalledDoc;
      return recalledDoc;
    });

    const gw = createMockGateway({
      listWorkspace: async () => ({
        offices: [actor.office, recipientOffice],
        personnel: [actor],
        documents: [currentDoc],
        trackedSnapshots: [],
        categories: [
          {
            id: 'cat-memo',
            name: 'Office Memorandum',
            code: 'OM',
            declaredByOfficeCode: 'BUDGET',
            isGlobal: true,
          },
        ],
        notifications: [],
      }),
      recallTransfer,
    });

    render(<App gateway={gw} initialActor={actor} firstVisitSkeletonMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: /^Sync$/i }));

    // Go to Sent Files and test Undo cancellation on SentPage FuseButton
    fireEvent.click(screen.getByRole('button', { name: /Sent Files/i }));
    const sentFuse = await screen.findByTestId('sent-recall-fuse-doc-fuse-1');

    try {
      vi.useFakeTimers();
      fireEvent.click(within(sentFuse).getByRole('button', { name: /^Recall$/i }));
      expect(sentFuse.getAttribute('data-phase')).toBe('armed');
      fireEvent.click(within(sentFuse).getByRole('button', { name: /^Undo$/i }));
      expect(sentFuse.getAttribute('data-phase')).toBe('idle');
      act(() => {
        vi.advanceTimersByTime(4500);
      });
      expect(recallTransfer).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }

    // Open document detail and test letting FuseButton burn out to commit Recall
    fireEvent.click(screen.getByRole('button', { name: /^Open$/i }));
    const detailFuse = await screen.findByTestId('detail-recall-fuse');

    try {
      vi.useFakeTimers();
      fireEvent.click(within(detailFuse).getByRole('button', { name: /^Recall Transfer$/i }));
      expect(detailFuse.getAttribute('data-phase')).toBe('armed');
      expect(recallTransfer).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(4100);
      });
    } finally {
      vi.useRealTimers();
    }

    await waitFor(() => {
      expect(recallTransfer).toHaveBeenCalledWith('doc-fuse-1');
    });
  });

  it('removes completed documents from Inbox into Completed screen, requires forward verification, and allows Release / Send Back on approved documents', async () => {
    const actor: Personnel = {
      id: 'usr-sender-1',
      fullName: 'Marco Villanueva',
      employeeId: 'EMP-2026-0142',
      email: 'marco.villanueva@deped.gov.ph',
      position: 'Administrative Officer IV',
      roleLabel: 'Unit Head',
      office: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
      availability: 'available',
      initials: 'MV',
    };
    const peer: Personnel = {
      id: 'usr-sgod-2',
      fullName: 'Rafael Cruz',
      employeeId: 'EMP-2026-0210',
      email: 'rafael.cruz@deped.gov.ph',
      position: 'EPS II',
      roleLabel: 'Staff',
      office: { id: 'off-sgod', code: 'SGOD', name: 'SGOD' },
      availability: 'available',
      initials: 'RC',
    };

    const activeDoc: DocumentRecord = {
      id: 'doc-active-1',
      trackingCode: 'SDO-OM-2026-000901',
      qrToken: '9f4a8b12c7e04a3d91f2a77c8d041901',
      title: 'Active Voucher Ready to Forward',
      categoryId: 'cat-memo',
      categoryName: 'Office Memorandum',
      confidentialityTier: 'standard_internal',
      copyFormat: 'digital',
      lifecycleStatus: 'in_review',
      slaState: 'on_track',
      slaDueAt: new Date(Date.now() + 86_400_000).toISOString(),
      originOffice: actor.office,
      currentOffice: actor.office,
      submittedSchoolName: null,
      submittedSchoolId: null,
      physicalReference: null,
      physicalPageCount: null,
      versions: [],
      transactions: [],
      createdAt: '2026-06-01T08:00:00Z',
    };

    const approvedDoc: DocumentRecord = {
      ...activeDoc,
      id: 'doc-done-1',
      trackingCode: 'SDO-OM-2026-000902',
      title: 'Approved Travel Order (Completed)',
      lifecycleStatus: 'approved',
    };

    const forwardDocument = vi.fn(async (documentId: string, recipientUserId: string, remarks: string) => ({
      ...activeDoc,
      id: documentId,
      lifecycleStatus: 'in_transit' as const,
      currentOffice: peer.office,
      transactions: [
        {
          id: 'tx-fwd-901',
          fromUserId: actor.id,
          fromOffice: actor.office,
          toUserId: recipientUserId,
          toOffice: peer.office,
          recipientName: peer.fullName,
          scope: 'inter_office' as const,
          status: 'pending' as const,
          remarks,
          sentAt: '2026-06-01T09:00:00Z',
          receivedAt: null,
          receivedByName: null,
        },
      ],
    }));

    const gw = createMockGateway({
      listWorkspace: async () => ({
        offices: [actor.office, peer.office],
        personnel: [actor, peer],
        documents: [activeDoc, approvedDoc],
        trackedSnapshots: [],
        categories: [
          {
            id: 'cat-memo',
            name: 'Office Memorandum',
            code: 'OM',
            declaredByOfficeCode: 'BUDGET',
            isGlobal: true,
          },
        ],
        notifications: [],
      }),
      forwardDocument,
    });

    render(<App gateway={gw} initialActor={actor} firstVisitSkeletonMs={0} />);
    fireEvent.click(screen.getByRole('button', { name: /^Sync$/i }));

    // 1. Inbox shows activeDoc and excludes approvedDoc
    await waitFor(() => {
      expect(screen.getByText('Active Voucher Ready to Forward')).toBeTruthy();
    });
    expect(screen.queryByText('Approved Travel Order (Completed)')).toBeNull();

    // 2. Forwarding requires checking the verification checkbox first
    fireEvent.click(screen.getByRole('button', { name: /^Forward$/i }));
    const dispatchBtn = (await screen.findByRole('button', { name: /Dispatch Forward/i })) as HTMLButtonElement;
    expect(dispatchBtn.disabled).toBe(true);

    fireEvent.click(screen.getByLabelText(/Confirm recipient and attachments are correct/i));
    expect(dispatchBtn.disabled).toBe(false);
    fireEvent.click(dispatchBtn);

    await waitFor(() => {
      expect(forwardDocument).toHaveBeenCalledWith('doc-active-1', 'usr-sgod-2', '');
    });
    expect(await screen.findByTestId('inbox-forwarded-badge-doc-active-1')).toBeTruthy();

    // 3. Completed sidebar link displays approvedDoc and allows Release / Send Back on detail view
    fireEvent.click(screen.getByRole('button', { name: /^Completed$/i }));
    expect(await screen.findByTestId('web-completed-page')).toBeTruthy();
    expect(screen.getByText('Approved Travel Order (Completed)')).toBeTruthy();

    fireEvent.click(screen.getByTestId('completed-row-doc-done-1'));
    expect(await screen.findByRole('button', { name: /Release \/ Send Back/i })).toBeTruthy();
  });

  it('supports Public QR Verify, Forgot Password, Force Password Change, USB Batch Receive, Routing Templates, and SLA Analytics', async () => {
    // 1. Public QR Verify works without authentication at #/verify/<token>
    window.location.hash = '#/verify/public-tok-777';
    const verifyPublicTransmittal = vi.fn(async () => ({
      trackingCode: 'TRC-2026-000777',
      lifecycleStatus: 'in_review',
      currentOfficeName: 'Budget Unit',
      latestChecksumShort: 'abcd1234ef56...',
      milestoneCount: 3,
    }));
    const requestPasswordReset = vi.fn(async () => ({
      message: 'Reset code issued.',
      devResetCode: 'K7P-492',
    }));
    const confirmPasswordReset = vi.fn(async () => 'Password reset successful.');

    const pubGw = createMockGateway({
      verifyPublicTransmittal,
      requestPasswordReset,
      confirmPasswordReset,
    });
    const pubView = render(<App gateway={pubGw} requireAuth />);

    expect(await screen.findByTestId('web-public-verify-page')).toBeTruthy();
    expect(await screen.findByTestId('web-public-verify-result')).toBeTruthy();
    expect(screen.getByText('TRC-2026-000777')).toBeTruthy();
    expect(verifyPublicTransmittal).toHaveBeenCalledWith('public-tok-777');

    // 2. Navigate to Sign In -> Self-service Forgot Password 2-step flow
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));
    fireEvent.click(await screen.findByTestId('web-forgot-password-btn'));
    fireEvent.change(screen.getByLabelText(/Employee ID or Work Email/i), {
      target: { value: 'budget@tracely.app' },
    });
    fireEvent.click(screen.getByTestId('web-forgot-send-code-btn'));
    await waitFor(() => {
      expect(requestPasswordReset).toHaveBeenCalledWith('budget@tracely.app');
    });

    fireEvent.change(await screen.findByLabelText(/6-Character Reset Code/i), {
      target: { value: 'K7P-492' },
    });
    fireEvent.change(screen.getByLabelText(/^New Password$/i), {
      target: { value: 'ResetPass#2026!' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm New Password/i), {
      target: { value: 'ResetPass#2026!' },
    });
    fireEvent.click(screen.getByTestId('web-forgot-confirm-btn'));
    await waitFor(() => {
      expect(confirmPasswordReset).toHaveBeenCalledWith(
        'budget@tracely.app',
        'K7P-492',
        'ResetPass#2026!',
      );
    });
    pubView.unmount();

    // 3. Authenticated workspace: Force Password Change, USB Batch Receive, Routing Templates, SLA Analytics
    window.location.hash = '#/inbox';
    const actor: Personnel = {
      id: 'usr-1',
      fullName: 'Marco Villanueva',
      employeeId: 'EMP-2026-0142',
      email: 'marco@tracely.app',
      position: 'Budget Officer',
      roleLabel: 'Unit Head',
      office: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
      availability: 'available',
      mustChangePassword: true,
      initials: 'MV',
    };

    const hardDocA: DocumentRecord = {
      id: 'doc-usb-a',
      trackingCode: 'TRC-2026-001001',
      qrToken: 'tok-usb-a',
      title: 'Hard Copy Folder A',
      categoryId: 'cat-bur',
      categoryName: 'Budget Utilization Request',
      confidentialityTier: 'standard_internal',
      copyFormat: 'hard_copy',
      lifecycleStatus: 'in_transit',
      slaState: 'on_track',
      slaDueAt: null,
      originOffice: { id: 'off-ops', code: 'OPS', name: 'Operations' },
      currentOffice: actor.office,
      submittedSchoolName: null,
      submittedSchoolId: null,
      physicalReference: 'Folder A',
      physicalPageCount: 4,
      versions: [],
      transactions: [
        {
          id: 'tx-usb-a',
          fromUserId: 'usr-ops-1',
          fromOffice: { id: 'off-ops', code: 'OPS', name: 'Operations' },
          toUserId: actor.id,
          toOffice: actor.office,
          recipientName: actor.fullName,
          scope: 'inter_office',
          status: 'pending',
          remarks: 'Physical batch',
          sentAt: new Date().toISOString(),
          receivedAt: null,
          receivedByName: null,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const changePassword = vi.fn(async () => {});
    const acknowledgeReceipt = vi.fn(async () => ({
      ...hardDocA,
      lifecycleStatus: 'in_review' as const,
      transactions: [{ ...hardDocA.transactions[0], status: 'acknowledged' as const }],
    }));

    const sentDocB: DocumentRecord = {
      id: 'doc-sent-b',
      trackingCode: 'TRC-2026-001002',
      qrToken: 'tok-sent-b',
      title: 'Outgoing Budget Allotment Slip',
      categoryId: 'cat-bur',
      categoryName: 'Budget Utilization Request',
      confidentialityTier: 'standard_internal',
      copyFormat: 'digital',
      lifecycleStatus: 'in_transit',
      slaState: 'on_track',
      slaDueAt: null,
      originUserId: actor.id,
      originUserName: actor.fullName,
      originOffice: actor.office,
      currentOffice: { id: 'off-acct', code: 'ACCT', name: 'Accounting Unit' },
      submittedSchoolName: null,
      submittedSchoolId: null,
      physicalReference: null,
      physicalPageCount: null,
      versions: [],
      transactions: [
        {
          id: 'tx-sent-b',
          fromUserId: actor.id,
          fromUserName: actor.fullName,
          fromOffice: actor.office,
          toUserId: 'usr-acct-1',
          toOffice: { id: 'off-acct', code: 'ACCT', name: 'Accounting Unit' },
          recipientName: 'Accounting Officer',
          scope: 'inter_office',
          status: 'pending',
          remarks: 'For accounting verification',
          sentAt: new Date().toISOString(),
          receivedAt: null,
          receivedByName: null,
        },
      ],
      createdAt: new Date().toISOString(),
    };

    const wsGw = createMockGateway({
      listWorkspace: async () => ({
        offices: [actor.office, { id: 'off-acct', code: 'ACCT', name: 'Accounting Unit' }],
        personnel: [actor],
        documents: [hardDocA, sentDocB],
        trackedSnapshots: [],
        categories: [
          {
            id: 'cat-bur',
            name: 'Budget Utilization Request',
            code: 'BUR',
            declaredByOfficeCode: 'BUDGET',
            isGlobal: true,
          },
        ],
        notifications: [],
      }),
      changePassword,
      acknowledgeReceipt,
      resolveQr: async () => ({
        kind: 'document_authorized',
        document: hardDocA,
        pendingForActorOffice: true,
        sentByActor: false,
        verificationCode: 'tok-usb-a',
      }),
    });

    render(<App gateway={wsGw} initialActor={actor} firstVisitSkeletonMs={0} />);

    // Force Password Change modal appears immediately for temporary admin-reset passwords
    expect(await screen.findByTestId('web-force-password-change-modal')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Temporary \/ Current Password/i), {
      target: { value: 'TempPass#2026!' },
    });
    fireEvent.change(screen.getByLabelText(/New Personal Password/i), {
      target: { value: 'PersonalPass#2026!' },
    });
    fireEvent.change(screen.getByLabelText(/Confirm New Password/i), {
      target: { value: 'PersonalPass#2026!' },
    });
    fireEvent.click(screen.getByTestId('web-force-password-submit'));

    await waitFor(() => {
      expect(changePassword).toHaveBeenCalledWith('TempPass#2026!', 'PersonalPass#2026!');
    });
    await waitFor(() => {
      expect(screen.queryByTestId('web-force-password-change-modal')).toBeNull();
    });

    // USB Batch Receive modal queues & confirms scanned slips
    fireEvent.click(screen.getByRole('button', { name: /^Sync$/i }));
    await waitFor(() => {
      expect(screen.getByTestId('web-open-usb-batch-btn')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('web-open-usb-batch-btn'));
    expect(await screen.findByTestId('web-batch-usb-receive-modal')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Batch Tracking Code Input'), {
      target: { value: 'TRC-2026-001001' },
    });
    fireEvent.submit(screen.getByTestId('web-batch-usb-form'));
    expect(await screen.findByTestId('usb-batch-item-doc-usb-a')).toBeTruthy();
    fireEvent.click(screen.getByTestId('web-batch-usb-confirm-all'));
    await waitFor(() => {
      expect(acknowledgeReceipt).toHaveBeenCalledWith(
        'doc-usb-a',
        undefined,
        undefined,
        'tok-usb-a',
      );
    });

    // Routing Templates inside Send Document
    const mainNav = screen.getByRole('navigation', { name: 'Main navigation' });
    fireEvent.click(within(mainNav).getByRole('button', { name: /Send Document/i }));
    fireEvent.click(await screen.findByTestId('web-send-new-template-btn'));
    fireEvent.change(screen.getByLabelText(/Template Name/i), {
      target: { value: 'Budget to Accounting Route' },
    });
    fireEvent.click(screen.getByTestId('web-routing-template-save-btn'));
    expect(await screen.findByTestId('web-applied-template-banner')).toBeTruthy();
    expect(screen.getByTestId('web-routing-templates-strip')).toBeTruthy();

    // SLA Analytics page loads office turnaround metrics & CSV export
    fireEvent.click(within(mainNav).getByRole('button', { name: /^Analytics$/i }));
    expect(await screen.findByTestId('web-analytics-page')).toBeTruthy();
    expect(await screen.findByTestId('analytics-total-docs')).toBeTruthy();
    expect(screen.getByTestId('analytics-office-table')).toBeTruthy();
    expect(screen.getByTestId('web-analytics-export-csv')).toBeTruthy();

    // Dedicated Dashboard screen renders vertical portrait ID Card + Minimal Custody Road (Title-based, Top 5) + Folders
    fireEvent.click(within(mainNav).getByRole('button', { name: /^Dashboard$/i }));
    expect(await screen.findByTestId('web-dashboard-page')).toBeTruthy();
    expect(screen.getByTestId('web-dashboard-wallet-card')).toBeTruthy();
    expect(
      screen.getByTestId('web-dashboard-wallet-card').getAttribute('data-orientation'),
    ).toBe('portrait');
    fireEvent.click(screen.getByTestId('web-dashboard-wallet-card-flip-btn'));
    fireEvent.click(screen.getByTestId('web-dashboard-wallet-card-mask-btn'));
    expect(screen.getByTestId('web-routing-flow-analytics')).toBeTruthy();
    expect(screen.getByTestId('web-custody-journey-road')).toBeTruthy();
    expect(screen.getByTestId('web-custody-road-title').textContent).toBe(
      'Outgoing Budget Allotment Slip',
    );
    expect(
      screen.getByTestId('web-custody-journey-road').querySelectorAll('[data-testid^="custody-hop-"]').length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByTestId('web-routing-flow-analytics').querySelectorAll('[data-testid^="custody-doc-pill-"]').length,
    ).toBeLessThanOrEqual(5);
    fireEvent.click(screen.getByTestId('flow-scope-user'));
    expect(screen.getByTestId('web-custody-journey-road')).toBeTruthy();
    fireEvent.click(screen.getByTestId('flow-scope-office'));

    expect(screen.getByTestId('web-folder-organizer')).toBeTruthy();
    expect(screen.getByTestId('organizer-folder-stage-incoming')).toBeTruthy();
    fireEvent.click(screen.getByTestId('open-folder-ledger-stage-incoming'));
    expect(await screen.findByTestId('web-folder-ledger')).toBeTruthy();
    expect(screen.getByTestId('web-folder-ledger-pagination')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search folder ledger'), {
      target: { value: 'TRC-2026' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Last 7 Days/i }));
    fireEvent.click(screen.getByRole('button', { name: /All Time/i }));
    fireEvent.click(screen.getByTestId('folder-group-category'));
    fireEvent.click(screen.getByTestId('folder-group-stage'));

    // Categories screen renders Dashboard-style folders holding matching docs and navigates to Track Docs
    fireEvent.click(within(mainNav).getByRole('button', { name: /^Categories$/i }));
    expect(await screen.findByTestId('web-categories-folder-grid')).toBeTruthy();
    fireEvent.click(screen.getByTestId('web-open-category-folder-cat-bur'));
    expect(await screen.findByTestId('web-category-docs-panel')).toBeTruthy();
    fireEvent.click(screen.getByTestId('web-cat-doc-track-doc-sent-b'));
    expect((await screen.findByLabelText('Search tracking code or title') as HTMLInputElement).value).toBe(
      'TRC-2026-001002',
    );

    // Settings screen includes Folder Preferences + Permissions + Developer + Legal (zero secrets)
    fireEvent.click(screen.getByTestId('web-sidebar-settings-btn'));
    expect(await screen.findByTestId('web-settings-page')).toBeTruthy();
    expect(screen.getByTestId('web-settings-folder-prefs-card')).toBeTruthy();
    fireEvent.click(screen.getByTestId('web-pref-folder-mode-book'));
    fireEvent.click(screen.getByTestId('web-pref-folder-variant-glass'));
    fireEvent.click(screen.getByTestId('web-pref-folder-layout-stack'));
    expect(screen.getByTestId('web-settings-permissions-card')).toBeTruthy();
    expect(screen.getByTestId('web-system-developer').textContent).toBe('Andrei Obligar');
    const settingsText = screen.getByTestId('web-settings-page').textContent ?? '';
    expect(settingsText).toContain('Folder Preferences');
    expect(settingsText).toContain('Device & Service Permissions');
    expect(settingsText).toContain('Terms & Conditions');
    expect(settingsText).toContain('Privacy Policy');
    expect(settingsText).not.toMatch(/DepEd|SDO|Sanctum|Bearer|http:\/\/|https:\/\//i);
  });

  it('redirects newly registered users to PendingApprovalPage and transitions to Sign In once approved', async () => {
    let statusChecks = 0;
    const gateway = createMockGateway({
      register: async (payload) => ({
        pendingApproval: true,
        statusToken: 'tok-pending-123',
        message: 'Registration submitted for administrator verification.',
        submitted: {
          fullName: payload.fullName,
          employeeId: payload.employeeId,
          email: payload.email,
          position: payload.position,
          officeCode: payload.officeCode,
          officeName: 'Records & Registry',
          submittedAt: '2026-11-24T01:00:00Z',
        },
      }),
      checkRegistrationStatus: async () => {
        statusChecks += 1;
        if (statusChecks === 1) {
          return {
            status: 'pending',
            canSignIn: false,
            message: 'Still awaiting administrator review.',
          };
        }
        return {
          status: 'approved',
          canSignIn: true,
          message: 'Your account has been approved! You can now sign in.',
        };
      },
    });

    render(<App gateway={gateway} requireAuth={true} firstVisitSkeletonMs={0} />);

    fireEvent.click(screen.getByRole('tab', { name: 'Create Account' }));
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Elena Cruz' } });
    fireEvent.change(screen.getByLabelText('Employee ID'), { target: { value: 'TRC-9401' } });
    fireEvent.change(screen.getByLabelText('Work Email'), { target: { value: 'elena.cruz@tracely.app' } });
    fireEvent.change(screen.getByLabelText('Designation / Position'), { target: { value: 'Records Clerk' } });
    fireEvent.change(screen.getByLabelText('Create Password'), { target: { value: 'Tracely#2026!' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Tracely#2026!' } });
    // Attempting to submit without accepting Terms & Privacy Policy shows consent notice
    fireEvent.click(screen.getByRole('button', { name: 'Submit Registration' }));
    expect(
      await screen.findByText('Please agree to the Terms and Conditions and Privacy Policy to continue.'),
    ).toBeTruthy();

    // Open and inspect Privacy Policy modal, close it, then accept consent and submit
    fireEvent.click(screen.getByTestId('web-register-privacy-link'));
    expect(await screen.findByTestId('web-legal-policy-modal')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByTestId('web-register-terms-checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Submit Registration' }));

    expect(await screen.findByTestId('web-pending-approval-page')).toBeTruthy();
    expect(screen.getByTestId('web-pending-status-pill').textContent).toContain(
      'Awaiting Administrator Verification',
    );
    expect(screen.getByTestId('web-pending-summary-card').textContent).toContain('TRC-9401');

    // First manual check stays pending
    fireEvent.click(screen.getByTestId('web-pending-check-status-btn'));
    await waitFor(() => expect(statusChecks).toBe(1));
    expect(screen.getByTestId('web-pending-status-pill').textContent).toContain(
      'Awaiting Administrator Verification',
    );

    // Second manual check transitions to approved and reveals Proceed to Sign In CTA
    fireEvent.click(screen.getByTestId('web-pending-check-status-btn'));
    expect(await screen.findByTestId('web-pending-proceed-signin-btn')).toBeTruthy();
    expect(screen.getByTestId('web-pending-status-pill').textContent).toContain('Account Approved');

    // Clicking Proceed to Sign In navigates to LoginPage with email prefilled
    fireEvent.click(screen.getByTestId('web-pending-proceed-signin-btn'));
    const idInput = (await screen.findByLabelText('Employee ID or Work Email')) as HTMLInputElement;
    expect(idInput.value).toBe('elena.cruz@tracely.app');
  });

  it('silently baselines pre-existing unread notifications on sign-in first render and only fires newly arriving ones', async () => {
    const dispatchedNotifications: Array<{ title: string; body?: string }> = [];
    class MockNotification {
      public static permission: NotificationPermission = 'granted';
      public onclick: (() => void) | null = null;
      constructor(title: string, options?: NotificationOptions) {
        dispatchedNotifications.push({ title, body: options?.body });
      }
    }
    const prevNotification = window.Notification;
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      writable: true,
      value: MockNotification,
    });

    try {
      const actor: Personnel = {
        id: 'usr-signin-notif-baseline',
        fullName: 'Marco Villanueva',
        employeeId: 'TRC-0204',
        email: 'budget@tracely.app',
        position: 'Budget Officer III',
        role: 'staff',
        roleLabel: 'Staff',
        office: { id: 'off-budget', code: 'BUDGET', name: 'Budget Unit' },
        availability: 'available',
        initials: 'MV',
      };

      const serverNotifications = [
        {
          id: 'notif-preexisting-unread-1',
          documentId: 'doc-101',
          title: 'Pre-existing Unread Alert',
          content: 'Already unread before signing in.',
          lockScreenPreview: '1 unread alert.',
          authenticatedDetail: 'Already unread before signing in.',
          receivedAt: new Date(Date.now() - 3_600_000).toISOString(),
          read: false,
        },
      ];

      const gw = createMockGateway({
        login: async () => ({
          bearerToken: 'tok-baseline-1',
          user: actor,
        }),
        listWorkspace: async () => ({
          offices: [actor.office],
          personnel: [actor],
          documents: [],
          trackedSnapshots: [],
          categories: [],
          notifications: [...serverNotifications],
        }),
      });

      render(<App gateway={gw} requireAuth={true} firstVisitSkeletonMs={0} />);
      fireEvent.change(screen.getByLabelText('Employee ID or Work Email'), {
        target: { value: 'budget@tracely.app' },
      });
      fireEvent.change(screen.getByLabelText('Password'), {
        target: { value: 'Tracely@2026!' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(document.title).toBe('(1) Tracely');
      });
      // Pre-existing unread notification must NOT pop up on first render after sign-in
      expect(dispatchedNotifications).toHaveLength(0);

      // A genuinely new notification arriving on subsequent sync DOES fire once
      serverNotifications.unshift({
        id: 'notif-fresh-live-2',
        documentId: 'doc-102',
        title: 'Fresh Incoming Document',
        content: 'New transfer routed just now.',
        lockScreenPreview: '1 new custody alert.',
        authenticatedDetail: 'New transfer routed just now.',
        receivedAt: new Date().toISOString(),
        read: false,
      });
      fireEvent.click(screen.getByRole('button', { name: /^Sync$/i }));

      await waitFor(() => {
        expect(dispatchedNotifications).toHaveLength(1);
      });
      expect(dispatchedNotifications[0].title).toBe('Fresh Incoming Document');
      expect(document.title).toBe('(2) Tracely');
    } finally {
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        writable: true,
        value: prevNotification,
      });
    }
  });

  it('shows simplified no internet connection message on offline login/registration and supports Ctrl+K Quick Search', async () => {
    const offlineGw = createMockGateway({
      login: async () => {
        throw new TypeError('Failed to fetch');
      },
      register: async () => {
        throw new TypeError('Failed to fetch');
      },
    });

    const { unmount } = render(<App gateway={offlineGw} requireAuth={true} firstVisitSkeletonMs={0} />);
    fireEvent.change(screen.getByLabelText('Employee ID or Work Email'), {
      target: { value: 'records@tracely.app' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Tracely@2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    expect(await screen.findAllByText('No internet connection. Please try again.')).toBeTruthy();

    // Switch to Create Account tab and trigger offline registration
    fireEvent.click(screen.getByRole('tab', { name: /Create Account/i }));
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Maria Santos' } });
    fireEvent.change(screen.getByLabelText('Employee ID'), { target: { value: 'TRC-8801' } });
    fireEvent.change(screen.getByLabelText('Work Email'), { target: { value: 'maria.santos@tracely.app' } });
    fireEvent.change(screen.getByLabelText('Designation / Position'), { target: { value: 'Records Clerk' } });
    fireEvent.change(screen.getByLabelText('Create Password'), { target: { value: 'Tracely#2026!' } });
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Tracely#2026!' } });
    fireEvent.click(screen.getByTestId('web-register-terms-checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Submit Registration/i }));

    expect((await screen.findAllByText('No internet connection. Please try again.')).length).toBeGreaterThan(0);
    unmount();

    // Authenticated workspace Ctrl+K Global Quick Search opens and navigates to matching document
    const actor: Personnel = {
      id: 'usr-quick-search',
      fullName: 'Clarissa Mendoza',
      employeeId: 'TRC-0101',
      email: 'records@tracely.app',
      position: 'Records Officer',
      role: 'records_officer',
      roleLabel: 'Records Officer',
      office: { id: 'off-records', code: 'RECORDS', name: 'Records & Registry' },
      availability: 'available',
      initials: 'CM',
    };
    const gw = createMockGateway({
      login: async () => ({ bearerToken: 'tok-qs-1', user: actor }),
      listWorkspace: async () => ({
        offices: [actor.office],
        personnel: [actor],
        documents: [
          {
            id: 'doc-qs-1',
            trackingCode: 'TRC-2026-9901',
            qrToken: 'tok-qs-doc',
            title: 'Annual Procurement Plan FY 2026',
            categoryId: 'cat-1',
            categoryName: 'Procurement',
            confidentialityTier: 'standard_internal',
            copyFormat: 'digital',
            lifecycleStatus: 'in_transit',
            slaState: 'on_track',
            slaDueAt: null,
            originOffice: actor.office,
            currentOffice: actor.office,
            submittedSchoolName: null,
            submittedSchoolId: null,
            physicalReference: null,
            physicalPageCount: null,
            versions: [],
            transactions: [],
            createdAt: new Date().toISOString(),
          },
        ],
        trackedSnapshots: [],
        categories: [],
        notifications: [],
      }),
    });

    render(<App gateway={gw} requireAuth={true} firstVisitSkeletonMs={0} />);
    fireEvent.change(screen.getByLabelText('Employee ID or Work Email'), {
      target: { value: 'records@tracely.app' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Tracely@2026!' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    expect(await screen.findByTestId('web-quick-search-trigger')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const qsModal = await screen.findByTestId('web-quick-search-modal');
    expect(qsModal).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Quick search documents and screens'), {
      target: { value: 'TRC-2026-9901' },
    });
    await waitFor(() => {
      expect(qsModal.textContent).toContain('Annual Procurement Plan FY 2026');
    });
  });
});
