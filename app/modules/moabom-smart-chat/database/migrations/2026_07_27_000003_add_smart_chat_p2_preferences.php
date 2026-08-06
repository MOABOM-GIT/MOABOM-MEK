<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('moabom_smart_chat_preferences')) {
            return;
        }

        Schema::table('moabom_smart_chat_preferences', function (Blueprint $table): void {
            if (! Schema::hasColumn('moabom_smart_chat_preferences', 'enabled_tools')) {
                $table->json('enabled_tools')->nullable()->after('custom_instructions')
                    ->comment('사이트 툴 allowlist (weather|profile)');
            }
            if (! Schema::hasColumn('moabom_smart_chat_preferences', 'web_search_enabled')) {
                $table->boolean('web_search_enabled')->default(false)->after('enabled_tools')
                    ->comment('웹검색 옵트인 기본값');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('moabom_smart_chat_preferences')) {
            return;
        }

        Schema::table('moabom_smart_chat_preferences', function (Blueprint $table): void {
            if (Schema::hasColumn('moabom_smart_chat_preferences', 'web_search_enabled')) {
                $table->dropColumn('web_search_enabled');
            }
            if (Schema::hasColumn('moabom_smart_chat_preferences', 'enabled_tools')) {
                $table->dropColumn('enabled_tools');
            }
        });
    }
};
