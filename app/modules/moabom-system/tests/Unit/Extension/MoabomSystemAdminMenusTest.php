<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Extension;

use Modules\Moabom\System\Extension\MoabomSystemAdminMenus;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Tests\ModuleTestCase;

final class MoabomSystemAdminMenusTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->app->register(SystemServiceProvider::class);
        config(['moabom-system.saas.enabled' => true]);
        config(['moabom-saas.enabled' => true]);
    }

    public function test_platform_host_shows_saas_hospitals_only(): void
    {
        app(TenantContext::class)->setPlatform('mek360.com');

        $menus = MoabomSystemAdminMenus::forCurrentRequest();
        $slugs = array_column($menus, 'slug');

        $this->assertContains('moabom-saas-hospitals', $slugs);
        $hospital = collect($menus)->firstWhere('slug', 'moabom-saas-hospitals');
        $this->assertSame('platform-settings', $hospital['parent_slug'] ?? null);
        $this->assertNotContains('moabom-tenant-settings', $slugs);
    }

    public function test_tenant_host_matches_platform_settings_group_without_tenant_settings_menu(): void
    {
        $tenant = new TenantRecord(
            id: 1,
            slug: 'freshent',
            host: 'freshent.mek360.com',
            dbDatabase: 'hospital_freshent',
            gcsPrefix: 'tenants/freshent',
            packageId: 'hospital-default',
            status: 'active',
        );

        app(TenantContext::class)->setTenant($tenant, $tenant->host);

        $menus = MoabomSystemAdminMenus::forCurrentRequest();
        $slugs = array_column($menus, 'slug');

        $this->assertContains('platform-settings', $slugs);
        $this->assertContains('moabom-system-settings', $slugs);
        $this->assertNotContains('moabom-tenant-settings', $slugs);
        $this->assertNotContains('moabom-saas-hospitals', $slugs);
        $this->assertNotContains('hospital-settings', $slugs);
    }
}
