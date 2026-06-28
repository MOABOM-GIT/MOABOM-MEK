<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * moabom_saas_tenants 에 업체 표시용 메타 컬럼 추가 (display_name·region·address).
 *
 * - tenant DB `settings/general.json` 만 보유하던 표시명을 platform 레지스트리에도 미러링하여
 *   `/admin/saas/hospitals` 목록을 cross-DB 조회 없이 렌더한다.
 * - Schema::hasColumn() 가드로 idempotent — 이미 추가된 운영 DB 에서는 no-op.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('moabom_saas_tenants')) {
            return;
        }

        Schema::table('moabom_saas_tenants', function (Blueprint $table): void {
            if (! Schema::hasColumn('moabom_saas_tenants', 'display_name')) {
                $table->string('display_name', 200)->nullable()->after('host')->comment('업체 표시명 (general.json site_name 동기화)');
            }
            if (! Schema::hasColumn('moabom_saas_tenants', 'region')) {
                $table->string('region', 100)->nullable()->after('display_name')->comment('지역 (예: 대구)');
            }
            if (! Schema::hasColumn('moabom_saas_tenants', 'address')) {
                $table->string('address', 500)->nullable()->after('region')->comment('주소');
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('moabom_saas_tenants')) {
            return;
        }

        Schema::table('moabom_saas_tenants', function (Blueprint $table): void {
            foreach (['address', 'region', 'display_name'] as $column) {
                if (Schema::hasColumn('moabom_saas_tenants', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
