<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('moabom_fcm_device_tokens');

        Schema::create('moabom_fcm_device_tokens', function (Blueprint $table) {
            $table->id()->comment('행 ID');
            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete()
                ->comment('사용자 ID');
            $table->unsignedBigInteger('tenant_id')->nullable()->comment('테넌트 ID (플랫폼 단일 DB 시 null 가능)');
            $table->string('token', 512)->comment('FCM 등록 토큰');
            $table->string('platform', 16)->default('web')->comment('플랫폼: web|android|ios');
            $table->string('device_label', 120)->nullable()->comment('기기 표시 라벨');
            $table->string('user_agent', 512)->nullable()->comment('등록 시점 User-Agent');
            $table->timestamp('last_seen_at')->nullable()->comment('최근 토큰 갱신 시각');
            $table->timestamps();

            $table->unique('token');
            $table->index(['user_id', 'platform']);
            $table->index(['tenant_id', 'user_id']);
        });

        if (DB::getDriverName() === 'mysql') {
            Schema::table('moabom_fcm_device_tokens', function (Blueprint $table) {
                $table->comment('Moabom FCM 디바이스 등록 토큰');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('moabom_fcm_device_tokens');
    }
};
