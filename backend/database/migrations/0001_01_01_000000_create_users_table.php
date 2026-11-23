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
        Schema::create('offices', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('code', 24)->unique();
            $table->string('name', 120);
            $table->boolean('is_custom')->default(false);
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->string('id', 64)->primary();
            $table->string('employee_id', 32)->unique();
            $table->string('full_name', 120);
            $table->string('email', 120)->unique();
            $table->string('position', 120);
            $table->string('office_id', 64);
            $table->string('role', 32)->default('staff');
            $table->string('availability', 32)->default('available');
            $table->timestamp('availability_until')->nullable();
            $table->string('delegate_id', 64)->nullable();
            $table->boolean('active')->default(true);
            $table->string('approval_status', 24)->default('approved');
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password');
            $table->rememberToken();
            $table->timestamps();

            $table->foreign('office_id')->references('id')->on('offices');
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('user_id', 64)->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('users');
        Schema::dropIfExists('offices');
    }
};
