import React, { useEffect, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Download, X } from 'lucide-react-native';
import { useAppServices } from '../../state/AppServiceContext';
import { CustomToast } from '../components/CustomToast';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';
import { BottomNav } from './BottomNav';
import { SidebarDrawer } from './SidebarDrawer';

export const MobileShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    bootstrapping,
    actor,
    requireAuth,
    showOnboarding,
    availableUpdate,
    dismissAvailableUpdate,
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
    activeTab !== 'login' &&
    activeTab !== 'pending_approval';

  return (
    <SafeAreaView
      style={showOnboarding ? styles.onboardingRoot : styles.safeRoot}
      edges={showOnboarding ? [] : ['top', 'bottom']}
    >
      <StatusBar barStyle={showOnboarding ? 'light-content' : 'dark-content'} />

      {!showOnboarding && !bootstrapping && availableUpdate ? (
        <View style={styles.updateBanner} testID="mobile-update-banner">
          <View style={styles.updateCopy}>
            <Text style={styles.updateTitle}>
              {`Tracely v${availableUpdate.version} available`}
            </Text>
            {availableUpdate.notes ? (
              <Text style={styles.updateNotes} numberOfLines={1}>
                {availableUpdate.notes}
              </Text>
            ) : null}
          </View>
          <Pressable
            onPress={() => {
              void Linking.openURL(availableUpdate.downloadUrl);
            }}
            style={styles.updateBtn}
            accessibilityRole="button"
            accessibilityLabel={`Download Tracely version ${availableUpdate.version}`}
          >
            <Download size={13} color="#06142E" />
            <Text style={styles.updateBtnText}>Update</Text>
          </Pressable>
          <Pressable
            onPress={dismissAvailableUpdate}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Dismiss update notice"
            style={styles.updateClose}
          >
            <X size={15} color="#CBD5E1" />
          </Pressable>
        </View>
      ) : null}

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
  updateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SDO_COLORS.navy,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  updateCopy: {
    flex: 1,
    minWidth: 0,
  },
  updateTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  updateNotes: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: '#CBD5E1',
    marginTop: 1,
  },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SDO_COLORS.amber,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  updateBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '800',
    color: '#06142E',
  },
  updateClose: {
    padding: 4,
  },
});
