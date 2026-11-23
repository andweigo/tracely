<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_unlock_challenges', function (Blueprint $table): void {
            $table->string('id', 64)->primary();
            $table->string('token', 96)->unique();
            $table->string('short_code', 16)->index();
            $table->string('document_id', 64)->index();
            $table->string('user_id', 64)->index();
            $table->string('office_id', 64)->index();
            $table->timestamp('expires_at');
            $table->timestamp('consumed_at')->nullable();
            $table->string('consumed_device_label', 120)->nullable();
            $table->timestamps();

            $table->foreign('document_id')->references('id')->on('documents')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('document_unlock_challenges');
    }
};
