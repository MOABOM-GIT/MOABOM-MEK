<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('moabom_ai_generation_sessions')) {
            return;
        }

        Schema::create('moabom_ai_generation_sessions', function (Blueprint $table) {
            $table->id()->comment('AI 생성 세션 ID');
            $table->foreignId('user_id')
                ->comment('소유 사용자 ID')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->string('status', 20)->default('active')->comment('active|streaming|paused|completed|abandoned');
            $table->string('app_type', 40)->default('general')->comment('앱 유형');
            $table->string('model_id', 60)->comment('AI 모델 식별자');
            $table->json('messages')->nullable()->comment('대화 히스토리(리믹스·이어하기)');
            $table->longText('partial_raw')->nullable()->comment('스트리밍 중간 버퍼');
            $table->foreignId('generated_app_id')
                ->nullable()
                ->comment('저장된 생성 앱 ID')
                ->constrained('moabom_system_generated_apps')
                ->nullOnDelete();
            $table->string('finish_reason', 40)->nullable()->comment('length 등 upstream 종료 사유');
            $table->boolean('truncated')->default(false)->comment('토큰 제한 등으로 잘림 여부');
            $table->timestamps();

            $table->index(['user_id', 'status', 'updated_at'], 'moabom_ai_gen_sessions_user_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moabom_ai_generation_sessions');
    }
};
