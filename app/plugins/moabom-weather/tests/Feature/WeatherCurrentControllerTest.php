<?php

namespace Plugins\Moabom\Weather\Tests\Feature;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Plugins\Moabom\Weather\Http\Support\WeatherConditionalHeaders;
use Plugins\Moabom\Weather\Tests\PluginTestCase;

final class WeatherCurrentControllerTest extends PluginTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        config([
            'moabom-weather.http_timeout' => 12,
            'moabom-weather.forecast_days' => 1,
        ]);
    }

    public function test_current_returns_etag_and_cache_control_headers(): void
    {
        Http::fake([
            'api.open-meteo.com/v1/forecast*' => Http::response([
                'current' => [
                    'weather_code' => 3,
                    'wind_speed_10m' => 2.0,
                    'wind_direction_10m' => 90,
                    'temperature_2m' => 18.0,
                    'is_day' => 1,
                ],
                'daily' => [
                    'sunrise' => ['2026-06-28T05:12'],
                    'sunset' => ['2026-06-28T19:45'],
                ],
            ]),
            'air-quality-api.open-meteo.com/v1/air-quality*' => Http::response([
                'current' => ['pm10' => 12.0, 'pm2_5' => 8.0, 'dust' => 1.0],
            ]),
        ]);

        $response = $this->getJson('/api/plugins/moabom-weather/weather/current?lat=37.5&lon=127.0&lang=ko');

        $response->assertOk();
        $response->assertHeader('ETag');
        $response->assertHeader('Last-Modified');
        $this->assertStringContainsString('private, max-age=300', (string) $response->headers->get('Cache-Control'));
    }

    public function test_current_returns_304_when_if_none_match_matches(): void
    {
        Http::fake([
            'api.open-meteo.com/v1/forecast*' => Http::response([
                'current' => [
                    'weather_code' => 0,
                    'wind_speed_10m' => 1.0,
                    'wind_direction_10m' => 0,
                    'temperature_2m' => 20.0,
                    'is_day' => 1,
                ],
                'daily' => [
                    'sunrise' => ['2026-06-28T05:12'],
                    'sunset' => ['2026-06-28T19:45'],
                ],
            ]),
            'air-quality-api.open-meteo.com/v1/air-quality*' => Http::response([
                'current' => ['pm10' => 10.0, 'pm2_5' => 5.0, 'dust' => 0.5],
            ]),
        ]);

        $first = $this->getJson('/api/plugins/moabom-weather/weather/current?lat=37.5&lon=127.0&lang=ko');
        $first->assertOk();

        $etag = (string) $first->headers->get('ETag');
        $this->assertNotSame('', $etag);

        $second = $this->withHeaders(['If-None-Match' => $etag])
            ->getJson('/api/plugins/moabom-weather/weather/current?lat=37.5&lon=127.0&lang=ko');

        $second->assertStatus(304);
        $second->assertHeader('ETag', $etag);
    }

    public function test_conditional_headers_use_grid_rounding(): void
    {
        $headersA = WeatherConditionalHeaders::build(37.54, 127.04, 'ko', '2026-06-28T10:00:00+00:00');
        $headersB = WeatherConditionalHeaders::build(37.56, 127.06, 'ko', '2026-06-28T10:00:00+00:00');

        $this->assertSame($headersA['ETag'], $headersB['ETag']);
    }
}
