import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertTriangle, PlusCircle } from 'lucide-react-native';
import { useAppServices } from '../../state/AppServiceContext';
import { ModalSheet } from '../components/ModalSheet';
import { SDO_COLORS } from '../theme/tokens';

interface CategoryDeclareSheetProps {
  open: boolean;
  onClose: () => void;
}

export const CategoryDeclareSheet: React.FC<CategoryDeclareSheetProps> = ({ open, onClose }) => {
  const { actor, findSimilarCategories, declareCategory, isBusy } = useAppServices();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const similar = useMemo(() => findSimilarCategories(name), [findSimilarCategories, name]);

  const handleSubmit = async () => {
    if (!name.trim() || isBusy) return;
    try {
      await declareCategory(name, code);
      setName('');
      setCode('');
      onClose();
    } catch {
      // Error surfaced via AppServiceContext toast
    }
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="Declare Shared Category"
      subtitle={`Declared by ${actor?.office.code ?? 'HQ'} · Globally selectable once saved`}
    >
      <View style={styles.block}>
        <Text style={styles.label}>Document Category Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="e.g., Request for School Electricity Subsidy"
          placeholderTextColor={SDO_COLORS.textMuted}
          style={styles.input}
        />
      </View>

      {similar.length > 0 ? (
        <View style={styles.warnCard}>
          <View style={styles.warnHeader}>
            <AlertTriangle size={16} color={SDO_COLORS.amberText} />
            <Text style={styles.warnTitle}>Similar Categories Already Exist</Text>
          </View>
          {similar.map((cat) => (
            <View key={cat.id} style={styles.warnRow}>
              <Text style={styles.warnName}>{cat.name}</Text>
              <Text style={styles.warnCode}>
                {cat.code} ({cat.declaredByOfficeCode})
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.block}>
        <Text style={styles.label}>Short Code (Optional)</Text>
        <TextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          placeholder="e.g., ELEC-SUB"
          placeholderTextColor={SDO_COLORS.textMuted}
          style={[styles.input, styles.monoInput]}
        />
      </View>

      <Pressable
        disabled={isBusy || !name.trim()}
        onPress={handleSubmit}
        style={[styles.submitBtn, (isBusy || !name.trim()) && styles.disabled]}
      >
        <PlusCircle size={18} color={SDO_COLORS.navyInk} />
        <Text style={styles.submitText}>
          {isBusy ? 'Saving Category...' : 'Save Global Category'}
        </Text>
      </Pressable>
    </ModalSheet>
  );
};

const styles = StyleSheet.create({
  block: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  input: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 16,
    fontSize: 14,
    color: SDO_COLORS.textPrimary,
  },
  monoInput: {
    fontFamily: 'monospace',
  },
  warnCard: {
    borderRadius: 16,
    backgroundColor: SDO_COLORS.amberSoft,
    padding: 12,
    gap: 6,
  },
  warnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warnTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.amberText,
  },
  warnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  warnName: {
    flex: 1,
    fontSize: 12,
    color: SDO_COLORS.amberText,
  },
  warnCode: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: SDO_COLORS.amberText,
  },
  submitBtn: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
  },
  disabled: {
    opacity: 0.45,
  },
  submitText: {
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
});
