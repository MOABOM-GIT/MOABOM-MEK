<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 홈 셸 유저별 앱 사용량 시간 버킷 (활동지수·유저 랭킹용)
     */
    public function up(): void
    {
        if (Schema::hasTable('moabom_shell_user_usage_buckets')) {
            return;
        }

        Schema::create('moabom_shell_user_usage_buckets', function (Blueprint $table) {
            $table->id()->comment('셸 유저 사용량 버킷 ID');
            $table->foreignId('user_id')
                ->comment('사용자 ID')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->dateTime('bucket_hour')->comment('집계 시간 버킷(UTC, 시 단위)');
            $table->unsignedInteger('open_hits')->default(0)->comment('앱 오픈 횟수 합계');
            $table->unsignedInteger('active_seconds')->default(0)->comment('활성 사용 시간 합계(초)');
            $table->timestamps();

            $table->unique(['user_id', 'bucket_hour'], 'moabom_shell_user_usage_bucket_unique');
            $table->index(['bucket_hour', 'user_id'], 'moabom_shell_user_usage_bucket_hour_user_idx');
        });

        if (DB::getDriverName() === 'mysql') {
            Schema::table('moabom_shell_user_usage_buckets', function (Blueprint $table) {
                $table->comment('홈 셸 유저별 앱 사용량 시간 버킷');
            });
        }
    }

    /**
     * 마이그레이션 롤백
     */
    public function down(): void
    {
        Schema::dropIfExists('moabom_shell_user_usage_buckets');
    }
};
