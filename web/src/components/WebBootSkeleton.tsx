import React from 'react';
import { WebRoute } from '../domain/types';

export interface WebBootSkeletonProps {
  variant?: WebRoute;
  'data-testid'?: string;
}

const SkeletonBox: React.FC<{
  width?: number | string;
  height: number | string;
  radius?: number | string;
  className?: string;
}> = ({ width = '100%', height, radius = 8, className = '' }) => (
  <div
    className={`skel ${className}`.trim()}
    style={{ width, height, borderRadius: radius }}
  />
);

/**
 * First-render layout skeleton tailored to every Web screen using authentic app.css grids.
 * Shown once on a screen's initial open (or boot hydration), and never displayed again once opened.
 */
export const WebBootSkeleton: React.FC<WebBootSkeletonProps> = ({
  variant = 'inbox',
  'data-testid': testId = variant === 'inbox' ? 'web-boot-skeleton' : `web-skeleton-${variant}`,
}) => {
  if (variant === 'login' || variant === 'pending_approval') {
    return (
      <div
        data-testid={testId}
        className="auth-page"
        aria-busy="true"
        aria-label="Loading sign in"
      >
        <div className="auth-card skel-card" style={{ gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SkeletonBox width={46} height={46} radius={14} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SkeletonBox width="52%" height={18} />
              <SkeletonBox width="78%" height={12} />
            </div>
          </div>
          <SkeletonBox height={42} radius={999} />
          <SkeletonBox height={44} radius={14} />
          <SkeletonBox height={44} radius={14} />
          <SkeletonBox height={44} radius={999} />
        </div>
      </div>
    );
  }

  if (variant === 'send') {
    return (
      <div
        data-testid={testId}
        className="send-workspace"
        aria-busy="true"
        aria-label="Loading send document"
      >
        <div className="send-main">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <SkeletonBox height={42} radius={999} />
            <SkeletonBox width="38%" height={13} />
            <SkeletonBox height={44} radius={14} />
            <SkeletonBox width="34%" height={13} />
            <SkeletonBox height={44} radius={14} />
            <SkeletonBox height={116} radius={16} />
          </div>
        </div>
        <aside className="send-aside">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SkeletonBox width="54%" height={16} />
            <SkeletonBox height={44} radius={14} />
            <SkeletonBox height={86} radius={14} />
            <SkeletonBox height={44} radius={999} />
          </div>
        </aside>
      </div>
    );
  }

  if (variant === 'document') {
    return (
      <div
        data-testid={testId}
        className="dashboard-grid"
        aria-busy="true"
        aria-label="Loading document detail"
      >
        <div className="dashboard-left">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <SkeletonBox width={150} height={14} />
              <SkeletonBox width={96} height={22} radius={999} />
            </div>
            <SkeletonBox width="62%" height={22} />
            <SkeletonBox width="45%" height={13} />
            <div style={{ display: 'flex', gap: 10 }}>
              <SkeletonBox width={140} height={38} radius={999} />
              <SkeletonBox width={120} height={38} radius={999} />
            </div>
          </div>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SkeletonBox width="40%" height={16} />
            {[0, 1, 2].map((idx) => (
              <SkeletonBox key={idx} height={58} radius={14} />
            ))}
          </div>
        </div>
        <aside className="dashboard-right">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <SkeletonBox width="48%" height={16} />
            {[0, 1, 2].map((idx) => (
              <SkeletonBox key={idx} height={46} radius={12} />
            ))}
          </div>
        </aside>
      </div>
    );
  }

  if (variant === 'track' || variant === 'sent') {
    return (
      <div
        data-testid={testId}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        aria-busy="true"
        aria-label={variant === 'sent' ? 'Loading sent files' : 'Loading document tracking'}
      >
        <div className="search-filter-row">
          <div className="skel skel-search" />
          <div className="skel skel-filter-btn" style={{ width: 126 }} />
        </div>
        <div className="tab-scroll-row">
          <div className="skel skel-tab skel-tab-wide" />
          <div className="skel skel-tab" />
          <div className="skel skel-tab" />
        </div>
        <div className="card-list">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="doc-card skel-card" style={{ cursor: 'default' }}>
              <div className="doc-card-top">
                <SkeletonBox width={150} height={12} />
                <SkeletonBox width={76} height={20} radius={999} />
              </div>
              <SkeletonBox width="70%" height={16} />
              <SkeletonBox width="52%" height={12} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'categories') {
    return (
      <div
        data-testid={testId}
        style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
        aria-busy="true"
        aria-label="Loading categories"
      >
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SkeletonBox width="38%" height={18} />
          <SkeletonBox width="68%" height={12} />
          <div style={{ display: 'flex', gap: 10 }}>
            <SkeletonBox height={42} radius={14} />
            <SkeletonBox width={132} height={42} radius={999} />
          </div>
        </div>
        <div className="category-grid">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="card skel-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SkeletonBox width={72} height={20} radius={999} />
              <SkeletonBox width="78%" height={16} />
              <SkeletonBox width="55%" height={12} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'alerts') {
    return (
      <div
        data-testid={testId}
        className="notifications-grid"
        aria-busy="true"
        aria-label="Loading alerts"
      >
        <div className="card-list">
          <div className="section-header-row">
            <SkeletonBox width={180} height={18} />
            <SkeletonBox width={118} height={32} radius={999} />
          </div>
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className="doc-card skel-card" style={{ cursor: 'default' }}>
              <div className="doc-card-top">
                <SkeletonBox width={110} height={12} />
                <SkeletonBox width={68} height={12} />
              </div>
              <SkeletonBox width="84%" height={15} />
              <SkeletonBox width="60%" height={12} />
            </div>
          ))}
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SkeletonBox width="52%" height={16} />
          <SkeletonBox height={52} radius={14} />
          <SkeletonBox height={52} radius={14} />
        </div>
      </div>
    );
  }

  if (variant === 'profile' || variant === 'user_profile') {
    return (
      <div
        data-testid={testId}
        className="profile-grid"
        aria-busy="true"
        aria-label={variant === 'user_profile' ? 'Loading user profile' : 'Loading profile'}
      >
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SkeletonBox width={52} height={52} radius={999} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <SkeletonBox width="58%" height={18} />
              <SkeletonBox width="42%" height={12} />
            </div>
          </div>
          <SkeletonBox height={46} radius={14} />
          <SkeletonBox height={46} radius={14} />
        </div>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SkeletonBox width="44%" height={16} />
          <SkeletonBox height={44} radius={14} />
          <SkeletonBox height={44} radius={999} />
          <SkeletonBox height={44} radius={14} />
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      className="dashboard-grid"
      aria-busy="true"
      aria-label="Loading workspace"
    >
      <div className="dashboard-left">
        <div className="search-filter-row">
          <div className="skel skel-search" />
          <div className="skel skel-filter-btn" />
        </div>

        <div className="tab-scroll-row">
          <div className="skel skel-tab skel-tab-wide" />
          <div className="skel skel-tab" />
          <div className="skel skel-tab" />
          <div className="skel skel-tab" />
          <div className="skel skel-tab" />
        </div>

        <div className="section-header-row" style={{ marginTop: 2 }}>
          <SkeletonBox width={156} height={18} />
          <SkeletonBox width={120} height={28} radius={999} />
        </div>

        <div className="card-list">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="doc-card skel-card" style={{ cursor: 'default' }}>
              <div className="doc-card-top">
                <SkeletonBox width={140} height={12} radius={6} />
                <SkeletonBox width={88} height={20} radius={999} />
              </div>
              <SkeletonBox width="78%" height={16} radius={7} />
              <SkeletonBox width="48%" height={12} radius={6} />
              <div className="doc-actions" style={{ marginTop: 8 }}>
                <div className="skel doc-actions-primary" style={{ height: 36, borderRadius: 999 }} />
                <SkeletonBox width={92} height={36} radius={999} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="dashboard-right">
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SkeletonBox width={140} height={14} radius={6} />
          <div className="workload-grid">
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} className="workload-tile" style={{ gap: 6 }}>
                <SkeletonBox width={32} height={20} radius={6} />
                <SkeletonBox width={78} height={11} radius={5} />
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SkeletonBox width="58%" height={14} radius={6} />
          <SkeletonBox width="90%" height={11} radius={5} />
          <SkeletonBox height={36} radius={999} />
        </div>
      </aside>
    </div>
  );
};
