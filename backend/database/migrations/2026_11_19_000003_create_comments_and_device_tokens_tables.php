<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_comments', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('document_id', 64);
            $table->string('author_id', 64);
            $table->string('author_name', 120);
            $table->string('author_office_id', 64);
            $table->string('author_office_code', 24);
            $table->string('author_position', 120)->default('');
            $table->string('visibility', 24)->default('cross_office'); // cross_office | internal_office
            $table->text('body');
            $table->timestamps();

            $table->index(['document_id', 'created_at']);
            $table->foreign('document_id')->references('id')->on('documents')->cascadeOnDelete();
            $table->foreign('author_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('author_office_id')->references('id')->on('offices');
        });

        Schema::create('device_push_tokens', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('user_id', 64);
            $table->string('platform', 16)->default('android'); // android | ios | web
            $table->string('token', 512)->unique();
            $table->string('device_label', 120)->default('DocsTrack Device');
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'platform']);
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('device_push_tokens');
        Schema::dropIfExists('document_comments');
    }
};
