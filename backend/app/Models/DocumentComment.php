<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentComment extends Model
{
    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'document_id',
        'author_id',
        'author_name',
        'author_office_id',
        'author_office_code',
        'author_position',
        'visibility',
        'body',
    ];

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class, 'document_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function isVisibleTo(User $actor): bool
    {
        if ($this->visibility === 'internal_office') {
            return $this->author_office_id === $actor->office_id;
        }

        return true;
    }
}
