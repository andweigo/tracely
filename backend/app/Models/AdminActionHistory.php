<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdminActionHistory extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'admin_user_id',
        'admin_name',
        'action_type',
        'summary',
        'target_type',
        'target_id',
        'reversible',
        'before_state',
        'after_state',
        'recalled_at',
        'recalled_by_user_id',
        'recalled_by_name',
    ];

    protected function casts(): array
    {
        return [
            'reversible' => 'boolean',
            'before_state' => 'array',
            'after_state' => 'array',
            'recalled_at' => 'datetime',
        ];
    }
}
