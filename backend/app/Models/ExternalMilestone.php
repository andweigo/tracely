<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExternalMilestone extends Model
{
    public $timestamps = false;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'document_id',
        'stage_label',
        'office_name',
        'occurred_at',
    ];

    protected function casts(): array
    {
        return [
            'occurred_at' => 'datetime',
        ];
    }
}
