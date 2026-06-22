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
            if (! Schema::hasColumn('moabom_system_generated_apps', 'tier')) {
                $table->string('tier', 16)
                    ->default('standard')
                    ->after('app_type')
                    ->comment('standard|hosted');
            }

            if (! Schema::hasColumn('moabom_system_generated_apps', 'hosted_subdomain')) {
                $table->string('hosted_subdomain', 64)
                    ->nullable()
                    ->after('tier')
                    ->comment('Hosted 전용 서브도메인 라벨, 예: app43');
            }

            if (! Schema::hasColumn('moabom_system_generated_apps', 'storage_prefix')) {
                $table->string('storage_prefix', 255)
                    ->nullable()
                    ->after('hosted_subdomain')
                    ->comment('Hosted GCS prefix, 예: generated-apps/43/');
            }

            if (! Schema::hasColumn('moabom_system_generated_apps', 'provision_status')) {
                $table->string('provision_status', 16)
                    ->nullable()
                    ->after('storage_prefix')
                    ->comment('pending|ready|failed');
            }

            if (! Schema::hasColumn('moabom_system_generated_apps', 'provisioned_at')) {
                $table->timestamp('provisioned_at')
                    ->nullable()
                    ->after('provision_status');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('moabom_system_generated_apps')) {
            return;
        }

        Schema::table('moabom_system_generated_apps', function (Blueprint $table): void {
            foreach (['provisioned_at', 'provision_status', 'storage_prefix', 'hosted_subdomain', 'tier'] as $column) {
                if (Schema::hasColumn('moabom_system_generated_apps', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
