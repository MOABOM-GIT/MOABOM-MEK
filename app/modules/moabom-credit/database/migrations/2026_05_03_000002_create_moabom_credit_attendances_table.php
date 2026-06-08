<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('moabom_credit_attendances', function (Blueprint $table) {
            $table->id()->comment('크레딧 출석체크 ID');
            $table->foreignId('user_id')
                ->comment('사용자 ID')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->date('attendance_date')->comment('출석체크 일자');
            $table->unsignedBigInteger('reward_amount')->default(0)->comment('출석 적립 크레딧');
            $table->boolean('ad_watched')->default(false)->comment('광고 시청 여부');
            $table->json('meta')->nullable()->comment('출석체크 부가 정보');
            $table->timestamps();

            $table->unique(['user_id', 'attendance_date']);
        });

        if (DB::getDriverName() === 'mysql') {
            Schema::table('moabom_credit_attendances', function (Blueprint $table) {
                $table->comment('모아봄 크레딧 출석체크 기록');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('moabom_credit_attendances');
    }
};
