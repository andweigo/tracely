<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserNotification extends Model
{
    public $timestamps = false;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'target_user_id',
        'target_office_id',
        'document_id',
        'title',
        'content',
        'lock_screen_preview',
        'authenticated_detail',
        'received_at',
        'read',
    ];

    protected function casts(): array
    {
        return [
            'received_at' => 'datetime',
            'read' => 'boolean',
        ];
    }
}
