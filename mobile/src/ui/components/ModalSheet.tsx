import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';

interface ModalSheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export const ModalSheet: React.FC<ModalSheetProps> = ({
  open,
  title,
  subtitle,
  onClose,
  children,
}) => {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={open}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        style={styles.backdrop}
      >
        <Pressable style={styles.scrim} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 12, 16) }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close modal"
            style={styles.closeBtn}
          >
            <X size={18} color={SDO_COLORS.textSecondary} />
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
        >
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  scrim: {
    flex: 1,
  },
  sheet: {
    backgroundColor: SDO_COLORS.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    paddingBottom: 14,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 6,
  },
  headerText: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 18,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  subtitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    lineHeight: 17,
    color: SDO_COLORS.textSecondary,
    marginTop: 3,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SDO_COLORS.surfaceSoft,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
});
