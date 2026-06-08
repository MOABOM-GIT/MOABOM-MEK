<?php

namespace Plugins\Moabom\Weather\Tests\Unit;

use Plugins\Moabom\Weather\Services\OpenMeteoClient;
use Plugins\Moabom\Weather\Tests\PluginTestCase;

final class OpenMeteoClientTest extends PluginTestCase
{
    public function test_air_quality_url_includes_timezone_and_current_variables(): void
    {
        $url = (new OpenMeteoClient())->airQualityUrl(37.5, 127.0);

        $this->assertStringContainsString('timezone=auto', $url);
        $this->assertStringContainsString('current=pm10', $url);
    }
}
