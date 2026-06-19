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

        Schema::table('moabom_system_generated_apps', function (Blueprint $table) {
            if (! Schema::hasColumn('moabom_system_generated_apps', 'parent_app_id')) {
                $table->foreignId('parent_app_id')
                    ->nullable()
                    ->after('html')
                    ->comment('리믹스/포크 원본 생성 앱 ID')
                    ->constrained('moabom_system_generated_apps')
                    ->nullOnDelete();
            }

            if (! Schema::hasColumn('moabom_system_generated_apps', 'version')) {
                $table->unsignedInteger('version')
                    ->default(1)
                    ->after('parent_app_id')
                    ->comment('동일 앱 계열 버전');
            }
        });

        if (
            Schema::hasColumn('moabom_system_generated_apps', 'parent_app_id')
            && Schema::hasColumn('moabom_system_generated_apps', 'version')
            && ! $this->hasIndex('moabom_system_generated_apps', 'moabom_generated_apps_parent_version_idx')
        ) {
            Schema::table('moabom_system_generated_apps', function (Blueprint $table) {
                $table->index(['parent_app_id', 'version'], 'moabom_generated_apps_parent_version_idx');
            });
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('moabom_system_generated_apps')) {
            return;
        }

        Schema::table('moabom_system_generated_apps', function (Blueprint $table) {
            if ($this->hasIndex('moabom_system_generated_apps', 'moabom_generated_apps_parent_version_idx')) {
                $table->dropIndex('moabom_generated_apps_parent_version_idx');
            }
            if (Schema::hasColumn('moabom_system_generated_apps', 'parent_app_id')) {
                $table->dropConstrainedForeignId('parent_app_id');
            }
            if (Schema::hasColumn('moabom_system_generated_apps', 'version')) {
                $table->dropColumn('version');
            }
        });
    }

    private function hasIndex(string $table, string $index): bool
    {
        return collect(Schema::getIndexes($table))
            ->contains(fn (array $item): bool => ($item['name'] ?? null) === $index);
    }
};
