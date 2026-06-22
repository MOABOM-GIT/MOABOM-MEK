<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;

/**
 * 플랫폼 DB(moabom-platform) — visibility + row tenant_slug.
 */
return new class extends Migration
{
    protected $connection = 'moabom_platform';

    public function up(): void
    {
        if (! Schema::connection($this->connection)->hasTable('moabom_system_generated_apps')) {
            return;
        }

        Schema::connection($this->connection)->table('moabom_system_generated_apps', function (Blueprint $table): void {
            if (! Schema::connection($this->connection)->hasColumn('moabom_system_generated_apps', 'visibility')) {
                $table->string('visibility', 16)
                    ->default(GeneratedAppVisibility::Private->value)
                    ->after('is_shared');
                $table->index(['visibility', 'tenant_slug', 'created_at'], 'moabom_gen_apps_visibility_tenant_idx');
            }
        });

        if (Schema::connection($this->connection)->hasColumn('moabom_system_generated_apps', 'visibility')) {
            DB::connection($this->connection)
                ->table('moabom_system_generated_apps')
                ->where('is_shared', true)
                ->update(['visibility' => GeneratedAppVisibility::Global->value]);
        }

        if (Schema::connection($this->connection)->hasTable('moabom_generated_app_rows')
            && ! Schema::connection($this->connection)->hasColumn('moabom_generated_app_rows', 'tenant_slug')) {
            Schema::connection($this->connection)->table('moabom_generated_app_rows', function (Blueprint $table): void {
                $table->string('tenant_slug', 64)->default('default')->after('user_id');
                $table->index(
                    ['generated_app_id', 'tenant_slug', 'user_id', 'table_key'],
                    'moabom_gen_app_rows_scope_idx',
                );
            });
        }
    }

    public function down(): void
    {
        if (Schema::connection($this->connection)->hasTable('moabom_generated_app_rows')
            && Schema::connection($this->connection)->hasColumn('moabom_generated_app_rows', 'tenant_slug')) {
            Schema::connection($this->connection)->table('moabom_generated_app_rows', function (Blueprint $table): void {
                $table->dropIndex('moabom_gen_app_rows_scope_idx');
                $table->dropColumn('tenant_slug');
            });
        }

        if (Schema::connection($this->connection)->hasTable('moabom_system_generated_apps')
            && Schema::connection($this->connection)->hasColumn('moabom_system_generated_apps', 'visibility')) {
            Schema::connection($this->connection)->table('moabom_system_generated_apps', function (Blueprint $table): void {
                $table->dropIndex('moabom_gen_apps_visibility_tenant_idx');
                $table->dropColumn('visibility');
            });
        }
    }
};
