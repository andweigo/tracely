<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DesktopPairing extends Model
{
    protected $primaryKey = 'pair_token';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'pair_token',
        'owner_user_id',
        'draft_label',
        'expires_at',
        'attached_file_name',
        'attached_sha256',
        'attached_compressed_bytes',
        'attached_mime_type',
        'attached_storage_key',
        'uploaded_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'attached_compressed_bytes' => 'integer',
            'uploaded_at' => 'datetime',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }
}
