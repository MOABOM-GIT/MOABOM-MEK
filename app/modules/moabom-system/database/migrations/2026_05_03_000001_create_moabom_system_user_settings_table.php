<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * 마이그레이션 실행
     */
    public function up(): void
    {
        if (Schema::hasTable('moabom_system_user_settings')) {
            return;
        }

        Schema::create('moabom_system_user_settings', function (Blueprint $table) {
            $table->id()->comment('사용자 시스템 설정 ID');
            $table->foreignId('user_id')
                ->comment('사용자 ID')
                ->constrained('users')
                ->cascadeOnDelete();
            $table->json('settings')->comment('사용자별 Moabom 시스템 설정 JSON');
            $table->timestamps();

            $table->unique('user_id');
        });

        if (DB::getDriverName() === 'mysql') {
            if (Schema::hasTable('moabom_system_user_settings')) {
                Schema::table('moabom_system_user_settings', function (Blueprint $table) {
                    $table->comment('Moabom 사용자별 시스템 설정');
                });
            }
        }
    }

    /**
     * 마이그레이션 롤백
     */
    public function down(): void
    {
        Schema::dropIfExists('moabom_system_user_settings');
    }
};
