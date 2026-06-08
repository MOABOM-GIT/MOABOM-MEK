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
        Schema::create('social_auth_codes', function (Blueprint $table) {
            $table->id()->comment('SNS 인증 교환 코드 ID');
            $table->unsignedBigInteger('user_id')->comment('토큰을 발급할 사용자 ID');
            $table->string('code_hash', 64)->unique()->comment('일회용 코드 해시');
            $table->string('provider', 30)->comment('SNS 제공자 식별자');
            $table->timestamp('expires_at')->comment('코드 만료 일시');
            $table->timestamp('used_at')->nullable()->comment('코드 사용 일시');
            $table->timestamps();

            $table->index(['provider', 'expires_at'], 'social_auth_codes_provider_expires_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('social_auth_codes');
    }
};
