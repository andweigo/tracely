import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Archive, CheckCircle2, Menu, Search } from 'lucide-react-native';
import { DocumentLifecycleStatus } from '../../domain/enums/DomainEnums';
import { useAppServices } from '../../state/AppServiceContext';
import { EmptyState } from '../components/EmptyState';
import { SDO_COLORS } from '../theme/tokens';

type CompletedFilter = 'all' | 'approved' | 'archived';
const PAGE_SIZE = 15;

export const CompletedScreen: React.FC = () => {
  const { documents, openDocument, openSidebar } = useAppServices();
  const [filter, setFilter] = useState<CompletedFilter>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const completed = useMemo(
    () =>
      documents.filter(
        (d) =>
          d.lifecycleStatus === DocumentLifecycleStatus.APPROVED ||
          d.lifecycleStatus === DocumentLifecycleStatus.ARCHIVED,
      ),
    [documents],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return completed
      .filter((d) => filter === 'all' || d.lifecycleStatus === filter)
      .filter(
        (d) =>
          !q ||
          d.trackingCode.toLowerCase().includes(q) ||
          d.title.toLowerCase().includes(q) ||
          d.categoryName.toLowerCase().includes(q),
      );
  }, [completed, filter, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const countOf = (f: CompletedFilter) =>
    f === 'all' ? completed.length : completed.filter((d) => d.lifecycleStatus === f).length;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Completed</Text>
        <Pressable onPress={openSidebar} accessibilityLabel="Open navigation sidebar" style={styles.iconBtn}>
          <Menu size={18} color={SDO_COLORS.navyInk} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.chipRow}>
          {(
            [
              { id: 'all', label: 'All' },
              { id: 'approved', label: 'Approved' },
              { id: 'archived', label: 'Archived' },
            ] as const
          ).map((c) => {
            const active = filter === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => {
                  setFilter(c.id);
                  setPage(1);
                }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {c.label} ({countOf(c.id)})
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.searchBox}>
          <Search size={15} color={SDO_COLORS.textMuted} />
          <TextInput
            value={query}
            onChangeText={(t) => {
              setQuery(t);
              setPage(1);
            }}
            placeholder="Search tracking code, title, category"
            placeholderTextColor={SDO_COLORS.textMuted}
            style={styles.searchInput}
          />
        </View>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={22} color={SDO_COLORS.navy} />}
            title="No completed documents yet"
            description="Documents marked Approved & Released or Archived move here and leave your Inbox."
          />
        ) : (
          pageItems.map((doc) => {
            const approved = doc.lifecycleStatus === DocumentLifecycleStatus.APPROVED;
            return (
              <Pressable
                key={doc.id}
                testID={`completed-row-${doc.id}`}
                onPress={() => openDocument(doc.id)}
                style={styles.card}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.code}>{doc.trackingCode}</Text>
                  <View style={[styles.pill, approved ? styles.pillApproved : styles.pillArchived]}>
                    {approved ? (
                      <CheckCircle2 size={11} color={SDO_COLORS.emeraldText} />
                    ) : (
                      <Archive size={11} color={SDO_COLORS.textSecondary} />
                    )}
                    <Text style={[styles.pillText, { color: approved ? SDO_COLORS.emeraldText : SDO_COLORS.textSecondary }]}>
                      {approved ? 'Approved & Released' : 'Archived · Closed'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.title}>{doc.title}</Text>
                <Text style={styles.meta}>
                  {doc.categoryName} · Finalized at {doc.currentOffice.code}
                </Text>
              </Pressable>
            );
          })
        )}

        {filtered.length > 0 ? (
          <View style={styles.pager}>
            <Pressable disabled={safePage <= 1} onPress={() => setPage(safePage - 1)} style={styles.pagerBtn}>
              <Text style={[styles.pagerText, safePage <= 1 && styles.pagerDisabled]}>Prev</Text>
            </Pressable>
            <Text style={styles.meta}>
              Page {safePage} of {totalPages} · {filtered.length} documents
            </Text>
            <Pressable disabled={safePage >= totalPages} onPress={() => setPage(safePage + 1)} style={styles.pagerBtn}>
              <Text style={[styles.pagerText, safePage >= totalPages && styles.pagerDisabled]}>Next</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: SDO_COLORS.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: SDO_COLORS.navyInk },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SDO_COLORS.surfaceSoft,
  },
  content: { paddingHorizontal: 16, paddingBottom: 110, gap: 10 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
  },
  chipActive: { backgroundColor: SDO_COLORS.navy, borderColor: SDO_COLORS.navy },
  chipText: { fontSize: 12, fontWeight: '700', color: SDO_COLORS.textSecondary },
  chipTextActive: { color: '#FFFFFF' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: SDO_COLORS.textPrimary },
  card: {
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    borderRadius: 16,
    padding: 14,
    gap: 6,
    backgroundColor: SDO_COLORS.surface,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  code: { fontSize: 12, fontWeight: '700', color: SDO_COLORS.navy },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  pillApproved: { backgroundColor: SDO_COLORS.emeraldSoft },
  pillArchived: { backgroundColor: SDO_COLORS.surfaceSoft },
  pillText: { fontSize: 10.5, fontWeight: '700' },
  title: { fontSize: 15, fontWeight: '800', color: SDO_COLORS.textPrimary },
  meta: { fontSize: 12, color: SDO_COLORS.textSecondary },
  pager: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  pagerBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  pagerText: { fontSize: 13, fontWeight: '700', color: SDO_COLORS.navy },
  pagerDisabled: { color: SDO_COLORS.textMuted },
});
