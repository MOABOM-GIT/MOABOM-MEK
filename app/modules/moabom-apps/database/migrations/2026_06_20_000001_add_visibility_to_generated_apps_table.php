<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('moabom_system_generated_apps')) {
            return;
        }

        Schema::table('moabom_system_generated_apps', function (Blueprint $table): void {
            if (! Schema::hasColumn('moabom_system_generated_apps', 'visibility')) {
                $table->string('visibility', 16)
                    ->default(GeneratedAppVisibility::Private->value)
                    ->after('is_shared')
                    ->comment('private|tenant|global');
                $table->index(['visibility', 'tenant_slug', 'created_at'], 'moabom_gen_apps_visibility_tenant_idx');
            }
        });

        if (Schema::hasColumn('moabom_system_generated_apps', 'visibility')) {
            DB::table('moabom_system_generated_apps')
                ->where('is_shared', true)
                ->update(['visibility' => GeneratedAppVisibility::Global->value]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('moabom_system_generated_apps')) {
            return;
        }

        Schema::table('moabom_system_generated_apps', function (Blueprint $table): void {
            if (Schema::hasColumn('moabom_system_generated_apps', 'visibility')) {
                if (Schema::hasIndex('moabom_system_generated_apps', 'moabom_gen_apps_visibility_tenant_idx')) {
                    $table->dropIndex('moabom_gen_apps_visibility_tenant_idx');
                }
                $table->dropColumn('visibility');
            }
        });
    }
};
