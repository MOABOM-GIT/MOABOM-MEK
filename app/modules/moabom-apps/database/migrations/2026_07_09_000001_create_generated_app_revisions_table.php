<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 로컬/비 SaaS — 생성앱 HTML 리비전 테이블 (tenant 또는 default 연결).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('moabom_generated_app_revisions')) {
            return;
        }

        Schema::create('moabom_generated_app_revisions', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('generated_app_id')->comment('생성 앱 ID');
            $table->unsignedInteger('revision_number')->comment('앱 내 단조 증가 리비전');
            $table->string('source', 16)->default('save')->comment('save|restore|patch|import');
            $table->string('html_hash', 64)->comment('sha256 of html');
            $table->longText('html')->comment('스냅샷 HTML');
            $table->string('title', 120)->nullable();
            $table->unsignedBigInteger('created_by')->nullable()->comment('스냅샷 생성 사용자');
            $table->timestamps();

            $table->unique(['generated_app_id', 'revision_number'], 'moabom_gen_app_rev_app_num_uq');
            $table->index(['generated_app_id', 'created_at'], 'moabom_gen_app_rev_app_created_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moabom_generated_app_revisions');
    }
};
