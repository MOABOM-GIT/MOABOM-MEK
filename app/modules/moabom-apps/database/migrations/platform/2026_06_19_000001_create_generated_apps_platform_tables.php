<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * 플랫폼 DB(moabom-platform) — 생성앱 중앙 집중 plane.
 *
 * 연결: moabom_platform (SaasPlatformMigrate 또는 moabom:apps:platform-migrate)
 */
return new class extends Migration
{
    protected $connection = 'moabom_platform';

    public function up(): void
    {
        if (! Schema::connection($this->connection)->hasTable('moabom_system_generated_apps')) {
            Schema::connection($this->connection)->create('moabom_system_generated_apps', function (Blueprint $table): void {
                $table->id()->comment('생성 앱 ID');
                $table->string('tenant_slug', 64)->default('default')->comment('SaaS tenant slug');
                $table->unsignedBigInteger('user_id')->comment('생성 사용자 ID');
                $table->string('title', 120)->comment('생성 앱 제목');
                $table->string('app_type', 40)->default('general')->comment('생성 앱 유형');
                $table->string('tier', 16)->default('standard')->comment('standard|hosted');
                $table->string('hosted_subdomain', 64)->nullable()->comment('Hosted 라벨 (앱 id)');
                $table->string('storage_prefix', 255)->nullable()->comment('Hosted GCS prefix');
                $table->string('provision_status', 16)->nullable();
                $table->timestamp('provisioned_at')->nullable();
                $table->string('model_id', 60)->nullable();
                $table->longText('prompt')->nullable();
                $table->longText('html')->comment('생성된 HTML');
                $table->boolean('is_shared')->default(false);
                $table->unsignedBigInteger('parent_app_id')->nullable();
                $table->unsignedInteger('version')->default(1);
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index(['tenant_slug', 'user_id', 'created_at'], 'moabom_gen_apps_tenant_user_idx');
                $table->index(['is_shared', 'created_at'], 'moabom_generated_apps_shared_created_idx');
                $table->index('app_type', 'moabom_generated_apps_type_idx');
            });
        }

        if (! Schema::connection($this->connection)->hasTable('moabom_generated_app_rows')) {
            Schema::connection($this->connection)->create('moabom_generated_app_rows', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('generated_app_id');
                $table->unsignedBigInteger('user_id')->nullable();
                $table->string('table_key', 64);
                $table->json('payload');
                $table->timestamps();

                $table->index(['generated_app_id', 'table_key'], 'moabom_gen_app_rows_app_table_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::connection($this->connection)->dropIfExists('moabom_generated_app_rows');
        Schema::connection($this->connection)->dropIfExists('moabom_system_generated_apps');
    }
};
