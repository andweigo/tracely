<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'must_change_password')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->boolean('must_change_password')->default(false)->after('approval_status');
            });
        }

        if (! Schema::hasTable('password_reset_codes')) {
            Schema::create('password_reset_codes', function (Blueprint $table): void {
                $table->string('id', 64)->primary();
                $table->string('user_id', 64)->index();
                $table->string('code_hash', 255);
                $table->timestamp('expires_at')->index();
                $table->timestamp('used_at')->nullable();
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            });
        }

        if (! Schema::hasTable('routing_templates')) {
            Schema::create('routing_templates', function (Blueprint $table): void {
                $table->string('id', 64)->primary();
                $table->string('name', 120);
                $table->string('description', 240)->nullable();
                $table->string('category_id', 64)->nullable()->index();
                $table->string('office_id', 64)->index();
                $table->string('created_by_user_id', 64)->index();
                $table->json('steps_json');
                $table->boolean('is_global')->default(false);
                $table->timestamps();

                $table->foreign('office_id')->references('id')->on('offices')->cascadeOnDelete();
                $table->foreign('created_by_user_id')->references('id')->on('users')->cascadeOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('routing_templates');
        Schema::dropIfExists('password_reset_codes');

        if (Schema::hasColumn('users', 'must_change_password')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->dropColumn('must_change_password');
            });
        }
    }
};
