import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Lock,
  MapPin,
  RotateCcw,
  Send,
} from 'lucide-react-native';
import { DocumentCopyFormat, DocumentLifecycleStatus } from '../../domain/enums/DomainEnums';
import type { DocumentTrackingSnapshot } from '../../domain/security/AccessPolicy';
import { SDO_COLORS } from '../theme/tokens';
import { CopyFormatBadge } from './Badges';
import { formatClockTime, formatCompactDate } from '../utils/formatters';

interface TrackingLocationCardProps {
  snapshot: DocumentTrackingSnapshot;
  onOpenDocument?: (documentId: string) => void;
  defaultExpanded?: boolean;
}

const ACTIVE_EXCLUDED_STATUSES: ReadonlySet<DocumentLifecycleStatus> = new Set([
  DocumentLifecycleStatus.APPROVED,
  DocumentLifecycleStatus.ARCHIVED,
]);

export function isCompletedTrackingStatus(status: DocumentLifecycleStatus): boolean {
  return ACTIVE_EXCLUDED_STATUSES.has(status);
}

/**
 * Expandable delivery-style document tracker card inspired by timeline logistics UIs,
 * carrying current office location, received timestamp, internal-office indicator,
 * and privacy-safe location-only redaction.
 */
export const TrackingLocationCard: React.FC<TrackingLocationCardProps> = ({
  snapshot,
  onOpenDocument,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const completed = isCompletedTrackingStatus(snapshot.lifecycleStatus);
  const isMasked = snapshot.visibility === 'location_only';

  const statusText = snapshot.receivedAt
    ? `Received · ${formatCompactDate(snapshot.receivedAt)} · ${formatClockTime(snapshot.receivedAt)}`
    : `Awaiting receipt · Sent ${formatClockTime(snapshot.lastUpdatedAt)}`;

  const renderNodeBadge = () => {
    if (completed) {
      return (
        <View style={[styles.nodeBadge, styles.nodeCompleted]}>
          <Check size={15} color="#FFFFFF" />
        </View>
      );
    }
    if (snapshot.lifecycleStatus === DocumentLifecycleStatus.RETURNED_FOR_REVISION) {
      return (
        <View style={[styles.nodeBadge, styles.nodeReturned]}>
          <RotateCcw size={14} color={SDO_COLORS.navyInk} />
        </View>
      );
    }
    if (snapshot.isInternalOfficeStage) {
      return (
        <View style={[styles.nodeBadge, styles.nodeActive]}>
          <Building2 size={14} color="#FFFFFF" />
        </View>
      );
    }
    if (snapshot.lifecycleStatus === DocumentLifecycleStatus.IN_REVIEW) {
      return (
        <View style={[styles.nodeBadge, styles.nodeActive]}>
          <FileCheck2 size={14} color="#FFFFFF" />
        </View>
      );
    }
    return (
      <View style={[styles.nodeBadge, styles.nodeActive]}>
        <Send size={14} color="#FFFFFF" />
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        accessibilityLabel={`Toggle timeline for ${snapshot.trackingCode}`}
        style={styles.summaryArea}
      >
        <View style={styles.topRow}>
          <View style={styles.codeRow}>
            <Text style={styles.trackingCode}>{snapshot.trackingCode}</Text>
            {snapshot.copyFormat !== DocumentCopyFormat.DIGITAL ? (
              <CopyFormatBadge format={snapshot.copyFormat} />
            ) : null}
            {snapshot.isInternalOfficeStage ? (
              <Text style={styles.internalPill}>INTERNAL DESK</Text>
            ) : null}
          </View>
          {expanded ? (
            <ChevronUp size={18} color={SDO_COLORS.textSecondary} />
          ) : (
            <ChevronDown size={18} color={SDO_COLORS.textSecondary} />
          )}
        </View>

        <Text style={[styles.title, completed && styles.titleMuted]}>
          {snapshot.displayTitle}
        </Text>

        <View style={styles.endpointRow}>
          <View style={styles.endpointCol}>
            <Text style={styles.endpointDate}>
              {formatCompactDate(snapshot.originTimestamp)} ·{' '}
              {formatClockTime(snapshot.originTimestamp)}
            </Text>
            <Text style={[styles.endpointCode, completed && styles.endpointCodeMuted]}>
              {snapshot.originOffice.code}
            </Text>
          </View>

          <View style={[styles.endpointCol, styles.endpointRight]}>
            <Text
              numberOfLines={1}
              style={[
                styles.endpointDate,
                snapshot.receivedAt ? styles.receivedTimeText : styles.pendingTimeText,
              ]}
            >
              {statusText}
            </Text>
            <Text style={[styles.endpointCode, completed && styles.endpointCodeMuted]}>
              {snapshot.isInternalOfficeStage
                ? `${snapshot.currentOffice.code} (Internal)`
                : snapshot.currentOffice.code}
            </Text>
          </View>
        </View>

        <View style={styles.railContainer}>
          <View style={styles.railLineBg} />
          <View
            style={[
              styles.railLineFill,
              completed
                ? styles.railFillDone
                : snapshot.isInternalOfficeStage
                  ? styles.railFillInternal
                  : styles.railFillTransit,
            ]}
          />
          <View style={styles.railEndpoints}>
            <View style={styles.railDotOrigin} />
            {completed ? (
              renderNodeBadge()
            ) : (
              <>
                <View
                  style={[
                    styles.centerIconSlot,
                    snapshot.isInternalOfficeStage && styles.internalIconSlot,
                  ]}
                >
                  {renderNodeBadge()}
                </View>
                <View style={styles.railDotDest} />
              </>
            )}
          </View>
        </View>

        <View style={styles.officeStrip}>
          <MapPin size={13} color={SDO_COLORS.navy} />
          <Text numberOfLines={1} style={styles.officeStripText}>
            In {snapshot.currentOffice.name}
            {snapshot.currentHolderName ? ` · ${snapshot.currentHolderName}` : ''}
          </Text>
          {isMasked ? <Lock size={12} color={SDO_COLORS.amberText} /> : null}
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.expandedPanel}>
          {snapshot.timelineEvents.map((ev, index) => {
            const isFirst = index === 0;
            const isLast = index === snapshot.timelineEvents.length - 1;
            const dotStyle =
              ev.state === 'active'
                ? styles.tlDotActive
                : ev.state === 'pending'
                  ? styles.tlDotPending
                  : styles.tlDotDone;

            return (
              <View key={ev.id} style={styles.tlRow}>
                <View style={styles.tlTimeCol}>
                  <Text style={styles.tlDate}>{formatCompactDate(ev.occurredAt)}</Text>
                  <Text style={styles.tlClock}>{formatClockTime(ev.occurredAt)}</Text>
                </View>

                <View style={styles.tlAxisCol}>
                  <View
                    style={[
                      styles.tlConnectorTop,
                      isFirst && styles.tlConnectorHidden,
                    ]}
                  />
                  <View style={[styles.tlDot, dotStyle]} />
                  <View
                    style={[
                      styles.tlConnectorBottom,
                      isLast && styles.tlConnectorHidden,
                    ]}
                  />
                </View>

                <View style={styles.tlEventCol}>
                  <Text style={styles.tlEventLabel}>{ev.label}</Text>
                  <Text style={styles.tlEventOffice}>{ev.officeName}</Text>
                </View>
              </View>
            );
          })}

          {isMasked || !snapshot.canOpenFullRecord ? (
            <View style={styles.maskedNotice}>
              <Lock size={13} color={SDO_COLORS.amberText} />
              <Text style={styles.maskedNoticeText}>
                Location visible only. Full document contents, internal desk remarks, and PDFs are
                restricted to Unit Head or named custodians.
              </Text>
            </View>
          ) : onOpenDocument ? (
            <Pressable
              onPress={() => onOpenDocument(snapshot.documentId)}
              style={styles.openBtn}
            >
              <Text style={styles.openBtnText}>Open Full Record</Text>
              <ArrowRight size={15} color={SDO_COLORS.navyInk} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

interface TrackingGroupedListProps {
  snapshots: ReadonlyArray<DocumentTrackingSnapshot>;
  onOpenDocument?: (documentId: string) => void;
  expandSingleItem?: boolean;
}

/**
 * Shared Active vs Completed grouped tracking list used in both Inbox and TrackDocumentSheet.
 */
export const TrackingGroupedList: React.FC<TrackingGroupedListProps> = ({
  snapshots,
  onOpenDocument,
  expandSingleItem = true,
}) => {
  const active = snapshots.filter((s) => !isCompletedTrackingStatus(s.lifecycleStatus));
  const completed = snapshots.filter((s) => isCompletedTrackingStatus(s.lifecycleStatus));
  const autoExpandFirst = expandSingleItem && active.length === 1;

  return (
    <View style={styles.groupedWrap}>
      {active.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.activeSectionTitle}>Active Routing ({active.length})</Text>
          {active.map((snap, idx) => (
            <TrackingLocationCard
              key={snap.documentId}
              snapshot={snap}
              onOpenDocument={onOpenDocument}
              defaultExpanded={autoExpandFirst && idx === 0}
            />
          ))}
        </View>
      ) : null}

      {completed.length > 0 ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.completedSectionTitle}>Previous Documents ({completed.length})</Text>
          {completed.map((snap) => (
            <TrackingLocationCard
              key={snap.documentId}
              snapshot={snap}
              onOpenDocument={onOpenDocument}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  groupedWrap: {
    gap: 16,
  },
  sectionBlock: {
    gap: 10,
  },
  activeSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navy,
  },
  completedSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.textMuted,
  },
  card: {
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 16,
    gap: 12,
    overflow: 'hidden',
  },
  summaryArea: {
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  codeRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  trackingCode: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: SDO_COLORS.textMuted,
  },
  internalPill: {
    fontSize: 9,
    fontWeight: '800',
    color: SDO_COLORS.navy,
    backgroundColor: SDO_COLORS.skySoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
    lineHeight: 21,
  },
  titleMuted: {
    color: SDO_COLORS.textSecondary,
  },
  endpointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 2,
  },
  endpointCol: {
    flex: 1,
    gap: 2,
  },
  endpointRight: {
    alignItems: 'flex-end',
  },
  endpointDate: {
    fontSize: 10,
    fontWeight: '600',
    color: SDO_COLORS.textMuted,
  },
  receivedTimeText: {
    color: SDO_COLORS.emeraldText,
  },
  pendingTimeText: {
    color: SDO_COLORS.amberText,
  },
  endpointCode: {
    fontSize: 14,
    fontWeight: '800',
    color: SDO_COLORS.navy,
  },
  endpointCodeMuted: {
    color: SDO_COLORS.textSecondary,
  },
  railContainer: {
    height: 36,
    justifyContent: 'center',
    position: 'relative',
  },
  railLineBg: {
    position: 'absolute',
    left: 6,
    right: 6,
    height: 2,
    backgroundColor: '#CBD5E1',
  },
  railLineFill: {
    position: 'absolute',
    left: 6,
    height: 2,
    backgroundColor: SDO_COLORS.navy,
  },
  railFillInternal: {
    width: '36%',
  },
  railFillTransit: {
    width: '50%',
  },
  railFillDone: {
    right: 6,
    backgroundColor: SDO_COLORS.emerald,
  },
  railEndpoints: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  railDotOrigin: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#94A3B8',
  },
  railDotDest: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#94A3B8',
  },
  centerIconSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  internalIconSlot: {
    marginRight: '26%',
  },
  nodeBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeActive: {
    backgroundColor: SDO_COLORS.navy,
  },
  nodeReturned: {
    backgroundColor: SDO_COLORS.amber,
  },
  nodeCompleted: {
    backgroundColor: SDO_COLORS.emerald,
  },
  officeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 2,
  },
  officeStripText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  expandedPanel: {
    borderRadius: 16,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  tlRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 48,
  },
  tlTimeCol: {
    width: 78,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 8,
    paddingVertical: 4,
  },
  tlDate: {
    fontSize: 11,
    fontWeight: '700',
    color: SDO_COLORS.textPrimary,
  },
  tlClock: {
    fontSize: 10,
    color: SDO_COLORS.textMuted,
  },
  tlAxisCol: {
    width: 22,
    alignItems: 'center',
  },
  tlConnectorTop: {
    flex: 1,
    width: 2,
    backgroundColor: SDO_COLORS.navy,
  },
  tlConnectorBottom: {
    flex: 1,
    width: 2,
    backgroundColor: SDO_COLORS.navy,
  },
  tlConnectorHidden: {
    backgroundColor: 'transparent',
  },
  tlDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tlDotDone: {
    backgroundColor: SDO_COLORS.navy,
  },
  tlDotActive: {
    backgroundColor: SDO_COLORS.emerald,
  },
  tlDotPending: {
    backgroundColor: SDO_COLORS.amber,
  },
  tlEventCol: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 8,
    paddingVertical: 4,
    gap: 1,
  },
  tlEventLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  tlEventOffice: {
    fontSize: 11,
    color: SDO_COLORS.textSecondary,
  },
  maskedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 12,
    backgroundColor: SDO_COLORS.amberSoft,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 4,
  },
  maskedNoticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    color: SDO_COLORS.amberText,
  },
  openBtn: {
    minHeight: 40,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.amber,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  openBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
});
