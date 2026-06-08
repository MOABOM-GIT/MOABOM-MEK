<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 마이그레이션 실행.
     *
     * 테이블명은 보존(F1 호환): 분리 이전 moabom-system 이 사용한
     * `moabom_system_cpap_measurements` 그대로. `Schema::hasTable()` 가드로
     * 이미 존재하는 tenant 에서는 no-op.
     */
    public function up(): void
    {
        if (Schema::hasTable('moabom_system_cpap_measurements')) {
            return;
        }

        Schema::create('moabom_system_cpap_measurements', function (Blueprint $table) {
            $table->id()->comment('양압기 마스크 피팅 측정 ID');
            $table->foreignId('user_id')
                ->comment('측정 사용자 ID')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->json('profile')->comment('설문 기반 사용자 프로필');
            $table->json('measurements')->comment('정면 안면 측정값');
            $table->json('profile_measurements')->nullable()->comment('측면 안면 측정값');
            $table->json('recommendation')->comment('마스크 추천 결과');
            $table->string('mask_type', 60)->nullable()->comment('추천 마스크 유형');
            $table->decimal('confidence', 5, 2)->nullable()->comment('추천 신뢰도');
            $table->json('metadata')->nullable()->comment('측정 부가 정보');
            $table->timestamps();

            $table->index(['user_id', 'created_at'], 'moabom_cpap_measurements_user_created_idx');
            $table->index('mask_type', 'moabom_cpap_measurements_mask_type_idx');
        });
    }

    /**
     * 마이그레이션 롤백.
     */
    public function down(): void
    {
        Schema::dropIfExists('moabom_system_cpap_measurements');
    }
};
