<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Str;

class AuditLogger
{
    public function record(
        User $actor,
        string $action,
        ?string $documentId,
        ?string $trackingCode,
        string $summary,
        string $deviceLabel = 'Tracely Client',
    ): AuditLog {
        $actor->loadMissing('office');

        return AuditLog::query()->create([
            'id' => 'aud-'.Str::uuid()->toString(),
            'actor_id' => $actor->id,
            'actor_name' => $actor->full_name,
            'actor_office_code' => $actor->office?->code ?? 'HQ',
            'action' => $action,
            'document_id' => $documentId,
            'tracking_code' => $trackingCode,
            'summary' => Str::limit($summary, 250, ''),
            'device_label' => Str::limit($deviceLabel, 115, ''),
            'occurred_at' => now(),
        ]);
    }
}
