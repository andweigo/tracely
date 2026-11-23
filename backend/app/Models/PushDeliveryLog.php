<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PushDeliveryLog extends Model
{
    public $timestamps = false;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'event_type',
        'document_id',
        'target_user_id',
        'target_office_id',
        'tokens_targeted',
        'status',
        'http_status',
        'error_message',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'tokens_targeted' => 'integer',
            'http_status' => 'integer',
            'occurred_at' => 'datetime',
        ];
    }

    public function targetUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    public function targetOffice(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'target_office_id');
    }
}
