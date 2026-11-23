<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('schools', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('deped_school_id', 24)->unique();
            $table->string('name', 160);
            $table->string('district', 80);
            $table->string('municipality', 100);
            $table->timestamps();
        });

        Schema::create('document_categories', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('name', 120)->unique();
            $table->string('code', 32)->unique();
            $table->string('declared_by_office_code', 24);
            $table->string('declared_by_office_name', 120);
            $table->unsignedInteger('usage_count')->default(0);
            $table->boolean('is_verified_global')->default(true);
            $table->timestamps();
        });

        Schema::create('documents', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('tracking_code', 40)->unique();
            $table->string('qr_token', 64)->unique();
            $table->string('title', 140);
            $table->string('category_id', 64);
            $table->string('confidentiality_tier', 32)->default('standard_internal');
            $table->string('lifecycle_status', 32)->default('registered');
            $table->string('copy_format', 24)->default('digital');
            $table->string('physical_reference', 80)->nullable();
            $table->unsignedInteger('physical_page_count')->nullable();
            $table->timestamp('sla_due_at');
            $table->string('origin_office_id', 64);
            $table->string('origin_user_id', 64);
            $table->string('current_office_id', 64);
            $table->string('current_holder_id', 64);
            $table->string('submitted_school_id', 64)->nullable();
            $table->timestamps();

            $table->foreign('category_id')->references('id')->on('document_categories');
            $table->foreign('origin_office_id')->references('id')->on('offices');
            $table->foreign('origin_user_id')->references('id')->on('users');
            $table->foreign('current_office_id')->references('id')->on('offices');
            $table->foreign('current_holder_id')->references('id')->on('users');
            $table->foreign('submitted_school_id')->references('id')->on('schools')->nullOnDelete();
        });

        Schema::create('document_participants', function (Blueprint $table) {
            $table->string('document_id', 64);
            $table->string('user_id', 64);
            $table->primary(['document_id', 'user_id']);

            $table->foreign('document_id')->references('id')->on('documents')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('document_versions', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('document_id', 64);
            $table->unsignedInteger('version_number');
            $table->string('file_name', 191);
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('size_bytes');
            $table->string('sha256_checksum', 64);
            $table->string('uploaded_by_id', 64);
            $table->timestamp('uploaded_at');
            $table->text('revision_note')->nullable();
            $table->string('storage_key', 191);

            $table->unique(['document_id', 'version_number']);
            $table->foreign('document_id')->references('id')->on('documents')->cascadeOnDelete();
            $table->foreign('uploaded_by_id')->references('id')->on('users');
        });

        Schema::create('routing_transactions', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('document_id', 64);
            $table->string('from_user_id', 64);
            $table->string('from_office_id', 64);
            $table->string('to_user_id', 64);
            $table->string('to_office_id', 64);
            $table->string('routing_scope', 24);
            $table->string('receipt_status', 32)->default('pending');
            $table->text('remarks')->nullable();
            $table->boolean('is_internal_only')->default(true);
            $table->timestamp('sent_at');
            $table->timestamp('acknowledged_at')->nullable();
            $table->string('acknowledged_by_name', 120)->nullable();
            $table->string('proof_photo_file_name', 191)->nullable();
            $table->unsignedBigInteger('proof_photo_compressed_bytes')->nullable();
            $table->string('proof_photo_sha256', 64)->nullable();
            $table->boolean('proof_photo_exif_stripped')->nullable();
            $table->string('proof_photo_storage_key', 191)->nullable();
            $table->timestamp('proof_photo_captured_at')->nullable();
            $table->timestamps();

            $table->index(['document_id', 'sent_at']);
            $table->foreign('document_id')->references('id')->on('documents')->cascadeOnDelete();
            $table->foreign('from_user_id')->references('id')->on('users');
            $table->foreign('from_office_id')->references('id')->on('offices');
            $table->foreign('to_user_id')->references('id')->on('users');
            $table->foreign('to_office_id')->references('id')->on('offices');
        });

        Schema::create('external_milestones', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('document_id', 64);
            $table->string('stage_label', 160);
            $table->string('office_name', 120);
            $table->timestamp('occurred_at');

            $table->index(['document_id', 'occurred_at']);
            $table->foreign('document_id')->references('id')->on('documents')->cascadeOnDelete();
        });

        Schema::create('desktop_pairings', function (Blueprint $table) {
            $table->string('pair_token', 64)->primary();
            $table->string('owner_user_id', 64);
            $table->string('draft_label', 160);
            $table->timestamp('expires_at');
            $table->string('attached_file_name', 191)->nullable();
            $table->string('attached_sha256', 64)->nullable();
            $table->unsignedBigInteger('attached_compressed_bytes')->nullable();
            $table->string('attached_mime_type', 100)->nullable();
            $table->string('attached_storage_key', 191)->nullable();
            $table->timestamp('uploaded_at')->nullable();
            $table->timestamps();

            $table->foreign('owner_user_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('mobile_captures', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('uploader_id', 64);
            $table->string('target_type', 32);
            $table->string('target_id', 64);
            $table->string('file_name', 191);
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('compressed_bytes');
            $table->string('sha256_checksum', 64);
            $table->boolean('exif_stripped')->default(true);
            $table->string('storage_key', 191);
            $table->timestamps();

            $table->foreign('uploader_id')->references('id')->on('users')->cascadeOnDelete();
        });

        Schema::create('user_notifications', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('target_user_id', 64);
            $table->string('target_office_id', 64);
            $table->string('document_id', 64);
            $table->string('lock_screen_preview', 191);
            $table->string('authenticated_detail', 255);
            $table->timestamp('received_at');
            $table->boolean('read')->default(false);

            $table->index(['target_user_id', 'target_office_id']);
            $table->foreign('target_user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('target_office_id')->references('id')->on('offices');
            $table->foreign('document_id')->references('id')->on('documents')->cascadeOnDelete();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('actor_id', 64);
            $table->string('actor_name', 120);
            $table->string('actor_office_code', 24);
            $table->string('action', 48);
            $table->string('document_id', 64)->nullable();
            $table->string('tracking_code', 40)->nullable();
            $table->string('summary', 255);
            $table->string('device_label', 120);
            $table->timestamp('occurred_at');

            $table->index(['document_id', 'occurred_at']);
            $table->foreign('actor_id')->references('id')->on('users');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('user_notifications');
        Schema::dropIfExists('mobile_captures');
        Schema::dropIfExists('desktop_pairings');
        Schema::dropIfExists('external_milestones');
        Schema::dropIfExists('routing_transactions');
        Schema::dropIfExists('document_versions');
        Schema::dropIfExists('document_participants');
        Schema::dropIfExists('documents');
        Schema::dropIfExists('document_categories');
        Schema::dropIfExists('schools');
    }
};
