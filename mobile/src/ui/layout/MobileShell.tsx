import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppServices } from '../../state/AppServiceContext';
import { CustomToast } from '../components/CustomToast';
import { SDO_COLORS } from '../theme/tokens';
import { BottomNav } from './BottomNav';
import { SidebarDrawer } from './SidebarDrawer';

export const MobileShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    bootstrapping,
    actor,
    requireAuth,
    showOnboarding,
    activeTab,
    selectedDocumentId,
    toast,
    clearToast,
    goBack,
  } = useAppServices();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (bootstrapping || showOnboarding) {
        return false;
      }
      if (requireAuth && !actor) {
        return false;
      }
      return goBack();
    });
    return () => sub.remove();
  }, [bootstrapping, showOnboarding, requireAuth, actor, goBack]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const durationMs = toast.action ? 30000 : 4000;
    const id = setTimeout(clearToast, durationMs);
    return () => clearTimeout(id);
  }, [toast, clearToast]);

  const showBottomNav =
    !keyboardVisible &&
    !bootstrapping &&
    !showOnboarding &&
    (Boolean(actor) || !requireAuth) &&
    !selectedDocumentId &&
    activeTab !== 'document' &&
    activeTab !== 'login';

  return (
    <SafeAreaView
      style={showOnboarding ? styles.onboardingRoot : styles.safeRoot}
      edges={showOnboarding ? [] : ['top', 'bottom']}
    >
      <StatusBar barStyle={showOnboarding ? 'light-content' : 'dark-content'} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={showOnboarding ? styles.onboardingContent : styles.content}
      >
        {children}
        <CustomToast toast={toast} onDismiss={clearToast} />
      </KeyboardAvoidingView>

      {showBottomNav ? <BottomNav /> : null}
      <SidebarDrawer />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeRoot: {
    flex: 1,
    backgroundColor: SDO_COLORS.bg,
  },
  onboardingRoot: {
    flex: 1,
    backgroundColor: SDO_COLORS.navy,
  },
  content: {
    flex: 1,
    position: 'relative',
    backgroundColor: SDO_COLORS.bg,
  },
  onboardingContent: {
    flex: 1,
    position: 'relative',
    backgroundColor: SDO_COLORS.navy,
  },
});
