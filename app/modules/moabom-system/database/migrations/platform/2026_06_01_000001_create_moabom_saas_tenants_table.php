<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * SaaS 플랫폼 레지스트리 — moabom_saas_tenants.
 *
 * 연결: moabom_platform (Cloud SQL `moabom-platform`).
 * 운영(freshent 등)에서는 이미 수동/Job 으로 만들어져 있을 수 있어
 * Schema::hasTable() 가드를 두어 idempotent 하게 적용한다.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('moabom_saas_tenants')) {
            return;
        }

        Schema::create('moabom_saas_tenants', function (Blueprint $table): void {
            $table->id();
            $table->string('slug', 63)->comment('서브도메인 라벨 (예: freshent)');
            $table->string('host', 255)->comment('테넌트 FQDN (예: freshent.mek360.com)');
            $table->string('db_database', 128)->comment('테넌트 MySQL 데이터베이스명');
            $table->string('gcs_prefix', 255)->default('')->comment('GCS prefix (예: tenants/freshent)');
            $table->string('package_id', 64)->default('hospital-default')->comment('provision 패키지 ID');
            $table->string('status', 32)->default('active')->comment('active|provisioning|suspended|inactive');
            $table->string('app_url', 512)->nullable()->comment('https://{host}');
            $table->timestamps();

            $table->unique('slug');
            $table->unique('host');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('moabom_saas_tenants');
    }
};
