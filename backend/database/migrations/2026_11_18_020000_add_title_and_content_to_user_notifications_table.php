<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_notifications', function (Blueprint $table): void {
            if (! Schema::hasColumn('user_notifications', 'title')) {
                $table->string('title', 191)->nullable()->after('document_id');
            }
            if (! Schema::hasColumn('user_notifications', 'content')) {
                $table->text('content')->nullable()->after('title');
            }
        });

        DB::table('user_notifications')
            ->whereNull('title')
            ->update([
                'title' => 'Document Custody Update',
                'content' => DB::raw('authenticated_detail'),
            ]);
    }

    public function down(): void
    {
        Schema::table('user_notifications', function (Blueprint $table): void {
            if (Schema::hasColumn('user_notifications', 'content')) {
                $table->dropColumn('content');
            }
            if (Schema::hasColumn('user_notifications', 'title')) {
                $table->dropColumn('title');
            }
        });
    }
};
