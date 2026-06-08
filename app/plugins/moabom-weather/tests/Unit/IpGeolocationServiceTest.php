<?php

namespace Plugins\Moabom\Weather\Tests\Unit;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Plugins\Moabom\Weather\Services\IpGeolocationService;
use Plugins\Moabom\Weather\Tests\PluginTestCase;

class IpGeolocationServiceTest extends PluginTestCase
{
    public function test_private_ip_uses_dev_fallback_coordinates(): void
    {
        Cache::flush();

        config([
            'moabom-weather.ip_provider' => 'cloudflare_then_ipinfo',
            'moabom-weather.dev_fallback_lat' => '37.5665',
            'moabom-weather.dev_fallback_lon' => '126.9780',
            'moabom-weather.dev_fallback_city' => 'Seoul',
            'moabom-weather.dev_fallback_country' => 'KR',
        ]);

        $request = Request::create('/api/plugins/moabom-weather/weather/geolocate', 'GET');
        $request->server->set('REMOTE_ADDR', '127.0.0.1');

        $result = (new IpGeolocationService())->resolve($request);

        $this->assertSame(37.5665, $result['lat']);
        $this->assertSame(126.978, $result['lon']);
        $this->assertSame('Seoul', $result['city']);
        $this->assertSame('KR', $result['country']);
    }
}
