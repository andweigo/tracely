import React, { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Bell, CheckCheck, Lock, UploadCloud } from 'lucide-react-native';
import { useAppServices } from '../../state/AppServiceContext';
import { OfflineStatusBadge } from '../components/Badges';
import { EmptyState } from '../components/EmptyState';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';
import { formatBytes, formatRelativeTime } from '../utils/formatters';

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
          accessibilityLabel="Back to inbox"
          style={styles.circleBtn}
        >
          <ArrowLeft size={18} color={SDO_COLORS.navyInk} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Alerts & Sync</Text>
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
          accessibilityLabel="Mark all notifications read"
          style={styles.circleBtn}
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
        <View style={styles.pillRow}>
          <Pressable
            onPress={() => setSubTab('alerts')}
            style={[styles.pillTab, subTab === 'alerts' && styles.pillTabActive]}
          >
            <View style={styles.tabLabelRow}>
              <Text style={[styles.pillText, subTab === 'alerts' && styles.pillTextActive]}>
                Alerts ({notifications.length})
              </Text>
              {unreadNotificationCount > 0 ? (
                <View style={styles.tabUnreadBadge}>
                  <Text style={styles.tabUnreadBadgeText}>
                    {unreadNotificationCount > 99 ? '99+' : `${unreadNotificationCount} new`}
                  </Text>
                </View>
              ) : null}
            </View>
          </Pressable>
          <Pressable
            onPress={() => setSubTab('offline_queue')}
            style={[styles.pillTab, subTab === 'offline_queue' && styles.pillTabActive]}
          >
            <Text
              style={[styles.pillText, subTab === 'offline_queue' && styles.pillTextActive]}
            >
              Offline Queue ({pendingOfflineCount})
            </Text>
          </Pressable>
        </View>

        {subTab === 'alerts' ? (
          <View style={styles.listGap}>
            <View style={styles.mintBanner}>
              <Lock size={14} color={SDO_COLORS.emeraldText} />
              <Text style={styles.mintBannerText}>
                Push alerts hide document titles on lock screens; details appear only after auth.
              </Text>
            </View>

            {notifications.length === 0 ? (
              <EmptyState
                icon={<Bell size={24} color={SDO_COLORS.textMuted} />}
                title="No new alerts"
                description="Routing updates and revision requests for your unit appear here."
              />
            ) : (
              notifications.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => handleOpenNotification(item.id, item.documentId)}
                  style={[styles.alertCard, !item.read && styles.alertCardUnread]}
                >
                  <View style={styles.rowBetween}>
                    <View style={styles.dotRow}>
                      {!item.read ? <View style={styles.unreadDot} /> : null}
                      <View style={[styles.statusBadge, !item.read && styles.statusBadgeUnread]}>
                        <Text
                          style={[
                            styles.statusBadgeText,
                            !item.read && styles.statusBadgeTextUnread,
                          ]}
                        >
                          {item.read ? 'Read' : 'Unread'}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.alertTime}>{formatRelativeTime(item.receivedAt)}</Text>
                  </View>
                  <Text style={styles.alertTitle}>{item.title}</Text>
                  <Text style={styles.alertContent}>{item.content}</Text>
                  <View style={styles.lockBox}>
                    <Text style={styles.lockBoxText}>
                      Lock-screen preview: {item.lockScreenPreview}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        ) : (
          <View style={styles.listGap}>
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineBannerText}>
                {isOnline
                  ? `Online · ${pendingOfflineCount} capture(s) pending sync.`
                  : `Offline. ${pendingOfflineCount} photo(s) waiting to upload.`}
              </Text>
              <Pressable
                disabled={isBusy}
                onPress={() => {
                  retryOfflineQueue().catch(() => {});
                }}
              >
                <Text style={styles.retryLink}>{isBusy ? 'Syncing...' : 'Retry now'}</Text>
              </Pressable>
            </View>

            {offlineQueue.length === 0 ? (
              <EmptyState
                icon={<UploadCloud size={24} color={SDO_COLORS.textMuted} />}
                title="Offline queue is empty"
                description="Photos snapped while offline queue here and sync automatically once connected."
              />
            ) : (
              offlineQueue.map((item) => (
                <View key={item.id} style={styles.alertCard}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.queueTitle}>{item.targetLabel}</Text>
                    <OfflineStatusBadge status={item.status} />
                  </View>
                  <Text style={styles.queueMeta}>
                    {item.fileName} · {formatBytes(item.compressedBytes)} (-
                    {item.compressionPercent}%) · EXIF stripped
                  </Text>
                  {item.lastError ? (
                    <Text style={styles.queueWarn}>{item.lastError}</Text>
                  ) : null}
                  <Text numberOfLines={1} style={styles.hashMono}>
                    sha256 {item.sha256Checksum}
                  </Text>
                </View>
              ))
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 16,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  headerBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: SDO_COLORS.rose,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  container: {
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 14,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pillTab: {
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surfaceSoft,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillTabActive: {
    backgroundColor: SDO_COLORS.navyInk,
  },
  pillText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '700',
    color: SDO_COLORS.textSecondary,
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  tabLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabUnreadBadge: {
    borderRadius: 999,
    backgroundColor: SDO_COLORS.rose,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tabUnreadBadgeText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  listGap: {
    gap: 10,
  },
  mintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.emeraldSoft,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mintBannerText: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: SDO_COLORS.emeraldText,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderRadius: 14,
    backgroundColor: SDO_COLORS.amberSoft,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  offlineBannerText: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: SDO_COLORS.amberText,
  },
  retryLink: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    fontWeight: '800',
    color: SDO_COLORS.amberText,
    textDecorationLine: 'underline',
  },
  alertCard: {
    borderRadius: 20,
    backgroundColor: SDO_COLORS.surfaceSoft,
    padding: 15,
    gap: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  alertCardUnread: {
    backgroundColor: SDO_COLORS.skySoft,
    borderColor: SDO_COLORS.skyBorder,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SDO_COLORS.rose,
  },
  statusBadge: {
    borderRadius: 999,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusBadgeUnread: {
    backgroundColor: SDO_COLORS.amber,
  },
  statusBadgeText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 10,
    fontWeight: '700',
    color: SDO_COLORS.textMuted,
  },
  statusBadgeTextUnread: {
    color: SDO_COLORS.navyInk,
    fontWeight: '800',
  },
  alertTime: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: SDO_COLORS.textMuted,
  },
  alertTitle: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 15,
    fontWeight: '800',
    color: SDO_COLORS.navyInk,
  },
  alertContent: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    color: SDO_COLORS.textPrimary,
  },
  lockBox: {
    borderRadius: 12,
    backgroundColor: SDO_COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  lockBoxText: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: SDO_COLORS.textSecondary,
  },
  queueTitle: {
    fontFamily: SDO_FONTS.sans,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: SDO_COLORS.textPrimary,
  },
  queueMeta: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 12,
    color: SDO_COLORS.textSecondary,
  },
  queueWarn: {
    fontFamily: SDO_FONTS.sans,
    fontSize: 11,
    color: SDO_COLORS.amberText,
  },
  hashMono: {
    fontSize: 10,
    fontFamily: SDO_FONTS.mono,
    color: SDO_COLORS.textMuted,
  },
});
