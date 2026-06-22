<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 플랫폼 DB — Cloud Run 전체 접속자 집계 plane.
 */
return new class extends Migration
{
    protected $connection = 'moabom_platform';

    public function up(): void
    {
        if (! Schema::connection($this->connection)->hasTable('moabom_presence_platform_sessions')) {
            Schema::connection($this->connection)->create('moabom_presence_platform_sessions', function (Blueprint $table): void {
                $table->id()->comment('플랫폼 접속 세션 ID');
                $table->string('session_key', 64)->comment('접속 세션 키(해시)');
                $table->string('tenant_slug', 64)->comment('테넌트 slug');
                $table->string('user_uuid', 36)->nullable()->comment('인증 사용자 UUID');
                $table->string('display_name', 120)->comment('표시 이름');
                $table->boolean('is_authenticated')->default(false)->comment('로그인 여부');
                $table->timestamp('last_seen_at')->comment('마지막 heartbeat 시각');
                $table->timestamps();

                $table->unique('session_key', 'moabom_presence_platform_sessions_key_uq');
                $table->index(['tenant_slug', 'last_seen_at'], 'moabom_presence_platform_tenant_seen_idx');
                $table->index('last_seen_at', 'moabom_presence_platform_seen_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('moabom_presence_platform_sessions');
    }
};
