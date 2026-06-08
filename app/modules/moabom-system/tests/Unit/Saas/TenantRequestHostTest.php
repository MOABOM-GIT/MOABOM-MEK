<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Illuminate\Http\Request;
use Modules\Moabom\System\Saas\TenantRequestHost;
use Modules\Moabom\System\Tests\ModuleTestCase;

class TenantRequestHostTest extends ModuleTestCase
{
    public function test_prefers_x_forwarded_host_over_get_host(): void
    {
        $request = Request::create(
            'https://internal.run.app/api/test',
            'GET',
            server: [
                'HTTP_HOST' => 'internal.run.app',
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
}
