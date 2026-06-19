<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('social_auth_settings')) {
            return;
        }

        Schema::create('social_auth_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('provider', 30)->unique();
            $table->boolean('enabled')->default(false);
            $table->boolean('use_master_defaults')->default(true);
            $table->text('client_id')->nullable();
            $table->text('client_secret')->nullable();
            $table->string('redirect_uri', 500)->nullable();
            $table->boolean('google_request_auth_time')->default(false);
            $table->boolean('kakao_use_client_secret')->default(true);
            $table->json('extra_json')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_auth_settings');
    }
};

