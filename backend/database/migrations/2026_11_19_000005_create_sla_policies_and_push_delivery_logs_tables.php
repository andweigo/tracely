<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('sla_policies', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('category_id', 64)->unique();
            $table->unsignedSmallInteger('target_hours')->default(48);
            $table->unsignedSmallInteger('stalled_alert_hours')->default(24);
            $table->unsignedSmallInteger('escalation_hours')->default(48);
            $table->string('escalate_to_office_id', 64)->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->foreign('category_id')->references('id')->on('document_categories')->cascadeOnDelete();
            $table->foreign('escalate_to_office_id')->references('id')->on('offices')->nullOnDelete();
        });

        Schema::create('push_delivery_logs', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('event_type', 48);
            $table->string('document_id', 64)->nullable();
            $table->string('target_user_id', 64)->nullable();
            $table->string('target_office_id', 64)->nullable();
            $table->unsignedInteger('tokens_targeted')->default(0);
            $table->string('status', 32); // sent | failed | skipped_unconfigured | no_tokens
            $table->unsignedSmallInteger('http_status')->nullable();
            $table->string('error_message', 255)->nullable();
            $table->timestamp('occurred_at');

            $table->index(['occurred_at', 'status']);
            $table->index(['target_office_id', 'occurred_at']);
            $table->foreign('target_user_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('target_office_id')->references('id')->on('offices')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_delivery_logs');
        Schema::dropIfExists('sla_policies');
    }
};
