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
        Schema::create('social_accounts', function (Blueprint $table) {
            $table->id()->comment('SNS 계정 고유 ID');
            $table->unsignedBigInteger('user_id')->comment('연결된 사용자 ID');
            $table->string('provider', 30)->comment('SNS 제공자 식별자');
            $table->string('provider_user_id', 191)->comment('SNS 제공자 사용자 ID');
            $table->string('email')->nullable()->comment('SNS 제공자 이메일');
            $table->string('name')->nullable()->comment('SNS 제공자 이름');
            $table->string('nickname')->nullable()->comment('SNS 제공자 닉네임');
            $table->text('avatar')->nullable()->comment('SNS 제공자 프로필 이미지 URL');
            $table->text('access_token')->nullable()->comment('암호화된 SNS access token');
            $table->text('refresh_token')->nullable()->comment('암호화된 SNS refresh token');
            $table->timestamp('token_expires_at')->nullable()->comment('SNS access token 만료 일시');
            $table->timestamp('linked_at')->nullable()->comment('SNS 계정 연결 일시');
            $table->timestamps();

            $table->unique(['provider', 'provider_user_id'], 'social_accounts_provider_user_unique');
            $table->index('user_id', 'social_accounts_user_id_index');
            $table->index(['user_id', 'provider'], 'social_accounts_user_provider_index');
            $table->index('email', 'social_accounts_email_index');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('social_accounts');
    }
};
