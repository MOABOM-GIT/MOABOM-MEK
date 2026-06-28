<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * tenant 단일 DB — 앱 이야기 글 전체 삭제 및 집계 캐시 리셋 (1회성).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('moabom_app_community_posts')) {
            DB::table('moabom_app_community_posts')->delete();
        }

        if (Schema::hasTable('moabom_system_generated_apps')
            && Schema::hasColumn('moabom_system_generated_apps', 'community_post_count')) {
            DB::table('moabom_system_generated_apps')->update([
                'community_rating_avg' => null,
                'community_rating_count' => 0,
                'community_post_count' => 0,
            ]);
        }
    }

    public function down(): void
    {
        // 데이터 복구 불가 — no-op
    }
};
