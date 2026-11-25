<?php

namespace App\Services;

use App\Models\Document;
use App\Models\Office;
use App\Models\RoutingTransaction;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class SentContributionService
{
    public const WINDOW_DAYS = 365;

    public function resolveTimezone(?string $requested): string
    {
        $candidate = trim((string) $requested);
        if ($candidate !== '' && in_array($candidate, timezone_identifiers_list(), true)) {
            return $candidate;
        }

        $configured = (string) config('app.timezone', 'Asia/Manila');
        if ($configured !== '' && strtoupper($configured) !== 'UTC' && in_array($configured, timezone_identifiers_list(), true)) {
            return $configured;
        }

        return 'Asia/Manila';
    }

    /**
     * Build user-sent and office-sent daily contribution graphs for the last 365 days.
     *
     * @return array{
     *   generated_at: string,
     *   timezone: string,
     *   start_date: string,
     *   end_date: string,
     *   user: array<string, mixed>,
     *   office: array<string, mixed>
     * }
     */
    public function forActor(User $actor, ?string $requestedTimezone = null): array
    {
        $tz = $this->resolveTimezone($requestedTimezone);
        $nowLocal = Carbon::now($tz);
        $endDate = $nowLocal->copy()->startOfDay();
        $startDate = $endDate->copy()->subDays(self::WINDOW_DAYS - 1);
        $queryStartUtc = $startDate->copy()->subDay()->utc();

        $userDays = [];
        $officeDays = [];

        $txRows = RoutingTransaction::query()
            ->toBase()
            ->select(['from_user_id', 'from_office_id', 'sent_at'])
            ->whereNotNull('sent_at')
            ->where('sent_at', '>=', $queryStartUtc)
            ->where('receipt_status', '!=', 'recalled')
            ->where(function ($query) use ($actor): void {
                $query->where('from_user_id', $actor->id)
                    ->orWhere('from_office_id', $actor->office_id);
            })
            ->get();

        $startKey = $startDate->format('Y-m-d');
        $endKey = $endDate->format('Y-m-d');

        foreach ($txRows as $row) {
            if (! $row->sent_at) {
                continue;
            }
            $dayKey = Carbon::parse($row->sent_at, 'UTC')->timezone($tz)->format('Y-m-d');
            if ($dayKey < $startKey || $dayKey > $endKey) {
                continue;
            }
            if ($row->from_user_id === $actor->id) {
                $userDays[$dayKey] = ($userDays[$dayKey] ?? 0) + 1;
            }
            if ($row->from_office_id === $actor->office_id) {
                $officeDays[$dayKey] = ($officeDays[$dayKey] ?? 0) + 1;
            }
        }

        // Also count documents registered without any routing transaction yet so initial intake is never lost.
        $standaloneDocs = Document::query()
            ->where('created_at', '>=', $queryStartUtc)
            ->whereDoesntHave('transactions')
            ->where(function ($query) use ($actor): void {
                $query->where('origin_user_id', $actor->id)
                    ->orWhere('origin_office_id', $actor->office_id);
            })
            ->get(['origin_user_id', 'origin_office_id', 'created_at']);

        foreach ($standaloneDocs as $doc) {
            if (! $doc->created_at) {
                continue;
            }
            $dayKey = $doc->created_at->copy()->timezone($tz)->format('Y-m-d');
            if ($dayKey < $startKey || $dayKey > $endKey) {
                continue;
            }
            if ($doc->origin_user_id === $actor->id) {
                $userDays[$dayKey] = ($userDays[$dayKey] ?? 0) + 1;
            }
            if ($doc->origin_office_id === $actor->office_id) {
                $officeDays[$dayKey] = ($officeDays[$dayKey] ?? 0) + 1;
            }
        }

        $actor->loadMissing('office');

        return [
            'generated_at' => now()->toIso8601String(),
            'timezone' => $tz,
            'start_date' => $startKey,
            'end_date' => $endKey,
            'user' => $this->summarizeSeries($userDays, $endDate),
            'office' => array_merge(
                [
                    'office_id' => $actor->office_id,
                    'office_code' => $actor->office?->code ?? 'OFFICE',
                    'office_name' => $actor->office?->name ?? 'My Office',
                ],
                $this->summarizeSeries($officeDays, $endDate),
            ),
        ];
    }

    /**
     * Build organization-wide + per-office daily sent contribution graphs for Admin Portal.
     *
     * @param  Collection<int, Office>  $offices
     * @return array<string, mixed>
     */
    public function forAdminOverview(Collection $offices, ?string $requestedTimezone = null): array
    {
        $tz = $this->resolveTimezone($requestedTimezone);
        $endDate = Carbon::now($tz)->startOfDay();
        $startDate = $endDate->copy()->subDays(self::WINDOW_DAYS - 1);
        $queryStartUtc = $startDate->copy()->subDay()->utc();
        $startKey = $startDate->format('Y-m-d');
        $endKey = $endDate->format('Y-m-d');

        $allDays = [];
        /** @var array<string, array<string, int>> $officeDayMaps */
        $officeDayMaps = [];
        foreach ($offices as $office) {
            $officeDayMaps[$office->id] = [];
        }

        $txRows = RoutingTransaction::query()
            ->toBase()
            ->select(['from_office_id', 'sent_at'])
            ->whereNotNull('sent_at')
            ->where('sent_at', '>=', $queryStartUtc)
            ->where('receipt_status', '!=', 'recalled')
            ->get();

        foreach ($txRows as $row) {
            if (! $row->sent_at) {
                continue;
            }
            $dayKey = Carbon::parse($row->sent_at, 'UTC')->timezone($tz)->format('Y-m-d');
            if ($dayKey < $startKey || $dayKey > $endKey) {
                continue;
            }
            $allDays[$dayKey] = ($allDays[$dayKey] ?? 0) + 1;
            if ($row->from_office_id) {
                $officeDayMaps[$row->from_office_id][$dayKey] = ($officeDayMaps[$row->from_office_id][$dayKey] ?? 0) + 1;
            }
        }

        $standaloneDocs = Document::query()
            ->where('created_at', '>=', $queryStartUtc)
            ->whereDoesntHave('transactions')
            ->get(['origin_office_id', 'created_at']);

        foreach ($standaloneDocs as $doc) {
            if (! $doc->created_at) {
                continue;
            }
            $dayKey = $doc->created_at->copy()->timezone($tz)->format('Y-m-d');
            if ($dayKey < $startKey || $dayKey > $endKey) {
                continue;
            }
            $allDays[$dayKey] = ($allDays[$dayKey] ?? 0) + 1;
            if ($doc->origin_office_id) {
                $officeDayMaps[$doc->origin_office_id][$dayKey] = ($officeDayMaps[$doc->origin_office_id][$dayKey] ?? 0) + 1;
            }
        }

        $byOffice = [];
        foreach ($offices as $office) {
            $byOffice[$office->id] = array_merge(
                [
                    'office_id' => $office->id,
                    'office_code' => $office->code,
                    'office_name' => $office->name,
                ],
                $this->summarizeSeries($officeDayMaps[$office->id] ?? [], $endDate),
            );
        }

        return [
            'timezone' => $tz,
            'start_date' => $startKey,
            'end_date' => $endKey,
            'all' => array_merge(
                [
                    'office_id' => 'all',
                    'office_code' => 'ALL',
                    'office_name' => 'All Offices',
                ],
                $this->summarizeSeries($allDays, $endDate),
            ),
            'by_office' => $byOffice,
        ];
    }

    /**
     * @param  array<string, int>  $dayCounts
     * @return array{
     *   total: int,
     *   active_days: int,
     *   peak_count: int,
     *   peak_date: ?string,
     *   current_streak: int,
     *   days: array<string, int>
     * }
     */
    private function summarizeSeries(array $dayCounts, Carbon $endDate): array
    {
        ksort($dayCounts);

        $total = 0;
        $peakCount = 0;
        $peakDate = null;

        foreach ($dayCounts as $date => $count) {
            if ($count <= 0) {
                unset($dayCounts[$date]);
                continue;
            }
            $total += $count;
            if ($count > $peakCount) {
                $peakCount = $count;
                $peakDate = $date;
            }
        }

        // Compute current consecutive active-day streak ending today (or yesterday if nothing sent yet today).
        $streak = 0;
        $cursor = $endDate->copy();
        if (($dayCounts[$cursor->format('Y-m-d')] ?? 0) === 0) {
            $cursor->subDay();
        }
        while (($dayCounts[$cursor->format('Y-m-d')] ?? 0) > 0) {
            $streak++;
            $cursor->subDay();
        }

        return [
            'total' => $total,
            'active_days' => count($dayCounts),
            'peak_count' => $peakCount,
            'peak_date' => $peakDate,
            'current_streak' => $streak,
            'days' => $dayCounts,
        ];
    }
}
