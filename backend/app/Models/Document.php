<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Document extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'tracking_code',
        'qr_token',
        'title',
        'category_id',
        'confidentiality_tier',
        'lifecycle_status',
        'copy_format',
        'physical_reference',
        'physical_page_count',
        'sla_due_at',
        'origin_office_id',
        'origin_user_id',
        'current_office_id',
        'current_holder_id',
        'submitted_school_id',
    ];

    protected function casts(): array
    {
        return [
            'physical_page_count' => 'integer',
            'sla_due_at' => 'datetime',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(DocumentCategory::class, 'category_id');
    }

    public function originOffice(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'origin_office_id');
    }

    public function originUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'origin_user_id');
    }

    public function currentOffice(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'current_office_id');
    }

    public function currentHolder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'current_holder_id');
    }

    public function submittedSchool(): BelongsTo
    {
        return $this->belongsTo(School::class, 'submitted_school_id');
    }

    public function participants(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'document_participants', 'document_id', 'user_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(DocumentVersion::class, 'document_id')->orderBy('version_number');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(RoutingTransaction::class, 'document_id')->orderBy('sent_at');
    }

    public function externalMilestones(): HasMany
    {
        return $this->hasMany(ExternalMilestone::class, 'document_id')->orderBy('occurred_at');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(DocumentComment::class, 'document_id')->orderBy('created_at');
    }

    public function involvesOffice(string $officeId): bool
    {
        if ($this->origin_office_id === $officeId || $this->current_office_id === $officeId) {
            return true;
        }

        return $this->transactions->contains(function (RoutingTransaction $tx) use ($officeId): bool {
            return $tx->from_office_id === $officeId || $tx->to_office_id === $officeId;
        });
    }

    public function isParticipant(string $userId): bool
    {
        if ($this->origin_user_id === $userId || $this->current_holder_id === $userId) {
            return true;
        }

        if ($this->participants->contains('id', $userId)) {
            return true;
        }

        return $this->transactions->contains(function (RoutingTransaction $tx) use ($userId): bool {
            return $tx->from_user_id === $userId || $tx->to_user_id === $userId;
        });
    }

    public function latestTransaction(): ?RoutingTransaction
    {
        return $this->transactions->last();
    }

    public function slaState(): string
    {
        if (in_array($this->lifecycle_status, ['approved', 'archived'], true)) {
            return 'on_track';
        }

        $diffHours = now()->diffInSeconds($this->sla_due_at, false) / 3600;
        if ($diffHours < 0) {
            return 'overdue';
        }

        return $diffHours <= 6 ? 'at_risk' : 'on_track';
    }

    public function hasDigitalFile(): bool
    {
        return $this->versions->isNotEmpty();
    }

    public function physicalSummary(): ?string
    {
        if ($this->copy_format === 'digital' && ! $this->physical_reference && ! $this->physical_page_count) {
            return null;
        }

        $parts = [];
        if ($this->physical_reference) {
            $parts[] = "Ref: {$this->physical_reference}";
        }
        if ($this->physical_page_count) {
            $parts[] = "{$this->physical_page_count} pp.";
        }

        if ($parts !== []) {
            return implode(' · ', $parts);
        }

        return $this->copy_format === 'hard_copy' ? 'Physical Folder' : 'Hybrid Physical + Digital';
    }
}
