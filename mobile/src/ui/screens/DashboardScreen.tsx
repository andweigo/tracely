import React, { useMemo, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Inbox,
  MapPin,
  Search,
  X,
} from 'lucide-react-native';
import { Document } from '../../domain/entities/Document';
import {
  DocumentCopyFormat,
  DocumentLifecycleStatus,
  ReceiptStatus,
} from '../../domain/enums/DomainEnums';
import { useAppServices } from '../../state/AppServiceContext';
import { ConfidentialityBadge, SlaBadge } from '../components/Badges';
import { MobileCustodyJourneyRoad } from '../components/MobileCustodyJourneyRoad';
import { MobileFolder, MobileFolderSheetItem } from '../components/MobileFolder';
import { MobileHeaderActions } from '../components/MobileHeaderActions';
import { MobileIdentityWalletCard } from '../components/MobileIdentityWalletCard';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';
import { sortDocuments } from '../utils/inboxFilter';
import { paginateSentItems } from '../utils/sentFilter';

type RoutingScopeFilter = 'user' | 'office';
type FolderGroupingMode = 'stage' | 'category';
type LedgerPeriodFilter = 'all' | 'today' | '7d' | '30d' | 'archive';
type LedgerFormatFilter = 'all' | 'soft' | 'hard';

const FOLDERS_PER_SHELF = 4;
const LEDGER_ITEMS_PER_PAGE = 15;
const FOLDER_PALETTE = ['#0ea5e9', '#f59e0b', '#6366f1', '#10b981', '#ec4899', '#8b5cf6'];

