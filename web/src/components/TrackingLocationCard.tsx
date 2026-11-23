import React, { useState } from 'react';
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
} from 'lucide-react';
import { DocumentLifecycleStatus, DocumentTrackingSnapshot } from '../domain/types';
import { formatClockTime, formatCompactDate } from '../utils/formatters';
import { CopyFormatBadge } from './Badges';

interface TrackingLocationCardProps {
  readonly snapshot: DocumentTrackingSnapshot;
  readonly onOpenDocument?: (documentId: string) => void;
  readonly defaultExpanded?: boolean;
}

const COMPLETED_STATUSES: ReadonlySet<DocumentLifecycleStatus> = new Set(['approved', 'archived']);

export const TrackingLocationCard: React.FC<TrackingLocationCardProps> = ({
  snapshot,
  onOpenDocument,
  defaultExpanded = false,
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const completed = COMPLETED_STATUSES.has(snapshot.lifecycleStatus);
  const isReturned = snapshot.lifecycleStatus === 'returned_for_revision';
  const isMasked = snapshot.visibility === 'location_only';

  const firstMilestone = snapshot.milestones[0] ?? null;
  const originCode = snapshot.originOffice?.code ?? firstMilestone?.officeCode ?? 'HQ';
  const originName = snapshot.originOffice?.name ?? firstMilestone?.officeName ?? 'Originating Unit';
  const originTimestamp = snapshot.originTimestamp ?? firstMilestone?.timestamp ?? snapshot.lastUpdatedAt;

  const statusText = completed
    ? `Completed · ${formatCompactDate(snapshot.lastUpdatedAt)} · ${formatClockTime(snapshot.lastUpdatedAt)}`
    : snapshot.receivedAt
      ? `Received · ${formatCompactDate(snapshot.receivedAt)} · ${formatClockTime(snapshot.receivedAt)}`
      : `Awaiting receipt · Sent ${formatClockTime(snapshot.lastUpdatedAt)}`;

  const railFillClass = completed
    ? 'track-rail-fill track-rail-fill-done'
    : isReturned
      ? 'track-rail-fill track-rail-fill-returned'
      : snapshot.isInternalOfficeStage
        ? 'track-rail-fill track-rail-fill-internal'
        : 'track-rail-fill track-rail-fill-transit';

  const nodeBadgeClass = completed
    ? 'track-rail-node track-rail-node-done'
    : isReturned
      ? 'track-rail-node track-rail-node-pending'
      : snapshot.isInternalOfficeStage
        ? 'track-rail-node track-rail-node-internal'
        : 'track-rail-node';

  const renderNodeIcon = () => {
    if (completed) return <Check size={14} />;
    if (isReturned) return <RotateCcw size={13} />;
    if (snapshot.isInternalOfficeStage) return <Building2 size={13} />;
    if (snapshot.lifecycleStatus === 'in_review') return <FileCheck2 size={13} />;
    return <Send size={13} />;
  };

  const timelineItems =
    snapshot.milestones.length > 0
      ? snapshot.milestones
      : [
          {
            id: `curr-${snapshot.documentId}`,
            officeCode: snapshot.currentOffice.code,
            officeName: snapshot.currentOffice.name,
            status: (snapshot.receivedAt ? 'acknowledged' : 'pending') as 'acknowledged' | 'pending',
            state: (completed ? 'completed' : snapshot.receivedAt ? 'active' : 'pending') as
              | 'completed'
              | 'active'
              | 'pending',
            timestamp: snapshot.receivedAt ?? snapshot.lastUpdatedAt,
            actorName: snapshot.currentHolderName,
            note: completed
              ? `Finalized at ${snapshot.currentOffice.code}`
              : snapshot.receivedAt
                ? `Received at ${snapshot.currentOffice.code}`
                : `In Transit → Awaiting Receipt at ${snapshot.currentOffice.code}`,
          },
        ];

  return (
    <div className="track-loc-card" data-testid={`tracking-card-${snapshot.documentId}`}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`Toggle timeline for ${snapshot.trackingCode}`}
        className="track-loc-summary"
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        {/* Top Row: Tracking Code + Badges + Expand Toggle */}
        <div className="track-loc-top">
          <div className="track-loc-badges">
            <span className="mono doc-tracking-code">{snapshot.trackingCode}</span>
            <CopyFormatBadge format={snapshot.copyFormat} />
            {snapshot.isInternalOfficeStage ? (
              <span className="pill pill-sky" style={{ fontSize: 10 }}>
                INTERNAL DESK
              </span>
            ) : null}
            {isMasked ? (
              <span className="pill pill-slate" style={{ fontSize: 10 }}>
                <Lock size={10} /> Location Only
              </span>
            ) : null}
          </div>
          <span className="icon-circle-btn" aria-hidden="true" style={{ width: 28, height: 28 }}>
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </span>
        </div>

        {/* Document Title */}
        <h4 className={`track-loc-title${completed ? ' track-loc-title-muted' : ''}`}>
          {snapshot.displayTitle}
        </h4>

        {/* Mobile & Admin Parity Horizontal Progress Rail */}
        <div className="track-rail-box" data-testid={`tracking-rail-${snapshot.documentId}`}>
          <div className="track-endpoints">
            <div className="track-ep-col">
              <div className="track-ep-meta tabular">
                {formatCompactDate(originTimestamp)} · {formatClockTime(originTimestamp)}
              </div>
              <div className={`track-ep-code mono${completed ? ' track-ep-code-muted' : ''}`}>
                {originCode}
              </div>
              <div className="track-ep-sub">{originName}</div>
            </div>

            <div className="track-ep-col track-ep-right">
              <div
                className={`track-ep-meta tabular ${
                  completed
                    ? 'track-ep-status-done'
                    : snapshot.receivedAt
                      ? 'track-ep-status-done'
                      : 'track-ep-status-pending'
                }`}
              >
                {statusText}
              </div>
              <div className={`track-ep-code mono${completed ? ' track-ep-code-muted' : ''}`}>
                {snapshot.isInternalOfficeStage
                  ? `${snapshot.currentOffice.code} (Internal)`
                  : snapshot.currentOffice.code}
              </div>
              <div className="track-ep-sub">{snapshot.currentOffice.name}</div>
            </div>
          </div>

          <div className="track-rail-track" aria-hidden="true">
            <div className="track-rail-bg" />
            <div className={railFillClass} />
            <div className="track-rail-dot" />
            <div className={nodeBadgeClass}>{renderNodeIcon()}</div>
            <div
              className={`track-rail-dot ${completed ? 'track-rail-dot-dest-done' : 'track-rail-dot-dest'}`}
            />
          </div>

          <div className="track-office-strip">
            <MapPin size={13} color="var(--navy)" style={{ flexShrink: 0 }} />
            <span className="track-office-strip-text">
              In <strong>{snapshot.currentOffice.name}</strong>
              {snapshot.currentHolderName ? ` · ${snapshot.currentHolderName}` : ''}
              {snapshot.physicalSummary ? ` · ${snapshot.physicalSummary}` : ''}
            </span>
            {isMasked ? <Lock size={12} color="var(--amber-text)" style={{ flexShrink: 0 }} /> : null}
          </div>
        </div>
      </div>

      {/* Expanded Mobile & Admin Parity Vertical Connected-Dot Timeline */}
      {expanded ? (
        <div className="track-loc-expanded" data-testid={`tracking-timeline-${snapshot.documentId}`}>
          <div className="tl-section-heading">Custody Journey Checkpoints</div>

          <div className="tl-list">
            {timelineItems.map((m, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === timelineItems.length - 1;
              const isException =
                m.status === 'recalled' ||
                m.status === 'declined_misrouted' ||
                m.status === 'returned_for_revision';

              let dotClass = 'tl-dot-done';
              if (isException) {
                dotClass = 'tl-dot-exception';
              } else if (m.state === 'pending' || m.status === 'pending') {
                dotClass = 'tl-dot-pending';
              } else if (isLast && completed) {
                dotClass = 'tl-dot-completed';
              } else if (m.state === 'active' || isLast) {
                dotClass = 'tl-dot-active';
              }

              return (
                <div key={m.id} className="tl-row">
                  <div className="tl-time">
                    <div className="tl-date tabular">{formatCompactDate(m.timestamp)}</div>
                    <div className="tl-clock mono">{formatClockTime(m.timestamp)}</div>
                  </div>

                  <div className="tl-axis" aria-hidden="true">
                    <div className={`tl-line-top${isFirst ? ' tl-line-hidden' : ''}`} />
                    <div className={`tl-dot ${dotClass}`} />
                    <div className={`tl-line-bottom${isLast ? ' tl-line-hidden' : ''}`} />
                  </div>

                  <div className="tl-body">
                    <div className="tl-time-inline mono">
                      {formatCompactDate(m.timestamp)} · {formatClockTime(m.timestamp)}
                    </div>
                    <div className="tl-label">{m.note}</div>
                    <div className="tl-office">
                      <span className="tl-office-tag mono">{m.officeCode}</span>
                      <span>
                        {m.officeName}
                        {m.actorName ? ` · ${m.actorName}` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {isMasked ? (
            <div className="track-masked-notice">
              <Lock size={13} color="var(--amber-text)" style={{ flexShrink: 0 }} />
              <span>
                Location visible only. Full document contents, internal desk remarks, and PDFs are
                restricted to Unit Head or named custodians.
              </span>
            </div>
          ) : onOpenDocument ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                className="btn btn-amber"
                style={{ minHeight: 36, fontSize: 12.5 }}
                onClick={() => onOpenDocument(snapshot.documentId)}
              >
                <span>Open Document Details</span>
                <ArrowRight size={14} />
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
