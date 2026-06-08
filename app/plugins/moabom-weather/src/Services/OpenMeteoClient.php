<?php

namespace Plugins\Moabom\Weather\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

/**
 * Open-Meteo Forecast · Air-Quality API 와의 HTTP 경계.
 *
 * @see https://open-meteo.com/en/docs
 */
class OpenMeteoClient
{
    private const FORECAST_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

    private const AIR_QUALITY_BASE_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';

    /**
     * 공통 HTTP 클라이언트 — 운영 타임아웃은 config(moabom-weather.http_*).
     */
    public function client(): PendingRequest
    {
        $timeout = max(3, (int) config('moabom-weather.http_timeout', 12));
        $connectTimeout = max(2, (int) config('moabom-weather.http_connect_timeout', 5));
        $retries = max(0, (int) config('moabom-weather.http_retries', 2));
        $retryMs = max(100, (int) config('moabom-weather.http_retry_sleep_ms', 300));

        return Http::connectTimeout($connectTimeout)
            ->timeout($timeout)
            ->retry($retries, $retryMs)
            ->withHeaders([
                'Accept' => 'application/json',
                'User-Agent' => 'moabom-weather/1.0 (+https://mek360.com)',
            ]);
    }

    /**
     * Forecast — current + 당일 일출·일몰만 (forecast_days=1 로 응답 최소화).
     */
    public function forecastUrl(float $lat, float $lon, string $lang): string
    {
        $forecastDays = max(1, min(16, (int) config('moabom-weather.forecast_days', 1)));

        return self::FORECAST_BASE_URL.'?'.http_build_query([
            'latitude' => $lat,
            'longitude' => $lon,
            'current' => 'weather_code,wind_speed_10m,wind_direction_10m,temperature_2m,is_day',
            'daily' => 'sunrise,sunset',
            'timezone' => 'auto',
            'forecast_days' => $forecastDays,
            'wind_speed_unit' => 'ms',
            'language' => $lang,
        ]);
    }

    /**
     * Air-Quality — current pm10/pm2_5/dust.
     */
    public function airQualityUrl(float $lat, float $lon): string
    {
        return self::AIR_QUALITY_BASE_URL.'?'.http_build_query([
            'latitude' => $lat,
            'longitude' => $lon,
            'timezone' => 'auto',
            'current' => 'pm10,pm2_5,dust',
        ]);
    }
}
