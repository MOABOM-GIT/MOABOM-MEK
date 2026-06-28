<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 생성앱 집계 캐시 — 앱 이야기 별점·글 수.
 */
return new class extends Migration
{
    protected $connection = 'moabom_platform';

    public function up(): void
    {
        if (! Schema::connection($this->connection)->hasTable('moabom_system_generated_apps')) {
            return;
        }

        Schema::connection($this->connection)->table('moabom_system_generated_apps', function (Blueprint $table): void {
            if (! Schema::connection($this->connection)->hasColumn('moabom_system_generated_apps', 'community_rating_avg')) {
                $table->decimal('community_rating_avg', 3, 2)->nullable()->after('metadata')->comment('앱 이야기 평균 별점');
            }
            if (! Schema::connection($this->connection)->hasColumn('moabom_system_generated_apps', 'community_rating_count')) {
                $table->unsignedInteger('community_rating_count')->default(0)->after('community_rating_avg')->comment('평점 있는 글 수');
            }
            if (! Schema::connection($this->connection)->hasColumn('moabom_system_generated_apps', 'community_post_count')) {
                $table->unsignedInteger('community_post_count')->default(0)->after('community_rating_count')->comment('공개 글 수');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::connection($this->connection)->hasTable('moabom_system_generated_apps')) {
            return;
        }

        Schema::connection($this->connection)->table('moabom_system_generated_apps', function (Blueprint $table): void {
            $columns = ['community_post_count', 'community_rating_count', 'community_rating_avg'];
            foreach ($columns as $column) {
                if (Schema::connection($this->connection)->hasColumn('moabom_system_generated_apps', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
