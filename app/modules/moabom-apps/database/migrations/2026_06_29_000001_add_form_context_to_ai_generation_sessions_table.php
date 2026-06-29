<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('moabom_ai_generation_sessions')) {
            return;
        }

        Schema::table('moabom_ai_generation_sessions', function (Blueprint $table) {
            if (! Schema::hasColumn('moabom_ai_generation_sessions', 'form_context')) {
                $table->json('form_context')
                    ->nullable()
                    ->after('model_id')
                    ->comment('이어하기용 폼 상태(title·prompt·tier)');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('moabom_ai_generation_sessions')) {
            return;
        }

        Schema::table('moabom_ai_generation_sessions', function (Blueprint $table) {
            if (Schema::hasColumn('moabom_ai_generation_sessions', 'form_context')) {
                $table->dropColumn('form_context');
            }
        });
    }
};
