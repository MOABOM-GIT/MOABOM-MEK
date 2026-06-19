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
            if (! Schema::hasColumn('moabom_system_generated_apps', 'is_shared')) {
                $table->boolean('is_shared')
                    ->default(false)
                    ->after('html')
                    ->comment('공유 공개 여부');
            }

            if (
                Schema::hasColumn('moabom_system_generated_apps', 'is_shared')
                && ! $this->hasIndex('moabom_system_generated_apps', 'moabom_generated_apps_shared_created_idx')
            ) {
                $table->index(['is_shared', 'created_at'], 'moabom_generated_apps_shared_created_idx');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('moabom_system_generated_apps')) {
            return;
        }

        Schema::table('moabom_system_generated_apps', function (Blueprint $table) {
            if (Schema::hasColumn('moabom_system_generated_apps', 'is_shared')) {
                if ($this->hasIndex('moabom_system_generated_apps', 'moabom_generated_apps_shared_created_idx')) {
                    $table->dropIndex('moabom_generated_apps_shared_created_idx');
                }
                $table->dropColumn('is_shared');
            }
        });
    }

    private function hasIndex(string $table, string $index): bool
    {
        return collect(Schema::getIndexes($table))
            ->contains(fn (array $item): bool => ($item['name'] ?? null) === $index);
    }
};
