<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Extension;

use Modules\Moabom\System\Extension\MoabomSystemAdminMenus;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Tests\ModuleTestCase;

final class MoabomSystemAdminMenusOrderTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->app->register(SystemServiceProvider::class);
        config(['moabom-system.saas.enabled' => true]);
    }

    public function test_tenant_host_declares_platform_menu_above_dashboard_slot(): void
    {
        $tenant = new TenantRecord(
            id: 1,
            slug: 't',
            host: 't.mek360.com',
            dbDatabase: 'hospital_t',
            gcsPrefix: 'tenants/t',
            packageId: 'hospital-default',
            status: 'active',
        );
        app(TenantContext::class)->setTenant($tenant, $tenant->host);

        $topLevel = $this->topLevelOrders(MoabomSystemAdminMenus::forCurrentRequest());

        $this->assertSame(0, $topLevel['platform-settings'] ?? null);
        $this->assertArrayNotHasKey('moabom-saas-hospitals', $topLevel);
    }

    public function test_platform_host_places_platform_menu_first_and_hospital_under_it(): void
    {
        app(TenantContext::class)->setPlatform('mek360.com');

        $menus = MoabomSystemAdminMenus::forCurrentRequest();
        $topLevel = $this->topLevelOrders($menus);

        $this->assertArrayNotHasKey('platform-saas', $topLevel);
        $this->assertSame(0, $topLevel['platform-settings'] ?? null);
        $this->assertArrayNotHasKey('moabom-saas-hospitals', $topLevel);

        $hospital = $this->menuBySlug($menus, 'moabom-saas-hospitals');
        $this->assertNotNull($hospital);
        $this->assertSame('platform-settings', $hospital['parent_slug'] ?? null);
        $this->assertSame(10, (int) ($hospital['order'] ?? 0));
    }

    /**
     * @param  list<array<string, mixed>>  $menus
     * @return array<string, int>
     */
    private function topLevelOrders(array $menus): array
    {
        $orders = [];
        foreach ($menus as $menu) {
            if (isset($menu['parent_slug'])) {
                continue;
            }
            $slug = $menu['slug'] ?? null;
            if (is_string($slug) && $slug !== '') {
                $orders[$slug] = (int) ($menu['order'] ?? 0);
            }
        }

        return $orders;
    }

    /**
     * @param  list<array<string, mixed>>  $menus
     * @return array<string, mixed>|null
     */
    private function menuBySlug(array $menus, string $slug): ?array
    {
        foreach ($menus as $menu) {
            if (($menu['slug'] ?? null) === $slug) {
                return $menu;
            }
        }

        return null;
    }
}
