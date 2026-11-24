import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  AppDependencies,
  AppServiceProvider,
  useAppServices,
} from './src/state/AppServiceContext';
import { AppBootSkeleton, ScreenSkeletonVariant } from './src/ui/components/AppBootSkeleton';
import { MobileShell } from './src/ui/layout/MobileShell';
import { CategoriesScreen } from './src/ui/screens/CategoriesScreen';
import { CompletedScreen } from './src/ui/screens/CompletedScreen';
import { DashboardScreen } from './src/ui/screens/DashboardScreen';
import { DocumentDetailScreen } from './src/ui/screens/DocumentDetailScreen';
import { InboxScreen } from './src/ui/screens/InboxScreen';
import { LoginScreen } from './src/ui/screens/LoginScreen';
import { NotificationsScreen } from './src/ui/screens/NotificationsScreen';
import { OnboardingScreen } from './src/ui/screens/OnboardingScreen';
import { PendingApprovalScreen } from './src/ui/screens/PendingApprovalScreen';
import { ProfileScreen } from './src/ui/screens/ProfileScreen';
import { ScannerScreen } from './src/ui/screens/ScannerScreen';
import { SendScreen } from './src/ui/screens/SendScreen';
import { SentScreen } from './src/ui/screens/SentScreen';
import { SettingsScreen } from './src/ui/screens/SettingsScreen';
import { TrackScreen } from './src/ui/screens/TrackScreen';
import { UserProfileScreen } from './src/ui/screens/UserProfileScreen';

const MobileRouteView: React.FC = () => {
  const {
    bootstrapping,
    showOnboarding,
    requireAuth,
    actor,
    pendingRegistration,
    activeTab,
    selectedDocumentId,
    documents,
    firstVisitSkeletonMs,
    hasScreenBeenOpened,
    markScreenOpened,
  } = useAppServices();

  const [, setRevealTick] = useState(0);

  const showPendingApproval =
    !actor &&
    (activeTab === 'pending_approval' ||
      (requireAuth && Boolean(pendingRegistration) && activeTab !== 'login'));

  const screenKey: ScreenSkeletonVariant = selectedDocumentId
    ? 'document'
    : showPendingApproval
      ? 'pending_approval'
      : (requireAuth && !actor) || activeTab === 'login'
        ? 'login'
        : activeTab;

  useEffect(() => {
    if (bootstrapping && !showOnboarding) {
      markScreenOpened(screenKey);
      markScreenOpened(activeTab);
    }
  }, [bootstrapping, showOnboarding, screenKey, activeTab, markScreenOpened]);

  const isWaitingFirstOpen =
    !bootstrapping &&
    !showOnboarding &&
    firstVisitSkeletonMs > 0 &&
    !hasScreenBeenOpened(screenKey);

  useEffect(() => {
    if (bootstrapping || showOnboarding) return;
    if (hasScreenBeenOpened(screenKey)) return;

    if (firstVisitSkeletonMs <= 0) {
      markScreenOpened(screenKey);
      return;
    }

    const timer = setTimeout(() => {
      markScreenOpened(screenKey);
      setRevealTick((tick) => tick + 1);
    }, firstVisitSkeletonMs);

    return () => clearTimeout(timer);
  }, [
    bootstrapping,
    showOnboarding,
    screenKey,
    firstVisitSkeletonMs,
    hasScreenBeenOpened,
    markScreenOpened,
  ]);

  if (bootstrapping) {
    return <AppBootSkeleton variant={screenKey} testID="app-boot-skeleton" />;
  }

  if (showOnboarding) {
    return <OnboardingScreen />;
  }

  if (isWaitingFirstOpen) {
    return (
      <AppBootSkeleton
        variant={screenKey}
        testID={screenKey === 'inbox' ? 'app-boot-skeleton' : `screen-skeleton-${screenKey}`}
      />
    );
  }

  if (showPendingApproval) {
    return <PendingApprovalScreen />;
  }

  if (requireAuth && !actor) {
    return <LoginScreen />;
  }

  if (!selectedDocumentId && activeTab === 'login') {
    return <LoginScreen />;
  }

  if (!selectedDocumentId && activeTab === 'pending_approval') {
    return <PendingApprovalScreen />;
  }

  if (selectedDocumentId) {
    return <DocumentDetailScreen documentId={selectedDocumentId} />;
  }

  switch (activeTab) {
    case 'dashboard':
      return <DashboardScreen />;
    case 'inbox':
      return <InboxScreen />;
    case 'scanner':
      return <ScannerScreen />;
    case 'send':
      return <SendScreen />;
    case 'sent':
      return <SentScreen />;
    case 'completed':
      return <CompletedScreen />;
    case 'document':
      return <DocumentDetailScreen documentId={documents[0]?.id ?? ''} />;
    case 'track':
      return <TrackScreen />;
    case 'categories':
      return <CategoriesScreen />;
    case 'alerts':
      return <NotificationsScreen />;
    case 'profile':
      return <ProfileScreen />;
    case 'user_profile':
      return <UserProfileScreen />;
    case 'settings':
      return <SettingsScreen />;
  }
};

export function App({
  dependencies,
  requireAuth,
  firstVisitSkeletonMs,
}: {
  dependencies?: AppDependencies;
  requireAuth?: boolean;
  firstVisitSkeletonMs?: number;
}): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <AppServiceProvider
        dependencies={dependencies}
        requireAuth={requireAuth}
        firstVisitSkeletonMs={firstVisitSkeletonMs}
      >
        <MobileShell>
          <MobileRouteView />
        </MobileShell>
      </AppServiceProvider>
    </SafeAreaProvider>
  );
}

export default App;
