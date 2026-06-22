<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('moabom_system_generated_apps')) {
            return;
        }

        Schema::table('moabom_system_generated_apps', function (Blueprint $table): void {
            if (! Schema::hasColumn('moabom_system_generated_apps', 'tenant_slug')) {
                $table->string('tenant_slug', 64)
                    ->default('default')
                    ->after('user_id')
                    ->comment('SaaS tenant slug (platform row 격리)');
                $table->index(['tenant_slug', 'user_id', 'created_at'], 'moabom_gen_apps_tenant_user_idx');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('moabom_system_generated_apps')) {
            return;
        }

        Schema::table('moabom_system_generated_apps', function (Blueprint $table): void {
            if (Schema::hasColumn('moabom_system_generated_apps', 'tenant_slug')) {
                $table->dropIndex('moabom_gen_apps_tenant_user_idx');
                $table->dropColumn('tenant_slug');
            }
        });
    }
};
