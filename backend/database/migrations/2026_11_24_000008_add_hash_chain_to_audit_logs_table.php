<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('audit_logs')) {
            return;
        }

        Schema::table('audit_logs', function (Blueprint $table): void {
            if (! Schema::hasColumn('audit_logs', 'prev_hash')) {
                $table->string('prev_hash', 64)->nullable()->after('device_label');
            }
            if (! Schema::hasColumn('audit_logs', 'entry_hash')) {
                $table->string('entry_hash', 64)->nullable()->after('prev_hash');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('audit_logs')) {
            return;
        }

        Schema::table('audit_logs', function (Blueprint $table): void {
            if (Schema::hasColumn('audit_logs', 'entry_hash')) {
                $table->dropColumn('entry_hash');
            }
            if (Schema::hasColumn('audit_logs', 'prev_hash')) {
                $table->dropColumn('prev_hash');
            }
        });
    }
};
