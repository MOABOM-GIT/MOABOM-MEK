<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 마이그레이션 실행.
     *
     * 신규 앱 → v9 테이블 prefix 규칙(`moabom_consulting_*`)을 따른다.
     * `Schema::hasTable()` 가드로 이미 존재하는 tenant 에서는 no-op.
     */
    public function up(): void
    {
        if (Schema::hasTable('moabom_consulting_contracts')) {
            return;
        }

        Schema::create('moabom_consulting_contracts', function (Blueprint $table) {
            $table->id()->comment('컨설팅 전자계약 ID');
            $table->foreignId('user_id')
                ->comment('계약을 작성한 상담원(로그인 사용자) ID')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->string('hospital_name', 200)->comment('병원명');
            $table->string('representative_name', 120)->nullable()->comment('대표자/원장명');
            $table->string('contact', 120)->nullable()->comment('연락처');
            $table->string('business_number', 40)->nullable()->comment('사업자등록번호');
            $table->string('plan', 120)->nullable()->comment('선택 요금제/플랜');
            $table->json('simulation_input')->nullable()->comment('계약 시점 시뮬레이션 입력값');
            $table->json('simulation_result')->nullable()->comment('계약 시점 시뮬레이션 결과 요약');
            $table->string('signer_name', 120)->nullable()->comment('서명자명');
            $table->longText('signature')->nullable()->comment('서명 이미지(data URL, base64 PNG)');
            $table->timestamp('signed_at')->nullable()->comment('서명 완료 일시');
            $table->string('status', 20)->default('draft')->comment('계약 상태: draft|signed');
            $table->text('memo')->nullable()->comment('특이사항 메모');
            $table->timestamps();

            $table->index(['user_id', 'created_at'], 'moabom_consulting_contracts_user_created_idx');
            $table->index('status', 'moabom_consulting_contracts_status_idx');
        });
    }

    /**
     * 마이그레이션 롤백.
     */
    public function down(): void
    {
        Schema::dropIfExists('moabom_consulting_contracts');
    }
};
