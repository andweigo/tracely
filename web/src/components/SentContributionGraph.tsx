import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DocumentRecord, Personnel, SentContributionReport, SentContributionSeries } from '../domain/types';

export type ContributionScope = 'user' | 'office';

const LEVEL_COLORS: ReadonlyArray<string> = [
  '#EBEDF0', // 0
  '#9BE9A8', // 1
  '#40C463', // 2
  '#30A14E', // 3
  '#216E39', // 4
];

const LEVEL_BORDERS: ReadonlyArray<string> = [
  'rgba(27, 31, 35, 0.06)',
  'rgba(27, 31, 35, 0.08)',
  'rgba(27, 31, 35, 0.08)',
  'rgba(27, 31, 35, 0.09)',
  'rgba(27, 31, 35, 0.12)',
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatReadableDate(key: string): string {
  const date = parseDateKey(key);
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function computeContributionLevel(count: number, peakCount: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (peakCount <= 4) {
    if (count === 1) return 1;
    if (count === 2) return 2;
    if (count === 3) return 3;
    return 4;
  }
  const ratio = count / peakCount;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

function summarizeLocalSeries(
  dayCounts: Record<string, number>,
  endDate: Date,
  meta?: { officeId?: string; officeCode?: string; officeName?: string },
): SentContributionSeries {
  let total = 0;
  let activeDays = 0;
  let peakCount = 0;
  let peakDate: string | null = null;

  for (const [dateKey, count] of Object.entries(dayCounts)) {
    if (count <= 0) continue;
    total += count;
    activeDays += 1;
    if (count > peakCount) {
      peakCount = count;
      peakDate = dateKey;
    }
  }

  let currentStreak = 0;
  const cursor = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  if ((dayCounts[toLocalDateKey(cursor)] ?? 0) === 0) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while ((dayCounts[toLocalDateKey(cursor)] ?? 0) > 0) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    officeId: meta?.officeId,
    officeCode: meta?.officeCode,
    officeName: meta?.officeName,
    total,
    activeDays,
    peakCount,
    peakDate,
    currentStreak,
    days: dayCounts,
  };
}

export function buildLocalSentContributions(
  documents: ReadonlyArray<DocumentRecord>,
  actor: Personnel | null,
): SentContributionReport {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 364);
  const startKey = toLocalDateKey(startDate);
  const endKey = toLocalDateKey(endDate);

  const userDays: Record<string, number> = {};
  const officeDays: Record<string, number> = {};

  if (actor) {
    for (const doc of documents) {
      if (doc.transactions.length > 0) {
        for (const tx of doc.transactions) {
          if (tx.status === 'recalled' || !tx.sentAt) continue;
          const parsed = new Date(tx.sentAt);
          if (Number.isNaN(parsed.getTime())) continue;
          const key = toLocalDateKey(parsed);
          if (key < startKey || key > endKey) continue;
          if (tx.fromUserId === actor.id || tx.fromUserName === actor.fullName) {
            userDays[key] = (userDays[key] ?? 0) + 1;
          }
          if (tx.fromOffice.id === actor.office.id) {
            officeDays[key] = (officeDays[key] ?? 0) + 1;
          }
        }
      } else if (doc.createdAt) {
        const parsed = new Date(doc.createdAt);
        if (!Number.isNaN(parsed.getTime())) {
          const key = toLocalDateKey(parsed);
          if (key >= startKey && key <= endKey) {
            if (doc.originUserId === actor.id) {
              userDays[key] = (userDays[key] ?? 0) + 1;
            }
            if (doc.originOffice.id === actor.office.id) {
              officeDays[key] = (officeDays[key] ?? 0) + 1;
            }
          }
        }
      }
    }
  }

  return {
    generatedAt: now.toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Manila',
    startDate: startKey,
    endDate: endKey,
    user: summarizeLocalSeries(userDays, endDate),
    office: summarizeLocalSeries(officeDays, endDate, {
      officeId: actor?.office.id,
      officeCode: actor?.office.code ?? 'OFFICE',
      officeName: actor?.office.name ?? 'My Office',
    }),
  };
}

interface CalendarCell {
  readonly key: string;
  readonly count: number;
  readonly level: 0 | 1 | 2 | 3 | 4;
  readonly inRange: boolean;
}

interface CalendarGridModel {
  readonly weeks: ReadonlyArray<ReadonlyArray<CalendarCell>>;
  readonly monthLabels: ReadonlyArray<{ readonly colIndex: number; readonly label: string }>;
}

function buildCalendarGrid(
  startDateKey: string,
  endDateKey: string,
  days: Readonly<Record<string, number>>,
  peakCount: number,
): CalendarGridModel {
  const start = parseDateKey(startDateKey);
  const end = parseDateKey(endDateKey);

  // Align start backward to Sunday so rows are always Sun (0) -> Sat (6)
  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  // Align end forward to Saturday so the final column is complete
  const gridEnd = new Date(end);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const weeks: Array<Array<CalendarCell>> = [];
  const monthLabels: Array<{ colIndex: number; label: string }> = [];

  const cursor = new Date(gridStart);
  let lastMarkedMonth = -1;
  let lastLabelCol = -4;

  while (cursor <= gridEnd) {
    const colIndex = weeks.length;
    const week: Array<CalendarCell> = [];
    let monthForCol: number | null = null;

    for (let dow = 0; dow < 7; dow += 1) {
      const key = toLocalDateKey(cursor);
      const inRange = key >= startDateKey && key <= endDateKey;
      const count = inRange ? (days[key] ?? 0) : 0;
      const level = inRange ? computeContributionLevel(count, peakCount) : 0;

      if (inRange && monthForCol === null && (cursor.getDate() <= 7 || colIndex === 0)) {
        monthForCol = cursor.getMonth();
      }

      week.push({ key, count, level, inRange });
      cursor.setDate(cursor.getDate() + 1);
    }

    if (monthForCol !== null && monthForCol !== lastMarkedMonth && colIndex - lastLabelCol >= 3) {
      monthLabels.push({ colIndex, label: MONTH_NAMES[monthForCol] });
      lastMarkedMonth = monthForCol;
      lastLabelCol = colIndex;
    }

    weeks.push(week);
  }

  return { weeks, monthLabels };
}

interface SentContributionGraphProps {
  readonly report: SentContributionReport;
  readonly scope?: ContributionScope;
  readonly onScopeChange?: (scope: ContributionScope) => void;
  readonly defaultScope?: ContributionScope;
  readonly showScopeToggle?: boolean;
  readonly testId?: string;
}

export const SentContributionGraph: React.FC<SentContributionGraphProps> = ({
  report,
  scope: controlledScope,
  onScopeChange,
  defaultScope = 'user',
  showScopeToggle = true,
  testId = 'web-sent-contributions',
}) => {
  const [internalScope, setInternalScope] = useState<ContributionScope>(defaultScope);
  const [hoveredCell, setHoveredCell] = useState<CalendarCell | null>(null);
  const [pinnedCell, setPinnedCell] = useState<CalendarCell | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const activeScope = controlledScope ?? internalScope;
  const setScope = (next: ContributionScope) => {
    setPinnedCell(null);
    setHoveredCell(null);
    if (onScopeChange) {
      onScopeChange(next);
    } else {
      setInternalScope(next);
    }
  };

  const series = activeScope === 'user' ? report.user : report.office;

  const grid = useMemo(
    () => buildCalendarGrid(report.startDate, report.endDate, series.days, series.peakCount),
    [report.startDate, report.endDate, series.days, series.peakCount],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollLeft = el.scrollWidth;
    }
  }, [activeScope, grid.weeks.length]);

  const activeCell = hoveredCell ?? pinnedCell;
  const noun = series.total === 1 ? 'document' : 'documents';
  const scopeHeading =
    activeScope === 'user'
      ? `${series.total.toLocaleString()} ${noun} sent in the last year`
      : `${series.total.toLocaleString()} ${noun} sent by ${series.officeCode ?? 'your office'} in the last year`;

  const CELL_SIZE = 12;
  const CELL_GAP = 3;
  const COL_STEP = CELL_SIZE + CELL_GAP;

  return (
    <div
      data-testid={testId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h3
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--text-main)',
            }}
          >
            {scopeHeading}
          </h3>
        </div>

        {showScopeToggle ? (
          <div
            role="tablist"
            aria-label="Sent activity scope"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              padding: 3,
              borderRadius: 9,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
            }}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === 'user'}
              onClick={() => setScope('user')}
              style={{
                border: 'none',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: activeScope === 'user' ? 'var(--text-main)' : 'transparent',
                color: activeScope === 'user' ? 'var(--bg-surface, #fff)' : 'var(--text-muted)',
              }}
            >
              My Sent ({report.user.total})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeScope === 'office'}
              onClick={() => setScope('office')}
              style={{
                border: 'none',
                borderRadius: 6,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: activeScope === 'office' ? 'var(--text-main)' : 'transparent',
                color: activeScope === 'office' ? 'var(--bg-surface, #fff)' : 'var(--text-muted)',
              }}
            >
              {report.office.officeCode ? `${report.office.officeCode} Sent` : 'Office Sent'} (
              {report.office.total})
            </button>
          </div>
        ) : null}
      </div>

      {/* GitHub-Style Contribution Frame */}
      <div
        style={{
          border: '1px solid var(--border)',
          borderRadius: 14,
          background: 'var(--surface, #ffffff)',
          padding: '14px 16px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div
          ref={scrollRef}
          style={{
            overflowX: 'auto',
            overflowY: 'hidden',
            paddingBottom: 2,
          }}
        >
          <div style={{ display: 'inline-flex', flexDirection: 'column', minWidth: 'max-content' }}>
            {/* Month Labels */}
            <div
              style={{
                position: 'relative',
                height: 18,
                marginLeft: 32,
                width: grid.weeks.length * COL_STEP,
              }}
            >
              {grid.monthLabels.map((m) => (
                <span
                  key={`${m.label}-${m.colIndex}`}
                  style={{
                    position: 'absolute',
                    left: m.colIndex * COL_STEP,
                    top: 0,
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    userSelect: 'none',
                  }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            {/* Weekday Axis + 53-Week Grid */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
                  rowGap: CELL_GAP,
                  width: 26,
                  flexShrink: 0,
                  fontSize: 10.5,
                  color: 'var(--text-muted)',
                  userSelect: 'none',
                }}
              >
                <span />
                <span style={{ lineHeight: `${CELL_SIZE}px` }}>Mon</span>
                <span />
                <span style={{ lineHeight: `${CELL_SIZE}px` }}>Wed</span>
                <span />
                <span style={{ lineHeight: `${CELL_SIZE}px` }}>Fri</span>
                <span />
              </div>

              <div
                role="grid"
                aria-label="Daily sent contributions calendar"
                style={{
                  display: 'flex',
                  gap: CELL_GAP,
                }}
              >
                {grid.weeks.map((week, wIdx) => (
                  <div
                    key={wIdx}
                    style={{
                      display: 'grid',
                      gridTemplateRows: `repeat(7, ${CELL_SIZE}px)`,
                      rowGap: CELL_GAP,
                    }}
                  >
                    {week.map((cell) => {
                      if (!cell.inRange) {
                        return (
                          <span
                            key={cell.key}
                            aria-hidden="true"
                            style={{ width: CELL_SIZE, height: CELL_SIZE }}
                          />
                        );
                      }
                      const isPinned = pinnedCell?.key === cell.key;
                      const label = `${cell.count === 0 ? 'No' : cell.count} ${cell.count === 1 ? 'document' : 'documents'} sent on ${formatReadableDate(cell.key)}`;
                      return (
                        <button
                          key={cell.key}
                          type="button"
                          title={label}
                          aria-label={label}
                          onMouseEnter={() => setHoveredCell(cell)}
                          onMouseLeave={() => setHoveredCell((prev) => (prev?.key === cell.key ? null : prev))}
                          onFocus={() => setHoveredCell(cell)}
                          onBlur={() => setHoveredCell((prev) => (prev?.key === cell.key ? null : prev))}
                          onClick={() =>
                            setPinnedCell((prev) => (prev?.key === cell.key ? null : cell))
                          }
                          style={{
                            width: CELL_SIZE,
                            height: CELL_SIZE,
                            padding: 0,
                            borderRadius: 3,
                            border: isPinned
                              ? '1.5px solid var(--text-main)'
                              : `1px solid ${LEVEL_BORDERS[cell.level]}`,
                            background: LEVEL_COLORS[cell.level],
                            cursor: 'pointer',
                            transition: 'transform 100ms ease',
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Readout + Less / More Legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            fontSize: 12,
            color: 'var(--text-muted)',
          }}
        >
          <div>
            {activeCell ? (
              <span>
                <strong style={{ color: 'var(--text-main)' }}>
                  {activeCell.count === 0 ? 'No documents' : `${activeCell.count} ${activeCell.count === 1 ? 'document' : 'documents'}`}
                </strong>{' '}
                sent on {formatReadableDate(activeCell.key)}
              </span>
            ) : series.total > 0 ? (
              <span>
                {series.activeDays} active {series.activeDays === 1 ? 'day' : 'days'}
                {series.peakCount > 0 && series.peakDate
                  ? ` · Peak ${series.peakCount} on ${formatReadableDate(series.peakDate)}`
                  : ''}
                {series.currentStreak > 1 ? ` · ${series.currentStreak}-day streak` : ''}
              </span>
            ) : (
              <span>Daily outgoing document dispatches appear here.</span>
            )}
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11.5,
              color: 'var(--text-muted)',
              userSelect: 'none',
            }}
          >
            <span>Less</span>
            {LEVEL_COLORS.map((color, idx) => (
              <span
                key={idx}
                aria-hidden="true"
                style={{
                  width: 11,
                  height: 11,
                  borderRadius: 2.5,
                  background: color,
                  border: `1px solid ${LEVEL_BORDERS[idx]}`,
                  display: 'inline-block',
                }}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>
    </div>
  );
};
