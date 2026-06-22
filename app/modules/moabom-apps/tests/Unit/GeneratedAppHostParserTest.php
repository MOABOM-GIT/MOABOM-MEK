<?php

namespace Modules\Moabom\Apps\Tests\Unit;

use Modules\Moabom\Apps\Support\GeneratedAppHostParser;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class GeneratedAppHostParserTest extends ModuleTestCase
{
    public function test_parses_standard_apps_host(): void
    {
        config([
            'moabom-apps.preview.standard_host' => 'apps.mek360.com',
            'moabom-apps.preview.hosted_apps_domain' => 'apps.mek360.com',
        ]);

        $parsed = (new GeneratedAppHostParser)->parse('apps.mek360.com');

        $this->assertSame('standard', $parsed['type']);
        $this->assertNull($parsed['app_id']);
    }

    public function test_parses_hosted_app_id_subdomain(): void
    {
        config([
            'moabom-apps.preview.hosted_apps_domain' => 'apps.mek360.com',
        ]);

        $parsed = (new GeneratedAppHostParser)->parse('43.apps.mek360.com');

        $this->assertSame('hosted', $parsed['type']);
        $this->assertSame(43, $parsed['app_id']);
    }

    public function test_hospital_tenant_host_is_none(): void
    {
        config([
            'moabom-apps.preview.standard_host' => 'apps.mek360.com',
            'moabom-apps.preview.hosted_apps_domain' => 'apps.mek360.com',
        ]);

        $parsed = (new GeneratedAppHostParser)->parse('smoke.mek360.com');

        $this->assertSame('none', $parsed['type']);
    }
}
