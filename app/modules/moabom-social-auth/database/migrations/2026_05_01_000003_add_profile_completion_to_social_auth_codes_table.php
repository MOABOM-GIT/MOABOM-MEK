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
        Schema::table('social_auth_codes', function (Blueprint $table) {
            $table->boolean('requires_profile_completion')
                ->default(false)
                ->after('provider')
                ->comment('프로필 보완 필요 여부');
            $table->timestamp('profile_completed_at')
                ->nullable()
                ->after('expires_at')
                ->comment('프로필 보완 완료 일시');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('social_auth_codes', function (Blueprint $table) {
            $table->dropColumn(['requires_profile_completion', 'profile_completed_at']);
        });
    }
};
