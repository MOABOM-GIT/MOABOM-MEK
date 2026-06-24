<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('moabom_presence_user_preferences')) {
            return;
        }

        if (Schema::hasColumn('moabom_presence_user_preferences', 'show_avatar_in_connect_list')) {
            return;
        }

        Schema::table('moabom_presence_user_preferences', function (Blueprint $table): void {
            $table->boolean('show_avatar_in_connect_list')
                ->default(true)
                ->after('activity_message')
                ->comment('접속자 목록에 프로필 사진 표시 여부');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('moabom_presence_user_preferences')) {
            return;
        }

        if (! Schema::hasColumn('moabom_presence_user_preferences', 'show_avatar_in_connect_list')) {
            return;
        }

        Schema::table('moabom_presence_user_preferences', function (Blueprint $table): void {
            $table->dropColumn('show_avatar_in_connect_list');
        });
    }
};
