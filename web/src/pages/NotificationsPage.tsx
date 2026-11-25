import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  BellRing,
  CheckCheck,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { PrivacySafeNotification } from '../domain/types';
import { useWebApp } from '../state/WebAppContext';
import { isPendingReceiptForActor } from '../utils/sentFilter';

type NotificationFilter = 'all' | 'unread';

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

function groupNotificationsByDay(
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

function getNotificationTone(title: string, content: string): {
  bg: string;
  fg: string;
  icon: React.ReactNode;
} {
  const hay = `${title} ${content}`.toLowerCase();
  if (hay.includes('overdue') || hay.includes('stalled') || hay.includes('return') || hay.includes('declin')) {
    return { bg: '#FFF1F2', fg: '#BE123C', icon: <AlertTriangle size={15} /> };
  }
  if (hay.includes('approv') || hay.includes('complet') || hay.includes('receiv') || hay.includes('archiv')) {
    return { bg: '#ECFDF5', fg: '#047857', icon: <CheckCircle2 size={15} /> };
  }
  if (hay.includes('forward') || hay.includes('incoming') || hay.includes('sent') || hay.includes('route')) {
    return { bg: '#EFF6FF', fg: '#1D4ED8', icon: <ArrowRightLeft size={15} /> };
  }
  return { bg: '#F1F5F9', fg: '#334155', icon: <FileText size={15} /> };
}

export const NotificationsPage: React.FC = () => {
  const {
    actor,
    documents,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    markAllNotificationsRead,
    openDocument,
    openSealedDocumentAction,
    isBusy,
  } = useWebApp();

  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [permissionState, setPermissionState] = useState<string>(() =>
    typeof window !== 'undefined' && window.Notification ? window.Notification.permission : 'unsupported',
  );

  const visibleNotifications = useMemo(
    () => (filter === 'unread' ? notifications.filter((n) => !n.read) : notifications),
    [notifications, filter],
  );

  const dayGroups = useMemo(
    () => groupNotificationsByDay(visibleNotifications),
    [visibleNotifications],
  );

  const handleOpenNotification = (itemId: string, documentId: string) => {
    void markNotificationRead(itemId);
    const matchedDoc = documents.find((d) => d.id === documentId);
    if (matchedDoc && (isPendingReceiptForActor(matchedDoc, actor) || Boolean(matchedDoc.isSealed))) {
      openSealedDocumentAction(matchedDoc);
      return;
    }
    openDocument(documentId);
  };

  const handleRequestDeviceAlerts = async () => {
    if (typeof window === 'undefined' || !window.Notification) return;
    try {
      const next = await window.Notification.requestPermission();
      setPermissionState(next);
    } catch {
      // Ignore blocked permission dialog
    }
  };

  return (
    <div
      data-testid="web-notifications-center"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
        maxWidth: 780,
      }}
    >
      {/* Clean Notifications 1 Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            role="tablist"
            aria-label="Filter notifications"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: 3,
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              onClick={() => setFilter('all')}
              style={{
                border: 'none',
                borderRadius: 7,
                padding: '5px 12px',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                background: filter === 'all' ? 'var(--navy-ink)' : 'transparent',
                color: filter === 'all' ? '#FFFFFF' : 'var(--text-muted)',
              }}
            >
              All
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'unread'}
              onClick={() => setFilter('unread')}
              style={{
                border: 'none',
                borderRadius: 7,
                padding: '5px 12px',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: filter === 'unread' ? 'var(--navy-ink)' : 'transparent',
                color: filter === 'unread' ? '#FFFFFF' : 'var(--text-muted)',
              }}
            >
              <span>Unread</span>
              {unreadNotificationCount > 0 ? (
                <span
                  data-testid="web-alerts-unread-badge"
                  style={{
                    minWidth: 18,
                    height: 18,
                    padding: '0 5px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: filter === 'unread' ? 'rgba(255,255,255,0.2)' : 'var(--rose-soft)',
                    color: filter === 'unread' ? '#FFFFFF' : 'var(--rose-text)',
                  }}
                >
                  {unreadNotificationCount}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {permissionState === 'default' ? (
            <button
              type="button"
              className="btn btn-soft"
              style={{ minHeight: 34, padding: '6px 12px', fontSize: 12.5 }}
              onClick={() => void handleRequestDeviceAlerts()}
            >
              <BellRing size={14} /> Enable Alerts
            </button>
          ) : null}

          {unreadNotificationCount > 0 ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void markAllNotificationsRead()}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--navy)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 4px',
              }}
            >
              <CheckCheck size={15} /> Mark all read
            </button>
          ) : null}
        </div>
      </div>

      {/* Grouped-by-Day Notification Center */}
      {dayGroups.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrap">
            <Bell size={20} />
          </div>
          <h4 className="empty-title">
            {filter === 'unread' ? 'All caught up' : 'No notifications'}
          </h4>
          <p className="empty-desc">
            {filter === 'unread' ? 'No unread alerts right now.' : 'Updates appear here.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {dayGroups.map((group) => (
            <section
              key={group.key}
              aria-label={group.label}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  paddingLeft: 4,
                }}
              >
                {group.label}
              </div>

              <div
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 14,
                  background: 'var(--surface)',
                  overflow: 'hidden',
                }}
              >
                {group.items.map((item, idx) => {
                  const displayTitle = actor ? item.title : 'Tracely Alert';
                  const displayContent = actor ? item.content : item.lockScreenPreview;
                  const tone = getNotificationTone(displayTitle, displayContent);
                  const isLast = idx === group.items.length - 1;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleOpenNotification(item.id, item.documentId)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        borderBottom: isLast ? 'none' : '1px solid var(--border)',
                        background: item.read ? 'var(--surface)' : 'rgba(13, 52, 114, 0.03)',
                        padding: '13px 16px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        cursor: 'pointer',
                        transition: 'background 120ms ease',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          background: tone.bg,
                          color: tone.fg,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      >
                        {tone.icon}
                      </span>

                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span
                          style={{
                            fontSize: 13.5,
                            fontWeight: item.read ? 600 : 700,
                            color: 'var(--navy-ink)',
                            lineHeight: 1.35,
                          }}
                        >
                          {displayTitle}
                        </span>
                        <span
                          style={{
                            fontSize: 12.5,
                            color: 'var(--text-secondary)',
                            lineHeight: 1.4,
                          }}
                        >
                          {displayContent}
                        </span>
                      </span>

                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          flexShrink: 0,
                          paddingTop: 2,
                        }}
                      >
                        <span
                          className="tabular"
                          style={{
                            fontSize: 11.5,
                            fontWeight: 500,
                            color: 'var(--text-muted)',
                          }}
                        >
                          {formatCompactAgo(item.receivedAt)}
                        </span>
                        {!item.read ? (
                          <span
                            aria-label="Unread"
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: 999,
                              background: 'var(--navy)',
                              display: 'inline-block',
                            }}
                          />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};
