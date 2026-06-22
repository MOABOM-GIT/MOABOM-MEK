<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('moabom_generated_app_rows')) {
            return;
        }

        Schema::table('moabom_generated_app_rows', function (Blueprint $table): void {
            if (! Schema::hasColumn('moabom_generated_app_rows', 'tenant_slug')) {
                $table->string('tenant_slug', 64)
                    ->default('default')
                    ->after('user_id')
                    ->comment('데이터 소유 tenant');
                $table->index(
                    ['generated_app_id', 'tenant_slug', 'user_id', 'table_key'],
                    'moabom_gen_app_rows_scope_idx',
                );
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('moabom_generated_app_rows')) {
            return;
        }

        Schema::table('moabom_generated_app_rows', function (Blueprint $table): void {
            if (Schema::hasColumn('moabom_generated_app_rows', 'tenant_slug')) {
                if (Schema::hasIndex('moabom_generated_app_rows', 'moabom_gen_app_rows_scope_idx')) {
                    $table->dropIndex('moabom_gen_app_rows_scope_idx');
                }
                $table->dropColumn('tenant_slug');
            }
        });
    }
};
