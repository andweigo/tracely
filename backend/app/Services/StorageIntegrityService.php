<?php

namespace App\Services;

use App\Models\DocumentVersion;
use App\Models\Office;
use App\Models\RoutingTransaction;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

/**
 * Verifies SHA-256 file integrity and disk storage health across all stored
 * document versions and custody proof photos on the local document vault disk.
 */
class StorageIntegrityService
{
    public const CACHE_KEY = 'doctrack:integrity_audit_snapshot';

    public function __construct(
        private readonly AuditLogger $audit,
    ) {}

    /**
     * Execute a full SHA-256 & disk presence audit across all digital versions and proof photos.
     *
     * @return array{
     *   audited_at: string,
     *   summary: array{
     *     total_artifacts: int,
     *     verified_count: int,
     *     missing_count: int,
     *     mismatch_count: int,
     *     total_bytes: int,
     *     total_size_label: string,
     *     health_rate: float
     *   },
     *   office_usage: array<int, array{
     *     office_id: string,
     *     office_code: string,
     *     office_name: string,
     *     file_count: int,
     *     total_bytes: int,
     *     size_label: string,
     *     issue_count: int
     *   }>,
     *   artifacts: array<int, array{
     *     id: string,
     *     artifact_type: string,
     *     tracking_code: string,
     *     document_title: string,
     *     office_code: string,
     *     file_name: string,
     *     storage_key: string,
     *     recorded_bytes: int,
     *     actual_bytes: int|null,
     *     size_label: string,
     *     expected_sha256: string,
     *     actual_sha256: string|null,
     *     status: string,
     *     uploaded_at: string
     *   }>
     * }
     */
    public function runAudit(?User $actor = null, bool $recordAuditLog = false): array
    {
        $disk = Storage::disk('local');
        $offices = Office::query()->orderBy('code')->get()->keyBy('id');

        $officeStats = [];
        foreach ($offices as $office) {
            $officeStats[$office->id] = [
                'office_id' => $office->id,
                'office_code' => $office->code,
                'office_name' => $office->name,
                'file_count' => 0,
                'total_bytes' => 0,
                'size_label' => '0 B',
                'issue_count' => 0,
            ];
        }

        $artifacts = [];
        $verified = 0;
        $missing = 0;
        $mismatch = 0;
        $totalBytes = 0;

        // 1. Audit all digital document versions
        $versions = DocumentVersion::query()
            ->with(['document.originOffice'])
            ->orderByDesc('uploaded_at')
            ->get();

        foreach ($versions as $ver) {
            $doc = $ver->document;
            $officeId = (string) ($doc?->origin_office_id ?? '');
            $officeCode = (string) ($doc?->originOffice?->code ?? 'HQ');
            $storageKey = (string) $ver->storage_key;
            $expectedHash = strtolower((string) $ver->sha256_checksum);

            $status = 'verified';
            $actualHash = null;
            $actualBytes = null;

            if ($storageKey === '' || ! $disk->exists($storageKey)) {
                $status = 'missing';
                $missing++;
            } else {
                $fullPath = $disk->path($storageKey);
                $actualBytes = is_file($fullPath) ? (int) filesize($fullPath) : (int) $disk->size($storageKey);
                $actualHash = is_file($fullPath)
                    ? strtolower((string) hash_file('sha256', $fullPath))
                    : strtolower(hash('sha256', (string) $disk->get($storageKey)));

                if ($expectedHash !== '' && ! hash_equals($expectedHash, $actualHash)) {
                    $status = 'checksum_mismatch';
                    $mismatch++;
                } else {
                    $verified++;
                }
            }

            $countedBytes = $actualBytes ?? (int) $ver->size_bytes;
            $totalBytes += $countedBytes;

            if ($officeId !== '' && isset($officeStats[$officeId])) {
                $officeStats[$officeId]['file_count']++;
                $officeStats[$officeId]['total_bytes'] += $countedBytes;
                if ($status !== 'verified') {
                    $officeStats[$officeId]['issue_count']++;
                }
            }

            $artifacts[] = [
                'id' => $ver->id,
                'artifact_type' => "Document v{$ver->version_number}",
                'tracking_code' => (string) ($doc?->tracking_code ?? '—'),
                'document_title' => (string) ($doc?->title ?? 'Untitled Document'),
                'office_code' => $officeCode,
                'file_name' => (string) $ver->file_name,
                'storage_key' => $storageKey,
                'recorded_bytes' => (int) $ver->size_bytes,
                'actual_bytes' => $actualBytes,
                'size_label' => $this->formatBytes($countedBytes),
                'expected_sha256' => $expectedHash,
                'actual_sha256' => $actualHash,
                'status' => $status,
                'uploaded_at' => optional($ver->uploaded_at)->format('Y-m-d H:i') ?? '—',
            ];
        }

        // 2. Audit all custody proof photos attached to routing transactions
        $proofTxs = RoutingTransaction::query()
            ->with(['document', 'toOffice'])
            ->whereNotNull('proof_photo_storage_key')
            ->where('proof_photo_storage_key', '!=', '')
            ->orderByDesc('proof_photo_captured_at')
            ->get();

        foreach ($proofTxs as $tx) {
            $doc = $tx->document;
            $officeId = (string) ($tx->to_office_id ?? '');
            $officeCode = (string) ($tx->toOffice?->code ?? 'HQ');
            $storageKey = (string) $tx->proof_photo_storage_key;
            $expectedHash = strtolower((string) ($tx->proof_photo_sha256 ?? ''));

            $status = 'verified';
            $actualHash = null;
            $actualBytes = null;

            if (! $disk->exists($storageKey)) {
                $status = 'missing';
                $missing++;
            } else {
                $fullPath = $disk->path($storageKey);
                $actualBytes = is_file($fullPath) ? (int) filesize($fullPath) : (int) $disk->size($storageKey);
                $actualHash = is_file($fullPath)
                    ? strtolower((string) hash_file('sha256', $fullPath))
                    : strtolower(hash('sha256', (string) $disk->get($storageKey)));

                if ($expectedHash !== '' && ! hash_equals($expectedHash, $actualHash)) {
                    $status = 'checksum_mismatch';
                    $mismatch++;
                } else {
                    $verified++;
                }
            }

            $countedBytes = $actualBytes ?? (int) ($tx->proof_photo_compressed_bytes ?? 0);
            $totalBytes += $countedBytes;

            if ($officeId !== '' && isset($officeStats[$officeId])) {
                $officeStats[$officeId]['file_count']++;
                $officeStats[$officeId]['total_bytes'] += $countedBytes;
                if ($status !== 'verified') {
                    $officeStats[$officeId]['issue_count']++;
                }
            }

            $artifacts[] = [
                'id' => $tx->id,
                'artifact_type' => 'Proof Photo',
                'tracking_code' => (string) ($doc?->tracking_code ?? '—'),
                'document_title' => (string) ($doc?->title ?? 'Custody Proof'),
                'office_code' => $officeCode,
                'file_name' => (string) ($tx->proof_photo_file_name ?: basename($storageKey)),
                'storage_key' => $storageKey,
                'recorded_bytes' => (int) ($tx->proof_photo_compressed_bytes ?? 0),
                'actual_bytes' => $actualBytes,
                'size_label' => $this->formatBytes($countedBytes),
                'expected_sha256' => $expectedHash,
                'actual_sha256' => $actualHash,
                'status' => $status,
                'uploaded_at' => optional($tx->proof_photo_captured_at ?? $tx->acknowledged_at)->format('Y-m-d H:i') ?? '—',
            ];
        }

        $totalArtifacts = count($artifacts);
        $healthRate = $totalArtifacts > 0 ? round(($verified / $totalArtifacts) * 100, 1) : 100.0;

        $officeUsage = array_values(array_map(function (array $row): array {
            $row['size_label'] = $this->formatBytes($row['total_bytes']);

            return $row;
        }, $officeStats));

        usort($officeUsage, fn (array $a, array $b) => $b['total_bytes'] <=> $a['total_bytes']);

        $auditChain = $this->audit->verifyChain();

        $snapshot = [
            'audited_at' => now()->format('Y-m-d H:i:s'),
            'summary' => [
                'total_artifacts' => $totalArtifacts,
                'verified_count' => $verified,
                'missing_count' => $missing,
                'mismatch_count' => $mismatch,
                'total_bytes' => $totalBytes,
                'total_size_label' => $this->formatBytes($totalBytes),
                'health_rate' => $healthRate,
                'audit_chain_valid' => $auditChain['valid'],
                'audit_chain_count' => $auditChain['chained_logs'],
            ],
            'audit_chain' => $auditChain,
            'office_usage' => $officeUsage,
            'artifacts' => $artifacts,
        ];

        Cache::put(self::CACHE_KEY, $snapshot, now()->addHours(6));

        if ($recordAuditLog && $actor) {
            $issues = $missing + $mismatch;
            $this->audit->record(
                $actor,
                'integrity_audit_completed',
                null,
                null,
                "SHA-256 storage integrity audit verified {$verified}/{$totalArtifacts} artifacts ({$issues} issue(s): {$missing} missing, {$mismatch} tampered).",
                'Tracely Admin Portal',
            );
        }

        return $snapshot;
    }

    public function formatBytes(int $bytes): string
    {
        if ($bytes < 1024) {
            return "{$bytes} B";
        }
        if ($bytes < 1048576) {
            return number_format($bytes / 1024, 1).' KB';
        }
        if ($bytes < 1073741824) {
            return number_format($bytes / 1048576, 2).' MB';
        }

        return number_format($bytes / 1073741824, 2).' GB';
    }
}
