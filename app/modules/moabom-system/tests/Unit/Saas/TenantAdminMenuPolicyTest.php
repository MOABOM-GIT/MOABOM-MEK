<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Saas\TenantAdminMenuPolicy;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Tests\ModuleTestCase;

final class TenantAdminMenuPolicyTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->app->register(SystemServiceProvider::class);
        config(['moabom-system.saas.enabled' => true]);
        config(['moabom-saas.enabled' => true]);

        if (! Schema::hasTable('menus')) {
            $this->markTestSkipped('menus table not available');
        }
    }

    public function test_apply_hygiene_purges_forbidden_and_links_child_under_platform_settings(): void
    {
        $tenant = new TenantRecord(
            id: 1,
            slug: 'test-tenant',
            host: 'test.mek360.com',
            dbDatabase: 'hospital_test',
            gcsPrefix: 'tenants/test',
            packageId: 'hospital-default',
            status: 'active',
        );
        app(TenantContext::class)->setTenant($tenant, $tenant->host);

        $platformSettingsId = DB::table('menus')->insertGetId([
            'slug' => 'platform-settings',
            'name' => json_encode(['ko' => '플랫폼 환경설정'], JSON_UNESCAPED_UNICODE),
            'url' => null,
            'parent_id' => null,
            'order' => 2,
            'is_active' => true,
            'extension_type' => 'module',
            'extension_identifier' => 'moabom-system',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $forbiddenId = DB::table('menus')->insertGetId([
            'slug' => 'moabom-saas-hospitals',
            'name' => json_encode(['ko' => '병원 관리'], JSON_UNESCAPED_UNICODE),
            'url' => '/admin/saas/hospitals',
            'parent_id' => null,
            'order' => 1,
            'is_active' => true,
            'extension_type' => 'module',
            'extension_identifier' => 'moabom-system',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $deprecatedId = DB::table('menus')->insertGetId([
            'slug' => 'hospital-settings',
            'name' => json_encode(['ko' => '병원 설정'], JSON_UNESCAPED_UNICODE),
            'url' => null,
            'parent_id' => null,
            'order' => 5,
            'is_active' => true,
            'extension_type' => 'module',
            'extension_identifier' => 'moabom-system',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $childId = DB::table('menus')->insertGetId([
            'slug' => 'moabom-tenant-settings',
            'name' => json_encode(['ko' => '병원 운영 설정'], JSON_UNESCAPED_UNICODE),
            'url' => '/admin/platform/settings/tenant',
            'parent_id' => null,
            'order' => 10,
            'is_active' => true,
            'extension_type' => 'module',
            'extension_identifier' => 'moabom-system',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $policy = app(TenantAdminMenuPolicy::class);
        $result = $policy->applyHygiene();

        $this->assertSame(3, $result['purged']);
        $this->assertSame(0, $result['linked']);
        $this->assertNull(DB::table('menus')->where('id', $forbiddenId)->first());
        $this->assertNull(DB::table('menus')->where('id', $deprecatedId)->first());
        $this->assertNull(DB::table('menus')->where('id', $childId)->first());

        DB::table('menus')->where('id', $platformSettingsId)->delete();
    }

}
