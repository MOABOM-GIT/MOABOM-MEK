<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Presence\Services\PresenceHeartbeatService;

/**
 * visitor_id 컬럼 도입 전 잔여 guest 행 정리 (TTL 초과분만).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('moabom_presence_tenant_sessions')
            || ! Schema::hasColumn('moabom_presence_tenant_sessions', 'visitor_id')) {
            return;
        }

        $before = now()->subSeconds(PresenceHeartbeatService::ACTIVE_TTL_SECONDS * 2);

        DB::table('moabom_presence_tenant_sessions')
            ->whereNull('visitor_id')
            ->where('last_seen_at', '<', $before)
            ->delete();
    }

    public function down(): void
    {
        // 데이터 복구 불가 — no-op
    }
};
