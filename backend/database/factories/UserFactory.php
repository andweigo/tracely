<?php

namespace Database\Factories;

use App\Models\Office;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    public function definition(): array
    {
        $office = Office::query()->first() ?? Office::query()->create([
            'id' => 'off-records',
            'code' => 'RECORDS',
            'name' => 'Records Section',
            'is_custom' => false,
        ]);

        return [
            'id' => 'usr-'.Str::uuid()->toString(),
            'employee_id' => 'TRC-'.str_pad((string) random_int(1000, 9999), 4, '0', STR_PAD_LEFT),
            'full_name' => fake()->name(),
            'email' => fake()->unique()->safeEmail(),
            'position' => 'Administrative Officer II',
            'office_id' => $office->id,
            'role' => 'staff',
            'availability' => 'available',
            'availability_until' => null,
            'delegate_id' => null,
            'active' => true,
            'approval_status' => 'approved',
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('Tracely@2026!'),
            'remember_token' => Str::random(10),
        ];
    }

    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}
