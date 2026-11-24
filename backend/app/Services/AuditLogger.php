<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class AuditLogger
{
    public const GENESIS_HASH = 'GENESIS';

    private static ?bool $hasHashChainColumns = null;

    public function record(
        User $actor,
        string $action,
        ?string $documentId,
        ?string $trackingCode,
        string $summary,
        string $deviceLabel = 'Tracely Client',
    ): AuditLog {
        $actor->loadMissing('office');

        $id = 'aud-'.Str::orderedUuid()->toString();
        $officeCode = $actor->office?->code ?? 'HQ';
        $cleanSummary = Str::limit($summary, 250, '');
        $cleanDevice = Str::limit($deviceLabel, 115, '');
        $occurredAt = now();

        $attributes = [
            'id' => $id,
            'actor_id' => $actor->id,
            'actor_name' => $actor->full_name,
            'actor_office_code' => $officeCode,
            'action' => $action,
            'document_id' => $documentId,
            'tracking_code' => $trackingCode,
            'summary' => $cleanSummary,
            'device_label' => $cleanDevice,
            'occurred_at' => $occurredAt,
        ];

        if ($this->supportsHashChain()) {
            $latestHash = AuditLog::query()
                ->whereNotNull('entry_hash')
                ->orderByDesc('occurred_at')
                ->orderByDesc('id')
                ->value('entry_hash');

            $prevHash = is_string($latestHash) && $latestHash !== '' ? $latestHash : self::GENESIS_HASH;
            $attributes['prev_hash'] = $prevHash;
            $attributes['entry_hash'] = self::computeEntryHash($prevHash, [
                'id' => $id,
                'actor_id' => $actor->id,
                'actor_office_code' => $officeCode,
                'action' => $action,
                'document_id' => $documentId ?? '',
                'tracking_code' => $trackingCode ?? '',
                'summary' => $cleanSummary,
                'occurred_at' => $occurredAt->utc()->format('Y-m-d\TH:i:s\Z'),
            ]);
        }

        return AuditLog::query()->create($attributes);
    }

    /**
     * Verifies cryptographic SHA-256 chain integrity across all hash-chained audit_logs rows.
     *
     * @return array{
     *   supported: bool,
     *   total_logs: int,
     *   chained_logs: int,
     *   valid: bool,
     *   broken_ids: array<int, string>
     * }
     */
    public function verifyChain(): array
    {
        $totalLogs = AuditLog::query()->count();
        if (! $this->supportsHashChain()) {
            return [
                'supported' => false,
                'total_logs' => $totalLogs,
                'chained_logs' => 0,
                'valid' => true,
                'broken_ids' => [],
            ];
        }

        $chained = AuditLog::query()
            ->whereNotNull('entry_hash')
            ->orderBy('occurred_at')
            ->orderBy('id')
            ->get();

        $brokenIds = [];
        $expectedPrev = self::GENESIS_HASH;

        foreach ($chained as $row) {
            $actualPrev = (string) ($row->prev_hash ?? '');
            $computed = self::computeEntryHash($actualPrev, [
                'id' => (string) $row->id,
                'actor_id' => (string) $row->actor_id,
                'actor_office_code' => (string) $row->actor_office_code,
                'action' => (string) $row->action,
                'document_id' => (string) ($row->document_id ?? ''),
                'tracking_code' => (string) ($row->tracking_code ?? ''),
                'summary' => (string) $row->summary,
                'occurred_at' => optional($row->occurred_at)->utc()->format('Y-m-d\TH:i:s\Z') ?? '',
            ]);

            if (! hash_equals($expectedPrev, $actualPrev) || ! hash_equals($computed, (string) $row->entry_hash)) {
                $brokenIds[] = (string) $row->id;
            }

            $expectedPrev = (string) $row->entry_hash;
        }

        return [
            'supported' => true,
            'total_logs' => $totalLogs,
            'chained_logs' => $chained->count(),
            'valid' => $brokenIds === [],
            'broken_ids' => $brokenIds,
        ];
    }

    /**
     * @param  array<string, string>  $fields
     */
    public static function computeEntryHash(string $prevHash, array $fields): string
    {
        $payload = implode('|', [
            $prevHash,
            $fields['id'] ?? '',
            $fields['actor_id'] ?? '',
            $fields['actor_office_code'] ?? '',
            $fields['action'] ?? '',
            $fields['document_id'] ?? '',
            $fields['tracking_code'] ?? '',
            $fields['summary'] ?? '',
            $fields['occurred_at'] ?? '',
        ]);

        return hash('sha256', $payload);
    }

    private function supportsHashChain(): bool
    {
        if (app()->runningUnitTests()) {
            return Schema::hasTable('audit_logs') && Schema::hasColumn('audit_logs', 'entry_hash');
        }

        if (self::$hasHashChainColumns === null) {
            self::$hasHashChainColumns = Schema::hasTable('audit_logs') && Schema::hasColumn('audit_logs', 'entry_hash');
        }

        return self::$hasHashChainColumns;
    }
}
