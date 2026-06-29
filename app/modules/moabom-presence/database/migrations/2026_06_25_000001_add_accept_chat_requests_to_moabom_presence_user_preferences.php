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

        if (Schema::hasColumn('moabom_presence_user_preferences', 'accept_chat_requests')) {
            return;
        }

        Schema::table('moabom_presence_user_preferences', function (Blueprint $table): void {
            $table->boolean('accept_chat_requests')
                ->default(true)
                ->after('show_avatar_in_connect_list')
                ->comment('메시지 요청 수락 여부 (1: 수락, 0: 거부)');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('moabom_presence_user_preferences')) {
            return;
        }

        if (! Schema::hasColumn('moabom_presence_user_preferences', 'accept_chat_requests')) {
            return;
        }

        Schema::table('moabom_presence_user_preferences', function (Blueprint $table): void {
            $table->dropColumn('accept_chat_requests');
        });
    }
};
