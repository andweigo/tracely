<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;

class DocumentCategory extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'name',
        'code',
        'declared_by_office_code',
        'declared_by_office_name',
        'usage_count',
        'is_verified_global',
    ];

    protected function casts(): array
    {
        return [
            'usage_count' => 'integer',
            'is_verified_global' => 'boolean',
        ];
    }

    public function slaPolicy(): HasOne
    {
        return $this->hasOne(SlaPolicy::class, 'category_id');
    }
}
