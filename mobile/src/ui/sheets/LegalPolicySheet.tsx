import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FileText, ShieldCheck, X } from 'lucide-react-native';
import {
  LegalDocumentType,
  PRIVACY_POLICY,
  TERMS_AND_CONDITIONS,
} from '../../domain/legal/LegalPolicies';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';

interface LegalPolicySheetProps {
  readonly open: boolean;
  readonly initialTab?: LegalDocumentType;
  readonly onClose: () => void;
}

export const LegalPolicySheet: React.FC<LegalPolicySheetProps> = ({
  open,
  initialTab = 'terms',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LegalDocumentType>(initialTab);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [open, initialTab]);

  const doc = activeTab === 'terms' ? TERMS_AND_CONDITIONS : PRIVACY_POLICY;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close legal sheet" />
        <View style={styles.sheet} testID="mobile-legal-policy-sheet">
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              {activeTab === 'terms' ? (
                <FileText size={16} color={SDO_COLORS.navy} />
              ) : (
                <ShieldCheck size={16} color={SDO_COLORS.emeraldText} />
              )}
              <Text style={styles.title}>{doc.title}</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close policy viewer"
              style={styles.closeBtn}
            >
              <X size={18} color={SDO_COLORS.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.tabs}>
            <Pressable
              onPress={() => setActiveTab('terms')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'terms' }}
              style={[styles.tabBtn, activeTab === 'terms' && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, activeTab === 'terms' && styles.tabTextActive]}>
                Terms &amp; Conditions
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setActiveTab('privacy')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'privacy' }}
              style={[styles.tabBtn, activeTab === 'privacy' && styles.tabBtnActive]}
            >
              <Text style={[styles.tabText, activeTab === 'privacy' && styles.tabTextActive]}>
                Privacy Policy
              </Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.effective}>{doc.effectiveDate}</Text>
            <Text style={styles.intro}>{doc.intro}</Text>

            {doc.sections.map((section) => (
              <View key={section.heading} style={styles.section}>
                <Text style={styles.sectionHeading}>{section.heading}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={styles.doneBtn}
          >
            <Text style={styles.doneBtnText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(13, 27, 62, 0.45)',
  },
  scrim: {
    flex: 1,
  },
  sheet: {
    maxHeight: '84%',
    backgroundColor: SDO_COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 22,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 16,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: SDO_COLORS.surfaceSoft,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  tabBtnActive: {
    backgroundColor: SDO_COLORS.surface,
  },
  tabText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  tabTextActive: {
    color: SDO_COLORS.navy,
  },
  body: {
    gap: 12,
    paddingBottom: 8,
  },
  effective: {
    fontFamily: SDO_FONTS.mono,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textMuted,
  },
  intro: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    lineHeight: 19,
    color: SDO_COLORS.textSecondary,
  },
  section: {
    borderRadius: 14,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 13,
    gap: 5,
  },
  sectionHeading: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  sectionBody: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    lineHeight: 18,
    color: SDO_COLORS.textSecondary,
  },
  doneBtn: {
    minHeight: 46,
    borderRadius: 13,
    backgroundColor: SDO_COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
