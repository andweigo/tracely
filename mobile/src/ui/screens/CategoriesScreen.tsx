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
import {
  ArrowLeft,
  ArrowUpRight,
  FolderKanban,
  FolderOpen,
  MapPin,
  Plus,
  Search,
  X,
} from 'lucide-react-native';
import { Document } from '../../domain/entities/Document';
import { DocumentCategory } from '../../domain/entities/DocumentCategory';
import { DocumentCopyFormat } from '../../domain/enums/DomainEnums';
import { useAppServices } from '../../state/AppServiceContext';
import { EmptyState } from '../components/EmptyState';
import { MobileFolder, MobileFolderSheetItem } from '../components/MobileFolder';
import { MobileScreenHeader } from '../components/MobileTopBars';
import { CategoryDeclareSheet } from '../sheets/CategoryDeclareSheet';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';
import { sortDocuments } from '../utils/inboxFilter';

const CATEGORY_FOLDER_COLORS = ['#0ea5e9', '#f59e0b', '#6366f1', '#10b981', '#ec4899', '#8b5cf6'];

interface CategoryFolderBucket {
  readonly category: DocumentCategory;
  readonly color: string;
  readonly matchingDocs: ReadonlyArray<Document>;
  readonly items: ReadonlyArray<MobileFolderSheetItem>;
}

