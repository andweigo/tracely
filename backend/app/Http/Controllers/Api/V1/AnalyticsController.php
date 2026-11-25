<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\RoutingTransaction;
use App\Models\User;
use App\Services\AccessPolicyService;
use App\Services\SentContributionService;
use App\Services\StalledDocumentAlertService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AnalyticsController extends Controller
{
    public function __construct(
        private readonly AccessPolicyService $policy,
        private readonly StalledDocumentAlertService $stalledService,
        private readonly SentContributionService $contributions,
    ) {}

    public function contributions(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();
        $tz = is_string($request->query('tz')) ? $request->query('tz') : null;

        return response()->json([
            'data' => $this->contributions->forActor($actor, $tz),
        ]);
    }

    public function turnaround(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        $docs = Document::query()
            ->with([
                'category.slaPolicy.escalateToOffice',
                'originOffice',
                'currentOffice',
                'currentHolder',
                'participants',
                'transactions.fromOffice',
                'transactions.toOffice',
            ])
            ->orderByDesc('created_at')
            ->get()
            ->filter(function (Document $doc) use ($actor): bool {
                if (in_array($actor->role, ['ict_admin', 'records_officer'], true)) {
                    return true;
                }

                return $doc->involvesOffice($actor->office_id)
                    || $this->policy->authorizeFullCustody($actor, $doc)['allowed'];
            })
            ->values();

        $totalDocuments = $docs->count();
        $completedCount = 0;
        $activeCount = 0;
        $stalledCount = 0;
        $overdueCount = 0;
        $atRiskCount = 0;
        $onTrackCount = 0;
        $turnaroundHoursList = [];

        $byFormat = [
            'digital' => 0,
            'hard_copy' => 0,
            'hybrid' => 0,
        ];

        /** @var array<string, array{office_id: string, office_code: string, office_name: string, handled_count: int, pending_count: int, overdue_count: int, hours_sum: float, hours_samples: int}> $officeMap */
        $officeMap = [];

        $months = [];
        for ($i = 5; $i >= 0; $i--) {
            $cursor = Carbon::now()->startOfMonth()->subMonths($i);
            $key = $cursor->format('Y-m');
            $months[$key] = [
                'month' => $key,
                'label' => $cursor->format('M Y'),
                'created_count' => 0,
                'completed_count' => 0,
            ];
        }

        foreach ($docs as $doc) {
            $fmt = in_array($doc->copy_format, ['digital', 'hard_copy', 'hybrid'], true)
                ? $doc->copy_format
                : 'digital';
            $byFormat[$fmt]++;

            $createdKey = $doc->created_at?->format('Y-m');
            if ($createdKey && isset($months[$createdKey])) {
                $months[$createdKey]['created_count']++;
            }

            $isCompleted = in_array($doc->lifecycle_status, ['approved', 'archived'], true);
            $eval = $this->stalledService->evaluate($doc);

            if ($isCompleted) {
                $completedCount++;
                $completedKey = $doc->updated_at?->format('Y-m');
                if ($completedKey && isset($months[$completedKey])) {
                    $months[$completedKey]['completed_count']++;
                }
                if ($doc->created_at && $doc->updated_at) {
                    $turnaroundHoursList[] = max(0.1, round($doc->created_at->diffInMinutes($doc->updated_at) / 60, 2));
                }
            } else {
                $activeCount++;
                if ($eval['isStalled']) {
                    $stalledCount++;
                }
                if ($eval['slaState'] === 'overdue') {
                    $overdueCount++;
                } elseif ($eval['slaState'] === 'at_risk') {
                    $atRiskCount++;
                } else {
                    $onTrackCount++;
                }
            }

            $ensureOffice = function (?string $officeId, ?string $code, ?string $name) use (&$officeMap): void {
                if (! $officeId) {
                    return;
                }
                if (! isset($officeMap[$officeId])) {
                    $officeMap[$officeId] = [
                        'office_id' => $officeId,
                        'office_code' => $code ?: 'UNIT',
                        'office_name' => $name ?: 'Office Unit',
                        'handled_count' => 0,
                        'pending_count' => 0,
                        'overdue_count' => 0,
                        'hours_sum' => 0.0,
                        'hours_samples' => 0,
                    ];
                }
            };

            $ensureOffice($doc->current_office_id, $doc->currentOffice?->code, $doc->currentOffice?->name);
            if (! $isCompleted && isset($officeMap[$doc->current_office_id])) {
                $officeMap[$doc->current_office_id]['pending_count']++;
                if ($eval['slaState'] === 'overdue') {
                    $officeMap[$doc->current_office_id]['overdue_count']++;
                }
            }

            /** @var RoutingTransaction $tx */
            foreach ($doc->transactions as $tx) {
                $ensureOffice($tx->to_office_id, $tx->toOffice?->code, $tx->toOffice?->name);
                if (! isset($officeMap[$tx->to_office_id])) {
                    continue;
                }
                if ($tx->receipt_status === 'acknowledged') {
                    $officeMap[$tx->to_office_id]['handled_count']++;
                    if ($tx->sent_at && $tx->acknowledged_at) {
                        $hrs = max(0.05, $tx->sent_at->diffInMinutes($tx->acknowledged_at) / 60);
                        $officeMap[$tx->to_office_id]['hours_sum'] += $hrs;
                        $officeMap[$tx->to_office_id]['hours_samples']++;
                    }
                }
            }
        }

        $avgTurnaroundHours = count($turnaroundHoursList) > 0
            ? round(array_sum($turnaroundHoursList) / count($turnaroundHoursList), 1)
            : 0.0;

        $onTimeDenominator = $activeCount + $completedCount;
        $onTimeRatePercent = $onTimeDenominator > 0
            ? (int) round((($onTimeDenominator - $overdueCount) / $onTimeDenominator) * 100)
            : 100;

        $byOffice = collect($officeMap)
            ->map(function (array $row): array {
                return [
                    'office_id' => $row['office_id'],
                    'office_code' => $row['office_code'],
                    'office_name' => $row['office_name'],
                    'handled_count' => $row['handled_count'],
                    'pending_count' => $row['pending_count'],
                    'overdue_count' => $row['overdue_count'],
                    'avg_hours' => $row['hours_samples'] > 0
                        ? round($row['hours_sum'] / $row['hours_samples'], 1)
                        : 0.0,
                ];
            })
            ->sortByDesc(fn (array $row): array => [$row['overdue_count'], $row['pending_count'], $row['handled_count']])
            ->values()
            ->all();

        return response()->json([
            'data' => [
                'generated_at' => now()->toIso8601String(),
                'summary' => [
                    'total_documents' => $totalDocuments,
                    'active_count' => $activeCount,
                    'completed_count' => $completedCount,
                    'stalled_count' => $stalledCount,
                    'overdue_count' => $overdueCount,
                    'at_risk_count' => $atRiskCount,
                    'on_track_count' => $onTrackCount,
                    'avg_turnaround_hours' => $avgTurnaroundHours,
                    'on_time_rate_percent' => $onTimeRatePercent,
                ],
                'by_format' => $byFormat,
                'by_office' => $byOffice,
                'monthly_throughput' => array_values($months),
            ],
        ]);
    }
}
