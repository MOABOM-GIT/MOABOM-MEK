<?php

namespace Plugins\Moabom\Weather\Tests\Unit;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Plugins\Moabom\Weather\Exceptions\UpstreamUnavailableException;
use Plugins\Moabom\Weather\Services\OpenMeteoClient;
use Plugins\Moabom\Weather\Services\WeatherCurrentService;
use Plugins\Moabom\Weather\Tests\PluginTestCase;

final class WeatherCurrentServiceTest extends PluginTestCase
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

    public function test_fetch_parses_current_and_daily_from_forecast(): void
    {
        Http::fake([
            'api.open-meteo.com/v1/forecast*' => Http::response([
                'current' => [
                    'weather_code' => 0,
                    'wind_speed_10m' => 3.5,
                    'wind_direction_10m' => 180,
                    'temperature_2m' => 22.1,
                    'is_day' => 1,
                ],
                'daily' => [
                    'sunrise' => ['2026-06-04T05:12'],
                    'sunset' => ['2026-06-04T19:45'],
                ],
            ]),
            'air-quality-api.open-meteo.com/v1/air-quality*' => Http::response([
                'current' => ['pm10' => 21.0, 'pm2_5' => 18.0, 'dust' => 2.0],
            ]),
        ]);

        $dto = (new WeatherCurrentService(new OpenMeteoClient()))->fetch(37.5, 127.0, 'ko');

        $this->assertSame(0, $dto->weatherCode);
        $this->assertSame(22.1, $dto->temperature2m);
        $this->assertSame('2026-06-04T05:12', $dto->sunrise);
        $this->assertSame(18.0, $dto->pm25);
    }

    public function test_fetch_throws_when_forecast_returns_api_error_json(): void
    {
        Http::fake([
            'api.open-meteo.com/v1/forecast*' => Http::response([
                'error' => true,
                'reason' => 'Cannot initialize WeatherVariable from invalid String value',
            ], 400),
            'air-quality-api.open-meteo.com/v1/air-quality*' => Http::response(['current' => []]),
        ]);

        $this->expectException(UpstreamUnavailableException::class);

        (new WeatherCurrentService(new OpenMeteoClient()))->fetch(37.5, 127.0, 'ko');
    }

    public function test_forecast_url_includes_forecast_days_and_current_variables(): void
    {
        $url = (new OpenMeteoClient())->forecastUrl(37.5, 127.0, 'ko');

        $this->assertStringContainsString('forecast_days=1', $url);
        $this->assertStringContainsString('current=weather_code', $url);
        $this->assertStringContainsString('wind_speed_unit=ms', $url);
        $this->assertStringContainsString('language=ko', $url);
    }
}
