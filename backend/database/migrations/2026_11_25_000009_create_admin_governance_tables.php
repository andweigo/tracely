<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('admin_action_histories')) {
            Schema::create('admin_action_histories', function (Blueprint $table): void {
                $table->string('id', 64)->primary();
                $table->string('admin_user_id', 64)->index();
                $table->string('admin_name', 160);
                $table->string('action_type', 64)->index();
                $table->string('summary', 260);
                $table->string('target_type', 64)->nullable();
                $table->string('target_id', 64)->nullable();
                $table->boolean('reversible')->default(true);
                $table->json('before_state')->nullable();
                $table->json('after_state')->nullable();
                $table->timestamp('recalled_at')->nullable();
                $table->string('recalled_by_user_id', 64)->nullable();
                $table->string('recalled_by_name', 160)->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('system_settings')) {
            Schema::create('system_settings', function (Blueprint $table): void {
                $table->string('key', 80)->primary();
                $table->text('value')->nullable();
                $table->string('updated_by_user_id', 64)->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_action_histories');
        Schema::dropIfExists('system_settings');
    }
};
