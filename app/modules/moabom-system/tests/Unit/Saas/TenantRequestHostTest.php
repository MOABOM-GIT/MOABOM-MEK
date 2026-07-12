<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Illuminate\Http\Request;
use Modules\Moabom\System\Saas\TenantRequestHost;
use Modules\Moabom\System\Tests\ModuleTestCase;

class TenantRequestHostTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'moabom-system.saas.base_domain' => 'mek360.com',
            'moabom-system.saas.platform_hosts' => ['mek360.com', 'www.mek360.com', 'auth.mek360.com'],
        ]);
    }

    public function test_prefers_x_forwarded_host_on_cloud_run_default_host(): void
    {
        $request = Request::create(
            'https://internal.run.app/api/test',
            'GET',
            server: [
                'HTTP_HOST' => 'mobaom-container-ptzusd23ha-du.a.run.app',
                'HTTP_X_FORWARDED_HOST' => 'freshent.mek360.com',
            ],
        );

        $this->assertSame('freshent.mek360.com', TenantRequestHost::resolve($request));
    }

    public function test_falls_back_to_get_host(): void
    {
        $request = Request::create(
            'https://freshent.mek360.com/api/test',
            'GET',
            server: ['HTTP_HOST' => 'freshent.mek360.com'],
        );

        $this->assertSame('freshent.mek360.com', TenantRequestHost::resolve($request));
    }

    public function test_ignores_spoofed_forwarded_host_when_request_host_is_saas(): void
    {
        $request = Request::create(
            'https://freshent.mek360.com/api/test',
            'GET',
            server: [
                'HTTP_HOST' => 'freshent.mek360.com',
                'HTTP_X_FORWARDED_HOST' => 'victim.mek360.com',
            ],
        );

        $this->assertSame('freshent.mek360.com', TenantRequestHost::resolve($request));
    }

    public function test_rejects_forwarded_host_outside_saas_allowlist(): void
    {
        $request = Request::create(
            'https://mobaom-container-ptzusd23ha-du.a.run.app/api/test',
            'GET',
            server: [
                'HTTP_HOST' => 'mobaom-container-ptzusd23ha-du.a.run.app',
                'HTTP_X_FORWARDED_HOST' => 'evil.example.com',
            ],
        );

        $this->assertSame('mobaom-container-ptzusd23ha-du.a.run.app', TenantRequestHost::resolve($request));
    }
}
