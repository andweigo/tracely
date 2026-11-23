<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'id',
        'employee_id',
        'full_name',
        'email',
        'position',
        'contact_number',
        'desk_note',
        'avatar_color',
        'preferences',
        'office_id',
        'role',
        'availability',
        'availability_until',
        'delegate_id',
        'active',
        'approval_status',
        'must_change_password',
        'email_verified_at',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'availability_until' => 'datetime',
            'active' => 'boolean',
            'must_change_password' => 'boolean',
            'preferences' => 'array',
            'password' => 'hashed',
        ];
    }

    public function office(): BelongsTo
    {
        return $this->belongsTo(Office::class, 'office_id');
    }

    public function delegate(): BelongsTo
    {
        return $this->belongsTo(self::class, 'delegate_id');
    }

    public function canReceiveDirectRouting(): bool
    {
        return $this->active
            && $this->approval_status === 'approved'
            && $this->availability !== 'on_leave';
    }
}
