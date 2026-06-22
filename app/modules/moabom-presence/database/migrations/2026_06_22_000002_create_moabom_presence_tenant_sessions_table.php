<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('moabom_presence_tenant_sessions')) {
            return;
        }

        Schema::create('moabom_presence_tenant_sessions', function (Blueprint $table): void {
            $table->id()->comment('테넌트 접속 세션 ID');
            $table->string('session_key', 64)->comment('접속 세션 키(해시)');
            $table->foreignId('user_id')->nullable()->comment('인증 사용자 ID')->constrained('users')->nullOnDelete();
            $table->string('display_name', 120)->comment('표시 이름');
            $table->string('status_text', 255)->nullable()->comment('활동 상태 문구');
            $table->string('avatar', 512)->nullable()->comment('아바타 URL');
            $table->boolean('is_authenticated')->default(false)->comment('로그인 여부');
            $table->timestamp('last_seen_at')->comment('마지막 heartbeat 시각');
            $table->timestamps();

            $table->unique('session_key', 'moabom_presence_tenant_sessions_key_uq');
            $table->index('last_seen_at', 'moabom_presence_tenant_sessions_seen_idx');
            $table->index('user_id', 'moabom_presence_tenant_sessions_user_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moabom_presence_tenant_sessions');
    }
};
