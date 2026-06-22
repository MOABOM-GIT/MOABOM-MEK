<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use Modules\Moabom\Apps\Support\GeneratedAppAdminScope;
use Modules\Moabom\Apps\Tests\ModuleTestCase;
use Modules\Moabom\System\Providers\SystemServiceProvider;

class GeneratedAppAdminScopeTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->app->register(SystemServiceProvider::class);

        config([
            'moabom-system.saas.enabled' => true,
            'moabom-system.saas.base_domain' => 'mek360.com',
            'moabom-system.saas.platform_hosts' => ['mek360.com', 'www.mek360.com'],
        ]);
    }

    public function test_platform_host_resolves_platform_scope(): void
    {
        $scope = $this->resolveScopeForHost('mek360.com');

        $this->assertTrue($scope->isPlatform());
        $this->assertSame(GeneratedAppAdminScope::MODE_PLATFORM, $scope->mode);
        $this->assertNull($scope->tenantSlug);
        $this->assertTrue($scope->listMeta()['abilities']['show_tenant_column']);
    }

    public function test_tenant_host_resolves_locked_tenant_scope(): void
    {
        $scope = $this->resolveScopeForHost('mosan.mek360.com');

        $this->assertFalse($scope->isPlatform());
        $this->assertSame(GeneratedAppAdminScope::MODE_TENANT, $scope->mode);
        $this->assertSame('mosan', $scope->tenantSlug);
        $this->assertFalse($scope->listMeta()['abilities']['filter_tenant_slug']);
    }

    public function test_tenant_scope_ignores_requested_tenant_slug_filter(): void
    {
        $scope = $this->resolveScopeForHost('mosan.mek360.com');

        $this->assertSame('mosan', $scope->resolveFilterTenantSlug('other'));
    }

    private function resolveScopeForHost(string $host): GeneratedAppAdminScope
    {
        $request = request();
        $request->headers->set('Host', $host);

        return GeneratedAppAdminScope::fromRequest();
    }
}
