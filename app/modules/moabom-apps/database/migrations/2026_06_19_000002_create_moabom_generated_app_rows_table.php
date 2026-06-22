<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('moabom_generated_app_rows')) {
            return;
        }

        Schema::create('moabom_generated_app_rows', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('generated_app_id')->comment('moabom_system_generated_apps.id');
            $table->unsignedBigInteger('user_id')->nullable()->comment('행 소유 사용자');
            $table->string('table_key', 120)->comment('앱 내 논리 테이블명');
            $table->json('payload');
            $table->timestamps();

            $table->index(['generated_app_id', 'table_key'], 'moabom_gen_app_rows_app_table_idx');
            $table->index(['generated_app_id', 'created_at'], 'moabom_gen_app_rows_app_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moabom_generated_app_rows');
    }
};
