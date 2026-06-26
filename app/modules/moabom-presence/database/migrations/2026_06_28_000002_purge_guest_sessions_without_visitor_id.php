<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * visitor_id SSOT 전환 후 guest 잔여 행 제거 — 동일 브라우저가 session_key·visitor_id 두 행으로 보이던 현상.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('moabom_presence_tenant_sessions')
            || ! Schema::hasColumn('moabom_presence_tenant_sessions', 'visitor_id')) {
            return;
        }

        DB::table('moabom_presence_tenant_sessions')
            ->whereNull('user_id')
            ->whereNull('visitor_id')
            ->delete();
    }

    public function down(): void
    {
        // 데이터 복구 불가 — no-op
    }
};
