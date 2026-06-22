<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 홈 셸 앱 사용량·랭킹 스냅샷 테이블 생성
     */
    public function up(): void
    {
        if (! Schema::hasTable('moabom_shell_app_usage_buckets')) {
            Schema::create('moabom_shell_app_usage_buckets', function (Blueprint $table) {
                $table->id()->comment('셸 앱 사용량 버킷 ID');
                $table->dateTime('bucket_hour')->comment('집계 시간 버킷(UTC, 시 단위)');
                $table->string('app_id', 128)->comment('셸 앱 식별자');
                $table->unsignedInteger('open_hits')->default(0)->comment('앱 오픈 횟수');
                $table->unsignedInteger('active_seconds')->default(0)->comment('활성 사용 시간(초)');
                $table->timestamps();

                $table->unique(['bucket_hour', 'app_id'], 'moabom_shell_usage_bucket_unique');
                $table->index(['bucket_hour', 'app_id'], 'moabom_shell_usage_bucket_hour_app_idx');
            });
        }

        if (! Schema::hasTable('moabom_shell_rank_snapshots')) {
            Schema::create('moabom_shell_rank_snapshots', function (Blueprint $table) {
                $table->id()->comment('셸 랭킹 스냅샷 ID');
                $table->string('scope', 16)->comment('랭킹 범위(apps|users)');
                $table->dateTime('bucket_hour')->comment('스냅샷 기준 시각(UTC, 시 단위)');
                $table->json('ranks')->comment('식별자→순위 JSON');
                $table->timestamps();

                $table->unique(['scope', 'bucket_hour'], 'moabom_shell_rank_snapshot_scope_hour_unique');
                $table->index('bucket_hour', 'moabom_shell_rank_snapshot_hour_idx');
            });
        }

        if (DB::getDriverName() === 'mysql') {
            if (Schema::hasTable('moabom_shell_app_usage_buckets')) {
                Schema::table('moabom_shell_app_usage_buckets', function (Blueprint $table) {
                    $table->comment('홈 셸 앱 사용량 시간 버킷');
                });
            }
            if (Schema::hasTable('moabom_shell_rank_snapshots')) {
                Schema::table('moabom_shell_rank_snapshots', function (Blueprint $table) {
                    $table->comment('홈 셸 랭킹 시간 스냅샷');
                });
            }
        }
    }

    /**
     * 마이그레이션 롤백
     */
    public function down(): void
    {
        Schema::dropIfExists('moabom_shell_rank_snapshots');
        Schema::dropIfExists('moabom_shell_app_usage_buckets');
    }
};
