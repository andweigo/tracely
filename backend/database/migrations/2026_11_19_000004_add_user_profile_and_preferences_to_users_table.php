<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('contact_number', 32)->nullable()->after('position');
            $table->string('desk_note', 160)->nullable()->after('contact_number');
            $table->string('avatar_color', 24)->default('#0D3472')->after('desk_note');
            $table->json('preferences')->nullable()->after('avatar_color');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn([
                'contact_number',
                'desk_note',
                'avatar_color',
                'preferences',
            ]);
        });
    }
};
