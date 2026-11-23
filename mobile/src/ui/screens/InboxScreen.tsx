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
  AlertTriangle,
  CheckSquare,
  ChevronDown,
  Inbox,
  MapPin,
  Menu,
  Search,
  SlidersHorizontal,
  Square,
} from 'lucide-react-native';
import { Document } from '../../domain/entities/Document';
import {
  AvailabilityStatus,
  ConfidentialityTier,
  DocumentLifecycleStatus,
  SlaState,
} from '../../domain/enums/DomainEnums';
import { useAppServices } from '../../state/AppServiceContext';
import { SlaBadge } from '../components/Badges';
import { EmptyState } from '../components/EmptyState';
import { ScanToReceiveCard } from '../components/ScanToReceiveCard';
import { SealedQrCard } from '../components/SealedQrCard';
import { TrackingGroupedList } from '../components/TrackingLocationCard';
import { formatHumanInboxStatus } from '../utils/sentFilter';
import { ActionRemarksSheet } from '../sheets/ActionRemarksSheet';
import { ForwardSheet } from '../sheets/ForwardSheet';
import { SDO_COLORS } from '../theme/tokens';
import { formatRelativeTime } from '../utils/formatters';
import {
  countSlaRisks,
  InboxFormatFilter,
  InboxSortMode,
  matchesFormatFilter,
  sortDocuments,
} from '../utils/inboxFilter';

type QueueTab = 'all' | 'incoming' | 'in_progress' | 'returned' | 'tracked';
type FilterChip = 'all' | 'sla_risk' | 'protected' | 'school_tagged';

const AVAILABILITY_LABEL: Record<AvailabilityStatus, string> = {
  available: 'Available',
  official_business: 'Official Business',
  on_leave: 'On Leave',
};

const TIER_LABEL: Record<ConfidentialityTier, string> = {
  standard_internal: 'Standard Internal',
  restricted: 'Restricted',
  confidential: 'Confidential',
};