export function formatMobileCompactCount(count: number): string {
  if (count >= 1_000_000) {
    const val = count / 1_000_000;
    return `${val >= 10 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (count >= 1_000) {
    const val = count / 1_000;
    return `${val >= 100 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(count);
}

interface OrganizerFolderBucket {
  readonly id: string;
  readonly code: string;
  readonly label: string;
  readonly subtitle: string;
  readonly color: string;
  readonly totalCount: number;
  readonly overflowCount: number;
  readonly allDocs: ReadonlyArray<Document>;
  readonly items: ReadonlyArray<MobileFolderSheetItem>;
}

function getDocumentTimestampMs(doc: Document): number {
  const latestTx = doc.latestTransaction;
  const raw = latestTx?.acknowledgedAt ?? latestTx?.sentAt ?? doc.createdAt;
  if (!raw) return 0;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

export const DashboardScreen: React.FC = () => {
  const {
    actor,
    documents,
    categories,
    folderAppearance,
    openDocument,
    setActiveTab,
    refreshWorkspace,
    isRefreshing,
  } = useAppServices();

  const [flowScope, setFlowScope] = useState<RoutingScopeFilter>('office');
  const [selectedJourneyDocId, setSelectedJourneyDocId] = useState<string | null>(null);
  const [lanyardDragging, setLanyardDragging] = useState(false);

  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);
  const [scrollY, setScrollY] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(720);
  const [journeySectionY, setJourneySectionY] = useState<number>(420);

  const [folderGroupMode, setFolderGroupMode] = useState<FolderGroupingMode>('stage');
  const [selectedFolderDoc, setSelectedFolderDoc] = useState<Document | null>(null);

  const [shelfPage, setShelfPage] = useState(1);
  const [categoryShelfQuery, setCategoryShelfQuery] = useState('');
  const [activeLedgerBucketId, setActiveLedgerBucketId] = useState<string | null>(null);
  const [ledgerQuery, setLedgerQuery] = useState('');
  const [ledgerPeriod, setLedgerPeriod] = useState<LedgerPeriodFilter>('all');
  const [ledgerFormat, setLedgerFormat] = useState<LedgerFormatFilter>('all');
  const [ledgerPage, setLedgerPage] = useState(1);

  const myUserSentDocs = useMemo(() => {
    if (!actor) return [];
    return documents.filter(
      (doc) =>
        doc.originUserId === actor.id ||
        doc.transactions.some((tx) => tx.fromUserId === actor.id),
    );
  }, [documents, actor]);

  const myOfficeSentDocs = useMemo(() => {
    if (!actor) return [];
    return documents.filter(
      (doc) =>
        doc.originOffice.id === actor.office.id ||
        doc.transactions.some((tx) => tx.fromOffice.id === actor.office.id),
    );
  }, [documents, actor]);

  const scopedDocuments = flowScope === 'user' ? myUserSentDocs : myOfficeSentDocs;

  const journeyDocuments = useMemo(
    () =>
      [...scopedDocuments]
        .sort((a, b) => getDocumentTimestampMs(b) - getDocumentTimestampMs(a))
        .slice(0, 5),
    [scopedDocuments],
  );

  const activeJourneyDoc = useMemo(() => {
    if (journeyDocuments.length === 0) return null;
    if (selectedJourneyDocId) {
      const found = journeyDocuments.find((d) => d.id === selectedJourneyDocId);
      if (found) return found;
    }
    return journeyDocuments[0];
  }, [journeyDocuments, selectedJourneyDocId]);

  const handleDashboardScroll = (ev: NativeSyntheticEvent<NativeScrollEvent>) => {
    setScrollY(ev.nativeEvent.contentOffset.y);
  };

  const handleScrollViewLayout = (ev: LayoutChangeEvent) => {
    const h = Math.round(ev.nativeEvent.layout.height);
    if (h > 100 && Math.abs(h - viewportHeight) > 4) {
      setViewportHeight(h);
    }
  };

  const handleJourneySectionLayout = (ev: LayoutChangeEvent) => {
    const y = Math.round(ev.nativeEvent.layout.y);
    if (Math.abs(y - journeySectionY) > 2) {
      setJourneySectionY(y);
    }
  };

  // High-Scale Folder Buckets:
  // - Sorts by SLA urgency so Top-5 physical sheets inside each folder are the most urgent documents
  // - Sheet 6 becomes an interactive "+N more records" Overflow Index Card whenever totalCount > 6
  const allFolderBuckets = useMemo<ReadonlyArray<OrganizerFolderBucket>>(() => {
    const buildBucket = (params: {
      id: string;
      code: string;
      subtitle: string;
      color: string;
      docs: ReadonlyArray<Document>;
    }): OrganizerFolderBucket => {
      const sortedDocs = sortDocuments([...params.docs], 'sla_urgent');
      const totalCount = sortedDocs.length;
      const hasOverflow = totalCount > 6;
      const previewDocs = hasOverflow ? sortedDocs.slice(0, 5) : sortedDocs.slice(0, 6);
      const overflowCount = hasOverflow ? totalCount - 5 : 0;

      const docItems: MobileFolderSheetItem[] = previewDocs.map((doc) => ({
        id: doc.id,
        docId: doc.id,
        bucketId: params.id,
        title: doc.isSealed ? `Sealed · ${doc.trackingCode}` : doc.title,
        description: `${doc.trackingCode} · ${doc.currentOffice.code} · ${
          doc.copyFormat === DocumentCopyFormat.HARD_COPY ? 'Hard Copy' : 'Soft Copy'
        }`,
      }));

      if (hasOverflow) {
        docItems.push({
          id: `${params.id}-overflow`,
          bucketId: params.id,
          isOverflowSheet: true,
          title: `+${overflowCount.toLocaleString()} more records`,
          description: 'Tap to open searchable & paginated folder ledger →',
        });
      }

      if (docItems.length === 0) {
        docItems.push({
          id: `${params.id}-empty`,
          bucketId: params.id,
          title: `0 in ${params.code}`,
          description: params.subtitle,
        });
      }

      return {
        id: params.id,
        code: params.code,
        label: `${params.code} (${formatMobileCompactCount(totalCount)})`,
        subtitle: params.subtitle,
        color: params.color,
        totalCount,
        overflowCount,
        allDocs: sortedDocs,
        items: docItems,
      };
    };

    if (folderGroupMode === 'category') {
      const byCategory = new Map<
        string,
        { code: string; name: string; docs: Document[] }
      >();
      for (const cat of categories) {
        byCategory.set(cat.id, { code: cat.code, name: cat.name, docs: [] });
      }
      for (const doc of documents) {
        let group = byCategory.get(doc.categoryId);
        if (!group) {
          group = {
            code: doc.categoryName.slice(0, 8).toUpperCase(),
            name: doc.categoryName,
            docs: [],
          };
          byCategory.set(doc.categoryId, group);
        }
        group.docs.push(doc);
      }

      const q = categoryShelfQuery.trim().toLowerCase();
      return Array.from(byCategory.entries())
        .filter(([, group]) => {
          if (!q) return true;
          return (
            group.code.toLowerCase().includes(q) || group.name.toLowerCase().includes(q)
          );
        })
        .sort((a, b) => b[1].docs.length - a[1].docs.length)
        .map(([catId, group], idx) =>
          buildBucket({
            id: `cat-${catId}`,
            code: group.code,
            subtitle: group.name,
            color: FOLDER_PALETTE[idx % FOLDER_PALETTE.length],
            docs: group.docs,
          }),
        );
    }

    const isPendingForActor = (doc: Document) =>
      Boolean(actor && doc.latestTransaction?.canBeAcknowledgedBy(actor));
    const isPendingSent = (doc: Document) =>
      Boolean(actor && doc.latestTransaction?.isPendingSentBy(actor.id));

    const incomingDocs = actor ? documents.filter(isPendingForActor) : [];
    const activeDeskDocs = actor
      ? documents.filter(
          (d) =>
            d.currentOffice.id === actor.office.id &&
            !isPendingForActor(d) &&
            !isPendingSent(d) &&
            d.lifecycleStatus !== DocumentLifecycleStatus.APPROVED &&
            d.lifecycleStatus !== DocumentLifecycleStatus.ARCHIVED,
        )
      : documents.filter(
          (d) =>
            d.lifecycleStatus !== DocumentLifecycleStatus.APPROVED &&
            d.lifecycleStatus !== DocumentLifecycleStatus.ARCHIVED,
        );
    const sentTransitDocs = actor
      ? documents.filter(
          (d) => d.originOffice.id === actor.office.id || isPendingSent(d),
        )
      : [];
    const completedDocs = documents.filter(
      (d) =>
        d.lifecycleStatus === DocumentLifecycleStatus.APPROVED ||
        d.lifecycleStatus === DocumentLifecycleStatus.ARCHIVED,
    );

    const stages = [
      {
        id: 'stage-incoming',
        code: 'Incoming',
        subtitle: 'Awaiting QR receipt or unlock at your desk',
        color: '#f59e0b',
        docs: incomingDocs,
      },
      {
        id: 'stage-desk',
        code: 'On My Desk',
        subtitle: 'Received files currently under review',
        color: '#0ea5e9',
        docs: activeDeskDocs,
      },
      {
        id: 'stage-sent',
        code: 'Dispatched',
        subtitle: 'Files originated or forwarded by your office',
        color: '#6366f1',
        docs: sentTransitDocs,
      },
      {
        id: 'stage-completed',
        code: 'Completed',
        subtitle: 'Approved & released or archived records',
        color: '#10b981',
        docs: completedDocs,
      },
    ];

    return stages.map((st) => buildBucket(st));
  }, [actor, categories, documents, folderGroupMode, categoryShelfQuery]);

  const pagedShelf = useMemo(
    () => paginateSentItems(allFolderBuckets, shelfPage, FOLDERS_PER_SHELF),
    [allFolderBuckets, shelfPage],
  );

  const activeLedgerBucket = useMemo(() => {
    if (!activeLedgerBucketId) return null;
    return allFolderBuckets.find((b) => b.id === activeLedgerBucketId) ?? null;
  }, [allFolderBuckets, activeLedgerBucketId]);

  const filteredLedgerDocs = useMemo(() => {
    if (!activeLedgerBucket) return [];
    const q = ledgerQuery.trim().toLowerCase();
    const nowMs = Date.now();
    const dayMs = 86_400_000;

    return activeLedgerBucket.allDocs.filter((doc) => {
      if (ledgerFormat === 'soft' && doc.copyFormat === DocumentCopyFormat.HARD_COPY) {
        return false;
      }
      if (ledgerFormat === 'hard' && doc.copyFormat !== DocumentCopyFormat.HARD_COPY) {
        return false;
      }

      if (ledgerPeriod !== 'all') {
        const docMs = getDocumentTimestampMs(doc);
        if (docMs > 0) {
          const ageMs = Math.max(0, nowMs - docMs);
          if (ledgerPeriod === 'today' && ageMs > dayMs) return false;
          if (ledgerPeriod === '7d' && ageMs > 7 * dayMs) return false;
          if (ledgerPeriod === '30d' && ageMs > 30 * dayMs) return false;
          if (ledgerPeriod === 'archive' && ageMs <= 30 * dayMs) return false;
        }
      }

      if (!q) return true;
      const visibleTitle = doc.isSealed ? 'sealed transfer' : doc.title.toLowerCase();
      return (
        doc.trackingCode.toLowerCase().includes(q) ||
        visibleTitle.includes(q) ||
        doc.categoryName.toLowerCase().includes(q) ||
        doc.currentOffice.code.toLowerCase().includes(q) ||
        doc.currentOffice.name.toLowerCase().includes(q)
      );
    });
  }, [activeLedgerBucket, ledgerQuery, ledgerPeriod, ledgerFormat]);

  const pagedLedgerDocs = useMemo(
    () => paginateSentItems(filteredLedgerDocs, ledgerPage, LEDGER_ITEMS_PER_PAGE),
    [filteredLedgerDocs, ledgerPage],
  );

  const openFolderLedger = (bucketId: string) => {
    setActiveLedgerBucketId(bucketId);
    setLedgerQuery('');
    setLedgerPeriod('all');
    setLedgerFormat('all');
    setLedgerPage(1);
  };

  const firstName = actor ? (actor.fullName.split(' ')[0] ?? actor.fullName) : 'Tracely';
  const avatarInitials = actor ? actor.initials : 'TR';

  return (
    <View testID="mobile-dashboard-screen" style={styles.screen}>
      {/* Main Screen Top Bar with Profile Pill + Sidebar Menu Button */}
      <View style={styles.topHeader}>
        <Pressable
          onPress={() => setActiveTab('profile')}
          accessibilityLabel="Open profile"
          style={styles.profilePill}
        >
          <View
            testID="mobile-dashboard-avatar"
            style={[
              styles.avatar,
              actor?.avatarColor ? { backgroundColor: actor.avatarColor } : null,
            ]}
          >
            <Text style={styles.avatarText}>{avatarInitials}</Text>
          </View>
          <View style={styles.profileTextWrap}>
            <View style={styles.greetingRow}>
              <Text style={styles.greeting}>
                {actor ? `Hey, ${firstName}` : 'Tracely'}
              </Text>
              <ChevronDown size={14} color={SDO_COLORS.textSecondary} />
            </View>
            <Text style={styles.subGreeting}>
              {actor ? `${actor.office.code} · Dashboard` : 'Dashboard'}
            </Text>
          </View>
        </Pressable>

        <MobileHeaderActions sidebarTestID="mobile-dashboard-sidebar-btn" variant="outlined" />
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!lanyardDragging}
        onScroll={handleDashboardScroll}
        scrollEventThrottle={16}
        onLayout={handleScrollViewLayout}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshWorkspace} />
        }
      >
        {/* SECTION 0: Vertical Identification Card */}
        <View style={styles.sectionBlock}>
          <MobileIdentityWalletCard
            testID="mobile-dashboard-wallet-card"
            onDragChange={setLanyardDragging}
            fullName={actor?.fullName ?? 'Tracely Operator'}
            employeeId={actor?.employeeId ?? 'EMP-2026-0001'}
            position={actor?.position ?? 'Records Officer'}
            officeCode={actor?.office.code ?? 'RECORDS'}
            officeName={actor?.office.name ?? 'Records & Registry'}
            roleLabel={actor?.roleLabel ?? 'Records Officer'}
            email={actor?.email}
            accentColor={actor?.avatarColor}
            activeDocsCount={
              documents.filter(
                (d) =>
                  d.lifecycleStatus !== DocumentLifecycleStatus.APPROVED &&
                  d.lifecycleStatus !== DocumentLifecycleStatus.ARCHIVED,
              ).length
            }
            completedDocsCount={
              documents.filter(
                (d) =>
                  d.lifecycleStatus === DocumentLifecycleStatus.APPROVED ||
                  d.lifecycleStatus === DocumentLifecycleStatus.ARCHIVED,
              ).length
            }
            actionLabel="Send Document"
            onActionPress={() => setActiveTab('send')}
            defaultMasked={true}
          />
        </View>

        {/* SECTION 1: Top 5 Recent Document Tracking */}
        <View
          testID="mobile-routing-flow-analytics"
          onLayout={handleJourneySectionLayout}
          style={styles.sectionBlock}
        >
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Tracking</Text>

            <View style={styles.segmentedControl}>
              <Pressable
                testID="mobile-flow-scope-user"
                onPress={() => {
                  setFlowScope('user');
                  setSelectedJourneyDocId(null);
                }}
                style={[styles.segmentBtn, flowScope === 'user' && styles.segmentBtnActive]}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    flowScope === 'user' && styles.segmentBtnTextActive,
                  ]}
                >
                  My Sent ({formatMobileCompactCount(myUserSentDocs.length)})
                </Text>
              </Pressable>
              <Pressable
                testID="mobile-flow-scope-office"
                onPress={() => {
                  setFlowScope('office');
                  setSelectedJourneyDocId(null);
                }}
                style={[styles.segmentBtn, flowScope === 'office' && styles.segmentBtnActive]}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    flowScope === 'office' && styles.segmentBtnTextActive,
                  ]}
                >
                  My Office ({formatMobileCompactCount(myOfficeSentDocs.length)})
                </Text>
              </Pressable>
            </View>
          </View>

          {journeyDocuments.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.journeyDocStrip}
            >
              {journeyDocuments.map((doc) => {
                const isSelected = activeJourneyDoc?.id === doc.id;
                const isCompleted =
                  doc.lifecycleStatus === DocumentLifecycleStatus.APPROVED ||
                  doc.lifecycleStatus === DocumentLifecycleStatus.ARCHIVED;
                const hasPending = doc.transactions.some(
                  (tx) => tx.receiptStatus === ReceiptStatus.PENDING,
                );
                const dotColor = isCompleted
                  ? '#059669'
                  : hasPending || doc.lifecycleStatus === DocumentLifecycleStatus.IN_TRANSIT
                    ? '#D97706'
                    : doc.lifecycleStatus === DocumentLifecycleStatus.RETURNED_FOR_REVISION
                      ? '#E11D48'
                      : '#0284C7';
                const pillTitle = doc.isSealed ? 'Sealed Document' : doc.title;
                return (
                  <Pressable
                    key={doc.id}
                    testID={`mobile-custody-doc-pill-${doc.id}`}
                    onPress={() => setSelectedJourneyDocId(doc.id)}
                    style={[
                      styles.journeyDocPill,
                      isSelected && styles.journeyDocPillActive,
                    ]}
                  >
                    <View style={[styles.journeyDocDot, { backgroundColor: dotColor }]} />
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.journeyDocTitle,
                        isSelected && styles.journeyDocTextActive,
                      ]}
                    >
                      {pillTitle}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {!activeJourneyDoc ? (
            <View style={styles.emptyFlowBox}>
              <Text style={styles.emptyFlowText}>
                {flowScope === 'user'
                  ? 'No documents sent by you yet.'
                  : 'No documents sent by your office yet.'}
              </Text>
            </View>
          ) : (
            <MobileCustodyJourneyRoad
              document={activeJourneyDoc}
              scrollY={scrollY}
              viewportHeight={viewportHeight}
              sectionOffsetY={journeySectionY}
              onOpenDocument={openDocument}
              onRequestScrollToY={(y) => {
                scrollViewRef.current?.scrollTo({ y, animated: true });
              }}
            />
          )}
        </View>

        {/* SECTION 2: Folders (Appearance configured in Settings) */}
        <View testID="mobile-folder-organizer" style={styles.sectionBlock}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Folders</Text>

            <View style={styles.segmentedControl}>
              <Pressable
                testID="mobile-folder-group-stage"
                onPress={() => {
                  setFolderGroupMode('stage');
                  setShelfPage(1);
                }}
                style={[styles.segmentBtn, folderGroupMode === 'stage' && styles.segmentBtnActive]}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    folderGroupMode === 'stage' && styles.segmentBtnTextActive,
                  ]}
                >
                  By Stage
                </Text>
              </Pressable>
              <Pressable
                testID="mobile-folder-group-category"
                onPress={() => {
                  setFolderGroupMode('category');
                  setShelfPage(1);
                }}
                style={[
                  styles.segmentBtn,
                  folderGroupMode === 'category' && styles.segmentBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    folderGroupMode === 'category' && styles.segmentBtnTextActive,
                  ]}
                >
                  By Category ({categories.length})
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Category Shelf Filter & Shelf Pagination */}
          {folderGroupMode === 'category' || allFolderBuckets.length > FOLDERS_PER_SHELF ? (
            <View style={styles.shelfControlBar}>
              {folderGroupMode === 'category' ? (
                <View style={styles.searchBox}>
                  <Search size={14} color={SDO_COLORS.textMuted} />
                  <TextInput
                    value={categoryShelfQuery}
                    onChangeText={(text) => {
                      setCategoryShelfQuery(text);
                      setShelfPage(1);
                    }}
                    placeholder="Filter category folders..."
                    placeholderTextColor={SDO_COLORS.textMuted}
                    style={styles.searchInput}
                  />
                </View>
              ) : null}

              {pagedShelf.totalPages > 1 ? (
                <View style={styles.shelfPagerRow}>
                  <Text style={styles.shelfPagerText}>
                    Shelf {pagedShelf.safePage} / {pagedShelf.totalPages}
                  </Text>
                  <Pressable
                    onPress={() => setShelfPage((p) => Math.max(1, p - 1))}
                    disabled={pagedShelf.safePage <= 1}
                    style={styles.pagerBtn}
                  >
                    <ChevronLeft size={14} color={SDO_COLORS.navyInk} />
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      setShelfPage((p) => Math.min(pagedShelf.totalPages, p + 1))
                    }
                    disabled={pagedShelf.safePage >= pagedShelf.totalPages}
                    style={styles.pagerBtn}
                  >
                    <ChevronRight size={14} color={SDO_COLORS.navyInk} />
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Selected Document Action Bar */}
          {selectedFolderDoc ? (
            <View testID="mobile-folder-selected-doc" style={styles.selectedDocBanner}>
              <View style={styles.selectedDocCopy}>
                <Text numberOfLines={1} style={styles.selectedDocTitle}>
                  {selectedFolderDoc.isSealed
                    ? 'Sealed Document'
                    : selectedFolderDoc.title}
                </Text>
                <Text style={styles.selectedDocMeta}>
                  {selectedFolderDoc.categoryName} · {selectedFolderDoc.currentOffice.name}
                </Text>
              </View>
              <View style={styles.selectedDocActions}>
                <Pressable
                  onPress={() => openDocument(selectedFolderDoc.id)}
                  style={styles.openDocBtn}
                >
                  <Text style={styles.openDocBtnText}>View</Text>
                  <ArrowUpRight size={12} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  onPress={() => setSelectedFolderDoc(null)}
                  style={styles.dismissDocBtn}
                >
                  <Text style={styles.dismissDocBtnText}>Close</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* 2x2 Interactive Folders Shelf */}
          <View style={styles.folderGrid}>
            {pagedShelf.pageItems.map((bucket) => {
              const isLedgerActive = activeLedgerBucket?.id === bucket.id;
              return (
                <View
                  key={bucket.id}
                  testID={`mobile-organizer-folder-${bucket.id}`}
                  style={styles.folderCell}
                >
                  <MobileFolder
                    testID={`mobile-folder-widget-${bucket.id}`}
                    label={bucket.label}
                    color={bucket.color}
                    mode={folderAppearance.mode}
                    variant={folderAppearance.variant}
                    layout={folderAppearance.layout}
                    items={bucket.items}
                    onOpenDocument={openDocument}
                    onItemClick={(item) => {
                      if (item.isOverflowSheet) {
                        openFolderLedger(bucket.id);
                        return;
                      }
                      if (item.docId) {
                        const matched = documents.find((d) => d.id === item.docId) ?? null;
                        setSelectedFolderDoc(matched);
                      }
                    }}
                  />
                  <Text style={styles.folderCellTitle}>
                    {bucket.code} ({bucket.totalCount.toLocaleString()})
                  </Text>
                  <Pressable
                    testID={`mobile-open-folder-ledger-${bucket.id}`}
                    onPress={() =>
                      isLedgerActive
                        ? setActiveLedgerBucketId(null)
                        : openFolderLedger(bucket.id)
                    }
                    style={styles.browseLedgerBtn}
                  >
                    <FolderOpen size={12} color="#0284C7" />
                    <Text style={styles.browseLedgerBtnText}>
                      {isLedgerActive
                        ? 'Hide list'
                        : `View all (${formatMobileCompactCount(bucket.totalCount)})`}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          {/* High-Scale Searchable, Time-Partitioned & Paginated Folder Contents Ledger */}
          {activeLedgerBucket ? (
            <View testID="mobile-folder-ledger" style={styles.ledgerBlock}>
              <View style={styles.ledgerHeaderRow}>
                <View style={styles.ledgerHeaderCopy}>
                  <Text style={styles.ledgerEyebrow}>
                    FOLDER CONTENTS LEDGER · {activeLedgerBucket.totalCount.toLocaleString()} RECORDS
                  </Text>
                  <Text style={styles.ledgerTitle}>
                    {activeLedgerBucket.code} — {activeLedgerBucket.subtitle}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setActiveLedgerBucketId(null)}
                  style={styles.closeLedgerBtn}
                >
                  <X size={13} color={SDO_COLORS.navyInk} />
                  <Text style={styles.closeLedgerBtnText}>Close</Text>
                </Pressable>
              </View>

              <View style={styles.searchBox}>
                <Search size={14} color={SDO_COLORS.textMuted} />
                <TextInput
                  testID="mobile-folder-ledger-search"
                  accessibilityLabel="Search folder ledger"
                  value={ledgerQuery}
                  onChangeText={(text) => {
                    setLedgerQuery(text);
                    setLedgerPage(1);
                  }}
                  placeholder={`Search inside ${activeLedgerBucket.code} by code or title...`}
                  placeholderTextColor={SDO_COLORS.textMuted}
                  style={styles.searchInput}
                />
              </View>

              {/* Time-Period Partition Chips */}
              <View style={styles.chipRow}>
                {(
                  [
                    { id: 'all', label: 'All Time' },
                    { id: 'today', label: 'Today' },
                    { id: '7d', label: 'Last 7 Days' },
                    { id: '30d', label: 'Last 30 Days' },
                    { id: 'archive', label: 'Archive (>30d)' },
                  ] as const
                ).map((period) => {
                  const active = ledgerPeriod === period.id;
                  return (
                    <Pressable
                      key={period.id}
                      onPress={() => {
                        setLedgerPeriod(period.id);
                        setLedgerPage(1);
                      }}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                    >
                      <Text
                        style={[styles.filterChipText, active && styles.filterChipTextActive]}
                      >
                        {period.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Format Chips */}
              <View style={styles.chipRow}>
                {(
                  [
                    { id: 'all', label: 'All Formats' },
                    { id: 'soft', label: 'Soft Copy' },
                    { id: 'hard', label: 'Hard Copy' },
                  ] as const
                ).map((fmt) => {
                  const active = ledgerFormat === fmt.id;
                  return (
                    <Pressable
                      key={fmt.id}
                      onPress={() => {
                        setLedgerFormat(fmt.id);
                        setLedgerPage(1);
                      }}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                    >
                      <Text
                        style={[styles.filterChipText, active && styles.filterChipTextActive]}
                      >
                        {fmt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Paginated Rows (15 per page) */}
              {pagedLedgerDocs.pageItems.length === 0 ? (
                <Text style={styles.emptyLedgerText}>
                  No records in this folder match the active search or date partition.
                </Text>
              ) : (
                <View style={styles.ledgerRowsWrap}>
                  {pagedLedgerDocs.pageItems.map((doc) => (
                    <Pressable
                      key={doc.id}
                      testID={`mobile-folder-ledger-row-${doc.id}`}
                      onPress={() => openDocument(doc.id)}
                      style={styles.ledgerRow}
                    >
                      <View style={styles.ledgerRowCopy}>
                        <Text numberOfLines={1} style={styles.ledgerRowTitle}>
                          {doc.isSealed
                            ? 'Sealed Transfer (Protected Until Receipt)'
                            : doc.title}
                        </Text>
                        <Text style={styles.ledgerRowMeta}>
                          {doc.trackingCode} · {doc.categoryName} · Desk: {doc.currentOffice.code}
                        </Text>
                      </View>
                      <View style={styles.ledgerRowBadges}>
                        <ConfidentialityBadge tier={doc.confidentialityTier} />
                        <SlaBadge state={doc.slaState} />
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Ledger Pagination Footer */}
              <View testID="mobile-folder-ledger-pagination" style={styles.ledgerPagerBar}>
                <Text style={styles.ledgerPagerInfo}>
                  Showing {pagedLedgerDocs.startIndex}–{pagedLedgerDocs.endIndex} of{' '}
                  {pagedLedgerDocs.totalItems.toLocaleString()}
                </Text>
                <View style={styles.shelfPagerRow}>
                  <Pressable
                    onPress={() => setLedgerPage((p) => Math.max(1, p - 1))}
                    disabled={pagedLedgerDocs.safePage <= 1}
                    style={styles.pagerBtn}
                  >
                    <ChevronLeft size={14} color={SDO_COLORS.navyInk} />
                  </Pressable>
                  <Text style={styles.shelfPagerText}>
                    {pagedLedgerDocs.safePage} / {pagedLedgerDocs.totalPages}
                  </Text>
                  <Pressable
                    onPress={() =>
                      setLedgerPage((p) => Math.min(pagedLedgerDocs.totalPages, p + 1))
                    }
                    disabled={pagedLedgerDocs.safePage >= pagedLedgerDocs.totalPages}
                    style={styles.pagerBtn}
                  >
                    <ChevronRight size={14} color={SDO_COLORS.navyInk} />
                  </Pressable>
                </View>
              </View>
            </View>
          ) : null}

          {/* Footer Quick Actions */}
          <View style={styles.footerRow}>
            <View style={styles.footerActionRow}>
              <Pressable
                onPress={() => setActiveTab('inbox')}
                style={styles.footerSecondaryBtn}
              >
                <Inbox size={13} color={SDO_COLORS.navyInk} />
                <Text style={styles.footerSecondaryBtnText}>Inbox</Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveTab('track')}
                style={styles.footerSecondaryBtn}
              >
                <MapPin size={13} color={SDO_COLORS.navyInk} />
                <Text style={styles.footerSecondaryBtnText}>Track Docs</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: SDO_COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileTextWrap: {
    flex: 1,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  greeting: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 15,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  subGreeting: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
    marginTop: 1,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 112,
    gap: 32,
  },
  sectionBlock: {
    paddingBottom: 26,
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
    gap: 18,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
  },
  sectionTitleWrap: {
    flex: 1,
    minWidth: 190,
  },
  eyebrowIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  eyebrowText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: SDO_COLORS.textMuted,
  },
  sectionTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
    marginTop: 2,
  },
  segmentedControl: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  segmentBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: SDO_COLORS.navyInk,
  },
  segmentBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textMuted,
  },
  segmentBtnTextActive: {
    color: '#FFFFFF',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legendCaption: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textMuted,
  },
  legendPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dotSoft: {
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: '#0EA5E9',
  },
  dotHard: {
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: '#F59E0B',
  },
  legendText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
  },
  emptyFlowBox: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFlowText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
  },
  inspectorWrap: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SDO_COLORS.border,
    gap: 8,
  },
  inspectorHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
  },
  inspectorTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  inspectorRankCode: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
  },
  inspectorName: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13.5,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
    marginTop: 1,
  },
  inspectorCountBox: {
    alignItems: 'flex-end',
  },
  inspectorCountText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 15,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  inspectorShareText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10.5,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
  },
  metricStrip: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
  },
  metricCell: {
    flex: 1,
    alignItems: 'center',
  },
  metricCellBorder: {
    borderLeftWidth: 1,
    borderLeftColor: SDO_COLORS.border,
  },
  metricValueAmber: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: '#D97706',
  },
  metricValueSky: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: '#0284C7',
  },
  metricValueEmerald: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  metricValueDark: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  metricLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  recentHeaderLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textMuted,
  },
  recentHeaderRatio: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10.5,
    fontWeight: '700',
    color: SDO_COLORS.textMuted,
  },
  recentDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
    gap: 8,
  },
  recentDocCopy: {
    flex: 1,
  },
  recentDocTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navyInk,
  },
  recentDocMeta: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10.5,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
    marginTop: 1,
  },
  recentDocFormat: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10.5,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  organizerControlRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  shelfControlBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
  },
  searchInput: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 12,
    color: SDO_COLORS.navyInk,
    paddingVertical: 0,
  },
  shelfPagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shelfPagerText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  pagerBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDocBanner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    gap: 8,
  },
  selectedDocCopy: {
    flex: 1,
    minWidth: 180,
  },
  selectedDocTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  selectedDocTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  selectedDocMeta: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10.5,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
    marginTop: 2,
  },
  selectedDocActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  openDocBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: SDO_COLORS.navyInk,
  },
  openDocBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dismissDocBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
  },
  dismissDocBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  folderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    rowGap: 18,
    columnGap: 10,
    paddingVertical: 10,
  },
  folderCell: {
    width: '46%',
    alignItems: 'center',
    gap: 4,
  },
  folderCellTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
    textAlign: 'center',
    marginTop: 2,
  },
  folderCellSub: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10.5,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
    textAlign: 'center',
  },
  browseLedgerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  browseLedgerBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '800',
    color: '#0284C7',
  },
  ledgerBlock: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: SDO_COLORS.border,
    gap: 10,
  },
  ledgerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  ledgerHeaderCopy: {
    flex: 1,
  },
  ledgerEyebrow: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
    letterSpacing: 0.4,
  },
  ledgerTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
    marginTop: 1,
  },
  closeLedgerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
  },
  closeLedgerBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.navyInk,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
  },
  filterChipActive: {
    backgroundColor: SDO_COLORS.navyInk,
    borderColor: SDO_COLORS.navyInk,
  },
  filterChipText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10.5,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  emptyLedgerText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.textMuted,
    paddingVertical: 12,
  },
  ledgerRowsWrap: {
    borderTopWidth: 1,
    borderTopColor: SDO_COLORS.border,
  },
  ledgerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
    gap: 8,
  },
  ledgerRowCopy: {
    flex: 1,
  },
  ledgerRowTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: SDO_COLORS.navyInk,
  },
  ledgerRowMeta: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10.5,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
    marginTop: 2,
  },
  ledgerRowBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ledgerPagerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  ledgerPagerInfo: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
  },
  footerRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SDO_COLORS.border,
    gap: 10,
  },
  footerTipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  footerTipText: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
    lineHeight: 15,
  },
  footerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
  },
  footerSecondaryBtnText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: SDO_COLORS.navyInk,
  },
  journeyDocStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  journeyDocPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 196,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  journeyDocPillActive: {
    backgroundColor: SDO_COLORS.navy,
    borderColor: SDO_COLORS.navy,
  },
  journeyDocDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  journeyDocTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11.5,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
    flexShrink: 1,
  },
  journeyDocTextActive: {
    color: '#FFFFFF',
  },
});
