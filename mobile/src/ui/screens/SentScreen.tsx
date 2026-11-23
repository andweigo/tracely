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
  ArrowUpDown,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderKanban,
  Menu,
  Printer,
  QrCode,
  Search,
  Send,
  Undo2,
} from 'lucide-react-native';
import { Document } from '../../domain/entities/Document';
import { ConfidentialityTier } from '../../domain/enums/DomainEnums';
import { DocumentViewerBridge } from '../../domain/security/DocumentViewerBridge';
import { useAppServices } from '../../state/AppServiceContext';
import { CopyFormatBadge, SlaBadge } from '../components/Badges';
import { EmptyState } from '../components/EmptyState';
import { OpaqueQrModal } from '../sheets/OpaqueQrModal';
import { SDO_COLORS } from '../theme/tokens';
import { formatClockTime, formatCompactDate, formatRelativeTime } from '../utils/formatters';
import {
  filterAndSortSentDocuments,
  paginateSentItems,
  selectSentDocuments,
  SentDateFilter,
  SentSortMode,
  SentStatusFilter,
} from '../utils/sentFilter';

const STATUS_BADGE: Record<
  Exclude<SentStatusFilter, 'all'>,
  { label: string; bg: string; fg: string }
> = {
  pending: { label: 'Awaiting Receipt', bg: SDO_COLORS.amberSoft, fg: SDO_COLORS.amberText },
  acknowledged: { label: 'Received', bg: SDO_COLORS.emeraldSoft, fg: SDO_COLORS.emeraldText },
  returned: { label: 'Returned / Declined', bg: SDO_COLORS.roseSoft, fg: SDO_COLORS.roseText },
  recalled: { label: 'Recalled', bg: SDO_COLORS.surfaceSoft, fg: SDO_COLORS.textSecondary },
  local: { label: 'Held Locally', bg: SDO_COLORS.skySoft, fg: SDO_COLORS.navy },
};

