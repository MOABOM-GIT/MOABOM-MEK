<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Modules\Moabom\System\Saas\SaasCachedConfigBridge;
use Modules\Moabom\System\Tests\ModuleTestCase;

final class SaasCachedConfigBridgeTest extends ModuleTestCase
{
    protected function tearDown(): void
    {
        putenv('MOABOM_SAAS_ENABLED');
        putenv('MOABOM_SAAS_BASE_DOMAIN');
        putenv('MOABOM_SAAS_PLATFORM_HOSTS');

        if ($this->app->configurationIsCached()) {
            $this->artisan('config:clear');
        }

        parent::tearDown();
    }

    public function test_applies_saas_enabled_from_getenv_when_config_cached(): void
    {
        putenv('MOABOM_SAAS_ENABLED=true');
        putenv('MOABOM_SAAS_BASE_DOMAIN=mek360.com');
        putenv('MOABOM_SAAS_PLATFORM_HOSTS=mek360.com,www.mek360.com');

        $this->artisan('config:cache');

        $this->assertFileExists(base_path('bootstrap/cache/config.php'));

        SaasCachedConfigBridge::applyIfNeeded();

        $this->assertTrue(config('moabom-system.saas.enabled'));
        $this->assertSame('mek360.com', config('moabom-system.saas.base_domain'));
        $this->assertSame(['mek360.com', 'www.mek360.com'], config('moabom-system.saas.platform_hosts'));
    }
}
