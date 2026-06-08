<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 마이그레이션 실행.
     *
     * 테이블명은 보존(F1 호환): 분리 이전 moabom-system 이 사용한 `moabom_system_generated_apps`
     * 그대로. `Schema::hasTable()` 가드로 이미 존재하는 tenant 에서는 no-op.
     */
    public function up(): void
    {
        if (Schema::hasTable('moabom_system_generated_apps')) {
            return;
        }

        Schema::create('moabom_system_generated_apps', function (Blueprint $table) {
            $table->id()->comment('생성 앱 ID');
            $table->foreignId('user_id')
                ->comment('생성 사용자 ID')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->string('title', 120)->comment('생성 앱 제목');
            $table->string('app_type', 40)->default('general')->comment('생성 앱 유형');
            $table->string('model_id', 60)->nullable()->comment('AI 모델 식별자');
            $table->longText('prompt')->nullable()->comment('생성 요청 프롬프트');
            $table->longText('html')->comment('생성된 HTML 문서');
            $table->json('metadata')->nullable()->comment('생성 앱 부가 정보');
            $table->timestamps();

            $table->index(['user_id', 'created_at'], 'moabom_generated_apps_user_created_idx');
            $table->index('app_type', 'moabom_generated_apps_type_idx');
        });
    }

    /**
     * 마이그레이션 롤백.
     */
    public function down(): void
    {
        Schema::dropIfExists('moabom_system_generated_apps');
    }
};
