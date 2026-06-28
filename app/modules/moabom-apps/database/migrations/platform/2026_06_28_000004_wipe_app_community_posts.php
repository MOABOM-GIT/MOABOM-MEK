<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 운영 초기화 — 앱 이야기 글 전체 삭제 및 집계 캐시 리셋 (1회성).
 */
return new class extends Migration
{
    protected $connection = 'moabom_platform';

    public function up(): void
    {
        if (Schema::connection($this->connection)->hasTable('moabom_app_community_posts')) {
            DB::connection($this->connection)->table('moabom_app_community_posts')->delete();
        }

        if (Schema::connection($this->connection)->hasTable('moabom_system_generated_apps')
            && Schema::connection($this->connection)->hasColumn('moabom_system_generated_apps', 'community_post_count')) {
            DB::connection($this->connection)->table('moabom_system_generated_apps')->update([
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
