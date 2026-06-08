<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Module 카테고리 JSON 의 storage backend 를 GCS → DB 로 전환.
 *
 * 각 tenant 의 hospital_{slug} DB 와 platform 의 default DB 양쪽에 동일 테이블 필요.
 * default connection 으로 migrate 실행 시 적용된 DB 에 생성됨.
 *
 * @see deploy/AGENT-FAILURE-ANALYSIS.md §9 — v98~v108 GCS staleness 실패 결산
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('moabom_module_settings', function (Blueprint $table) {
            $table->id()->comment('Module 설정 row ID');
            $table->string('module', 100)->comment('모듈 식별자 (예: moabom-system)');
            $table->string('category', 50)->comment('카테고리 식별자 (예: appearance, mypage, preferences)');
            $table->json('payload')->comment('카테고리 페이로드 JSON');
            $table->timestamps();

            $table->unique(['module', 'category'], 'uk_module_category');
            $table->index('module', 'idx_module');
        });

        if (DB::getDriverName() === 'mysql') {
            Schema::table('moabom_module_settings', function (Blueprint $table) {
                $table->comment('Moabom 모듈 카테고리 설정 (tenant-scoped DB 또는 platform DB)');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('moabom_module_settings');
    }
};
