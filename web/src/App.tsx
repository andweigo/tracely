import React, { Suspense, lazy, useEffect, useState } from 'react';
import { WebBackendGateway } from './domain/qrPolicy';
import { Personnel, WebRoute } from './domain/types';
import { WebShell } from './layout/WebShell';
import { BatchUsbReceiveModal } from './components/BatchUsbReceiveModal';
import { ForcePasswordChangeModal } from './components/ForcePasswordChangeModal';
import { HardCopyReceiveModal } from './components/HardCopyReceiveModal';
import { SoftCopyUnlockModal } from './components/SoftCopyUnlockModal';
import { WebBootSkeleton } from './components/WebBootSkeleton';
import { CategoriesPage } from './pages/CategoriesPage';
import { CompletedPage } from './pages/CompletedPage';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentDetailPage } from './pages/DocumentDetailPage';
import { InboxPage } from './pages/InboxPage';
import { LoginPage } from './pages/LoginPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { PendingApprovalPage } from './pages/PendingApprovalPage';
import { ProfilePage } from './pages/ProfilePage';
import { SendPage } from './pages/SendPage';
import { SentPage } from './pages/SentPage';
import { SettingsPage } from './pages/SettingsPage';
import { TrackPage } from './pages/TrackPage';
import { UserProfilePage } from './pages/UserProfilePage';
import { useWebApp, WebAppProvider } from './state/WebAppContext';

const AnalyticsPage = lazy(() =>
  import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const PublicVerifyPage = lazy(() =>
  import('./pages/PublicVerifyPage').then((m) => ({ default: m.PublicVerifyPage })),
);

const WebRouteSwitch: React.FC = () => {
  const {
    route,
    actor,
    requireAuth,
    pendingRegistration,
    bootstrapping,
    firstVisitSkeletonMs,
    hasScreenBeenOpened,
    markScreenOpened,
  } = useWebApp();

  const [, setRevealTick] = useState(0);

  const activeScreenKey: WebRoute =
    route === 'verify'
      ? 'verify'
      : !actor && (route === 'pending_approval' || (requireAuth && Boolean(pendingRegistration) && route !== 'login'))
        ? 'pending_approval'
        : (requireAuth && !actor) || route === 'login'
          ? 'login'
          : route;

  useEffect(() => {
    if (bootstrapping) {
      markScreenOpened(activeScreenKey);
    }
  }, [bootstrapping, activeScreenKey, markScreenOpened]);

  const isWaitingFirstOpen =
    !bootstrapping &&
    firstVisitSkeletonMs > 0 &&
    !hasScreenBeenOpened(activeScreenKey);

  useEffect(() => {
    if (bootstrapping) return;
    if (hasScreenBeenOpened(activeScreenKey)) return;

    if (firstVisitSkeletonMs <= 0) {
      markScreenOpened(activeScreenKey);
      return;
    }

    const timer = setTimeout(() => {
      markScreenOpened(activeScreenKey);
      setRevealTick((tick) => tick + 1);
    }, firstVisitSkeletonMs);

    return () => clearTimeout(timer);
  }, [
    bootstrapping,
    activeScreenKey,
    firstVisitSkeletonMs,
    hasScreenBeenOpened,
    markScreenOpened,
  ]);

  if (activeScreenKey === 'verify') {
    return (
      <Suspense fallback={<WebBootSkeleton variant="login" />}>
        <PublicVerifyPage />
      </Suspense>
    );
  }

  if (bootstrapping) {
    const bootSkeleton = (
      <WebBootSkeleton variant={activeScreenKey} data-testid="web-boot-skeleton" />
    );
    return activeScreenKey === 'login' || activeScreenKey === 'pending_approval'
      ? bootSkeleton
      : <WebShell>{bootSkeleton}</WebShell>;
  }

  if (isWaitingFirstOpen) {
    const skeleton = (
      <WebBootSkeleton
        variant={activeScreenKey}
        data-testid={
          activeScreenKey === 'inbox'
            ? 'web-boot-skeleton'
            : `web-skeleton-${activeScreenKey}`
        }
      />
    );
    return activeScreenKey === 'login' || activeScreenKey === 'pending_approval'
      ? skeleton
      : <WebShell>{skeleton}</WebShell>;
  }

  if (activeScreenKey === 'pending_approval') {
    return <PendingApprovalPage />;
  }

  if (activeScreenKey === 'login') {
    return <LoginPage />;
  }

  let view: React.ReactNode;
  switch (activeScreenKey) {
    case 'dashboard':
      view = <DashboardPage />;
      break;
    case 'inbox':
      view = <InboxPage />;
      break;
    case 'send':
      view = <SendPage />;
      break;
    case 'sent':
      view = <SentPage />;
      break;
    case 'completed':
      view = <CompletedPage />;
      break;
    case 'document':
      view = <DocumentDetailPage />;
      break;
    case 'track':
      view = <TrackPage />;
      break;
    case 'analytics':
      view = (
        <Suspense fallback={<WebBootSkeleton variant="track" />}>
          <AnalyticsPage />
        </Suspense>
      );
      break;
    case 'categories':
      view = <CategoriesPage />;
      break;
    case 'alerts':
      view = <NotificationsPage />;
      break;
    case 'profile':
      view = <ProfilePage />;
      break;
    case 'user_profile':
      view = <UserProfilePage />;
      break;
    case 'settings':
      view = <SettingsPage />;
      break;
  }

  return (
    <WebShell>
      {view}
      <SoftCopyUnlockModal />
      <HardCopyReceiveModal />
      <BatchUsbReceiveModal />
      <ForcePasswordChangeModal />
    </WebShell>
  );
};

export function App({
  gateway,
  initialActor,
  requireAuth,
  firstVisitSkeletonMs,
}: {
  gateway?: WebBackendGateway;
  initialActor?: Personnel | null;
  requireAuth?: boolean;
  firstVisitSkeletonMs?: number;
}): React.JSX.Element {
  return (
    <WebAppProvider
      gateway={gateway}
      initialActor={initialActor}
      requireAuth={requireAuth}
      firstVisitSkeletonMs={firstVisitSkeletonMs}
    >
      <WebRouteSwitch />
    </WebAppProvider>
  );
}

export default App;
