import React, { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowLeft, FolderKanban, Plus, Search, ShieldCheck } from 'lucide-react-native';
import { useAppServices } from '../../state/AppServiceContext';
import { EmptyState } from '../components/EmptyState';
import { CategoryDeclareSheet } from '../sheets/CategoryDeclareSheet';
import { SDO_COLORS } from '../theme/tokens';

export const CategoriesScreen: React.FC = () => {
  const { actor, categories, goBack, refreshWorkspace, isRefreshing } = useAppServices();
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'mine' | 'popular'>('all');
  const [showDeclare, setShowDeclare] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories.filter((cat) => {
      if (scopeFilter === 'mine' && actor && cat.declaredByOfficeCode !== actor.office.code) {
        return false;
      }
      if (scopeFilter === 'popular' && cat.usageCount < 25) {
        return false;
      }
      if (!q) return true;
      return (
        cat.name.toLowerCase().includes(q) ||
        cat.code.toLowerCase().includes(q) ||
        cat.declaredByOfficeCode.toLowerCase().includes(q)
      );
    });
  }, [actor, categories, search, scopeFilter]);

  return (
    <View style={styles.screen}>
      <View style={styles.topHeader}>
        <Pressable
          onPress={() => goBack()}
          accessibilityLabel="Back to inbox"
          style={styles.circleBtn}
        >
          <ArrowLeft size={18} color={SDO_COLORS.navyInk} />
        </Pressable>
        <Text style={styles.headerTitle}>Shared Categories</Text>
        <Pressable
          onPress={() => setShowDeclare(true)}
          accessibilityLabel="Declare new category"
          style={styles.amberCircleBtn}
        >
          <Plus size={19} color={SDO_COLORS.navyInk} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshWorkspace} />
        }
      >
        <View style={styles.searchBox}>
          <Search size={17} color={SDO_COLORS.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search shared document types"
            placeholderTextColor={SDO_COLORS.textMuted}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.pillRow}>
          {(
            [
              { id: 'all', label: `All (${categories.length})` },
              { id: 'mine', label: `By ${actor?.office.code ?? 'Unit'}` },
              { id: 'popular', label: 'Most Used' },
            ] as const
          ).map((item) => {
            const active = scopeFilter === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setScopeFilter(item.id)}
                style={[styles.pillTab, active && styles.pillTabActive]}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<FolderKanban size={24} color={SDO_COLORS.textMuted} />}
            title="No matching categories"
            description="Declare a category once to make it globally selectable across all offices."
            action={
              <Pressable onPress={() => setShowDeclare(true)} style={styles.amberPill}>
                <Text style={styles.amberPillText}>Declare Category</Text>
              </Pressable>
            }
          />
        ) : (
          <View style={styles.listGap}>
            {filtered.map((cat) => (
              <View key={cat.id} style={styles.catCard}>
                <View style={styles.catTop}>
                  <Text style={styles.codeMono}>{cat.code}</Text>
                  <View style={styles.mintPill}>
                    <ShieldCheck size={12} color={SDO_COLORS.emeraldText} />
                    <Text style={styles.mintText}>Global</Text>
                  </View>
                </View>
                <Text style={styles.catName}>{cat.name}</Text>
                <Text style={styles.catMeta}>
                  Declared by {cat.declaredByOfficeName} ({cat.declaredByOfficeCode}) ·{' '}
                  {cat.usageCount} docs
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <CategoryDeclareSheet open={showDeclare} onClose={() => setShowDeclare(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SDO_COLORS.bg,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amberCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SDO_COLORS.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  container: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 14,
  },
  searchBox: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: SDO_COLORS.textPrimary,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pillTab: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillTabActive: {
    backgroundColor: SDO_COLORS.navyInk,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  amberPill: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amberPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  listGap: {
    gap: 10,
  },
  catCard: {
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 16,
    gap: 6,
  },
  catTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  codeMono: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: SDO_COLORS.navy,
  },
  mintPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.emeraldSoft,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  mintText: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.emeraldText,
  },
  catName: {
    fontSize: 15,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  catMeta: {
    fontSize: 12,
    color: SDO_COLORS.textSecondary,
  },
});