const DATE_OPTIONS: ReadonlyArray<{ id: SentDateFilter; label: string }> = [
  { id: 'all', label: 'All Dates' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
];

const SORT_OPTIONS: ReadonlyArray<{ id: SentSortMode; label: string }> = [
  { id: 'newest', label: 'Newest' },
  { id: 'oldest', label: 'Oldest' },
  { id: 'status_pending', label: 'Pending First' },
  { id: 'title_asc', label: 'Title A–Z' },
  { id: 'title_desc', label: 'Title Z–A' },
  { id: 'tracking_code', label: 'Code' },
];

const SENT_ITEMS_PER_PAGE = 15;

export const SentScreen: React.FC = () => {
  const {
    actor,
    documents,
    openDocument,
    setActiveTab,
    openSidebar,
    recallTransfer,
    refreshWorkspace,
    notify,
    isRefreshing,
    isBusy,
  } = useAppServices();

  const [statusFilter, setStatusFilter] = useState<SentStatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<SentDateFilter>('all');
  const [sortMode, setSortMode] = useState<SentSortMode>('newest');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [qrDoc, setQrDoc] = useState<Document | null>(null);
  const [printingManifest, setPrintingManifest] = useState(false);

  const allSent = useMemo(() => selectSentDocuments(documents, actor), [documents, actor]);

  const counts = useMemo(() => {
    let pending = 0;
    let acknowledged = 0;
    let returned = 0;
    let recalled = 0;
    let local = 0;
    for (const item of allSent) {
      if (item.status === 'pending') pending += 1;
      else if (item.status === 'acknowledged') acknowledged += 1;
      else if (item.status === 'returned') returned += 1;
      else if (item.status === 'recalled') recalled += 1;
      else if (item.status === 'local') local += 1;
    }
    return { total: allSent.length, pending, acknowledged, returned, recalled, local };
  }, [allSent]);

  const filteredAndSorted = useMemo(
    () =>
      filterAndSortSentDocuments(allSent, {
        statusFilter,
        dateFilter,
        query,
        sortMode,
      }),
    [allSent, statusFilter, dateFilter, query, sortMode],
  );

  const pagination = useMemo(
    () => paginateSentItems(filteredAndSorted, page, SENT_ITEMS_PER_PAGE),
    [filteredAndSorted, page],
  );

  const handlePrintTransmittal = async () => {
    if (filteredAndSorted.length === 0 || printingManifest) return;
    setPrintingManifest(true);
    try {
      const docsToPrint = filteredAndSorted.map((item) => item.doc);
      const refCode = `TR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(docsToPrint.length).padStart(2, '0')}`;
      const ok = await DocumentViewerBridge.printTransmittalSheet({
        referenceCode: refCode,
        issuedDateLabel: formatCompactDate(new Date().toISOString()),
        originOfficeLabel: actor
          ? `${actor.office.code} — ${actor.office.name}`
          : `${docsToPrint[0].originOffice.code} — ${docsToPrint[0].originOffice.name}`,
        preparedBy: actor?.fullName ?? 'Desk Officer',
        verifyQrPayload: `TRC-QR:VERIFY:${docsToPrint[0].qrToken}`,
        items: filteredAndSorted.map((item) => ({
          trackingCode: item.doc.trackingCode,
          title: item.doc.title,
          categoryName: item.doc.categoryName,
          formatInfo: item.doc.isHardCopy
            ? item.doc.physicalPageCount
              ? `Hard (${item.doc.physicalPageCount}p)`
              : 'Hard Copy'
            : `Soft (${item.doc.versions.length}v)`,
          destinationLabel: item.recipientLabel,
          receivedLabel: item.latestOutboundTx?.acknowledgedByName
            ? `${item.latestOutboundTx.acknowledgedByName}`
            : undefined,
          isConfidential: item.doc.confidentialityTier === ConfidentialityTier.CONFIDENTIAL,
        })),
      });
      if (!ok) {
        notify('info', 'Android Print Service is unavailable on this device.');
      }
    } catch (err) {
      notify('error', err instanceof Error ? err.message : 'Unable to print transmittal sheet.');
    } finally {
      setPrintingManifest(false);
    }
  };

  const statusTabs: ReadonlyArray<{ id: SentStatusFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.total },
    { id: 'pending', label: 'Pending', count: counts.pending },
    { id: 'acknowledged', label: 'Received', count: counts.acknowledged },
    { id: 'returned', label: 'Returned', count: counts.returned },
    { id: 'recalled', label: 'Recalled', count: counts.recalled },
    { id: 'local', label: 'Local', count: counts.local },
  ];

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const start = Math.max(1, pagination.safePage - 1);
    const end = Math.min(pagination.totalPages, start + 2);
    for (let p = Math.max(1, end - 2); p <= end; p += 1) {
      pages.push(p);
    }
    return pages;
  }, [pagination.safePage, pagination.totalPages]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={() => refreshWorkspace().catch(() => {})} />
      }
    >
      <View style={styles.topHeader}>
        <View style={styles.headerCopy}>
          <Text style={styles.screenTitle}>Sent Files</Text>
          <Text style={styles.screenSub}>Track all files &amp; slips you dispatched</Text>
        </View>
        <Pressable
          onPress={openSidebar}
          accessibilityLabel="Open navigation sidebar"
          style={styles.menuBtn}
        >
          <Menu size={20} color={SDO_COLORS.navyInk} />
        </Pressable>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statTile}>
          <Text style={styles.statVal}>{counts.total}</Text>
          <Text style={styles.statLabel}>Total Sent</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={[styles.statVal, { color: SDO_COLORS.amberText }]}>{counts.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={[styles.statVal, { color: SDO_COLORS.emeraldText }]}>{counts.acknowledged}</Text>
          <Text style={styles.statLabel}>Received</Text>
        </View>
        <View style={styles.statTile}>
          <Text style={[styles.statVal, { color: SDO_COLORS.roseText }]}>{counts.returned}</Text>
          <Text style={styles.statLabel}>Returned</Text>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Search size={16} color={SDO_COLORS.textMuted} />
        <TextInput
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            setPage(1);
          }}
          placeholder="Search code, title, filename, recipient..."
          placeholderTextColor={SDO_COLORS.textMuted}
          accessibilityLabel="Search sent documents"
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        <View style={styles.dateIconWrap}>
          <Calendar size={12} color={SDO_COLORS.textSecondary} />
        </View>
        {DATE_OPTIONS.map((opt) => {
          const active = dateFilter === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => {
                setDateFilter(opt.id);
                setPage(1);
              }}
              style={[styles.sortChip, active && styles.sortChipActive]}
            >
              <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                {opt.label}
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
        {statusTabs.map((tab) => {
          const active = statusFilter === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => {
                setStatusFilter(tab.id);
                setPage(1);
              }}
              style={[styles.filterPill, active && styles.filterPillActive]}
            >
              <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                {`${tab.label} (${tab.count})`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sortBlock}>
        <View style={styles.sortHeader}>
          <View style={styles.sortLabelRow}>
            <ArrowUpDown size={13} color={SDO_COLORS.textSecondary} />
            <Text style={styles.sortLabel}>Sort</Text>
          </View>
          {filteredAndSorted.length > 0 ? (
            <Pressable
              disabled={printingManifest}
              onPress={() => {
                handlePrintTransmittal().catch(() => {});
              }}
              style={[styles.transmittalChip, printingManifest && styles.disabled]}
            >
              <Printer size={12} color={SDO_COLORS.navy} />
              <Text style={styles.transmittalChipText}>
                {printingManifest ? 'Printing...' : 'Transmittal Sheet'}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {SORT_OPTIONS.map((opt) => {
            const active = sortMode === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => {
                  setSortMode(opt.id);
                  setPage(1);
                }}
                style={[styles.sortChip, active && styles.sortChipActive]}
              >
                <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {pagination.pageItems.length === 0 ? (
        <EmptyState
          icon={<Send size={22} color={SDO_COLORS.navy} />}
          title={
            query.trim() || statusFilter !== 'all' || dateFilter !== 'all'
              ? 'No matching sent files'
              : 'No sent documents yet'
          }
          description={
            query.trim() || statusFilter !== 'all' || dateFilter !== 'all'
              ? 'Try clearing your search or switching the date or status filter.'
              : 'Documents and hard-copy QR slips you upload or dispatch appear here with live receipt status.'
          }
          action={
            <Pressable onPress={() => setActiveTab('send')} style={styles.ctaBtn}>
              <Send size={15} color={SDO_COLORS.navyInk} />
              <Text style={styles.ctaText}>Send Document</Text>
            </Pressable>
          }
        />
      ) : (
        <View style={styles.cardList} testID="mobile-sent-list">
          {pagination.pageItems.map((item) => {
            const { doc, status, statusSummary, sentAt, recipientLabel, canRecall } = item;
            const badge = STATUS_BADGE[status];
            const latestVersion = doc.latestVersionOrNull;

            return (
              <View key={doc.id} style={styles.docCard} testID={`mobile-sent-row-${doc.id}`}>
                <View style={styles.cardTop}>
                  <Text numberOfLines={1} style={styles.trackingMono}>
                    {doc.trackingCode}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.fg }]}>
                      {badge.label}
                    </Text>
                  </View>
                </View>

                <Text numberOfLines={2} style={styles.docTitle}>
                  {doc.title}
                </Text>

                <Text style={styles.statusSummaryText}>{statusSummary}</Text>

                <View style={styles.badgeRow}>
                  <CopyFormatBadge format={doc.copyFormat} />
                  <SlaBadge state={doc.slaState} suffix={formatRelativeTime(doc.slaDueAt)} />
                </View>

                <Text numberOfLines={1} style={styles.metaText}>
                  {`To: ${recipientLabel}`}
                </Text>
                <Text style={styles.metaSub}>
                  {`${doc.categoryName} · Sent ${formatCompactDate(sentAt)} ${formatClockTime(sentAt)}`}
                </Text>

                {latestVersion ? (
                  <View style={styles.fileRow}>
                    <FileText size={13} color={SDO_COLORS.navy} />
                    <Text numberOfLines={1} style={styles.fileText}>
                      {latestVersion.fileName}
                    </Text>
                  </View>
                ) : doc.physicalSummary ? (
                  <View style={styles.fileRow}>
                    <FolderKanban size={13} color={SDO_COLORS.amberText} />
                    <Text numberOfLines={1} style={styles.fileText}>
                      {doc.physicalSummary}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.actionRow}>
                  <Pressable onPress={() => openDocument(doc.id)} style={styles.openBtn}>
                    <Text style={styles.openBtnText}>Open</Text>
                  </Pressable>
                  <Pressable onPress={() => setQrDoc(doc)} style={styles.outlineBtn}>
                    <QrCode size={13} color={SDO_COLORS.navy} />
                    <Text style={styles.outlineBtnText}>QR Slip</Text>
                  </Pressable>
                  {canRecall ? (
                    <Pressable
                      disabled={isBusy}
                      onPress={() => {
                        recallTransfer(doc).catch(() => {});
                      }}
                      style={[styles.recallBtn, isBusy && styles.disabled]}
                    >
                      <Undo2 size={13} color={SDO_COLORS.roseText} />
                      <Text style={styles.recallBtnText}>Recall</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.paginationCard} testID="mobile-sent-pagination">
        <Text style={styles.paginationSummary}>
          {pagination.totalItems === 0
            ? 'Showing 0 of 0 sent files · Page 1 of 1'
            : `Showing ${pagination.startIndex}–${pagination.endIndex} of ${pagination.totalItems} sent files · Page ${pagination.safePage} of ${pagination.totalPages}`}
        </Text>
        <View style={styles.paginationControls}>
          <Pressable
            disabled={pagination.safePage <= 1}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            accessibilityLabel="Previous sent page"
            style={[styles.pageNavBtn, pagination.safePage <= 1 && styles.disabled]}
          >
            <ChevronLeft size={14} color={SDO_COLORS.navy} />
            <Text style={styles.pageNavText}>Prev</Text>
          </Pressable>

          {pageNumbers.map((num) => {
            const active = num === pagination.safePage;
            return (
              <Pressable
                key={num}
                onPress={() => setPage(num)}
                style={[styles.pageNumBtn, active && styles.pageNumBtnActive]}
              >
                <Text style={[styles.pageNumText, active && styles.pageNumTextActive]}>
                  {num}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            disabled={pagination.safePage >= pagination.totalPages}
            onPress={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            accessibilityLabel="Next sent page"
            style={[
              styles.pageNavBtn,
              pagination.safePage >= pagination.totalPages && styles.disabled,
            ]}
          >
            <Text style={styles.pageNavText}>Next</Text>
            <ChevronRight size={14} color={SDO_COLORS.navy} />
          </Pressable>
        </View>
      </View>

      {qrDoc ? (
        <OpaqueQrModal
          open={Boolean(qrDoc)}
          qrToken={qrDoc.qrToken}
          trackingCode={qrDoc.trackingCode}
          isHardCopy={qrDoc.isHardCopy}
          document={qrDoc}
          onClose={() => setQrDoc(null)}
        />
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 108,
    gap: 12,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  screenSub: {
    fontSize: 12,
    color: SDO_COLORS.textSecondary,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surface,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statTile: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.surface,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 2,
  },
  statVal: {
    fontSize: 17,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: SDO_COLORS.textMuted,
  },
  searchBar: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surface,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: SDO_COLORS.textPrimary,
    paddingVertical: 8,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 8,
  },
  filterPill: {
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surface,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterPillActive: {
    backgroundColor: SDO_COLORS.navy,
    borderColor: SDO_COLORS.navy,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  sortBlock: {
    gap: 8,
  },
  sortHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  sortLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sortLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  sortChip: {
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  sortChipActive: {
    backgroundColor: SDO_COLORS.skySoft,
    borderWidth: 1,
    borderColor: SDO_COLORS.navy,
  },
  sortChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  sortChipTextActive: {
    color: SDO_COLORS.navy,
  },
  cardList: {
    gap: 12,
  },
  docCard: {
    borderRadius: 18,
    backgroundColor: SDO_COLORS.surface,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    padding: 16,
    gap: 8,
    overflow: 'hidden',
  },
  cardTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  trackingMono: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: SDO_COLORS.navy,
    flexShrink: 1,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  docTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.textPrimary,
  },
  metaSub: {
    fontSize: 11,
    color: SDO_COLORS.textSecondary,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  fileText: {
    flex: 1,
    fontSize: 11.5,
    color: SDO_COLORS.textSecondary,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: SDO_COLORS.border,
  },
  openBtn: {
    flex: 1,
    minWidth: 92,
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  openBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  outlineBtn: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: SDO_COLORS.navy,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  outlineBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  recallBtn: {
    minHeight: 38,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.roseSoft,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  recallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.roseText,
  },
  paginationCard: {
    borderRadius: 16,
    backgroundColor: SDO_COLORS.surface,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    padding: 14,
    gap: 10,
    alignItems: 'center',
    overflow: 'hidden',
  },
  paginationSummary: {
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
    textAlign: 'center',
  },
  paginationControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pageNavBtn: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pageNavText: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  pageNumBtn: {
    minWidth: 34,
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumBtnActive: {
    backgroundColor: SDO_COLORS.navy,
    borderColor: SDO_COLORS.navy,
  },
  pageNumText: {
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  pageNumTextActive: {
    color: '#FFFFFF',
  },
  ctaBtn: {
    minHeight: 42,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  dateIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  statusSummaryText: {
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  transmittalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  transmittalChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  disabled: {
    opacity: 0.45,
  },
});
