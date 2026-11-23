<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SlaPolicy extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'category_id',
        'target_hours',
        'stalled_alert_hours',
        'escalation_hours',
        'escalate_to_office_id',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'target_hours' => 'integer',
            'stalled_alert_hours' => 'integer',
            'escalation_hours' => 'integer',
            'active' => 'boolean',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(DocumentCategory::class, 'category_id');
    }

    public function escalateToOffice(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'escalate_to_office_id');
    }
}
