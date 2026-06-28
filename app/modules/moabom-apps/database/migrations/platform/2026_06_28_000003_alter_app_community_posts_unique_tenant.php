<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 플랫폼 DB — 앱 이야기 unique 를 (app, author tenant, user, type) 로 확장.
 */
return new class extends Migration
{
    protected $connection = 'moabom_platform';

    public function up(): void
    {
        if (! Schema::connection($this->connection)->hasTable('moabom_app_community_posts')) {
            return;
        }

        Schema::connection($this->connection)->table('moabom_app_community_posts', function (Blueprint $table): void {
            $table->dropUnique('moabom_app_comm_posts_app_user_type_uniq');
            $table->unique(
                ['generated_app_id', 'tenant_slug', 'user_id', 'post_type'],
                'moabom_app_comm_posts_app_tenant_user_type_uniq',
            );
        });
    }

    public function down(): void
    {
        if (! Schema::connection($this->connection)->hasTable('moabom_app_community_posts')) {
            return;
        }

        Schema::connection($this->connection)->table('moabom_app_community_posts', function (Blueprint $table): void {
            $table->dropUnique('moabom_app_comm_posts_app_tenant_user_type_uniq');
            $table->unique(
                ['generated_app_id', 'user_id', 'post_type'],
                'moabom_app_comm_posts_app_user_type_uniq',
            );
        });
    }
};
