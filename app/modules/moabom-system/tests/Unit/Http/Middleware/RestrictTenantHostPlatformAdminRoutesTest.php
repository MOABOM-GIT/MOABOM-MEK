<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Http\Middleware;

use Illuminate\Http\Request;
use Modules\Moabom\System\Http\Middleware\RestrictTenantHostPlatformAdminRoutes;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Tests\ModuleTestCase;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

final class RestrictTenantHostPlatformAdminRoutesTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->app->register(SystemServiceProvider::class);
        config(['moabom-system.saas.enabled' => true]);
    }

    public function test_tenant_host_blocks_admin_saas_spa(): void
    {
        $this->bindTenant();

        $this->expectException(NotFoundHttpException::class);

        (new RestrictTenantHostPlatformAdminRoutes)->handle(
            Request::create('https://freshent.mek360.com/admin/saas/hospitals', 'GET'),
            fn () => response('ok'),
        );
    }

    public function test_tenant_host_redirects_legacy_tenant_settings_to_mypage(): void
    {
        $this->bindTenant();

        $response = (new RestrictTenantHostPlatformAdminRoutes)->handle(
            Request::create('https://freshent.mek360.com/admin/platform/settings/tenant', 'GET'),
            fn () => response('ok'),
        );

        $this->assertSame(302, $response->getStatusCode());
        $this->assertSame(
            'https://freshent.mek360.com/admin/platform/settings/mypage',
            $response->headers->get('Location'),
        );
    }

    public function test_platform_host_allows_admin_saas_spa(): void
    {
        app(TenantContext::class)->setPlatform('mek360.com');

        $response = (new RestrictTenantHostPlatformAdminRoutes)->handle(
            Request::create('https://mek360.com/admin/saas/hospitals', 'GET'),
            fn () => response('ok', 200),
        );

        $this->assertSame(200, $response->getStatusCode());
    }

    private function bindTenant(): void
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
    }
}
