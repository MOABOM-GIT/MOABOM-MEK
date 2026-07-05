<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Illuminate\Support\Facades\Config;
use Modules\Moabom\System\Saas\MoabomRuntimeDriverSettings;
use Modules\Moabom\System\Tests\ModuleTestCase;

class MoabomRuntimeDriverSettingsTest extends ModuleTestCase
{
    protected function tearDown(): void
    {
        putenv('BROADCAST_CONNECTION');
        parent::tearDown();
    }

    public function test_websocket_enabled_follows_broadcast_connection_env_not_runtime_config(): void
    {
        Config::set('broadcasting.default', 'null');
        putenv('BROADCAST_CONNECTION=reverb');

        $normalized = MoabomRuntimeDriverSettings::normalize([
            'websocket_enabled' => false,
        ]);

        $this->assertTrue($normalized['websocket_enabled'] ?? false);
    }

    public function test_effective_broadcast_connection_prefers_env(): void
    {
        Config::set('broadcasting.default', 'null');
        putenv('BROADCAST_CONNECTION=reverb');

        $this->assertSame('reverb', MoabomRuntimeDriverSettings::effectiveBroadcastConnection());
    }
}
