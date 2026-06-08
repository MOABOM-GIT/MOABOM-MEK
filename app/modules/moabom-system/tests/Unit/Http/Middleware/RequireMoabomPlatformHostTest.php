<?php

namespace Modules\Moabom\System\Tests\Unit\Http\Middleware;

use Illuminate\Http\Request;
use Modules\Moabom\System\Http\Middleware\RequireMoabomPlatformHost;
use Modules\Moabom\System\Tests\ModuleTestCase;
use Symfony\Component\HttpKernel\Exception\HttpException;

class RequireMoabomPlatformHostTest extends ModuleTestCase
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

    public function test_allows_platform_request(): void
    {
        $middleware = new RequireMoabomPlatformHost;
        $response = $middleware->handle(Request::create('https://mek360.com'), fn () => response('ok'));

        $this->assertSame(200, $response->getStatusCode());
    }

    public function test_blocks_tenant_request(): void
    {
        $middleware = new RequireMoabomPlatformHost;

        $this->expectException(HttpException::class);
        $middleware->handle(Request::create('https://freshent.mek360.com'), fn () => response('ok'));
    }

    public function test_blocks_unknown_host(): void
    {
        $middleware = new RequireMoabomPlatformHost;

        $this->expectException(HttpException::class);
        $middleware->handle(Request::create('https://localhost'), fn () => response('ok'));
    }
}
