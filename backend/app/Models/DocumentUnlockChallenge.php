<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentUnlockChallenge extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'token',
        'short_code',
        'document_id',
        'user_id',
        'office_id',
        'expires_at',
        'consumed_at',
        'consumed_device_label',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
        ];
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'document_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function formattedShortCode(): string
    {
        $clean = strtoupper(preg_replace('/[^A-Z0-9]/', '', $this->short_code) ?: $this->short_code);
        if (strlen($clean) === 6) {
            return substr($clean, 0, 3).'-'.substr($clean, 3, 3);
        }

        return $clean;
    }
}
