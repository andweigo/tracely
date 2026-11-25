import React, { useMemo, useState } from 'react';
import { Bell, BellRing, CheckCheck } from 'lucide-react';
import { useWebApp } from '../state/WebAppContext';
import { paginateList, PaginationBar } from '../components/PaginationBar';
import { formatClockTime, formatCompactDate } from '../utils/formatters';

import { isPendingReceiptForActor } from '../utils/sentFilter';

const NOTIFICATIONS_PER_PAGE = 12;

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

  const handleOpenNotification = (itemId: string, documentId: string) => {
    void markNotificationRead(itemId);
    const matchedDoc = documents.find((d) => d.id === documentId);
    if (matchedDoc && (isPendingReceiptForActor(matchedDoc, actor) || Boolean(matchedDoc.isSealed))) {
      openSealedDocumentAction(matchedDoc);
      return;
    }
    openDocument(documentId);
  };

  const [page, setPage] = useState(1);
  const [permissionState, setPermissionState] = useState<string>(() =>
    typeof window !== 'undefined' && window.Notification ? window.Notification.permission : 'unsupported',
  );

  const pagedNotifications = useMemo(
    () => paginateList(notifications, page, NOTIFICATIONS_PER_PAGE),
    [notifications, page],
  );

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="section-header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <h3 className="section-title">Notifications</h3>
          {unreadNotificationCount > 0 ? (
            <span data-testid="web-alerts-unread-badge" className="pill pill-rose">
              {unreadNotificationCount} unread
            </span>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {permissionState === 'default' ? (
            <button
              type="button"
              className="btn btn-soft"
              onClick={() => void handleRequestDeviceAlerts()}
            >
              <BellRing size={15} /> Enable Alerts
            </button>
          ) : null}

          {unreadNotificationCount > 0 ? (
            <button
              type="button"
              className="btn btn-outline"
              disabled={isBusy}
              onClick={() => void markAllNotificationsRead()}
            >
              <CheckCheck size={15} /> Mark All Read
            </button>
          ) : null}
        </div>
      </div>

      {notifications.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon-wrap">
            <Bell size={22} />
          </div>
          <h4 className="empty-title">No Alerts Yet</h4>
          <p className="empty-desc">Document updates and reminders will appear here.</p>
        </div>
      ) : (
        <div className="notifications-grid">
          {pagedNotifications.pageItems.map((item) => {
            const displayTitle = actor ? item.title : 'Tracely Alert';
            const displayContent = actor ? item.content : item.lockScreenPreview;

            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                className="doc-card"
                onClick={() => handleOpenNotification(item.id, item.documentId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleOpenNotification(item.id, item.documentId);
                  }
                }}
                style={{
                  borderColor: item.read ? 'var(--border)' : 'var(--sky-border)',
                  background: item.read ? 'var(--surface)' : 'var(--sky-soft)',
                }}
              >
                <div className="doc-card-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {!item.read ? <span className="pill pill-amber">Unread</span> : null}
                  </div>
                  <span className="tabular" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {formatCompactDate(item.receivedAt)} {formatClockTime(item.receivedAt)}
                  </span>
                </div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--navy-ink)' }}>
                  {displayTitle}
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--text-secondary)' }}>
                  {displayContent}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PaginationBar
        totalItems={notifications.length}
        page={pagedNotifications.safePage}
        pageSize={NOTIFICATIONS_PER_PAGE}
        itemLabel="notifications"
        onPageChange={setPage}
        testId="web-notifications-pagination"
      />
    </div>
  );
};