export const CategoriesScreen: React.FC = () => {
  const {
    categories,
    documents,
    folderAppearance,
    openDocument,
    openTrackForDocument,
    goBack,
    refreshWorkspace,
    isRefreshing,
  } = useAppServices();

  const [search, setSearch] = useState('');
  const [showDeclare, setShowDeclare] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [docSearch, setDocSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (cat) =>
        cat.name.toLowerCase().includes(q) ||
        cat.code.toLowerCase().includes(q) ||
        cat.declaredByOfficeCode.toLowerCase().includes(q),
    );
  }, [categories, search]);

  const buckets = useMemo<ReadonlyArray<CategoryFolderBucket>>(() => {
    return filtered.map((cat, idx) => {
      const matched = sortDocuments(
        documents.filter(
          (doc) =>
            doc.categoryId === cat.id ||
            doc.categoryName.trim().toLowerCase() === cat.name.trim().toLowerCase(),
        ),
        'sla_urgent',
      );
      const total = matched.length;
      const hasOverflow = total > 6;
      const preview = hasOverflow ? matched.slice(0, 5) : matched.slice(0, 6);
      const overflowCount = hasOverflow ? total - 5 : 0;

      const items: MobileFolderSheetItem[] = preview.map((doc) => ({
        id: doc.id,
        docId: doc.id,
        bucketId: cat.id,
        title: doc.isSealed ? 'Sealed Document' : doc.title,
        description: `${doc.currentOffice.name} · ${
          doc.copyFormat === DocumentCopyFormat.HARD_COPY ? 'Hard Copy' : 'Soft Copy'
        }`,
      }));

      if (hasOverflow) {
        items.push({
          id: `${cat.id}-overflow`,
          bucketId: cat.id,
          isOverflowSheet: true,
          title: `+${overflowCount.toLocaleString()} more`,
          description: 'Tap to browse all',
        });
      }

      if (items.length === 0) {
        items.push({
          id: `${cat.id}-empty`,
          bucketId: cat.id,
          title: 'No documents yet',
          description: cat.name,
        });
      }

      return {
        category: cat,
        color: CATEGORY_FOLDER_COLORS[idx % CATEGORY_FOLDER_COLORS.length],
        matchingDocs: matched,
        items,
      };
    });
  }, [filtered, documents]);

  const activeBucket = useMemo(
    () => buckets.find((b) => b.category.id === activeCategoryId) ?? null,
    [buckets, activeCategoryId],
  );

  const visibleCategoryDocs = useMemo(() => {
    if (!activeBucket) return [];
    const q = docSearch.trim().toLowerCase();
    if (!q) return activeBucket.matchingDocs;
    return activeBucket.matchingDocs.filter((doc) => {
      const title = doc.isSealed ? 'sealed document' : doc.title.toLowerCase();
      return (
        title.includes(q) ||
        doc.trackingCode.toLowerCase().includes(q) ||
        doc.currentOffice.name.toLowerCase().includes(q) ||
        doc.currentOffice.code.toLowerCase().includes(q)
      );
    });
  }, [activeBucket, docSearch]);

  return (
    <View testID="mobile-categories-screen" style={styles.screen}>
      <MobileScreenHeader title="Categories" />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshWorkspace} />
        }
      >
        <View style={styles.toolbarRow}>
          <View style={styles.searchBox}>
            <Search size={16} color={SDO_COLORS.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search categories..."
              placeholderTextColor={SDO_COLORS.textMuted}
              style={styles.searchInput}
            />
          </View>
          <Pressable
            testID="mobile-categories-add-btn"
            onPress={() => setShowDeclare(true)}
            accessibilityLabel="Add new category"
            style={styles.addBtn}
          >
            <Plus size={16} color={SDO_COLORS.navyInk} />
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>

        {selectedDoc ? (
          <View testID="mobile-category-selected-doc" style={styles.selectedDocBanner}>
            <View style={styles.selectedDocCopy}>
              <Text numberOfLines={1} style={styles.selectedDocTitle}>
                {selectedDoc.isSealed ? 'Sealed Document' : selectedDoc.title}
              </Text>
              <Text numberOfLines={1} style={styles.selectedDocMeta}>
                {selectedDoc.categoryName} · {selectedDoc.currentOffice.name}
              </Text>
            </View>
            <View style={styles.selectedDocActions}>
              <Pressable
                onPress={() => openTrackForDocument(selectedDoc.trackingCode)}
                style={styles.trackMiniBtn}
              >
                <MapPin size={12} color={SDO_COLORS.navy} />
                <Text style={styles.trackMiniBtnText}>Track</Text>
              </Pressable>
              <Pressable
                onPress={() => openDocument(selectedDoc.id)}
                style={styles.viewMiniBtn}
              >
                <Text style={styles.viewMiniBtnText}>View</Text>
                <ArrowUpRight size={12} color="#FFFFFF" />
              </Pressable>
              <Pressable onPress={() => setSelectedDoc(null)} style={styles.closeMiniBtn}>
                <X size={13} color={SDO_COLORS.textSecondary} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState
            icon={<FolderKanban size={24} color={SDO_COLORS.textMuted} />}
            title="No categories found"
            description="Add a category to organize documents."
            action={
              <Pressable onPress={() => setShowDeclare(true)} style={styles.amberPill}>
                <Text style={styles.amberPillText}>Add Category</Text>
              </Pressable>
            }
          />
        ) : (
          <View testID="mobile-categories-folder-grid" style={styles.folderGrid}>
            {buckets.map((bucket) => {
              const cat = bucket.category;
              const isOpen = activeCategoryId === cat.id;
              return (
                <View
                  key={cat.id}
                  testID={`mobile-category-folder-${cat.id}`}
                  style={styles.folderCell}
                >
                  <MobileFolder
                    testID={`mobile-category-folder-widget-${cat.id}`}
                    label={`${cat.code} (${bucket.matchingDocs.length})`}
                    color={bucket.color}
                    mode={folderAppearance.mode}
                    variant={folderAppearance.variant}
                    layout={folderAppearance.layout}
                    items={bucket.items}
                    onOpenDocument={openDocument}
                    onItemClick={(item) => {
                      if (item.isOverflowSheet) {
                        setActiveCategoryId(cat.id);
                        setDocSearch('');
                        return;
                      }
                      if (item.docId) {
                        const doc = documents.find((d) => d.id === item.docId) ?? null;
                        setSelectedDoc(doc);
                      }
                    }}
                  />
                  <Text numberOfLines={1} style={styles.folderName}>
                    {cat.name}
                  </Text>
                  <Text style={styles.folderSub}>
                    {bucket.matchingDocs.length}{' '}
                    {bucket.matchingDocs.length === 1 ? 'document' : 'documents'}
                  </Text>
                  <Pressable
                    testID={`mobile-open-category-folder-${cat.id}`}
                    onPress={() => {
                      setActiveCategoryId(isOpen ? null : cat.id);
                      setDocSearch('');
                    }}
                    style={styles.openFolderBtn}
                  >
                    <FolderOpen size={12} color={SDO_COLORS.navy} />
                    <Text style={styles.openFolderBtnText}>
                      {isOpen ? 'Close' : 'Open'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {activeBucket ? (
          <View testID="mobile-category-docs-panel" style={styles.docsPanel}>
            <View style={styles.docsPanelHeader}>
              <View style={styles.docsPanelTitleWrap}>
                <Text style={styles.docsPanelTitle}>
                  {activeBucket.category.name} ({activeBucket.matchingDocs.length})
                </Text>
                <Text style={styles.docsPanelSub}>
                  {activeBucket.category.code} · {activeBucket.category.declaredByOfficeCode}
                </Text>
              </View>
              <Pressable
                onPress={() => setActiveCategoryId(null)}
                style={styles.panelCloseBtn}
              >
                <X size={14} color={SDO_COLORS.navyInk} />
              </Pressable>
            </View>

            {activeBucket.matchingDocs.length > 0 ? (
              <View style={styles.panelSearchBox}>
                <Search size={14} color={SDO_COLORS.textMuted} />
                <TextInput
                  value={docSearch}
                  onChangeText={setDocSearch}
                  placeholder={`Filter inside ${activeBucket.category.name}...`}
                  placeholderTextColor={SDO_COLORS.textMuted}
                  style={styles.panelSearchInput}
                />
              </View>
            ) : null}

            {visibleCategoryDocs.length === 0 ? (
              <Text style={styles.emptyDocsText}>No documents in this category yet.</Text>
            ) : (
              <View style={styles.docsList}>
                {visibleCategoryDocs.map((doc) => (
                  <View
                    key={doc.id}
                    testID={`mobile-cat-doc-row-${doc.id}`}
                    style={styles.docRow}
                  >
                    <View style={styles.docRowCopy}>
                      <Text numberOfLines={1} style={styles.docRowTitle}>
                        {doc.isSealed ? 'Sealed Document' : doc.title}
                      </Text>
                      <Text numberOfLines={1} style={styles.docRowMeta}>
                        {doc.currentOffice.name} ·{' '}
                        {doc.copyFormat === DocumentCopyFormat.HARD_COPY
                          ? 'Hard Copy'
                          : 'Soft Copy'}
                      </Text>
                    </View>
                    <View style={styles.docRowActions}>
                      <Pressable
                        testID={`mobile-cat-doc-track-${doc.id}`}
                        onPress={() => openTrackForDocument(doc.trackingCode)}
                        style={styles.trackMiniBtn}
                      >
                        <MapPin size={12} color={SDO_COLORS.navy} />
                        <Text style={styles.trackMiniBtnText}>Track</Text>
                      </Pressable>
                      <Pressable
                        testID={`mobile-cat-doc-view-${doc.id}`}
                        onPress={() => openDocument(doc.id)}
                        style={styles.viewMiniBtn}
                      >
                        <Text style={styles.viewMiniBtnText}>View</Text>
                        <ArrowUpRight size={12} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        ) : null}
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
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 16,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 32,
    gap: 16,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 14,
  },
  searchInput: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 13,
    color: SDO_COLORS.textPrimary,
  },
  addBtn: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  addBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
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
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  selectedDocBanner: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    padding: 12,
    gap: 10,
  },
  selectedDocCopy: {
    gap: 2,
  },
  selectedDocTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  selectedDocMeta: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    color: SDO_COLORS.textSecondary,
  },
  selectedDocActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  folderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 24,
    paddingTop: 14,
  },
  folderCell: {
    width: '48%',
    alignItems: 'center',
    gap: 5,
  },
  folderName: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
    textAlign: 'center',
    marginTop: 4,
  },
  folderSub: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: SDO_COLORS.textMuted,
    textAlign: 'center',
  },
  openFolderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.skySoft,
    marginTop: 2,
  },
  openFolderBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  docsPanel: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    padding: 14,
    gap: 12,
  },
  docsPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  docsPanelTitleWrap: {
    flex: 1,
  },
  docsPanelTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 14.5,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  docsPanelSub: {
    fontFamily: SDO_FONTS.mono,
    fontSize: 11,
    color: SDO_COLORS.textSecondary,
    marginTop: 2,
  },
  panelCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelSearchBox: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  panelSearchInput: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 12.5,
    color: SDO_COLORS.textPrimary,
    paddingVertical: 0,
  },
  emptyDocsText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    color: SDO_COLORS.textMuted,
    paddingVertical: 8,
  },
  docsList: {
    borderTopWidth: 1,
    borderTopColor: SDO_COLORS.border,
  },
  docRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
    gap: 8,
  },
  docRowCopy: {
    gap: 2,
  },
  docRowTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  docRowMeta: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    color: SDO_COLORS.textSecondary,
  },
  docRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  trackMiniBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  viewMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.navy,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  viewMiniBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeMiniBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
