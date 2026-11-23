/* eslint-env jest */
/**
 * @format
 */

import React from 'react';
import { BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pick } from '@react-native-documents/picker';
import ReactTestRenderer, { ReactTestRendererJSON } from 'react-test-renderer';
import App from '../App';
import { createTestAppDependencies } from './fixtures/InMemoryTestRepos';

jest.setTimeout(15000);

function extractRenderedText(
  node: ReactTestRendererJSON | ReactTestRendererJSON[] | null,
): string {
  if (!node) return '';
  if (Array.isArray(node)) {
    return node.map(extractRenderedText).join(' ');
  }
  const parts: string[] = [];
  if (node.children) {
    for (const child of node.children) {
      if (typeof child === 'string' || typeof child === 'number') {
        parts.push(String(child));
      } else {
        parts.push(extractRenderedText(child));
      }
    }
  }
  return parts
    .join(' ')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')');
}

function extractInstanceText(inst: ReactTestRenderer.ReactTestInstance): string {
  return inst.children
    .map((c) => (typeof c === 'string' ? c : extractInstanceText(c)))
    .join(' ');
}

describe('DocsTracker React Native App', () => {
  const waitMs = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const mounted: ReactTestRenderer.ReactTestRenderer[] = [];

  const mountApp = async (element: React.ReactElement) => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(element);
    });
    mounted.push(renderer!);
    return renderer!;
  };

  afterEach(async () => {
    while (mounted.length > 0) {
      const inst = mounted.pop();
      await ReactTestRenderer.act(async () => {
        inst?.unmount();
      });
    }
  });

  test('gates behind LoginScreen by default when unauthenticated (AUTH_REQUIRED=true)', async () => {
    const { deps } = createTestAppDependencies();
    const renderer = await mountApp(<App dependencies={deps} />);

    const renderedText = extractRenderedText(renderer.toJSON());
    expect(renderedText).toContain('Tracely');
    expect(renderedText).toContain('Sign In');
    expect(renderedText).toContain('Employee ID or Work Email');
    expect(renderedText).toContain('Forgot password?');

    // Tapping Forgot password? switches cleanly to the self-service reset flow
    const forgotBtn = renderer.root.findByProps({ testID: 'mobile-forgot-password-btn' });
    await ReactTestRenderer.act(async () => {
      forgotBtn.props.onPress();
    });
    expect(extractRenderedText(renderer.toJSON())).toContain('Send Reset Code');
  });

  test('opens directly into Inbox workspace when login gate is explicitly deferred', async () => {
    const { deps } = createTestAppDependencies();
    const renderer = await mountApp(<App dependencies={deps} requireAuth={false} />);

    const renderedText = extractRenderedText(renderer.toJSON());
    expect(renderedText).toContain('Tracely');
    expect(renderedText).toContain('Scan to receive');
    expect(renderedText).not.toContain('Track Code');
    expect(renderedText).toContain('Track');
    expect(renderedText).toContain('Tracked (');
    expect(renderedText).not.toContain('Create Account');
  });

  test('gates behind LoginScreen when requireAuth is enabled and unauthenticated', async () => {
    const { deps } = createTestAppDependencies();
    const renderer = await mountApp(<App dependencies={deps} requireAuth />);

    const renderedText = extractRenderedText(renderer.toJSON());
    expect(renderedText).toContain('Tracely');
    expect(renderedText).toContain('Sign In');
    expect(renderedText).toContain('Create Account');
    expect(renderedText).toContain('Employee ID or Work Email');
    expect(renderedText).not.toContain('Configure');
    expect(renderedText).not.toContain('Quick Sign-In');
  });

  test('renders custody-scoped Budget incoming queue and hides Confidential Legal records when authenticated', async () => {
    const { deps } = createTestAppDependencies({ authenticatedUserId: 'usr-budget-1' });
    const renderer = await mountApp(<App dependencies={deps} requireAuth />);

    const renderedText = extractRenderedText(renderer.toJSON());
    // Pending incoming doc-142 renders as a sealed QR card hiding real code & title until scanned
    expect(renderer.root.findAllByProps({ testID: 'mobile-sealed-qr-card-doc-142' }).length).toBeGreaterThan(0);
    expect(renderedText).toContain('Sealed Incoming Document');
    expect(renderedText).toContain('SDO-OM-2026-••••••');
    expect(renderedText).not.toContain('SDO-OM-2026-000142');
    expect(renderedText).not.toContain('Q4 School DRRM Minor Repair Funding Request');
    // Already acknowledged custody doc-115 is visible; Confidential Legal doc-099 stays hidden
    expect(renderedText).toContain('SDO-OM-2026-000115');
    expect(renderedText).not.toContain('SDO-OM-2026-000099');
  });

  test('lists documents sent by the user office inside TrackScreen without typing codes', async () => {
    const { deps } = createTestAppDependencies({ authenticatedUserId: 'usr-records-1' });
    const renderer = await mountApp(<App dependencies={deps} requireAuth />);

    const trackBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        node.props.accessibilityLabel === 'Track',
    );
    expect(trackBtn.length).toBeGreaterThan(0);

    await ReactTestRenderer.act(async () => {
      trackBtn[0].props.onPress();
    });

    const sheetText = extractRenderedText(renderer.toJSON()).replace(/\s+/g, ' ');
    expect(sheetText).toContain('Active Routing (2)');
    expect(sheetText).toContain('SDO-OM-2026-000138');
    expect(sheetText).toContain('School Governance & Operations Division');
    expect(sheetText).toContain('Received ·');

    // Expand SDO-OM-2026-000138 card inline without typing any code
    const toggleBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        node.props.accessibilityLabel === 'Toggle timeline for SDO-OM-2026-000138',
    );
    expect(toggleBtn.length).toBeGreaterThan(0);

    await ReactTestRenderer.act(async () => {
      toggleBtn[0].props.onPress();
    });

    const expandedText = extractRenderedText(renderer.toJSON()).replace(/\s+/g, ' ');
    expect(expandedText).toContain('Registered at RECORDS');
    expect(expandedText).toContain('Forwarded to SGOD');
  });

  test('renders realistic HR-locked identity, workload metrics, and security controls on ProfileScreen', async () => {
    const { deps } = createTestAppDependencies({ authenticatedUserId: 'usr-budget-1' });
    const renderer = await mountApp(<App dependencies={deps} requireAuth />);

    const headerProfileBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Marco'),
    )[0];
    expect(headerProfileBtn).toBeDefined();

    await ReactTestRenderer.act(async () => {
      headerProfileBtn.props.onPress();
    });

    const profileText = extractRenderedText(renderer.toJSON());
    expect(profileText).toContain('Profile & Security');
    expect(profileText).toContain('HR-LOCKED IDENTITY');
    expect(profileText).toContain('Unit Head');
    expect(profileText).toContain('Desk Workload Overview');
    expect(profileText).toContain('Device Lock for Confidential Docs');
    expect(profileText).toContain('Active Devices & Sanctum Sessions');
    expect(profileText).toContain('Change Account Password');

    // Verify CustomToast renders sleekly and dismisses cleanly without layout shift
    const switches = renderer.root.findAll(
      (node) => typeof node.props.onValueChange === 'function',
    );
    expect(switches.length).toBeGreaterThan(0);

    await ReactTestRenderer.act(async () => {
      switches[0].props.onValueChange(true);
    });

    const withToast = extractRenderedText(renderer.toJSON());
    expect(withToast).toContain('Device security preferences saved.');

    const dismissBtn = renderer.root.find(
      (node) => node.props.accessibilityLabel === 'Dismiss notification',
    );
    await ReactTestRenderer.act(async () => {
      dismissBtn.props.onPress();
    });

    const withoutToast = extractRenderedText(renderer.toJSON());
    expect(withoutToast).not.toContain('Device security preferences saved.');
  });

  test('opens QR camera inline on Dashboard and ScannerScreen only after Scan QR is tapped, and preserves pause state', async () => {
    const { deps } = createTestAppDependencies();
    const renderer = await mountApp(<App dependencies={deps} requireAuth={false} />);

    // Dashboard starts idle (camera closed) until Scan QR is tapped
    expect(renderer.root.findAll((node) => node.props.testID === 'qr-camera-preview')).toHaveLength(
      0,
    );

    const dashboardScanCta = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Scan QR',
    )[0];
    expect(dashboardScanCta).toBeDefined();

    await ReactTestRenderer.act(async () => {
      dashboardScanCta.props.onPress();
    });

    // Opens inline on Dashboard rather than redirecting to ScannerScreen
    const inlineActiveText = extractRenderedText(renderer.toJSON());
    expect(inlineActiveText).toContain('Needs your action');
    expect(inlineActiveText).not.toContain('Track Code');
    expect(inlineActiveText).not.toContain('Recent Scans');
    expect(inlineActiveText).toContain('Pause Scan');
    expect(renderer.root.findAll((node) => node.props.testID === 'qr-camera-preview').length).toBeGreaterThan(0);

    // Pause Scan on Dashboard closes camera cleanly and switches back to Scan QR
    const dashboardPauseBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Pause Scan',
    )[0];
    await ReactTestRenderer.act(async () => {
      dashboardPauseBtn.props.onPress();
    });

    const inlinePausedText = extractRenderedText(renderer.toJSON());
    expect(inlinePausedText).toContain('Scanner paused');
    expect(inlinePausedText).toContain('Scan QR');
    expect(renderer.root.findAll((node) => node.props.testID === 'qr-camera-preview')).toHaveLength(
      0,
    );

    // Switch explicitly to Scan tab via BottomNav
    const scanNavTab = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' && node.props.accessibilityLabel === 'Scan',
    )[0];
    await ReactTestRenderer.act(async () => {
      scanNavTab.props.onPress();
    });

    const scannerText = extractRenderedText(renderer.toJSON());
    expect(scannerText).toContain('QR Scanner');
    expect(scannerText).toContain('Scan to receive');
    expect(scannerText).toContain(
      'Point at a Tracely Web Unlock QR, routing slip QR, or attach code.',
    );
    expect(scannerText).toContain('Align the QR inside the frame');
    expect(scannerText).toContain('Scan QR');
    expect(scannerText).toContain('Recent Scans');
    expect(scannerText).toContain('Track Office Docs');
    expect(scannerText).not.toContain('Camera unavailable?');
    expect(scannerText).not.toContain('Supported SDO Opaque QR Tokens');
    // ScannerScreen starts with camera closed until Scan QR is tapped
    expect(renderer.root.findAll((node) => node.props.testID === 'qr-camera-preview')).toHaveLength(
      0,
    );

    const scannerStartBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Scan QR',
    )[0];
    expect(scannerStartBtn).toBeDefined();
    await ReactTestRenderer.act(async () => {
      scannerStartBtn.props.onPress();
    });

    expect(extractRenderedText(renderer.toJSON())).toContain('Pause Scan');
    expect(renderer.root.findAll((node) => node.props.testID === 'qr-camera-preview').length).toBeGreaterThan(0);

    // Pausing on ScannerScreen stops camera immediately and stays paused across tab switches
    const scannerPauseBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Pause Scan',
    )[0];
    await ReactTestRenderer.act(async () => {
      scannerPauseBtn.props.onPress();
    });

    expect(extractRenderedText(renderer.toJSON())).toContain('Scanner paused');
    expect(renderer.root.findAll((node) => node.props.testID === 'qr-camera-preview')).toHaveLength(
      0,
    );

    const trackTab = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        node.props.accessibilityLabel === 'Track',
    )[0];
    await ReactTestRenderer.act(async () => {
      trackTab.props.onPress();
    });
    const scanTabReturn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' && node.props.accessibilityLabel === 'Scan',
    )[0];
    await ReactTestRenderer.act(async () => {
      scanTabReturn.props.onPress();
    });

    expect(extractRenderedText(renderer.toJSON())).toContain('Scanner paused');
    expect(renderer.root.findAll((node) => node.props.testID === 'qr-camera-preview')).toHaveLength(
      0,
    );

    const torchBtn = renderer.root.find(
      (node) => node.props.accessibilityLabel === 'Toggle flashlight',
    );
    await ReactTestRenderer.act(async () => {
      torchBtn.props.onPress();
    });

    const enterCodeBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Enter code',
    )[0];

    await ReactTestRenderer.act(async () => {
      enterCodeBtn.props.onPress();
    });

    const modalText = extractRenderedText(renderer.toJSON());
    expect(modalText).toContain('Enter QR Token');
    expect(modalText).toContain('Verify & Resolve');
  });

  test('replaces top notification button with Sidebar drawer accessing all screens', async () => {
    const { deps } = createTestAppDependencies();
    const renderer = await mountApp(<App dependencies={deps} requireAuth={false} />);

    // Notification bell is replaced cleanly at top by sidebar trigger
    const oldBellBtns = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Open notifications',
    );
    expect(oldBellBtns).toHaveLength(0);

    const menuBtn = renderer.root.find(
      (node) => node.props.accessibilityLabel === 'Open navigation sidebar',
    );
    await ReactTestRenderer.act(async () => {
      menuBtn.props.onPress();
    });

    const drawerText = extractRenderedText(renderer.toJSON());
    expect(drawerText).toContain('WORKSPACE');
    expect(drawerText).toContain('Inbox');
    expect(drawerText).toContain('QR Scanner');
    expect(drawerText).toContain('Send Document');
    expect(drawerText).toContain('Document Detail');
    expect(drawerText).toContain('Categories');
    expect(drawerText).toContain('Alerts & Sync');
    expect(drawerText).toContain('Profile');
    expect(drawerText).toContain('Sign Out');
    expect(drawerText).not.toContain('Sign In');

    // Navigate directly from sidebar to Document Detail empty state
    const docDetailNav = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Document Detail'),
    );
    expect(docDetailNav.length).toBeGreaterThan(0);

    await ReactTestRenderer.act(async () => {
      docDetailNav[docDetailNav.length - 1].props.onPress();
    });

    const docDetailText = extractRenderedText(renderer.toJSON());
    expect(docDetailText).toContain('No Document Selected');

    // Navigate via sidebar Sign Out -> redirects to Login / Registration screen
    const detailMenuBtn = renderer.root.find(
      (node) => node.props.accessibilityLabel === 'Open navigation sidebar',
    );
    await ReactTestRenderer.act(async () => {
      detailMenuBtn.props.onPress();
    });

    const signOutNav = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Sign Out',
    );
    await ReactTestRenderer.act(async () => {
      await signOutNav[signOutNav.length - 1].props.onPress();
    });

    const loginText = extractRenderedText(renderer.toJSON());
    expect(loginText).toContain('Tracely');
    expect(loginText).toContain('Employee ID or Work Email');
    expect(loginText).toContain('Create Account');
    expect(loginText).toContain('Back to Workspace');
    expect(
      renderer.root.findAll((node) => node.props.accessibilityLabel === 'Tracely app icon')
        .length,
    ).toBeGreaterThan(0);

    // Switch cleanly to Registration tab
    const registerTab = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Create Account',
    );
    await ReactTestRenderer.act(async () => {
      registerTab[registerTab.length - 1].props.onPress();
    });

    const registerText = extractRenderedText(renderer.toJSON());
    expect(registerText).toContain('Work Email');
    expect(registerText).toContain('Office / Unit');
    expect(registerText).toContain('Other / Custom');
    expect(registerText).toContain('0/50');
    expect(registerText).toContain('0/16');
    expect(registerText).toContain('0/64');
    expect(registerText).toContain('0/32');
    expect(registerText).toContain('Submit Registration');
    // Password validation chips stay hidden until the user starts typing a password
    expect(registerText).not.toContain('Upper & lower');

    const regPasswordInput = renderer.root.find(
      (node) => node.props.placeholder === 'At least 8 characters',
    );
    await ReactTestRenderer.act(async () => {
      regPasswordInput.props.onChangeText('Sdo#2026');
    });

    const typingPasswordText = extractRenderedText(renderer.toJSON());
    expect(typingPasswordText).toContain('8–32 chars');
    expect(typingPasswordText).toContain('Upper & lower');
    expect(typingPasswordText).toContain('8/32');

    const placeholders = renderer.root
      .findAll((node) => typeof node.props.placeholder === 'string')
      .map((node) => node.props.placeholder as string);
    expect(placeholders).toContain('e.g. Juan Dela Crus');
    expect(placeholders).toContain('e.g. EMP-2026-0142');
    expect(placeholders).toContain('e.g. name@tracely.app');
    expect(placeholders).toContain('e.g. Administrative Officer IV');

    // Selecting unlisted Office / Unit reveals Custom Office Code & Name inputs
    const customOfficeBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Other / Custom',
    );
    await ReactTestRenderer.act(async () => {
      customOfficeBtn[customOfficeBtn.length - 1].props.onPress();
    });

    const customOfficeText = extractRenderedText(renderer.toJSON());
    expect(customOfficeText).toContain('Custom Office / Unit Code');
    expect(customOfficeText).toContain('Custom Office / Unit Name');
    expect(customOfficeText).toContain('0/12');

    // Return to workspace via Back to Workspace
    const backBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Back to Workspace'),
    );
    await ReactTestRenderer.act(async () => {
      backBtn[backBtn.length - 1].props.onPress();
    });

    const workspaceText = extractRenderedText(renderer.toJSON());
    expect(workspaceText).toContain('Scan to receive');
  });

  test('presents immersive app-icon OnboardingScreen on first launch and transitions to auth/workspace', async () => {
    const { deps } = createTestAppDependencies({ skipOnboarding: false });
    const renderer = await mountApp(<App dependencies={deps} />);

    const step1Text = extractRenderedText(renderer.toJSON());
    expect(step1Text).toContain('TRACELY');
    expect(step1Text).toContain('Every Document. Every Desk.');
    expect(step1Text).not.toContain('DepEd SDO Oriental Mindoro');
    expect(step1Text).not.toContain('Tap icon to replay animation');
    expect(step1Text).toContain('Continue');
    expect(step1Text).toContain('Skip');

    const replayIconBtn = renderer.root.find(
      (node) => node.props.accessibilityLabel === 'Tracely app icon',
    );
    await ReactTestRenderer.act(async () => {
      replayIconBtn.props.onPress();
    });

    const continueBtn1 = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Continue',
    );
    await ReactTestRenderer.act(async () => {
      continueBtn1[continueBtn1.length - 1].props.onPress();
    });

    const step2Text = extractRenderedText(renderer.toJSON());
    expect(step2Text).toContain('Scan to Receive. Sync Offline.');

    const continueBtn2 = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Continue',
    );
    await ReactTestRenderer.act(async () => {
      continueBtn2[continueBtn2.length - 1].props.onPress();
    });

    const step3Text = extractRenderedText(renderer.toJSON());
    expect(step3Text).toContain('Security Built Into Every Step.');
    expect(step3Text).toContain('Get Started');
    expect(step3Text).toContain('Sign In or Create Account');
    expect(step3Text).not.toContain('Skip');

    const authEntryBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Sign In or Create Account',
    );
    await ReactTestRenderer.act(async () => {
      await authEntryBtn[authEntryBtn.length - 1].props.onPress();
    });

    const authText = extractRenderedText(renderer.toJSON());
    expect(authText).toContain('Employee ID or Work Email');
    expect(authText).toContain('Intro');

    // Subsequent launch persists onboarding completion and opens workspace directly when deferred
    const { deps: nextLaunchDeps } = createTestAppDependencies({ skipOnboarding: false });
    const nextRenderer = await mountApp(<App dependencies={nextLaunchDeps} requireAuth={false} />);
    const nextText = extractRenderedText(nextRenderer.toJSON());
    expect(nextText).toContain('Scan to receive');
    expect(nextText).not.toContain('Every Document. Every Desk.');
  });

  test('places highlighted Send tab in center of BottomNav without Inbox Hard Copy badge and generates QR slips from SendScreen', async () => {
    const { deps } = createTestAppDependencies({ authenticatedUserId: 'usr-budget-1' });
    const renderer = await mountApp(<App dependencies={deps} requireAuth />);

    // Inbox Needs your action section must not display Hard Copy badge or intake button
    const oldHardCopyBtn = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Log hard-copy document',
    );
    expect(oldHardCopyBtn).toHaveLength(0);
    const inboxText = extractRenderedText(renderer.toJSON());
    expect(inboxText).not.toContain('Hard Copy');

    // Bottom navigation puts Send Document cleanly at the center (index 2 of 5 tabs)
    const navTabs = renderer.root
      .findAll(
        (node) =>
          typeof node.props.onPress === 'function' &&
          node.props.accessibilityRole === 'button' &&
          typeof node.props.accessibilityLabel === 'string' &&
          ['Inbox', 'Scan', 'Send Document', 'Track', 'Alerts'].includes(
            node.props.accessibilityLabel as string,
          ),
      )
      .map((node) => node.props.accessibilityLabel as string);
    expect(navTabs).toEqual(['Inbox', 'Scan', 'Send Document', 'Track', 'Alerts']);
    expect(inboxText).toContain('Track');
    expect(inboxText).toContain('Alerts');
    expect(inboxText).toContain('Send');

    // Tap the centered Send button to open SendScreen
    const sendTabBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        node.props.accessibilityLabel === 'Send Document',
    )[0];
    await ReactTestRenderer.act(async () => {
      sendTabBtn.props.onPress();
    });

    const softViewText = extractRenderedText(renderer.toJSON());
    expect(softViewText).toContain('Send Document');
    expect(softViewText).toContain('Soft Copy');
    expect(softViewText).toContain('Hard Copy');
    expect(softViewText).toContain('Select PDF or Image');

    // Switch to Hard Copy option cleanly inside SendScreen
    const hardCopyOption = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Hard Copy',
    )[0];
    await ReactTestRenderer.act(async () => {
      hardCopyOption.props.onPress();
    });

    const hardViewText = extractRenderedText(renderer.toJSON());
    expect(hardViewText).toContain('Folder / Slip Note');
    expect(hardViewText).toContain('Generate QR Slip');

    // Expand progressive-disclosure options (Category · Confidentiality)
    const optionsToggleBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Change'),
    )[0];
    await ReactTestRenderer.act(async () => {
      optionsToggleBtn.props.onPress();
    });

    const expandedOptionsText = extractRenderedText(renderer.toJSON());
    expect(expandedOptionsText).toContain('Confidentiality');
    expect(expandedOptionsText).toContain('Restricted');

    const titleInput = renderer.root.find(
      (node) => node.props.placeholder === 'e.g. Budget Utilization Request — Q4 Supplies',
    );
    const refInput = renderer.root.find(
      (node) => node.props.placeholder === 'e.g. Brown folder · Slip #14',
    );
    const pagesInput = renderer.root.find((node) => node.props.placeholder === 'e.g. 6');

    await ReactTestRenderer.act(async () => {
      titleInput.props.onChangeText('Wet-Signed Payroll Transmittal Batch');
      refInput.props.onChangeText('Green Folder #7');
      pagesInput.props.onChangeText('14');
    });

    const submitBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Generate QR Slip',
    );
    await ReactTestRenderer.act(async () => {
      await submitBtn[submitBtn.length - 1].props.onPress();
    });

    const qrModalText = extractRenderedText(renderer.toJSON());
    expect(qrModalText).toContain('Routing Slip QR');
    expect(qrModalText).toContain('TRACKING CODE');
    expect(qrModalText).toContain('SDO-OM-2026-000');

    const doneQrBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' && extractInstanceText(node).trim() === 'Done',
    );
    await ReactTestRenderer.act(async () => {
      doneQrBtn[doneQrBtn.length - 1].props.onPress();
    });

    const openRecordBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Open Record',
    );
    await ReactTestRenderer.act(async () => {
      openRecordBtn[openRecordBtn.length - 1].props.onPress();
    });

    const detailText = extractRenderedText(renderer.toJSON());
    expect(detailText).toContain('Physical Hard Copy · Zero Digital File');
    expect(detailText).toContain('Green Folder #7 · 14 pg(s)');
    expect(detailText).toContain('Files (0)');
    expect(detailText).toContain('QR Routing Slip');
    expect(detailText).toContain('Attach Scan v1');
  });

  test('supports batch QR scanning, persists recent scans across restarts, and gates protected files with Device Lock', async () => {
    await AsyncStorage.removeItem('@sdo_doctrack/recent_scans');
    await AsyncStorage.removeItem('@sdo_doctrack/security_prefs');

    const { deps } = createTestAppDependencies({ authenticatedUserId: 'usr-budget-1' });
    const renderer = await mountApp(<App dependencies={deps} requireAuth />);

    // Inbox displays SLA risk banner for at-risk incoming document
    expect(extractRenderedText(renderer.toJSON())).toContain('1 due soon');
    expect(extractRenderedText(renderer.toJSON())).toContain('Review SLA');

    // Switch to Scan tab and enable Batch scan mode
    const scanTab = renderer.root.find(
      (node) => node.props.accessibilityLabel === 'Scan' && typeof node.props.onPress === 'function',
    );
    await ReactTestRenderer.act(async () => {
      scanTab.props.onPress();
    });

    const batchBtn = renderer.root.find(
      (node) =>
        node.props.accessibilityLabel === 'Toggle batch scan mode' &&
        typeof node.props.onPress === 'function',
    );
    await ReactTestRenderer.act(async () => {
      batchBtn.props.onPress();
    });

    const enterCodeBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Enter code',
    )[0];
    await ReactTestRenderer.act(async () => {
      enterCodeBtn.props.onPress();
    });

    const tokenInput = renderer.root.find(
      (node) => typeof node.props.placeholder === 'string' && node.props.placeholder.includes('TRC-QR:DOC:'),
    );
    await ReactTestRenderer.act(async () => {
      tokenInput.props.onChangeText('SDO-QR:DOC:9f4a8b12c7e04a3d91f2a77c8d04142a');
    });

    const verifyBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Verify & Resolve',
    );
    await ReactTestRenderer.act(async () => {
      await verifyBtn[verifyBtn.length - 1].props.onPress();
    });

    const batchText = extractRenderedText(renderer.toJSON());
    expect(batchText).toContain('Batch Queue (1)');
    expect(batchText).toContain('Confirm All Receipt (1)');
    expect(batchText).toContain('SDO-OM-2026-000142');

    const confirmAllBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Confirm All Receipt'),
    );
    await ReactTestRenderer.act(async () => {
      await confirmAllBtn[confirmAllBtn.length - 1].props.onPress();
    });

    expect(extractRenderedText(renderer.toJSON())).not.toContain('Batch Queue');

    // Remount app to verify Recent Scans persisted in AsyncStorage
    const { deps: nextDeps } = createTestAppDependencies({ authenticatedUserId: 'usr-budget-1' });
    const nextRenderer = await mountApp(<App dependencies={nextDeps} requireAuth />);
    const nextScanTab = nextRenderer.root.find(
      (node) => node.props.accessibilityLabel === 'Scan' && typeof node.props.onPress === 'function',
    );
    await ReactTestRenderer.act(async () => {
      nextScanTab.props.onPress();
    });
    expect(extractRenderedText(nextRenderer.toJSON())).toContain('SDO-OM-2026-000142');

    // Enable Device Lock on ProfileScreen and verify Screenshot Shield toggle exists
    const inboxNav = nextRenderer.root.find(
      (node) => node.props.accessibilityLabel === 'Inbox' && typeof node.props.onPress === 'function',
    );
    await ReactTestRenderer.act(async () => {
      inboxNav.props.onPress();
    });
    const profileBtn = nextRenderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Marco'),
    )[0];
    await ReactTestRenderer.act(async () => {
      profileBtn.props.onPress();
    });

    expect(extractRenderedText(nextRenderer.toJSON())).toContain('Screenshot Shield (FLAG_SECURE)');
    const switches = nextRenderer.root.findAll(
      (node) => typeof node.props.onValueChange === 'function',
    );
    expect(switches.length).toBeGreaterThanOrEqual(3);
    await ReactTestRenderer.act(async () => {
      switches[0].props.onValueChange(true);
    });

    // Open Restricted document (SDO-OM-2026-000115), inspect Share Slip & Device Lock gate
    const backBtn = nextRenderer.root.find(
      (node) =>
        node.props.accessibilityLabel === 'Back to inbox' &&
        typeof node.props.onPress === 'function',
    );
    await ReactTestRenderer.act(async () => {
      backBtn.props.onPress();
    });

    const restrictedCard = nextRenderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('SDO-OM-2026-000115'),
    )[0];
    await ReactTestRenderer.act(async () => {
      restrictedCard.props.onPress();
    });

    const qrBtn = nextRenderer.root.find(
      (node) =>
        node.props.accessibilityLabel === 'Show opaque QR code' &&
        typeof node.props.onPress === 'function',
    );
    await ReactTestRenderer.act(async () => {
      qrBtn.props.onPress();
    });
    expect(extractRenderedText(nextRenderer.toJSON())).toContain('Share Slip');

    const closeQrBtn = nextRenderer.root.find(
      (node) =>
        node.props.accessibilityLabel === 'Close QR modal' &&
        typeof node.props.onPress === 'function',
    );
    await ReactTestRenderer.act(async () => {
      closeQrBtn.props.onPress();
    });

    const filesTab = nextRenderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Files (1)'),
    )[0];
    await ReactTestRenderer.act(async () => {
      filesTab.props.onPress();
    });

    const view60sBtn = nextRenderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('60s View'),
    )[0];
    await ReactTestRenderer.act(async () => {
      await view60sBtn.props.onPress();
    });

    expect(extractRenderedText(nextRenderer.toJSON())).toContain('Device Lock Required');
    expect(extractRenderedText(nextRenderer.toJSON())).toContain('Verify Device Lock to View');

    await AsyncStorage.removeItem('@sdo_doctrack/recent_scans');
    await AsyncStorage.removeItem('@sdo_doctrack/security_prefs');
  });

  test('prevents non-scan Inbox bulk confirmation on sealed docs and routes to Batch Scan QR', async () => {
    const { deps, docRepo } = createTestAppDependencies({ authenticatedUserId: 'usr-budget-1' });
    const renderer = await mountApp(<App dependencies={deps} requireAuth />);

    const selectBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Select',
    )[0];
    await ReactTestRenderer.act(async () => {
      selectBtn.props.onPress();
    });

    const selectUnlockedBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Select Unlocked'),
    )[0];
    expect(selectUnlockedBtn).toBeDefined();
    await ReactTestRenderer.act(async () => {
      selectUnlockedBtn.props.onPress();
    });

    const renderedText = extractRenderedText(renderer.toJSON()).replace(/\s+/g, ' ');
    expect(renderedText).not.toContain('Confirm (');
    expect(renderedText).toContain('Batch Scan QR');
    expect(docRepo.acknowledgedPayloads).toHaveLength(0);

    const batchScanBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Batch Scan QR'),
    )[0];
    expect(batchScanBtn).toBeDefined();
    await ReactTestRenderer.act(async () => {
      batchScanBtn.props.onPress();
    });

    expect(extractRenderedText(renderer.toJSON())).toContain('Sealed Incoming');
  });

  test('supports multi-file Soft Copy Bundle (1 QR) and Separate Docs Batch Send on SendScreen', async () => {
    const { deps } = createTestAppDependencies({ authenticatedUserId: 'usr-budget-1' });
    const renderer = await mountApp(<App dependencies={deps} requireAuth />);

    const sendTabBtn = renderer.root.find(
      (node) =>
        typeof node.props.onPress === 'function' &&
        node.props.accessibilityLabel === 'Send Document',
    );
    await ReactTestRenderer.act(async () => {
      sendTabBtn.props.onPress();
    });

    (pick as jest.Mock).mockResolvedValueOnce([
      {
        uri: 'file:///docs/memo_page1.pdf',
        name: 'memo_page1.pdf',
        type: 'application/pdf',
        size: 42000,
      },
      {
        uri: 'file:///docs/annex_receipt.jpg',
        name: 'annex_receipt.jpg',
        type: 'image/jpeg',
        size: 18500,
      },
    ]);

    const selectFilesBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Select PDF or Image'),
    )[0];
    await ReactTestRenderer.act(async () => {
      await selectFilesBtn.props.onPress();
    });

    const multiPickedText = extractRenderedText(renderer.toJSON());
    expect(multiPickedText).toContain('Files (2)');
    expect(multiPickedText).toContain('One Doc (2 files)');
    expect(multiPickedText).toContain('Separate (2 docs)');
    expect(multiPickedText).toContain('Upload Bundle (2)');

    const titleInput = renderer.root.find(
      (node) => node.props.placeholder === 'e.g. Budget Utilization Request — Q4 Supplies',
    );
    await ReactTestRenderer.act(async () => {
      titleInput.props.onChangeText('Q4 DRRM Bundled Submission');
    });

    const bundleSubmitBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Upload Bundle (2)'),
    );
    await ReactTestRenderer.act(async () => {
      await bundleSubmitBtn[bundleSubmitBtn.length - 1].props.onPress();
    });

    expect(extractRenderedText(renderer.toJSON())).toContain('Document QR');
    expect(extractRenderedText(renderer.toJSON())).toContain('Bundled 2 files into');
    const doneBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' && extractInstanceText(node).trim() === 'Done',
    );
    await ReactTestRenderer.act(async () => {
      doneBtn[doneBtn.length - 1].props.onPress();
    });

    const openRecordBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Open Record',
    );
    await ReactTestRenderer.act(async () => {
      openRecordBtn[openRecordBtn.length - 1].props.onPress();
    });

    const bundleDetailText = extractRenderedText(renderer.toJSON());
    expect(bundleDetailText).toContain('Files (2)');

    const filesTab = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Files (2)'),
    )[0];
    await ReactTestRenderer.act(async () => {
      filesTab.props.onPress();
    });
    const bundleFilesText = extractRenderedText(renderer.toJSON());
    expect(bundleFilesText).toContain('memo_page1.pdf');
    expect(bundleFilesText).toContain('annex_receipt.jpg');

    // Now test Separate Docs (Batch Send) back on SendScreen
    const backInboxBtn = renderer.root.find(
      (node) =>
        node.props.accessibilityLabel === 'Back to inbox' &&
        typeof node.props.onPress === 'function',
    );
    await ReactTestRenderer.act(async () => {
      backInboxBtn.props.onPress();
    });
    const sendTabBtn2 = renderer.root.find(
      (node) =>
        typeof node.props.onPress === 'function' &&
        node.props.accessibilityLabel === 'Send Document',
    );
    await ReactTestRenderer.act(async () => {
      sendTabBtn2.props.onPress();
    });

    (pick as jest.Mock).mockResolvedValueOnce([
      {
        uri: 'file:///docs/travel_1.pdf',
        name: 'travel_1.pdf',
        type: 'application/pdf',
        size: 12000,
      },
      {
        uri: 'file:///docs/travel_2.pdf',
        name: 'travel_2.pdf',
        type: 'application/pdf',
        size: 14000,
      },
    ]);

    const selectFilesBtn2 = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Select PDF or Image'),
    )[0];
    await ReactTestRenderer.act(async () => {
      await selectFilesBtn2.props.onPress();
    });

    const separateTab = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Separate (2 docs)'),
    )[0];
    await ReactTestRenderer.act(async () => {
      separateTab.props.onPress();
    });

    const titleInput2 = renderer.root.find(
      (node) => node.props.placeholder === 'Optional prefix for untitled files below',
    );
    await ReactTestRenderer.act(async () => {
      titleInput2.props.onChangeText('District Travel Batch');
    });

    const file1TitleInput = renderer.root.find(
      (node) => node.props.accessibilityLabel === 'Title for travel_1.pdf',
    );
    await ReactTestRenderer.act(async () => {
      file1TitleInput.props.onChangeText('Region IV-A Memo Copy');
    });

    const batchSubmitBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Batch Upload (2)'),
    );
    await ReactTestRenderer.act(async () => {
      await batchSubmitBtn[batchSubmitBtn.length - 1].props.onPress();
    });

    const batchIssuedText = extractRenderedText(renderer.toJSON());
    expect(batchIssuedText).toContain('Batch Issued (2)');
    expect(batchIssuedText).toContain('Region IV-A Memo Copy');
    expect(batchIssuedText).toContain('District Travel Batch — travel_2');
  });

  test('redirects pending incoming sealed QR taps to Scanner and requires QR verification before Forward', async () => {
    const { deps } = createTestAppDependencies({ authenticatedUserId: 'usr-budget-1' });
    const renderer = await mountApp(<App dependencies={deps} requireAuth />);

    // Sealed QR card displays Misrouted option and hides Forward before scanning
    const initialText = extractRenderedText(renderer.toJSON());
    expect(initialText).toContain('Misrouted');
    expect(initialText).not.toContain('Q4 School DRRM Minor Repair Funding Request');

    const sealedQrTrigger = renderer.root.findByProps({
      testID: 'mobile-sealed-qr-trigger-doc-142',
    });
    await ReactTestRenderer.act(async () => {
      sealedQrTrigger.props.onPress();
    });

    // Tapping the sealed QR card redirects straight to Scanner with target transfer banner
    expect(renderer.root.findAllByProps({ testID: 'mobile-scanner-target-banner' }).length).toBeGreaterThan(0);

    // Resolving the code via Scanner shows Confirm Receipt (and never Forward until acknowledged)
    const enterCodeBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Enter code',
    )[0];
    await ReactTestRenderer.act(async () => {
      enterCodeBtn.props.onPress();
    });

    const manualInput = renderer.root.find(
      (node) => typeof node.props.placeholder === 'string' && node.props.placeholder.includes('TRC-QR:DOC:'),
    );
    await ReactTestRenderer.act(async () => {
      manualInput.props.onChangeText('SDO-OM-2026-000142');
    });

    const verifyBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Verify & Resolve',
    );
    await ReactTestRenderer.act(async () => {
      await verifyBtn[verifyBtn.length - 1].props.onPress();
    });

    const scanResultText = extractRenderedText(renderer.toJSON());
    expect(scanResultText).toContain('Confirm Receipt');
    expect(scanResultText).not.toContain('Forward');
  });

  test('shows AppBootSkeleton on initial first render while bootstrapping and hides it once a screen opens', async () => {
    const { deps } = createTestAppDependencies({ authenticatedUserId: 'usr-records-1' });
    let releaseBoot!: () => void;
    const bootGate = new Promise<void>((resolve) => {
      releaseBoot = resolve;
    });
    const origGetSession = deps.tokenStore.getSession.bind(deps.tokenStore);
    deps.tokenStore.getSession = async () => {
      await bootGate;
      return origGetSession();
    };

    const renderer = await mountApp(<App dependencies={deps} />);
    expect(renderer.root.findAllByProps({ testID: 'app-boot-skeleton' }).length).toBeGreaterThan(0);

    await ReactTestRenderer.act(async () => {
      releaseBoot();
    });

    expect(renderer.root.findAllByProps({ testID: 'app-boot-skeleton' })).toHaveLength(0);
    expect(extractRenderedText(renderer.toJSON())).toContain('Scan to receive');

    // Navigating across opened screens must never display boot skeleton again
    const scanTabBtn = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Scan' && typeof node.props.onPress === 'function',
    )[0];
    await ReactTestRenderer.act(async () => {
      scanTabBtn.props.onPress();
    });
    expect(renderer.root.findAllByProps({ testID: 'app-boot-skeleton' })).toHaveLength(0);

    const trackTabBtn = renderer.root.findAll(
      (node) =>
        node.props.accessibilityLabel === 'Track' && typeof node.props.onPress === 'function',
    )[0];
    await ReactTestRenderer.act(async () => {
      trackTabBtn.props.onPress();
    });
    expect(renderer.root.findAllByProps({ testID: 'app-boot-skeleton' })).toHaveLength(0);
  });

  test('renders a tailored skeleton once on each screen first open and never repeats on revisit', async () => {
    const { deps } = createTestAppDependencies({ authenticatedUserId: 'usr-records-1' });
    let releaseBoot!: () => void;
    const bootGate = new Promise<void>((resolve) => {
      releaseBoot = resolve;
    });
    const origGetSession = deps.tokenStore.getSession.bind(deps.tokenStore);
    deps.tokenStore.getSession = async () => {
      await bootGate;
      return origGetSession();
    };

    const renderer = await mountApp(<App dependencies={deps} firstVisitSkeletonMs={280} />);

    // Inbox displays app-boot-skeleton on first startup and reveals cleanly once ready
    expect(renderer.root.findAllByProps({ testID: 'app-boot-skeleton' }).length).toBeGreaterThan(0);
    await ReactTestRenderer.act(async () => {
      releaseBoot();
    });
    expect(renderer.root.findAllByProps({ testID: 'app-boot-skeleton' })).toHaveLength(0);
    expect(extractRenderedText(renderer.toJSON())).toContain('Scan to receive');
    expect(extractRenderedText(renderer.toJSON())).not.toContain('Track Code');

    // Bottom nav screens each render their skeleton once on first open
    const tabChecks = [
      { label: 'Scan', testID: 'screen-skeleton-scanner' },
      { label: 'Send Document', testID: 'screen-skeleton-send' },
      { label: 'Track', testID: 'screen-skeleton-track' },
      { label: 'Alerts', testID: 'screen-skeleton-alerts' },
    ];
    for (const check of tabChecks) {
      const btn = renderer.root.findAll(
        (node) =>
          node.props.accessibilityLabel === check.label && typeof node.props.onPress === 'function',
      )[0];
      await ReactTestRenderer.act(async () => {
        btn.props.onPress();
      });
      expect(renderer.root.findAllByProps({ testID: check.testID }).length).toBeGreaterThan(0);
      await ReactTestRenderer.act(async () => {
        await waitMs(340);
      });
      expect(renderer.root.findAllByProps({ testID: check.testID })).toHaveLength(0);
    }

    // Sidebar-only screens (Categories, Document Detail, Profile) also render their skeletons once
    const sidebarChecks = [
      { label: 'Categories', testID: 'screen-skeleton-categories' },
      { label: 'Document Detail', testID: 'screen-skeleton-document' },
      { label: 'Profile', testID: 'screen-skeleton-profile' },
    ];
    for (const check of sidebarChecks) {
      let menuBtns = renderer.root.findAll(
        (node) =>
          node.props.accessibilityLabel === 'Open navigation sidebar' &&
          typeof node.props.onPress === 'function',
      );
      if (menuBtns.length === 0) {
        const backBtn = renderer.root.findAll(
          (node) =>
            (node.props.accessibilityLabel === 'Inbox' ||
              node.props.accessibilityLabel === 'Back to inbox') &&
            typeof node.props.onPress === 'function',
        )[0];
        await ReactTestRenderer.act(async () => {
          backBtn.props.onPress();
        });
        menuBtns = renderer.root.findAll(
          (node) =>
            node.props.accessibilityLabel === 'Open navigation sidebar' &&
            typeof node.props.onPress === 'function',
        );
      }
      await ReactTestRenderer.act(async () => {
        menuBtns[0].props.onPress();
      });
      const drawerItem = renderer.root.findAll(
        (node) =>
          typeof node.props.onPress === 'function' &&
          extractInstanceText(node).includes(check.label),
      )[0];
      await ReactTestRenderer.act(async () => {
        drawerItem.props.onPress();
      });
      expect(renderer.root.findAllByProps({ testID: check.testID }).length).toBeGreaterThan(0);
      await ReactTestRenderer.act(async () => {
        await waitMs(340);
      });
      expect(renderer.root.findAllByProps({ testID: check.testID })).toHaveLength(0);
    }

    // Revisiting already-opened screens must never show skeletons again
    const inboxBtn = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Inbox' && typeof node.props.onPress === 'function',
    )[0];
    await ReactTestRenderer.act(async () => {
      inboxBtn.props.onPress();
    });
    expect(renderer.root.findAllByProps({ testID: 'app-boot-skeleton' })).toHaveLength(0);

    const trackRevisitBtn = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Track' && typeof node.props.onPress === 'function',
    )[0];
    await ReactTestRenderer.act(async () => {
      trackRevisitBtn.props.onPress();
    });
    expect(renderer.root.findAllByProps({ testID: 'screen-skeleton-track' })).toHaveLength(0);
  }, 30000);

  test('renders notification title, content, in-app badges, device sync counts, and mark-read updates', async () => {
    const { DeviceNotificationBridge } = require('../src/domain/security/DeviceNotificationBridge') as typeof import('../src/domain/security/DeviceNotificationBridge');
    const syncSpy = jest.spyOn(DeviceNotificationBridge, 'syncNotifications');

    const { deps, bundle } = createTestAppDependencies({ authenticatedUserId: 'usr-budget-1' });
    const renderer = await mountApp(<App dependencies={deps} />);

    // Sidebar menu button should NOT render a badge count; BottomNav Alerts badge reflects unread + pending offline alerts (1 + 1 = 2)
    expect(renderer.root.findAllByProps({ testID: 'inbox-alert-badge' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ testID: 'dashboard-alert-badge' })).toHaveLength(0);
    const sidebarTriggerBtn = renderer.root.findAll(
      (node) =>
        node.props.accessibilityLabel === 'Open navigation sidebar' &&
        typeof node.props.onPress === 'function',
    )[0];
    expect(sidebarTriggerBtn).toBeDefined();
    expect(extractInstanceText(sidebarTriggerBtn).trim()).toBe('');
    expect(
      extractInstanceText(renderer.root.findByProps({ testID: 'bottom-nav-alerts-badge' })),
    ).toBe('2');
    expect(syncSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'notif-1',
          title: 'Incoming Document · SDO-OM-2026-000142',
          content: 'Q4 School DRRM Minor Repair Funding Request routed from SGOD (SLA due soon).',
        }),
      ]),
      1,
      false,
    );

    const alertsTab = renderer.root.findAll(
      (node) => node.props.accessibilityLabel === 'Alerts' && typeof node.props.onPress === 'function',
    )[0];
    await ReactTestRenderer.act(async () => {
      alertsTab.props.onPress();
    });

    const alertsText = extractRenderedText(renderer.toJSON());
    expect(alertsText).toContain('Incoming Document · SDO-OM-2026-000142');
    expect(alertsText).toContain(
      'Q4 School DRRM Minor Repair Funding Request routed from SGOD (SLA due soon).',
    );
    expect(
      extractInstanceText(renderer.root.findByProps({ testID: 'alerts-header-badge' })),
    ).toBe('1');

    // Tapping notification marks it read and clears header unread badge
    const notifCard = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Incoming Document · SDO-OM-2026-000142'),
    )[0];
    await ReactTestRenderer.act(async () => {
      notifCard.props.onPress();
    });

    expect(bundle.notifications[0].read).toBe(true);
    expect(syncSpy).toHaveBeenLastCalledWith([], 0, false);
    syncSpy.mockRestore();
  });

  test('separates UserProfileScreen (Personal Info, Preferences, Settings) from ProfileScreen', async () => {
    const { deps, authRepo } = createTestAppDependencies({ authenticatedUserId: 'usr-budget-1' });
    const renderer = await mountApp(<App dependencies={deps} firstVisitSkeletonMs={0} />);

    // Open current Desk & Office ProfileScreen first
    const headerProfileBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Marco'),
    )[0];
    await ReactTestRenderer.act(async () => {
      headerProfileBtn.props.onPress();
    });

    expect(extractRenderedText(renderer.toJSON())).toContain('Profile & Security');

    // Tap "Edit Info, Preferences & Settings" -> navigates to dedicated UserProfileScreen
    const openUserProfileBtn = renderer.root.findByProps({
      testID: 'mobile-open-user-profile-btn',
    });
    await ReactTestRenderer.act(async () => {
      openUserProfileBtn.props.onPress();
    });

    expect(
      renderer.root.findAllByProps({ testID: 'mobile-user-profile-screen' }).length,
    ).toBeGreaterThan(0);

    // 1. Update Personal Info
    const tealSwatch = renderer.root.findByProps({ testID: 'mobile-avatar-color-Teal' });
    const fullNameInput = renderer.root.findByProps({ testID: 'mobile-profile-fullname-input' });
    const positionInput = renderer.root.findByProps({ testID: 'mobile-profile-position-input' });
    const contactInput = renderer.root.findByProps({ testID: 'mobile-profile-contact-input' });
    const deskNoteInput = renderer.root.findByProps({ testID: 'mobile-profile-desknote-input' });

    await ReactTestRenderer.act(async () => {
      tealSwatch.props.onPress();
      fullNameInput.props.onChangeText('Marco A. Villareal');
      positionInput.props.onChangeText('Supervising Budget Officer');
      contactInput.props.onChangeText('+63 917 555 0142');
      deskNoteInput.props.onChangeText('2nd Floor Finance Wing · Window 3');
    });

    const saveInfoBtn = renderer.root.findByProps({ testID: 'mobile-save-profile-info-btn' });
    await ReactTestRenderer.act(async () => {
      saveInfoBtn.props.onPress();
    });

    expect(authRepo.currentUser.fullName).toBe('Marco A. Villareal');
    expect(authRepo.currentUser.position).toBe('Supervising Budget Officer');
    expect(authRepo.currentUser.contactNumber).toBe('+63 917 555 0142');
    expect(authRepo.currentUser.deskNote).toBe('2nd Floor Finance Wing · Window 3');
    expect(authRepo.currentUser.avatarColor).toBe('#0F766E');

    // 2. Switch to Preferences tab and save workflow defaults
    const prefTabBtn = renderer.root.findByProps({
      testID: 'mobile-user-profile-tab-preferences',
    });
    await ReactTestRenderer.act(async () => {
      prefTabBtn.props.onPress();
    });

    const hardCopyPref = renderer.root.findByProps({ testID: 'mobile-pref-format-hard_copy' });
    const budgetRemarkPref = renderer.root.findByProps({
      testID: 'mobile-pref-remark-For Budget Certification',
    });
    await ReactTestRenderer.act(async () => {
      hardCopyPref.props.onPress();
      budgetRemarkPref.props.onPress();
    });

    const savePrefBtn = renderer.root.findByProps({ testID: 'mobile-save-preferences-btn' });
    await ReactTestRenderer.act(async () => {
      savePrefBtn.props.onPress();
    });

    expect(authRepo.currentUser.preferences.defaultCopyFormat).toBe('hard_copy');
    expect(authRepo.currentUser.preferences.defaultRemarks).toBe('For Budget Certification');

    // 3. Switch to Settings tab and verify account settings are accessible
    const settingsTabBtn = renderer.root.findByProps({
      testID: 'mobile-user-profile-tab-settings',
    });
    await ReactTestRenderer.act(async () => {
      settingsTabBtn.props.onPress();
    });

    const settingsText = extractRenderedText(renderer.toJSON());
    expect(settingsText).toContain('Account & Security Settings');
    expect(settingsText).toContain('Change Account Password');
  });

  test('gates pending incoming documents behind sealed QR redirect to Scanner until code verification unlocks them, and supports inline custom category creation in SendScreen', async () => {
    const { deps, docRepo } = createTestAppDependencies({ authenticatedUserId: 'usr-budget-1' });
    const renderer = await mountApp(<App dependencies={deps} requireAuth />);

    // 1. Pending incoming Soft Copy SDO-OM-2026-000142 renders as a sealed QR card with "Scan QR in Tracely Web"; tapping redirects to Scanner
    expect(renderer.root.findAllByProps({ testID: 'mobile-sealed-qr-card-doc-142' }).length).toBeGreaterThan(0);
    expect(extractRenderedText(renderer.toJSON())).toContain('Scan QR in Tracely Web');
    expect(extractRenderedText(renderer.toJSON())).not.toContain('60s View');

    const sealedTrigger = renderer.root.findByProps({
      testID: 'mobile-sealed-qr-trigger-doc-142',
    });
    await ReactTestRenderer.act(async () => {
      sealedTrigger.props.onPress();
    });

    expect(renderer.root.findAllByProps({ testID: 'mobile-scanner-target-banner' }).length).toBeGreaterThan(0);
    expect(
      renderer.root.findAllByProps({ testID: 'mobile-scanner-password-fallback-btn' }).length,
    ).toBeGreaterThan(0);

    // Unlock using manual tracking code entry in Scanner (case-insensitive SDO-OM-2026-000142)
    const enterCodeBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Enter code',
    )[0];
    await ReactTestRenderer.act(async () => {
      enterCodeBtn.props.onPress();
    });

    const manualInput = renderer.root.find(
      (node) => typeof node.props.placeholder === 'string' && node.props.placeholder.includes('TRC-QR:DOC:'),
    );
    await ReactTestRenderer.act(async () => {
      manualInput.props.onChangeText('sdo-om-2026-000142');
    });

    const verifyBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Verify & Resolve',
    );
    await ReactTestRenderer.act(async () => {
      await verifyBtn[verifyBtn.length - 1].props.onPress();
    });

    // Confirm Receipt sends the QR verificationCode to backend/repo
    const confirmBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).includes('Confirm Receipt & Unlock'),
    )[0];
    expect(confirmBtn).toBeDefined();
    await ReactTestRenderer.act(async () => {
      await confirmBtn.props.onPress();
    });

    expect(docRepo.acknowledgedPayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentId: 'doc-142',
          verificationCode: '9f4a8b12c7e04a3d91f2a77c8d04142a',
        }),
      ]),
    );

    // Confirming receipt automatically opens the unlocked DocumentDetailScreen with full details & 60s View
    expect(renderer.root.findAllByProps({ testID: 'mobile-qr-lock-gate' })).toHaveLength(0);
    expect(extractRenderedText(renderer.toJSON())).toContain(
      'Q4 School DRRM Minor Repair Funding Request',
    );
    const filesTab = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' && extractInstanceText(node).includes('Files ('),
    )[0];
    await ReactTestRenderer.act(async () => {
      filesTab.props.onPress();
    });
    expect(extractRenderedText(renderer.toJSON())).toContain('60s View');

    // 2. Navigate to SendScreen and create a custom category inline
    const backBtn = renderer.root.find(
      (node) => node.props.accessibilityLabel === 'Back to inbox' && typeof node.props.onPress === 'function',
    );
    await ReactTestRenderer.act(async () => {
      backBtn.props.onPress();
    });

    const sendTabBtn = renderer.root.find(
      (node) =>
        typeof node.props.onPress === 'function' &&
        node.props.accessibilityLabel === 'Send Document',
    );
    await ReactTestRenderer.act(async () => {
      sendTabBtn.props.onPress();
    });

    const changeOptsBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' && extractInstanceText(node).includes('Change'),
    )[0];
    await ReactTestRenderer.act(async () => {
      changeOptsBtn.props.onPress();
    });

    const addCustomBtn = renderer.root.findByProps({
      testID: 'mobile-send-add-custom-category-btn',
    });
    await ReactTestRenderer.act(async () => {
      addCustomBtn.props.onPress();
    });

    const catNameInput = renderer.root.findByProps({ testID: 'mobile-send-custom-cat-name' });
    const catCodeInput = renderer.root.findByProps({ testID: 'mobile-send-custom-cat-code' });
    await ReactTestRenderer.act(async () => {
      catNameInput.props.onChangeText('Division Sports Endorsement');
      catCodeInput.props.onChangeText('SPORTS-END');
    });

    const saveCatBtn = renderer.root.findByProps({ testID: 'mobile-send-save-custom-cat-btn' });
    await ReactTestRenderer.act(async () => {
      await saveCatBtn.props.onPress();
    });

    const catsAfter = await docRepo.listCategories();
    expect(catsAfter.some((c) => c.name === 'Division Sports Endorsement' && c.code === 'SPORTS-END')).toBe(
      true,
    );
    expect(extractRenderedText(renderer.toJSON())).toContain('Division Sports Endorsement');
  });

  test('moves completed documents out of InboxScreen into CompletedScreen accessible from SidebarDrawer', async () => {
    const { deps, docRepo } = createTestAppDependencies({ authenticatedUserId: 'usr-budget-1' });
    await docRepo.completeDocument('doc-115', 'approved', 'Approved & signed by Unit Head');

    const renderer = await mountApp(<App dependencies={deps} requireAuth />);

    // Completed doc-115 is removed from active InboxScreen
    const inboxText = extractRenderedText(renderer.toJSON());
    expect(inboxText).not.toContain('SDO-OM-2026-000115');

    // Open SidebarDrawer and navigate to Completed
    const menuBtn = renderer.root.find(
      (node) =>
        node.props.accessibilityLabel === 'Open navigation sidebar' &&
        typeof node.props.onPress === 'function',
    );
    await ReactTestRenderer.act(async () => {
      menuBtn.props.onPress();
    });

    const completedNav = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Completed',
    )[0];
    expect(completedNav).toBeDefined();
    await ReactTestRenderer.act(async () => {
      completedNav.props.onPress();
    });

    const completedScreenText = extractRenderedText(renderer.toJSON());
    expect(completedScreenText).toContain('SDO-OM-2026-000115');
    expect(completedScreenText).toContain('Approved & Released');
  });

  test('unlocks Soft Copy via 6-char Tracely Web code and via Mobile Password Fallback', async () => {
    // Part A: 6-char Tracely Web Unlock Code auto-unlocks & opens the document immediately
    const first = createTestAppDependencies({ authenticatedUserId: 'usr-budget-1' });
    first.docRepo.seedUnlockChallenge({
      documentId: 'doc-142',
      userId: 'usr-budget-1',
      token: 'webunlocktoken123456',
      shortCode: 'K7P-492',
    });
    const rendererA = await mountApp(<App dependencies={first.deps} requireAuth />);

    const sealedTriggerA = rendererA.root.findByProps({
      testID: 'mobile-sealed-qr-trigger-doc-142',
    });
    await ReactTestRenderer.act(async () => {
      sealedTriggerA.props.onPress();
    });

    const enterCodeBtn = rendererA.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Enter code',
    )[0];
    await ReactTestRenderer.act(async () => {
      enterCodeBtn.props.onPress();
    });

    const codeInput = rendererA.root.find(
      (node) => typeof node.props.placeholder === 'string' && node.props.placeholder.includes('TRC-QR:DOC:'),
    );
    await ReactTestRenderer.act(async () => {
      codeInput.props.onChangeText('k7p-492');
    });

    const verifyBtns = rendererA.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Verify & Resolve',
    );
    await ReactTestRenderer.act(async () => {
      await verifyBtns[verifyBtns.length - 1].props.onPress();
    });

    // Immediately auto-opens unlocked document without an extra Confirm step
    expect(rendererA.root.findAllByProps({ testID: 'mobile-qr-lock-gate' })).toHaveLength(0);
    expect(extractRenderedText(rendererA.toJSON())).toContain(
      'Q4 School DRRM Minor Repair Funding Request',
    );

    // Part B: Mobile Password Fallback ("No desktop nearby? Unlock with Password")
    const second = createTestAppDependencies({ authenticatedUserId: 'usr-budget-1' });
    const rendererB = await mountApp(<App dependencies={second.deps} requireAuth />);

    const sealedTriggerB = rendererB.root.findByProps({
      testID: 'mobile-sealed-qr-trigger-doc-142',
    });
    await ReactTestRenderer.act(async () => {
      sealedTriggerB.props.onPress();
    });

    const pwFallbackBtn = rendererB.root.findByProps({
      testID: 'mobile-scanner-password-fallback-btn',
    });
    await ReactTestRenderer.act(async () => {
      pwFallbackBtn.props.onPress();
    });

    const pwInput = rendererB.root.findByProps({ testID: 'mobile-password-unlock-input' });
    const pwSubmit = rendererB.root.findByProps({ testID: 'mobile-password-unlock-submit' });

    // Wrong password displays inline error and keeps document locked
    await ReactTestRenderer.act(async () => {
      pwInput.props.onChangeText('WrongPassword!');
    });
    await ReactTestRenderer.act(async () => {
      await pwSubmit.props.onPress();
    });
    expect(
      rendererB.root.findAllByProps({ testID: 'mobile-password-unlock-error' }).length,
    ).toBeGreaterThan(0);

    // Correct password confirms receipt (logged in Track) and opens unlocked document
    await ReactTestRenderer.act(async () => {
      pwInput.props.onChangeText('Tracely#2026');
    });
    await ReactTestRenderer.act(async () => {
      await pwSubmit.props.onPress();
    });

    expect(second.docRepo.acknowledgedPayloads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentId: 'doc-142',
          password: 'Tracely#2026',
        }),
      ]),
    );
    expect(rendererB.root.findAllByProps({ testID: 'mobile-qr-lock-gate' })).toHaveLength(0);
    expect(extractRenderedText(rendererB.toJSON())).toContain(
      'Q4 School DRRM Minor Repair Funding Request',
    );
  });

  test('renders Mobile Dashboard screen with Minimalist Routing Flow Map and High-Scale Folder Organizer', async () => {
    const { deps } = createTestAppDependencies({ authenticatedUserId: 'usr-records-1' });
    const renderer = await mountApp(<App dependencies={deps} firstVisitSkeletonMs={0} />);

    // Open Sidebar Drawer and select Dashboard
    const openMenuBtn = renderer.root.findAll(
      (node) =>
        node.props.accessibilityLabel === 'Open navigation sidebar' &&
        typeof node.props.onPress === 'function',
    )[0];
    await ReactTestRenderer.act(async () => {
      openMenuBtn.props.onPress();
    });

    const dashboardDrawerBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Dashboard',
    )[0];
    await ReactTestRenderer.act(async () => {
      dashboardDrawerBtn.props.onPress();
    });

    expect(
      renderer.root.findAllByProps({ testID: 'mobile-dashboard-screen' }).length,
    ).toBeGreaterThan(0);
    expect(
      renderer.root.findAllByProps({ testID: 'mobile-dashboard-wallet-card' }).length,
    ).toBeGreaterThan(0);
    const walletFlipBtn = renderer.root.findByProps({
      testID: 'mobile-dashboard-wallet-card-flip-btn',
    });
    const walletMaskBtn = renderer.root.findByProps({
      testID: 'mobile-dashboard-wallet-card-mask-btn',
    });
    await ReactTestRenderer.act(async () => {
      walletFlipBtn.props.onPress();
      walletMaskBtn.props.onPress();
    });
    expect(
      renderer.root.findAllByProps({ testID: 'mobile-routing-flow-analytics' }).length,
    ).toBeGreaterThan(0);
    expect(
      renderer.root.findAllByProps({ testID: 'mobile-routing-flow-inspector' }).length,
    ).toBeGreaterThan(0);

    // Switch flow scope between My Sent (per-user) and My Office (per-office), never All Offices
    const scopeUserBtn = renderer.root.findByProps({ testID: 'mobile-flow-scope-user' });
    const scopeOfficeBtn = renderer.root.findByProps({ testID: 'mobile-flow-scope-office' });
    await ReactTestRenderer.act(async () => {
      scopeUserBtn.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      scopeOfficeBtn.props.onPress();
    });

    // High-Scale Interactive Folder Organizer + Searchable Paginated Folder Ledger
    expect(
      renderer.root.findAllByProps({ testID: 'mobile-folder-organizer' }).length,
    ).toBeGreaterThan(0);
    expect(
      renderer.root.findAllByProps({ testID: 'mobile-organizer-folder-stage-incoming' }).length,
    ).toBeGreaterThan(0);

    const openLedgerBtn = renderer.root.findByProps({
      testID: 'mobile-open-folder-ledger-stage-incoming',
    });
    await ReactTestRenderer.act(async () => {
      openLedgerBtn.props.onPress();
    });

    expect(
      renderer.root.findAllByProps({ testID: 'mobile-folder-ledger' }).length,
    ).toBeGreaterThan(0);
    expect(
      renderer.root.findAllByProps({ testID: 'mobile-folder-ledger-pagination' }).length,
    ).toBeGreaterThan(0);

    const ledgerSearch = renderer.root.findByProps({ testID: 'mobile-folder-ledger-search' });
    await ReactTestRenderer.act(async () => {
      ledgerSearch.props.onChangeText('SDO-OM-2026');
    });

    const groupCategoryBtn = renderer.root.findByProps({
      testID: 'mobile-folder-group-category',
    });
    const groupStageBtn = renderer.root.findByProps({ testID: 'mobile-folder-group-stage' });
    await ReactTestRenderer.act(async () => {
      groupCategoryBtn.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      groupStageBtn.props.onPress();
    });
  });

  test('runs Dashboard as main screen with Sidebar drawer, flippable Lanyard, interactive Folders, and clean Lanyard-only Profile', async () => {
    const { deps } = createTestAppDependencies({ authenticatedUserId: 'usr-budget-1' });
    const renderer = await mountApp(
      <App dependencies={{ ...deps, initialTab: 'dashboard' }} firstVisitSkeletonMs={0} />,
    );

    // 1. Dashboard mounts directly as main screen with Sidebar menu trigger and no redundant lanyard caption
    expect(
      renderer.root.findAllByProps({ testID: 'mobile-dashboard-screen' }).length,
    ).toBeGreaterThan(0);
    expect(extractRenderedText(renderer.toJSON())).not.toContain(
      'Drag lanyard to swing · Tap card to flip',
    );
    const dashboardSidebarBtn = renderer.root.findByProps({
      testID: 'mobile-dashboard-sidebar-btn',
    });
    expect(dashboardSidebarBtn.props.accessibilityLabel).toBe('Open navigation sidebar');
    expect(renderer.root.findAllByProps({ testID: 'dashboard-alert-badge' })).toHaveLength(0);
    expect(extractInstanceText(dashboardSidebarBtn).trim()).toBe('');

    // 2. Interactive Mobile Lanyard flips between front & back face
    const backFaceBefore = renderer.root.findByProps({
      testID: 'mobile-dashboard-wallet-card-back-face',
    });
    expect(backFaceBefore.props.pointerEvents).toBe('none');

    const flipBtn = renderer.root.findByProps({
      testID: 'mobile-dashboard-wallet-card-flip-btn',
    });
    await ReactTestRenderer.act(async () => {
      flipBtn.props.onPress();
    });
    const backFaceAfter = renderer.root.findByProps({
      testID: 'mobile-dashboard-wallet-card-back-face',
    });
    expect(backFaceAfter.props.pointerEvents).toBe('auto');
    expect(extractInstanceText(backFaceAfter)).toContain('TRACELY VERIFIED CUSTODY PASS');

    // 3. Interactive Mobile Folder opens Web-parity stage, displays fanned sheets, and zooms on sheet press
    const folderToggle = renderer.root.findByProps({
      testID: 'mobile-folder-widget-stage-incoming-toggle',
    });
    await ReactTestRenderer.act(async () => {
      folderToggle.props.onPress();
    });
    const firstSheet = renderer.root.findByProps({
      testID: 'mobile-folder-widget-stage-incoming-sheet-0',
    });
    await ReactTestRenderer.act(async () => {
      firstSheet.props.onPress();
    });
    expect(
      renderer.root.findAllByProps({
        testID: 'mobile-folder-widget-stage-incoming-zoomed-card',
      }).length,
    ).toBeGreaterThan(0);
    const closeStageBtn = renderer.root.findByProps({
      testID: 'mobile-folder-widget-stage-incoming-close-stage',
    });
    await ReactTestRenderer.act(async () => {
      closeStageBtn.props.onPress();
    });

    // 4. Sidebar opens cleanly directly from Dashboard and navigates to Profile & User Profile
    await ReactTestRenderer.act(async () => {
      dashboardSidebarBtn.props.onPress();
    });
    const profileDrawerBtn = renderer.root.findAll(
      (node) =>
        typeof node.props.onPress === 'function' &&
        extractInstanceText(node).trim() === 'Profile',
    )[0];
    await ReactTestRenderer.act(async () => {
      profileDrawerBtn.props.onPress();
    });

    // Profile renders the interactive Lanyard wallet pass and clean action row without legacy hero card
    expect(
      renderer.root.findAllByProps({ testID: 'mobile-profile-wallet-card' }).length,
    ).toBeGreaterThan(0);
    const openUserProfileBtn = renderer.root.findByProps({
      testID: 'mobile-open-user-profile-btn',
    });
    expect(extractRenderedText(renderer.toJSON())).toContain('HR-LOCKED IDENTITY');

    // 5. User Profile locks email read-only, removes HR-Assigned card, and applies theme color to Dashboard
    await ReactTestRenderer.act(async () => {
      openUserProfileBtn.props.onPress();
    });
    const emailInput = renderer.root.findByProps({ testID: 'mobile-profile-email-input' });
    expect(emailInput.props.editable).toBe(false);
    expect(extractRenderedText(renderer.toJSON())).not.toContain('HR-Assigned Plantilla Record');

    const tealSwatch = renderer.root.findByProps({ testID: 'mobile-avatar-color-Teal' });
    const saveBtn = renderer.root.findByProps({ testID: 'mobile-save-profile-info-btn' });
    await ReactTestRenderer.act(async () => {
      tealSwatch.props.onPress();
    });
    await ReactTestRenderer.act(async () => {
      saveBtn.props.onPress();
    });

    // 6. Navigate back through history cleanly: UserProfile -> Profile -> Dashboard (main screen!)
    const backToProfileBtn = renderer.root.findByProps({
      accessibilityLabel: 'Back to Desk Profile',
    });
    await ReactTestRenderer.act(async () => {
      backToProfileBtn.props.onPress();
    });
    const backFromProfileBtn = renderer.root.findByProps({
      accessibilityLabel: 'Back to inbox',
    });
    await ReactTestRenderer.act(async () => {
      backFromProfileBtn.props.onPress();
    });

    // Returned directly to Dashboard (previous screen in history), with saved Teal (#0F766E)
    expect(
      renderer.root.findAllByProps({ testID: 'mobile-dashboard-screen' }).length,
    ).toBeGreaterThan(0);
    const dashAvatar = renderer.root.findByProps({ testID: 'mobile-dashboard-avatar' });
    expect(JSON.stringify(dashAvatar.props.style)).toContain('#0F766E');

    // Open Settings & System Information screen from Dashboard Sidebar
    const dashSidebarBtn2 = renderer.root.findByProps({
      testID: 'mobile-dashboard-sidebar-btn',
    });
    await ReactTestRenderer.act(async () => {
      dashSidebarBtn2.props.onPress();
    });
    const settingsDrawerBtn = renderer.root.findByProps({ testID: 'sidebar-settings-item' });
    await ReactTestRenderer.act(async () => {
      settingsDrawerBtn.props.onPress();
    });

    expect(
      renderer.root.findAllByProps({ testID: 'mobile-settings-screen' }).length,
    ).toBeGreaterThan(0);
    const devText = extractInstanceText(
      renderer.root.findByProps({ testID: 'mobile-system-developer' }),
    );
    expect(devText).toContain('Andrei Obligar');
    const settingsFullText = extractRenderedText(renderer.toJSON());
    expect(settingsFullText).not.toMatch(/DepEd|SDO|Sanctum|Bearer|http:\/\/|https:\/\//i);

    // Tapping Back from Settings returns cleanly to Dashboard instead of exiting
    const backFromSettingsBtn = renderer.root.findByProps({
      accessibilityLabel: 'Back to dashboard',
    });
    await ReactTestRenderer.act(async () => {
      backFromSettingsBtn.props.onPress();
    });
    expect(
      renderer.root.findAllByProps({ testID: 'mobile-dashboard-screen' }).length,
    ).toBeGreaterThan(0);
  });

  test('routes Android BackHandler gesture through previous screens back to Dashboard before exiting', async () => {
    const handlers: Array<() => boolean> = [];
    const backSpy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_eventName, handler) => {
        handlers.push(handler as () => boolean);
        return { remove: jest.fn() };
      });

    try {
      const { deps } = createTestAppDependencies({ authenticatedUserId: 'usr-records-1' });
      const renderer = await mountApp(
        <App dependencies={{ ...deps, initialTab: 'dashboard' }} firstVisitSkeletonMs={0} />,
      );

      const pressHardwareBack = async (): Promise<boolean> => {
        const latest = handlers[handlers.length - 1];
        let handled = false;
        await ReactTestRenderer.act(async () => {
          handled = Boolean(latest?.());
        });
        return handled;
      };

      // Dashboard -> Sidebar -> Profile -> UserProfile
      const dashSidebarBtn = renderer.root.findByProps({
        testID: 'mobile-dashboard-sidebar-btn',
      });
      await ReactTestRenderer.act(async () => {
        dashSidebarBtn.props.onPress();
      });
      const profileDrawerBtn = renderer.root.findAll(
        (node) =>
          typeof node.props.onPress === 'function' &&
          extractInstanceText(node).trim() === 'Profile',
      )[0];
      await ReactTestRenderer.act(async () => {
        profileDrawerBtn.props.onPress();
      });
      const openUserProfileBtn = renderer.root.findByProps({
        testID: 'mobile-open-user-profile-btn',
      });
      await ReactTestRenderer.act(async () => {
        openUserProfileBtn.props.onPress();
      });
      expect(
        renderer.root.findAllByProps({ testID: 'mobile-user-profile-screen' }).length,
      ).toBeGreaterThan(0);

      // 1st Back gesture: UserProfile -> Profile (consumed, does NOT exit)
      expect(await pressHardwareBack()).toBe(true);
      expect(
        renderer.root.findAllByProps({ testID: 'mobile-profile-wallet-card' }).length,
      ).toBeGreaterThan(0);

      // 2nd Back gesture: Profile -> Dashboard (consumed, does NOT exit)
      expect(await pressHardwareBack()).toBe(true);
      expect(
        renderer.root.findAllByProps({ testID: 'mobile-dashboard-screen' }).length,
      ).toBeGreaterThan(0);

      // 3rd Back gesture on root Dashboard: returns false so Android exits only from main screen
      expect(await pressHardwareBack()).toBe(false);
    } finally {
      backSpy.mockRestore();
    }
  });
});
