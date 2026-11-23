<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MobileCapture extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'uploader_id',
        'target_type',
        'target_id',
        'file_name',
        'mime_type',
        'compressed_bytes',
        'sha256_checksum',
        'exif_stripped',
        'storage_key',
    ];

    protected function casts(): array
    {
        return [
            'compressed_bytes' => 'integer',
            'exif_stripped' => 'boolean',
        ];
    }
}
