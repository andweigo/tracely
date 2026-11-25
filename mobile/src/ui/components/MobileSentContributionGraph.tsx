import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  GestureResponderEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Document } from '../../domain/entities/Document';
import { Personnel } from '../../domain/entities/Personnel';
import { ReceiptStatus } from '../../domain/enums/DomainEnums';
import {
  SentContributionReport,
  SentContributionSeries,
} from '../../repositories/contracts/IDocumentRepository';
import { SDO_COLORS, SDO_FONTS } from '../theme/tokens';

export type MobileContributionScope = 'user' | 'office';

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
  'rgba(27, 31, 35, 0.10)',
  'rgba(27, 31, 35, 0.14)',
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const CELL_SIZE = 11;
const CELL_GAP = 3;
const COL_STEP = CELL_SIZE + CELL_GAP;
const GRID_HEIGHT = 7 * CELL_SIZE + 6 * CELL_GAP;

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

export function computeMobileContributionLevel(count: number, peakCount: number): 0 | 1 | 2 | 3 | 4 {
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

function summarizeSeries(
  dayCounts: Record<string, number>,
  endDate: Date,
  meta?: { officeId?: string; officeCode?: string; officeName?: string },
): SentContributionSeries {
  let total = 0;
  let activeDays = 0;
  let peakCount = 0;
  let peakDate: string | null = null;

  for (const [key, count] of Object.entries(dayCounts)) {
    if (count <= 0) continue;
    total += count;
    activeDays += 1;
    if (count > peakCount) {
      peakCount = count;
      peakDate = key;
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

export function buildMobileLocalSentContributions(
  documents: ReadonlyArray<Document>,
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
          if (tx.receiptStatus === ReceiptStatus.RECALLED || !tx.sentAt) continue;
          const parsed = new Date(tx.sentAt);
          if (Number.isNaN(parsed.getTime())) continue;
          const key = toLocalDateKey(parsed);
          if (key < startKey || key > endKey) continue;
          if (tx.fromUserId === actor.id) {
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
    timezone: 'Asia/Manila',
    startDate: startKey,
    endDate: endKey,
    user: summarizeSeries(userDays, endDate),
    office: summarizeSeries(officeDays, endDate, {
      officeId: actor?.office.id,
      officeCode: actor?.office.code ?? 'OFFICE',
      officeName: actor?.office.name ?? 'My Office',
    }),
  };
}

interface CalendarCell {
  readonly key: string;
  readonly col: number;
  readonly row: number;
  readonly count: number;
  readonly level: 0 | 1 | 2 | 3 | 4;
  readonly inRange: boolean;
}

function buildCalendarGrid(
  startDateKey: string,
  endDateKey: string,
  days: Readonly<Record<string, number>>,
  peakCount: number,
) {
  const start = parseDateKey(startDateKey);
  const end = parseDateKey(endDateKey);

  const gridStart = new Date(start);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const gridEnd = new Date(end);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const weeks: Array<Array<CalendarCell>> = [];
  const flatCells: Array<CalendarCell> = [];
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
      const level = inRange ? computeMobileContributionLevel(count, peakCount) : 0;

      if (inRange && monthForCol === null && (cursor.getDate() <= 7 || colIndex === 0)) {
        monthForCol = cursor.getMonth();
      }

      const cell: CalendarCell = { key, col: colIndex, row: dow, count, level, inRange };
      week.push(cell);
      if (inRange) {
        flatCells.push(cell);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (monthForCol !== null && monthForCol !== lastMarkedMonth && colIndex - lastLabelCol >= 3) {
      monthLabels.push({ colIndex, label: MONTH_NAMES[monthForCol] });
      lastMarkedMonth = monthForCol;
      lastLabelCol = colIndex;
    }

    weeks.push(week);
  }

  return { weeks, flatCells, monthLabels };
}

interface MobileSentContributionGraphProps {
  readonly report: SentContributionReport;
  readonly scope?: MobileContributionScope;
  readonly onScopeChange?: (scope: MobileContributionScope) => void;
  readonly defaultScope?: MobileContributionScope;
  readonly showScopeToggle?: boolean;
  readonly testID?: string;
}

/**
 * Single-SVG GitHub-style daily contribution heatmap optimized for low-end devices
 * (renders 1 SVG view instead of 371 individual native Pressable views).
 */
export const MobileSentContributionGraph: React.FC<MobileSentContributionGraphProps> = React.memo(
  ({
    report,
    scope: controlledScope,
    onScopeChange,
    defaultScope = 'user',
    showScopeToggle = true,
    testID = 'mobile-sent-contributions',
  }) => {
    const [internalScope, setInternalScope] = useState<MobileContributionScope>(defaultScope);
    const [selectedCell, setSelectedCell] = useState<CalendarCell | null>(null);
    const scrollRef = useRef<React.ComponentRef<typeof ScrollView> | null>(null);

    const activeScope = controlledScope ?? internalScope;
    const setScope = (next: MobileContributionScope) => {
      setSelectedCell(null);
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
      const timer = setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }, 40);
      return () => clearTimeout(timer);
    }, [activeScope, grid.weeks.length]);

    const handleGridPress = (e: GestureResponderEvent) => {
      const { locationX, locationY } = e.nativeEvent;
      const col = Math.floor(locationX / COL_STEP);
      const row = Math.floor(locationY / COL_STEP);
      const week = grid.weeks[col];
      const cell = week?.[row];
      if (!cell || !cell.inRange) return;
      setSelectedCell((prev) => (prev?.key === cell.key ? null : cell));
    };

    const noun = series.total === 1 ? 'document' : 'documents';
    const heading =
      activeScope === 'user'
        ? `${series.total.toLocaleString()} ${noun} sent in the last year`
        : `${series.total.toLocaleString()} ${noun} sent by ${series.officeCode ?? 'office'} in the last year`;

    const gridWidth = Math.max(COL_STEP, grid.weeks.length * COL_STEP);

    return (
      <View testID={testID} style={styles.wrap}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>{heading}</Text>

          {showScopeToggle ? (
            <View style={styles.toggle}>
              <Pressable
                onPress={() => setScope('user')}
                style={[styles.toggleBtn, activeScope === 'user' && styles.toggleBtnActive]}
              >
                <Text
                  style={[styles.toggleText, activeScope === 'user' && styles.toggleTextActive]}
                >
                  My Sent ({report.user.total})
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setScope('office')}
                style={[styles.toggleBtn, activeScope === 'office' && styles.toggleBtnActive]}
              >
                <Text
                  style={[styles.toggleText, activeScope === 'office' && styles.toggleTextActive]}
                >
                  {report.office.officeCode ?? 'Office'} ({report.office.total})
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.frame}>
          <View style={styles.chartRow}>
            <View style={styles.weekdayAxis}>
              <View style={{ height: 18 }} />
              <View style={styles.weekdayCol}>
                <Text style={styles.weekdaySpacer}> </Text>
                <Text style={styles.weekdayLabel}>Mon</Text>
                <Text style={styles.weekdaySpacer}> </Text>
                <Text style={styles.weekdayLabel}>Wed</Text>
                <Text style={styles.weekdaySpacer}> </Text>
                <Text style={styles.weekdayLabel}>Fri</Text>
                <Text style={styles.weekdaySpacer}> </Text>
              </View>
            </View>

            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: 4 }}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
            >
              <View>
                <View style={[styles.monthRow, { width: gridWidth }]}>
                  {grid.monthLabels.map((m) => (
                    <Text
                      key={`${m.label}-${m.colIndex}`}
                      style={[styles.monthLabel, { left: m.colIndex * COL_STEP }]}
                    >
                      {m.label}
                    </Text>
                  ))}
                </View>

                <Pressable onPress={handleGridPress}>
                  <Svg width={gridWidth} height={GRID_HEIGHT}>
                    {grid.flatCells.map((cell) => {
                      const isSelected = selectedCell?.key === cell.key;
                      return (
                        <Rect
                          key={cell.key}
                          x={cell.col * COL_STEP}
                          y={cell.row * COL_STEP}
                          width={CELL_SIZE}
                          height={CELL_SIZE}
                          rx={2.5}
                          ry={2.5}
                          fill={LEVEL_COLORS[cell.level]}
                          stroke={isSelected ? SDO_COLORS.navyInk : LEVEL_BORDERS[cell.level]}
                          strokeWidth={isSelected ? 1.5 : 0.8}
                        />
                      );
                    })}
                  </Svg>
                </Pressable>
              </View>
            </ScrollView>
          </View>

          <View style={styles.footerRow}>
            <Text style={styles.footerText} numberOfLines={2}>
              {selectedCell
                ? `${selectedCell.count === 0 ? 'No documents' : `${selectedCell.count} ${selectedCell.count === 1 ? 'document' : 'documents'}`} sent on ${formatReadableDate(selectedCell.key)}`
                : series.total > 0
                  ? `${series.activeDays} active ${series.activeDays === 1 ? 'day' : 'days'}${series.peakCount > 0 ? ` · Peak ${series.peakCount}/day` : ''}${series.currentStreak > 1 ? ` · ${series.currentStreak}d streak` : ''}`
                  : 'Tap any day after sending documents.'}
            </Text>

            <View style={styles.legendRow}>
              <Text style={styles.legendLabel}>Less</Text>
              {LEVEL_COLORS.map((color, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.legendSwatch,
                    {
                      backgroundColor: color,
                      borderColor: LEVEL_BORDERS[idx],
                    },
                  ]}
                />
              ))}
              <Text style={styles.legendLabel}>More</Text>
            </View>
          </View>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  headerRow: {
    gap: 8,
  },
  heading: {
    fontSize: 14,
    fontFamily: SDO_FONTS.sans,
    fontWeight: '700',
    color: SDO_COLORS.navyInk,
  },
  toggle: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    backgroundColor: SDO_COLORS.surface,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    borderRadius: 9,
    padding: 3,
    gap: 3,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: SDO_COLORS.navyInk,
  },
  toggleText: {
    fontSize: 11.5,
    fontFamily: SDO_FONTS.sans,
    fontWeight: '600',
    color: SDO_COLORS.textSecondary,
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  frame: {
    backgroundColor: SDO_COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SDO_COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  weekdayAxis: {
    width: 26,
  },
  weekdayCol: {
    gap: CELL_GAP,
  },
  weekdayLabel: {
    height: CELL_SIZE,
    lineHeight: CELL_SIZE,
    fontSize: 10,
    fontFamily: SDO_FONTS.sans,
    fontWeight: '500',
    color: SDO_COLORS.textMuted,
  },
  weekdaySpacer: {
    height: CELL_SIZE,
    fontSize: 10,
  },
  monthRow: {
    height: 18,
    position: 'relative',
  },
  monthLabel: {
    position: 'absolute',
    top: 0,
    fontSize: 10.5,
    fontFamily: SDO_FONTS.sans,
    fontWeight: '500',
    color: SDO_COLORS.textMuted,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  footerText: {
    fontSize: 11.5,
    fontFamily: SDO_FONTS.sans,
    fontWeight: '500',
    color: SDO_COLORS.textSecondary,
    flexShrink: 1,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  legendLabel: {
    fontSize: 10.5,
    fontFamily: SDO_FONTS.sans,
    fontWeight: '500',
    color: SDO_COLORS.textMuted,
    marginHorizontal: 2,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1,
  },
});
