<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * tenant 단일 DB fallback — 앱 이야기 글 plane.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('moabom_app_community_posts')) {
            return;
        }

        Schema::create('moabom_app_community_posts', function (Blueprint $table): void {
            $table->id()->comment('앱 이야기 글 ID');
            $table->unsignedBigInteger('generated_app_id')->comment('생성 앱 ID');
            $table->string('tenant_slug', 64)->default('default')->comment('SaaS tenant slug');
            $table->unsignedBigInteger('user_id')->comment('작성자 사용자 ID');
            $table->string('post_type', 16)->default('review')->comment('글 유형 (review|talk)');
            $table->unsignedTinyInteger('rating')->nullable()->comment('별점 1-5 (review 필수)');
            $table->string('title', 120)->comment('제목');
            $table->text('body')->comment('본문');
            $table->string('status', 16)->default('published')->comment('published|hidden|deleted');
            $table->string('hidden_reason', 32)->nullable()->comment('숨김 사유');
            $table->unsignedInteger('comments_count')->default(0)->comment('댓글 수 (Phase 2)');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['generated_app_id', 'created_at'], 'moabom_app_comm_posts_app_created_idx');
            $table->index(['tenant_slug', 'generated_app_id'], 'moabom_app_comm_posts_tenant_app_idx');
            $table->index(['user_id', 'generated_app_id'], 'moabom_app_comm_posts_user_app_idx');
            $table->index('status', 'moabom_app_comm_posts_status_idx');
            $table->unique(
                ['generated_app_id', 'tenant_slug', 'user_id', 'post_type'],
                'moabom_app_comm_posts_app_tenant_user_type_uniq',
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moabom_app_community_posts');
    }
};
