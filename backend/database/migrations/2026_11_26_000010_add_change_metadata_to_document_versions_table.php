<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_versions', function (Blueprint $table) {
            if (! Schema::hasColumn('document_versions', 'change_type')) {
                $table->string('change_type', 32)->default('initial')->after('version_number');
            }
            if (! Schema::hasColumn('document_versions', 'uploaded_by_office_id')) {
                $table->string('uploaded_by_office_id', 64)->nullable()->after('uploaded_by_id');
            }
            if (! Schema::hasColumn('document_versions', 'uploaded_by_office_code')) {
                $table->string('uploaded_by_office_code', 24)->nullable()->after('uploaded_by_office_id');
            }
            if (! Schema::hasColumn('document_versions', 'uploaded_by_office_name')) {
                $table->string('uploaded_by_office_name', 120)->nullable()->after('uploaded_by_office_code');
            }
        });
    }

    public function down(): void
    {
        Schema::table('document_versions', function (Blueprint $table) {
            foreach (['uploaded_by_office_name', 'uploaded_by_office_code', 'uploaded_by_office_id', 'change_type'] as $col) {
                if (Schema::hasColumn('document_versions', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
