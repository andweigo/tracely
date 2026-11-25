import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRightLeft,
  Bell,
  CheckCheck,
  CheckCircle2,
  FileText,
  UploadCloud,
} from 'lucide-react-native';
import { PrivacySafeNotification } from '../../repositories/contracts/IDocumentRepository';
import { useAppServices } from '../../state/AppServiceContext';
import { OfflineStatusBadge } from '../components/Badges';
import { EmptyState } from '../components/EmptyState';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';
import { formatBytes } from '../utils/formatters';

type AlertFilter = 'all' | 'unread';

interface NotificationDayGroup {
  readonly key: string;
  readonly label: string;
  readonly items: ReadonlyArray<PrivacySafeNotification>;
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function startOfDayMs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatCompactAgo(iso: string): string {
  const ts = new Date(iso).getTime();
  if (!Number.isFinite(ts)) return '';
  const diffMin = Math.max(0, Math.floor((Date.now() - ts) / 60_000));
  if (diffMin < 1) return 'Now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const d = new Date(ts);
  return `${SHORT_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function groupByDay(
  items: ReadonlyArray<PrivacySafeNotification>,
): ReadonlyArray<NotificationDayGroup> {
  const now = new Date();
  const todayMs = startOfDayMs(now);
  const yesterdayMs = todayMs - 86_400_000;
  const weekCutoffMs = todayMs - 6 * 86_400_000;

  const map = new Map<string, { label: string; items: PrivacySafeNotification[] }>();

  for (const item of items) {
    const parsed = new Date(item.receivedAt);
    const dayMs = Number.isNaN(parsed.getTime()) ? 0 : startOfDayMs(parsed);

    let key: string;
    let label: string;
    if (dayMs >= todayMs) {
      key = 'today';
      label = 'Today';
    } else if (dayMs >= yesterdayMs) {
      key = 'yesterday';
      label = 'Yesterday';
    } else if (dayMs >= weekCutoffMs) {
      key = `day-${dayMs}`;
      label = `${SHORT_MONTHS[parsed.getMonth()]} ${parsed.getDate()}`;
    } else {
      key = 'earlier';
      label = 'Earlier';
    }

    const bucket = map.get(key) ?? { label, items: [] };
    bucket.items.push(item);
    map.set(key, bucket);
  }

  return Array.from(map.entries()).map(([key, value]) => ({
    key,
    label: value.label,
    items: value.items,
  }));
}

function getTone(title: string, content: string): {
  bg: string;
  fg: string;
  kind: 'alert' | 'done' | 'route' | 'doc';
} {
  const hay = `${title} ${content}`.toLowerCase();
  if (hay.includes('overdue') || hay.includes('stalled') || hay.includes('return') || hay.includes('declin')) {
    return { bg: '#FFF1F2', fg: '#BE123C', kind: 'alert' };
  }
  if (hay.includes('approv') || hay.includes('complet') || hay.includes('receiv') || hay.includes('archiv')) {
    return { bg: '#ECFDF5', fg: '#047857', kind: 'done' };
  }
  if (hay.includes('forward') || hay.includes('incoming') || hay.includes('sent') || hay.includes('route')) {
    return { bg: '#EFF6FF', fg: '#1D4ED8', kind: 'route' };
  }
  return { bg: '#F1F5F9', fg: '#334155', kind: 'doc' };
}

export const NotificationsScreen: React.FC = () => {
  const {
    actor,
    documents,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    openDocument,
    openScannerForDocument,
    offlineQueue,
    pendingOfflineCount,
    retryOfflineQueue,
    refreshWorkspace,
    isRefreshing,
    isBusy,
    isOnline,
    goBack,
  } = useAppServices();

  const [subTab, setSubTab] = useState<'alerts' | 'offline_queue'>('alerts');
  const [filter, setFilter] = useState<AlertFilter>('all');

  const visibleAlerts = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.read) : notifications),
    [notifications, filter],
  );

  const dayGroups = useMemo(() => groupByDay(visibleAlerts), [visibleAlerts]);

  const handleOpenNotification = (notifId: string, documentId: string) => {
    markNotificationRead(notifId).catch(() => {});
    const matchedDoc = documents.find((d) => d.id === documentId);
    if (
      matchedDoc &&
      (matchedDoc.isSealed || Boolean(actor && matchedDoc.latestTransaction?.canBeAcknowledgedBy(actor)))
    ) {
      openScannerForDocument(matchedDoc, true);
      return;
    }
    openDocument(documentId);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topHeader}>
        <Pressable
          onPress={() => goBack()}
          accessibilityLabel="Back"
          style={styles.circleBtn}
        >
          <ArrowLeft size={18} color={SDO_COLORS.navyInk} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadNotificationCount > 0 ? (
            <View testID="alerts-header-badge" style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>
                {unreadNotificationCount > 99 ? '99+' : String(unreadNotificationCount)}
              </Text>
            </View>
          ) : null}
        </View>

        <Pressable
          disabled={isBusy || unreadNotificationCount === 0}
          onPress={() => {
            markAllNotificationsRead().catch(() => {});
          }}
          accessibilityLabel="Mark all read"
          style={[styles.circleBtn, unreadNotificationCount === 0 && styles.circleBtnMuted]}
        >
          <CheckCheck size={18} color={SDO_COLORS.navyInk} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refreshWorkspace} />
        }
      >
        <View style={styles.filterBar}>
          <View style={styles.segmented}>
            <Pressable
              onPress={() => {
                setSubTab('alerts');
                setFilter('all');
              }}
              style={[
                styles.segBtn,
                subTab === 'alerts' && filter === 'all' && styles.segBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.segText,
                  subTab === 'alerts' && filter === 'all' && styles.segTextActive,
                ]}
              >
                All
              </Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setSubTab('alerts');
                setFilter('unread');
              }}
              style={[
                styles.segBtn,
                subTab === 'alerts' && filter === 'unread' && styles.segBtnActive,
              ]}
            >
              <Text
                style={[
                  styles.segText,
                  subTab === 'alerts' && filter === 'unread' && styles.segTextActive,
                ]}
              >
                Unread{unreadNotificationCount > 0 ? ` (${unreadNotificationCount})` : ''}
              </Text>
            </Pressable>

            {pendingOfflineCount > 0 || offlineQueue.length > 0 ? (
              <Pressable
                onPress={() => setSubTab('offline_queue')}
                style={[styles.segBtn, subTab === 'offline_queue' && styles.segBtnActive]}
              >
                <Text
                  style={[
                    styles.segText,
                    subTab === 'offline_queue' && styles.segTextActive,
                  ]}
                >
                  Offline ({pendingOfflineCount})
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {subTab === 'alerts' ? (
          dayGroups.length === 0 ? (
            <EmptyState
              icon={<Bell size={22} color={SDO_COLORS.textMuted} />}
              title={filter === 'unread' ? 'All caught up' : 'No notifications'}
              description={filter === 'unread' ? 'No unread alerts right now.' : 'Updates appear here.'}
            />
          ) : (
            <View style={styles.groupsWrap}>
              {dayGroups.map((group) => (
                <View key={group.key} style={styles.dayGroup}>
                  <Text style={styles.dayLabel}>{group.label}</Text>

                  <View style={styles.groupCard}>
                    {group.items.map((item, idx) => {
                      const title = actor ? item.title : 'Tracely Alert';
                      const content = actor ? item.content : item.lockScreenPreview;
                      const tone = getTone(title, content);
                      const isLast = idx === group.items.length - 1;

                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => handleOpenNotification(item.id, item.documentId)}
                          style={[
                            styles.notifRow,
                            !item.read && styles.notifRowUnread,
                            !isLast && styles.notifRowBorder,
                          ]}
                        >
                          <View style={[styles.iconBox, { backgroundColor: tone.bg }]}>
                            {tone.kind === 'alert' ? (
                              <AlertTriangle size={15} color={tone.fg} />
                            ) : tone.kind === 'done' ? (
                              <CheckCircle2 size={15} color={tone.fg} />
                            ) : tone.kind === 'route' ? (
                              <ArrowRightLeft size={15} color={tone.fg} />
                            ) : (
                              <FileText size={15} color={tone.fg} />
                            )}
                          </View>

                          <View style={styles.notifBody}>
                            <Text
                              style={[styles.notifTitle, !item.read && styles.notifTitleUnread]}
                              numberOfLines={1}
                            >
                              {title}
                            </Text>
                            <Text style={styles.notifContent} numberOfLines={2}>
                              {content}
                            </Text>
                          </View>

                          <View style={styles.notifMeta}>
                            <Text style={styles.notifTime}>{formatCompactAgo(item.receivedAt)}</Text>
                            {!item.read ? <View style={styles.unreadDot} /> : null}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )
        ) : (
          <View style={styles.groupsWrap}>
            <View style={styles.offlineBar}>
              <Text style={styles.offlineText}>
                {isOnline
                  ? `${pendingOfflineCount} pending sync`
                  : `Offline · ${pendingOfflineCount} waiting`}
              </Text>
              <Pressable
                disabled={isBusy}
                onPress={() => {
                  retryOfflineQueue().catch(() => {});
                }}
              >
                <Text style={styles.retryText}>{isBusy ? 'Syncing…' : 'Sync now'}</Text>
              </Pressable>
            </View>

            {offlineQueue.length === 0 ? (
              <EmptyState
                icon={<UploadCloud size={22} color={SDO_COLORS.textMuted} />}
                title="Queue empty"
                description="Offline photos sync here automatically."
              />
            ) : (
              <View style={styles.groupCard}>
                {offlineQueue.map((item, idx) => (
                  <View
                    key={item.id}
                    style={[styles.queueRow, idx < offlineQueue.length - 1 && styles.notifRowBorder]}
                  >
                    <View style={styles.queueTop}>
                      <Text style={styles.notifTitleUnread}>{item.targetLabel}</Text>
                      <OfflineStatusBadge status={item.status} />
                    </View>
                    <Text style={styles.notifContent}>
                      {item.fileName} · {formatBytes(item.compressedBytes)}
                    </Text>
                    {item.lastError ? <Text style={styles.queueWarn}>{item.lastError}</Text> : null}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
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
    paddingVertical: 10,
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBtnMuted: {
    opacity: 0.4,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 16,
    fontWeight: '700',
    color: SDO_COLORS.navyInk,
  },
  headerBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: SDO_COLORS.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  container: {
    paddingHorizontal: 18,
    paddingBottom: 28,
    gap: 16,
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: SDO_COLORS.surface,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  segBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
  },
  segBtnActive: {
    backgroundColor: SDO_COLORS.navyInk,
  },
  segText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
  },
  segTextActive: {
    color: '#FFFFFF',
  },
  groupsWrap: {
    gap: 18,
  },
  dayGroup: {
    gap: 8,
  },
  dayLabel: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    color: SDO_COLORS.textMuted,
    paddingLeft: 4,
  },
  groupCard: {
    backgroundColor: SDO_COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    overflow: 'hidden',
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: SDO_COLORS.surface,
  },
  notifRowUnread: {
    backgroundColor: 'rgba(13, 52, 114, 0.035)',
  },
  notifRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: SDO_COLORS.border,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  notifBody: {
    flex: 1,
    gap: 2,
  },
  notifTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13.5,
    fontWeight: '600',
    color: SDO_COLORS.navyInk,
  },
  notifTitleUnread: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13.5,
    fontWeight: '700',
    color: SDO_COLORS.navyInk,
  },
  notifContent: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    lineHeight: 17,
    color: SDO_COLORS.textSecondary,
  },
  notifMeta: {
    alignItems: 'flex-end',
    gap: 6,
    paddingTop: 2,
  },
  notifTime: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '500',
    color: SDO_COLORS.textMuted,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: SDO_COLORS.navy,
  },
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: SDO_COLORS.surface,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
  },
  offlineText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
  },
  retryText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12.5,
    fontWeight: '700',
    color: SDO_COLORS.navy,
  },
  queueRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  queueTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  queueWarn: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.rose,
  },
});
