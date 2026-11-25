<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class SystemSetting extends Model
{
    public $incrementing = false;

    protected $primaryKey = 'key';

    protected $keyType = 'string';

    protected $fillable = [
        'key',
        'value',
        'updated_by_user_id',
    ];

    public static function getValue(string $key, ?string $default = null): ?string
    {
        if (! Schema::hasTable('system_settings')) {
            return $default;
        }

        $row = self::query()->find($key);

        return $row ? $row->value : $default;
    }

    public static function getBool(string $key, bool $default = false): bool
    {
        $val = self::getValue($key);
        if ($val === null) {
            return $default;
        }

        return in_array(strtolower(trim($val)), ['1', 'true', 'yes', 'on'], true);
    }

    /**
     * @return array{
     *   organization_name: string,
     *   announcement_banner: string,
     *   registration_paused: bool,
     *   maintenance_mode: bool,
     *   default_sla_hours: int,
     *   stalled_threshold_hours: int
     * }
     */
    public static function allGovernanceSettings(): array
    {
        $map = [];
        if (Schema::hasTable('system_settings')) {
            $map = self::query()->pluck('value', 'key')->all();
        }

        return [
            'organization_name' => (string) ($map['organization_name'] ?? 'Tracely'),
            'announcement_banner' => (string) ($map['announcement_banner'] ?? ''),
            'registration_paused' => in_array(strtolower((string) ($map['registration_paused'] ?? '0')), ['1', 'true', 'on'], true),
            'maintenance_mode' => in_array(strtolower((string) ($map['maintenance_mode'] ?? '0')), ['1', 'true', 'on'], true),
            'default_sla_hours' => max(1, (int) ($map['default_sla_hours'] ?? 72)),
            'stalled_threshold_hours' => max(1, (int) ($map['stalled_threshold_hours'] ?? (int) config('doctrack.stalled_threshold_hours', 24))),
        ];
    }

    /**
     * @param  array<string, string|int|bool|null>  $pairs
     */
    public static function saveMany(array $pairs, ?string $adminUserId = null): void
    {
        if (! Schema::hasTable('system_settings')) {
            return;
        }

        foreach ($pairs as $key => $val) {
            $serialized = is_bool($val) ? ($val ? '1' : '0') : (string) ($val ?? '');
            self::query()->updateOrCreate(
                ['key' => $key],
                [
                    'value' => $serialized,
                    'updated_by_user_id' => $adminUserId,
                ],
            );
        }
    }
}
