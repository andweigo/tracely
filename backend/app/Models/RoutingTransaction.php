<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RoutingTransaction extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'document_id',
        'from_user_id',
        'from_office_id',
        'to_user_id',
        'to_office_id',
        'routing_scope',
        'receipt_status',
        'remarks',
        'is_internal_only',
        'sent_at',
        'acknowledged_at',
        'acknowledged_by_name',
        'proof_photo_file_name',
        'proof_photo_compressed_bytes',
        'proof_photo_sha256',
        'proof_photo_exif_stripped',
        'proof_photo_storage_key',
        'proof_photo_captured_at',
    ];

    protected function casts(): array
    {
        return [
            'is_internal_only' => 'boolean',
            'sent_at' => 'datetime',
            'acknowledged_at' => 'datetime',
            'proof_photo_compressed_bytes' => 'integer',
            'proof_photo_exif_stripped' => 'boolean',
            'proof_photo_captured_at' => 'datetime',
        ];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'document_id');
    }

    public function fromUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'from_user_id');
    }

    public function toUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }

    public function fromOffice(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'from_office_id');
    }

    public function toOffice(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'to_office_id');
    }

    public function isPendingForOffice(string $officeId): bool
    {
        return $this->receipt_status === 'pending' && $this->to_office_id === $officeId;
    }

    public function isPendingSentBy(string $userId): bool
    {
        return $this->receipt_status === 'pending' && $this->from_user_id === $userId;
    }

    public function canBeAcknowledgedBy(User $actor): bool
    {
        return $this->isPendingForOffice($actor->office_id)
            && $this->from_user_id !== $actor->id;
    }

    public function canBeRecalledBy(string $userId): bool
    {
        return $this->receipt_status === 'pending' && $this->from_user_id === $userId;
    }
}
