<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('moabom_presence_user_preferences')) {
            return;
        }

        Schema::create('moabom_presence_user_preferences', function (Blueprint $table): void {
            $table->id()->comment('접속 표시 설정 ID');
            $table->foreignId('user_id')->comment('사용자 ID')->constrained('users')->cascadeOnDelete();
            $table->string('availability', 16)->default('online')->comment('접속 상태: online|away|busy|offline');
            $table->string('subtitle_mode', 16)->default('profile_bio')->comment('부가 표시: profile_bio|activity|hidden');
            $table->string('activity_message', 255)->nullable()->comment('활동 메시지(subtitle_mode=activity)');
            $table->timestamps();

            $table->unique('user_id', 'moabom_presence_user_prefs_user_uq');
            $table->index('availability', 'moabom_presence_user_prefs_avail_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moabom_presence_user_preferences');
    }
};
