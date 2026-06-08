<?php

namespace Modules\Moabom\System\Tests\Unit\Http\Middleware;

use Illuminate\Http\Request;
use Modules\Moabom\System\Http\Middleware\RestrictPlatformApiToPlatformHost;
use Modules\Moabom\System\Tests\ModuleTestCase;
use Symfony\Component\HttpKernel\Exception\HttpException;

class RestrictPlatformApiToPlatformHostTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'moabom-system.saas.enabled' => true,
            'moabom-system.saas.base_domain' => 'mek360.com',
            'moabom-system.saas.platform_hosts' => ['mek360.com', 'www.mek360.com'],
        ]);
    }

    public function test_allows_platform_host_on_platform_api_path(): void
    {
        $middleware = new RestrictPlatformApiToPlatformHost;
        $request = Request::create(
            'https://mek360.com/api/modules/moabom-system/platform/saas/hospitals',
            'GET',
            server: ['HTTP_HOST' => 'mek360.com'],
        );

        $response = $middleware->handle($request, fn () => response('ok'));

        $this->assertSame(200, $response->getStatusCode());
    }

    public function test_blocks_tenant_host_on_platform_api_path(): void
    {
        $middleware = new RestrictPlatformApiToPlatformHost;
        $request = Request::create(
            'https://freshent.mek360.com/api/modules/moabom-system/platform/saas/hospitals',
            'GET',
            server: ['HTTP_HOST' => 'freshent.mek360.com'],
        );

        $this->expectException(HttpException::class);
        $middleware->handle($request, fn () => response('ok'));
    }

    public function test_ignores_non_platform_api_paths_on_tenant_host(): void
    {
        $middleware = new RestrictPlatformApiToPlatformHost;
        $request = Request::create(
            'https://freshent.mek360.com/api/modules/moabom-system/public/shell-boot',
            'GET',
            server: ['HTTP_HOST' => 'freshent.mek360.com'],
        );

        $response = $middleware->handle($request, fn () => response('ok'));

        $this->assertSame(200, $response->getStatusCode());
    }
}
