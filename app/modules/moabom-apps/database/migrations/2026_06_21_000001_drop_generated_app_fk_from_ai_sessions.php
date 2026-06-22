<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * AI 세션(generated_app_id) → platform 앱 plane 논리 참조.
 *
 * tenant DB 세션은 moabom-platform 의 앱 ID 를 가리키므로
 * tenant moabom_system_generated_apps FK 는 운영상 무효·저장 실패 원인.
 *
 * @see docs/GENERATED-APP-TIERS.md §12
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('moabom_ai_generation_sessions')) {
            return;
        }

        if (! Schema::hasColumn('moabom_ai_generation_sessions', 'generated_app_id')) {
            return;
        }

        Schema::table('moabom_ai_generation_sessions', function (Blueprint $table): void {
            try {
                $table->dropForeign(['generated_app_id']);
            } catch (\Throwable) {
                // 이미 제거됐거나 SQLite 등 FK 미지원 환경
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('moabom_ai_generation_sessions')) {
            return;
        }

        if (! Schema::hasColumn('moabom_ai_generation_sessions', 'generated_app_id')) {
            return;
        }

        if (! Schema::hasTable('moabom_system_generated_apps')) {
            return;
        }

        Schema::table('moabom_ai_generation_sessions', function (Blueprint $table): void {
            try {
                $table->foreign('generated_app_id')
                    ->references('id')
                    ->on('moabom_system_generated_apps')
                    ->nullOnDelete();
            } catch (\Throwable) {
                // platform plane 전환 후 rollback 비권장
            }
        });
    }
};
