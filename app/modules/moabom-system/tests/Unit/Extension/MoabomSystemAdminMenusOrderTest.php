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

    public function test_tenant_host_declares_platform_settings_before_notification_slot(): void
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

        $this->assertSame(3, $topLevel['platform-settings'] ?? null);
    }

    public function test_platform_host_places_hospitals_under_dashboard_and_platform_settings_under_settings(): void
    {
        app(TenantContext::class)->setPlatform('mek360.com');

        $topLevel = $this->topLevelOrders(MoabomSystemAdminMenus::forCurrentRequest());

        // SaaS 그룹 wrapper 제거 — 병원 관리만 top-level (대시보드[core order 1] 밑, order 2).
        $this->assertArrayNotHasKey('platform-saas', $topLevel);
        $this->assertSame(2, $topLevel['moabom-saas-hospitals'] ?? null);

        // 플랫폼 환경설정은 마스터·테넌트 공통으로 환경설정[core order 2] 바로 밑(order 3).
        $this->assertSame(3, $topLevel['platform-settings'] ?? null);
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
}