export const InboxScreen: React.FC = () => {
  const {
    actor,
    documents,
    trackedSnapshots,
    categories,
    openDocument,
    openScannerForDocument,
    setActiveTab,
    openSidebar,
    refreshWorkspace,
    declineMisrouted,
    isRefreshing,
    isBusy,
  } = useAppServices();

  const [queueTab, setQueueTab] = useState<QueueTab>('all');
  const [chip, setChip] = useState<FilterChip>('all');
  const [formatFilter, setFormatFilter] = useState<InboxFormatFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortMode, setSortMode] = useState<InboxSortMode>('sla_urgent');
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<ReadonlyArray<string>>([]);
  const [declineTarget, setDeclineTarget] = useState<Document | null>(null);
  const [forwardTargets, setForwardTargets] = useState<ReadonlyArray<Document> | null>(null);

  const counts = useMemo(() => {
    if (!actor) {
      return { all: 0, incoming: 0, inProgress: 0, returned: 0, tracked: trackedSnapshots.length };
    }
    const incoming = documents.filter((d) =>
      d.latestTransaction?.canBeAcknowledgedBy(actor),
    ).length;
    const inProgress = documents.filter(
      (d) =>
        d.currentOffice.id === actor.office.id &&
        !d.latestTransaction?.canBeAcknowledgedBy(actor) &&
        !d.latestTransaction?.isPendingSentBy(actor.id) &&
        d.lifecycleStatus === DocumentLifecycleStatus.IN_REVIEW,
    ).length;
    const returned = documents.filter(
      (d) => d.lifecycleStatus === DocumentLifecycleStatus.RETURNED_FOR_REVISION,
    ).length;
    return {
      all: documents.filter(
        (d) =>
          d.lifecycleStatus !== DocumentLifecycleStatus.APPROVED &&
          d.lifecycleStatus !== DocumentLifecycleStatus.ARCHIVED,
      ).length,
      incoming,
      inProgress,
      returned,
      tracked: trackedSnapshots.length,
    };
  }, [actor, documents, trackedSnapshots]);

  const slaRisks = useMemo(() => countSlaRisks(documents), [documents]);

  const filteredDocs = useMemo(() => {
    if (!actor || queueTab === 'tracked') return [];
    const q = query.trim().toLowerCase();

    const matched = documents.filter((doc) => {
      if (
        doc.lifecycleStatus === DocumentLifecycleStatus.APPROVED ||
        doc.lifecycleStatus === DocumentLifecycleStatus.ARCHIVED
      ) {
        return false;
      }
      if (queueTab === 'incoming' && !doc.latestTransaction?.canBeAcknowledgedBy(actor)) {
        return false;
      }
      if (
        queueTab === 'in_progress' &&
        !(
          doc.currentOffice.id === actor.office.id &&
          !doc.latestTransaction?.canBeAcknowledgedBy(actor) &&
          !doc.latestTransaction?.isPendingSentBy(actor.id) &&
          doc.lifecycleStatus === DocumentLifecycleStatus.IN_REVIEW
        )
      ) {
        return false;
      }
      if (
        queueTab === 'returned' &&
        doc.lifecycleStatus !== DocumentLifecycleStatus.RETURNED_FOR_REVISION
      ) {
        return false;
      }
      if (
        chip === 'sla_risk' &&
        doc.slaState !== SlaState.AT_RISK &&
        doc.slaState !== SlaState.OVERDUE
      ) {
        return false;
      }
      if (
        chip === 'protected' &&
        doc.confidentialityTier === ConfidentialityTier.STANDARD_INTERNAL
      ) {
        return false;
      }
      if (chip === 'school_tagged' && !doc.submittedSchool) {
        return false;
      }
      if (!matchesFormatFilter(doc, formatFilter)) {
        return false;
      }
      if (categoryFilter !== 'all' && doc.categoryId !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        doc.trackingCode.toLowerCase().includes(q) ||
        doc.title.toLowerCase().includes(q) ||
        doc.categoryName.toLowerCase().includes(q) ||
        doc.currentOffice.name.toLowerCase().includes(q) ||
        doc.submittedSchool?.name.toLowerCase().includes(q)
      );
    });

    return sortDocuments(matched, sortMode);
  }, [actor, documents, queueTab, chip, formatFilter, categoryFilter, sortMode, query]);

  const selectedDocSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedDocs = useMemo(
    () => filteredDocs.filter((d) => selectedDocSet.has(d.id)),
    [filteredDocs, selectedDocSet],
  );
  const selectableCustodyDocs = useMemo(
    () =>
      actor
        ? filteredDocs.filter(
            (d) =>
              d.currentOffice.id === actor.office.id &&
              !d.latestTransaction?.canBeAcknowledgedBy(actor) &&
              !d.latestTransaction?.isPendingSentBy(actor.id),
          )
        : [],
    [actor, filteredDocs],
  );
  const selectedCustodyDocs = useMemo(
    () =>
      actor
        ? selectedDocs.filter(
            (d) =>
              d.currentOffice.id === actor.office.id &&
              !d.latestTransaction?.canBeAcknowledgedBy(actor) &&
              !d.latestTransaction?.isPendingSentBy(actor.id),
          )
        : [],
    [actor, selectedDocs],
  );

  const toggleDocSelected = (docId: string) => {
    setSelectedIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId],
    );
  };

  const filteredTracked = useMemo(() => {
    if (queueTab !== 'tracked') return [];
    const q = query.trim().toLowerCase();
    return trackedSnapshots.filter((snap) => {
      if (
        chip === 'sla_risk' &&
        snap.slaState !== SlaState.AT_RISK &&
        snap.slaState !== SlaState.OVERDUE
      ) {
        return false;
      }
      if (
        chip === 'protected' &&
        snap.confidentialityTier === ConfidentialityTier.STANDARD_INTERNAL
      ) {
        return false;
      }
      if (!q) return true;
      return (
        snap.trackingCode.toLowerCase().includes(q) ||
        snap.displayTitle.toLowerCase().includes(q) ||
        snap.currentOffice.name.toLowerCase().includes(q) ||
        snap.currentOffice.code.toLowerCase().includes(q)
      );
    });
  }, [trackedSnapshots, queueTab, chip, query]);

  const firstName = actor ? (actor.fullName.split(' ')[0] ?? actor.fullName) : 'Tracely';
  const avatarInitials = actor ? actor.initials : 'TR';
  const officeSubtitle = actor
    ? `${actor.office.code} · ${AVAILABILITY_LABEL[actor.availability]}`
    : 'Tracely · Pre-Auth';

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={refreshWorkspace} />
      }
    >
      <View style={styles.topHeader}>
        <Pressable onPress={() => setActiveTab('profile')} style={styles.profilePill}>
          <View
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
            <Text style={styles.subGreeting}>{officeSubtitle}</Text>
          </View>
        </Pressable>

        <Pressable
          onPress={openSidebar}
          accessibilityLabel="Open navigation sidebar"
          style={styles.menuBtn}
        >
          <Menu size={20} color={SDO_COLORS.navyInk} />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={17} color={SDO_COLORS.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search code or title"
            placeholderTextColor={SDO_COLORS.textMuted}
            style={styles.searchInput}
          />
        </View>
        <Pressable
          onPress={() => setShowFilters((v) => !v)}
          accessibilityLabel="Toggle document filters"
          style={styles.filterCircle}
        >
          <SlidersHorizontal size={18} color={SDO_COLORS.navyInk} />
        </Pressable>
      </View>

      {showFilters ? (
        <View style={styles.filterPanel}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {(
              [
                { id: 'all', label: 'All items' },
                { id: 'sla_risk', label: 'SLA due / overdue' },
                { id: 'protected', label: 'Restricted & Confidential' },
                { id: 'school_tagged', label: 'School-tagged' },
              ] as const
            ).map((item) => {
              const active = chip === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setChip(item.id)}
                  style={[styles.subFilterChip, active && styles.subFilterChipActive]}
                >
                  <Text style={[styles.subFilterText, active && styles.subFilterTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            {(
              [
                { id: 'all', label: 'All Formats' },
                { id: 'soft_copy', label: 'Soft Copy' },
                { id: 'hard_copy', label: 'Hard Copy' },
              ] as const
            ).map((item) => {
              const active = formatFilter === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setFormatFilter(item.id)}
                  style={[styles.subFilterChip, active && styles.subFilterChipActive]}
                >
                  <Text style={[styles.subFilterText, active && styles.subFilterTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}

            {(
              [
                { id: 'sla_urgent', label: 'Sort: SLA Urgent' },
                { id: 'newest', label: 'Sort: Newest' },
                { id: 'oldest', label: 'Sort: Oldest' },
              ] as const
            ).map((item) => {
              const active = sortMode === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setSortMode(item.id)}
                  style={[styles.subFilterChip, active && styles.subFilterChipActive]}
                >
                  <Text style={[styles.subFilterText, active && styles.subFilterTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {categories.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              <Pressable
                onPress={() => setCategoryFilter('all')}
                style={[
                  styles.subFilterChip,
                  categoryFilter === 'all' && styles.subFilterChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.subFilterText,
                    categoryFilter === 'all' && styles.subFilterTextActive,
                  ]}
                >
                  All Categories
                </Text>
              </Pressable>
              {categories.map((cat) => {
                const active = categoryFilter === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => setCategoryFilter(cat.id)}
                    style={[styles.subFilterChip, active && styles.subFilterChipActive]}
                  >
                    <Text style={[styles.subFilterText, active && styles.subFilterTextActive]}>
                      {cat.code}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>
      ) : null}

      {actor && slaRisks.totalRiskCount > 0 && chip !== 'sla_risk' ? (
        <View style={styles.slaAlertBanner}>
          <View style={styles.slaAlertLeft}>
            <AlertTriangle size={15} color={SDO_COLORS.amberText} />
            <Text style={styles.slaAlertText}>
              {slaRisks.overdueCount > 0 ? `${slaRisks.overdueCount} overdue` : ''}
              {slaRisks.overdueCount > 0 && slaRisks.atRiskCount > 0 ? ' · ' : ''}
              {slaRisks.atRiskCount > 0 ? `${slaRisks.atRiskCount} due soon` : ''}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              setQueueTab('all');
              setChip('sla_risk');
              setShowFilters(true);
            }}
            style={styles.slaReviewChip}
          >
            <Text style={styles.slaReviewText}>Review SLA</Text>
          </Pressable>
        </View>
      ) : null}

      <ScanToReceiveCard autoStart={false} allowDismissResult />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {(
          [
            { id: 'all', label: 'All' },
            { id: 'incoming', label: `Incoming (${counts.incoming})` },
            { id: 'in_progress', label: 'In progress' },
            { id: 'returned', label: 'Returned' },
            { id: 'tracked', label: `Tracked (${counts.tracked})` },
          ] as const
        ).map((tab) => {
          const active = queueTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setQueueTab(tab.id)}
              style={[styles.pillTab, active && styles.pillTabActive]}
            >
              <Text style={[styles.pillTabText, active && styles.pillTabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {queueTab === 'tracked' ? 'Where your office docs are' : 'Needs your action'}
        </Text>
        <View style={styles.sectionActions}>
          {queueTab !== 'tracked' && filteredDocs.length > 0 ? (
            <Pressable
              onPress={() => {
                setSelectMode((v) => !v);
                setSelectedIds([]);
              }}
              style={[styles.trackCodeChip, selectMode && styles.selectChipActive]}
            >
              <Text style={[styles.trackCodeChipText, selectMode && styles.selectChipTextActive]}>
                {selectMode ? 'Done' : 'Select'}
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => setQueueTab('all')}>
            <Text style={styles.seeAll}>See all</Text>
          </Pressable>
        </View>
      </View>

      {selectMode && queueTab !== 'tracked' && filteredDocs.length > 0 ? (
        <View style={styles.bulkBar}>
          <Pressable
            onPress={() =>
              setSelectedIds(
                selectedIds.length === selectableCustodyDocs.length
                  ? []
                  : selectableCustodyDocs.map((d) => d.id),
              )
            }
          >
            <Text style={styles.bulkSelectLink}>
              {selectedIds.length === selectableCustodyDocs.length &&
              selectableCustodyDocs.length > 0
                ? 'Clear All'
                : 'Select Unlocked'}{' '}
              ({selectedIds.length})
            </Text>
          </Pressable>
          <View style={styles.bulkBtnRow}>
            {counts.incoming > 0 ? (
              <Pressable
                onPress={() => setActiveTab('scanner')}
                style={styles.bulkAmberBtn}
              >
                <Text style={styles.bulkAmberText}>
                  Batch Scan QR ({counts.incoming})
                </Text>
              </Pressable>
            ) : null}
            {selectedCustodyDocs.length > 0 ? (
              <Pressable
                disabled={isBusy}
                onPress={() => setForwardTargets(selectedCustodyDocs)}
                style={styles.bulkOutlineBtn}
              >
                <Text style={styles.bulkOutlineText}>
                  Forward ({selectedCustodyDocs.length})
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {queueTab === 'tracked' ? (
        filteredTracked.length === 0 ? (
          <EmptyState
            icon={<MapPin size={24} color={SDO_COLORS.textMuted} />}
            title={actor ? 'No tracked office documents' : 'Track Any Document Location'}
            description={
              actor
                ? 'Documents originated or forwarded by your office appear here with live office location.'
                : 'Enter a document tracking code to check which office currently holds it.'
            }
            action={
              <Pressable onPress={() => setActiveTab('track')} style={styles.emptyActionBtn}>
                <Text style={styles.emptyActionText}>Track by Code</Text>
              </Pressable>
            }
          />
        ) : (
          <TrackingGroupedList
            snapshots={filteredTracked}
            onOpenDocument={openDocument}
          />
        )
      ) : filteredDocs.length === 0 ? (
        <EmptyState
          icon={<Inbox size={24} color={SDO_COLORS.textMuted} />}
          title={actor ? 'No documents in this view' : 'Ready for Tracely Server Connection'}
          description={
            actor
              ? 'Only documents permitted by your office custody and confidentiality policy appear here. Pull down to refresh.'
              : 'Login is deferred for now. Explore the QR Scanner, Shared Categories, Alerts, and Server Settings from Profile.'
          }
          action={
            !actor ? (
              <Pressable onPress={() => setActiveTab('profile')} style={styles.emptyActionBtn}>
                <Text style={styles.emptyActionText}>Server & Profile</Text>
              </Pressable>
            ) : undefined
          }
        />
      ) : (
        <View style={styles.cardList}>
          {filteredDocs.map((doc) => {
            const latest = doc.latestTransaction;
            const pendingMyReceipt =
              Boolean(actor && latest?.canBeAcknowledgedBy(actor)) || doc.isSealed;
            const pendingSentByMe = Boolean(actor && latest?.isPendingSentBy(actor.id));

            if (pendingMyReceipt) {
              return (
                <SealedQrCard
                  key={doc.id}
                  document={doc}
                  onScan={(target) => openScannerForDocument(target, true)}
                  onDecline={(target) => setDeclineTarget(target)}
                />
              );
            }

            const inMyCustody =
              Boolean(actor) &&
              doc.currentOffice.id === actor?.office.id &&
              !pendingSentByMe;
            const isSelected = selectedDocSet.has(doc.id);

            return (
              <Pressable
                key={doc.id}
                onPress={() => (selectMode ? toggleDocSelected(doc.id) : openDocument(doc.id))}
                style={[styles.docCard, selectMode && isSelected && styles.docCardSelected]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardCodeGroup}>
                    {selectMode ? (
                      isSelected ? (
                        <CheckSquare size={16} color={SDO_COLORS.navy} />
                      ) : (
                        <Square size={16} color={SDO_COLORS.textMuted} />
                      )
                    ) : null}
                    <Text style={styles.trackingCode}>{doc.trackingCode}</Text>
                  </View>
                  <SlaBadge state={doc.slaState} suffix={formatRelativeTime(doc.slaDueAt)} />
                </View>

                <Text style={styles.docTitle}>{doc.title}</Text>
                <Text style={styles.docSub}>
                  {`${formatHumanInboxStatus(doc, actor)} · ${TIER_LABEL[doc.confidentialityTier]}`}
                </Text>

                {!selectMode ? (
                  <View style={styles.cardActions}>
                    {inMyCustody ? (
                      <>
                        <Pressable
                          onPress={() => setForwardTargets([doc])}
                          style={styles.amberBtn}
                        >
                          <Text style={styles.amberBtnText}>Forward</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => openDocument(doc.id)}
                          style={styles.outlinePillBtn}
                        >
                          <Text style={styles.outlinePillText}>Open</Text>
                        </Pressable>
                      </>
                    ) : (
                      <Pressable
                        onPress={() => openDocument(doc.id)}
                        style={styles.outlinePillBtn}
                      >
                        <Text style={styles.outlinePillText}>Track Status</Text>
                      </Pressable>
                    )}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}

      {declineTarget ? (
        <ActionRemarksSheet
          open={Boolean(declineTarget)}
          mode="decline_misrouted"
          trackingCode={`From ${declineTarget.latestTransaction?.fromOffice.code ?? declineTarget.originOffice.code}`}
          onConfirm={(reason) => {
            declineMisrouted(declineTarget, reason).catch(() => {});
          }}
          onClose={() => setDeclineTarget(null)}
        />
      ) : null}

      {forwardTargets ? (
        <ForwardSheet
          open={Boolean(forwardTargets)}
          documents={forwardTargets}
          onForwarded={() => {
            setSelectedIds([]);
            setSelectMode(false);
          }}
          onClose={() => setForwardTargets(null)}
        />
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 14,
    backgroundColor: SDO_COLORS.bg,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  profilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 14,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: SDO_COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  profileTextWrap: {
    gap: 1,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  subGreeting: {
    fontSize: 11,
    color: SDO_COLORS.textSecondary,
  },
  menuBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBox: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: SDO_COLORS.textPrimary,
  },
  filterCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SDO_COLORS.amber,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
  },
  filterPanel: {
    gap: 6,
  },
  slaAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 16,
    backgroundColor: SDO_COLORS.amberSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  slaAlertLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  slaAlertText: {
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.amberText,
  },
  slaReviewChip: {
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  slaReviewText: {
    fontSize: 11,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  selectChipActive: {
    backgroundColor: SDO_COLORS.navy,
  },
  selectChipTextActive: {
    color: '#FFFFFF',
  },
  bulkBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 16,
    backgroundColor: SDO_COLORS.skySoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bulkSelectLink: {
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.navy,
  },
  bulkBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  bulkAmberBtn: {
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bulkAmberText: {
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  bulkOutlineBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.navy,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  bulkOutlineText: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  docCardSelected: {
    borderWidth: 1.5,
    borderColor: SDO_COLORS.navy,
  },
  cardCodeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subFilterChip: {
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  subFilterChipActive: {
    backgroundColor: SDO_COLORS.navy,
  },
  subFilterText: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  subFilterTextActive: {
    color: '#FFFFFF',
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
  pillTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  pillTabTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  trackCodeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.skySoft,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trackCodeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  seeAll: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  cardList: {
    gap: 12,
  },
  docCard: {
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 16,
    gap: 6,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  trackingCode: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: SDO_COLORS.textSecondary,
  },
  docTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
    lineHeight: 21,
  },
  docSub: {
    fontSize: 12,
    color: SDO_COLORS.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  amberBtn: {
    flex: 1,
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
  },
  amberBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  outlinePillBtn: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: SDO_COLORS.navy,
    backgroundColor: SDO_COLORS.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 13,
  },
  qrLockPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amberSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  qrLockPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.amberText,
  },
  outlinePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  emptyActionBtn: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
});
