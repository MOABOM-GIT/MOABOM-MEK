<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasTable('social_auth_codes')) {
            return;
        }

        Schema::table('social_auth_codes', function (Blueprint $table) {
            if (! Schema::hasColumn('social_auth_codes', 'requires_profile_completion')) {
                $table->boolean('requires_profile_completion')
                    ->default(false)
                    ->after('provider')
                    ->comment('프로필 보완 필요 여부');
            }
            if (! Schema::hasColumn('social_auth_codes', 'profile_completed_at')) {
                $table->timestamp('profile_completed_at')
                    ->nullable()
                    ->after('expires_at')
                    ->comment('프로필 보완 완료 일시');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('social_auth_codes')) {
            return;
        }

        Schema::table('social_auth_codes', function (Blueprint $table) {
            if (Schema::hasColumn('social_auth_codes', 'requires_profile_completion')) {
                $table->dropColumn('requires_profile_completion');
            }
            if (Schema::hasColumn('social_auth_codes', 'profile_completed_at')) {
                $table->dropColumn('profile_completed_at');
            }
        });
    }
};
