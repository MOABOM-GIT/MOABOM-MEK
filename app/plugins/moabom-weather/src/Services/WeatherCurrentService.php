<?php

namespace Plugins\Moabom\Weather\Services;

use Illuminate\Http\Client\Pool;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Plugins\Moabom\Weather\Contracts\WeatherCurrentServiceInterface;
use Plugins\Moabom\Weather\Exceptions\UpstreamUnavailableException;
use Plugins\Moabom\Weather\Services\Dto\WeatherSnapshotDto;
use Throwable;

/**
 * Weather_Current_API 의 도메인 서비스 구현.
 *
 * - Open-Meteo Forecast + Air-Quality 를 `Http::pool` 로 병렬 호출한다.
 * - 위도/경도를 0.1° 그리드(약 11km) 로 반올림한 문자열 + 언어로 `Cache::remember` 키를 구성(Req 7.5).
 * - Forecast 실패 시 `UpstreamUnavailableException` 을 throw → `Cache::remember` 가 캐시에 기록하지 않음(Req 7.13).
 * - Air-Quality 실패 시에는 `pm2_5 / pm10 / dust` 를 `null` 로 채워 graceful degrade(Req 7.6).
 */
class WeatherCurrentService implements WeatherCurrentServiceInterface
{
    public function __construct(
        private readonly OpenMeteoClient $openMeteo,
    ) {}

    public function fetch(float $lat, float $lon, string $lang): WeatherSnapshotDto
    {
        $cacheKey = $this->cacheKey($lat, $lon, $lang);

        $array = Cache::remember($cacheKey, 600, function () use ($lat, $lon, $lang) {
            return $this->fetchFromUpstream($lat, $lon, $lang);
        });

        return $this->hydrate($array, $lat, $lon);
    }

    /**
     * 0.1° 그리드 + 언어로 캐시 키를 구성한다(Req 7.5).
     */
    private function cacheKey(float $lat, float $lon, string $lang): string
    {
        return sprintf(
            'moabom_weather_current:%.1f:%.1f:%s',
            round($lat, 1),
            round($lon, 1),
            $lang,
        );
    }

    /**
     * Open-Meteo Forecast + Air-Quality 병렬 호출 후 정규화된 배열을 반환한다.
     *
     * @return array<string, mixed>
     *
     * @throws UpstreamUnavailableException Forecast 실패 시. Cache::remember 가 닫힌 클로저 안에서
     *                                      예외를 던지면 캐시에 값이 기록되지 않는다.
     */
    private function fetchFromUpstream(float $lat, float $lon, string $lang): array
    {
        $forecastUrl = $this->openMeteo->forecastUrl($lat, $lon, $lang);
        $airUrl = $this->openMeteo->airQualityUrl($lat, $lon);

        $client = $this->openMeteo->client();
        $forecast = null;
        $air = null;

        try {
            $responses = $client->pool(fn (Pool $pool) => [
                $pool->as('forecast')->get($forecastUrl),
                $pool->as('air')->get($airUrl),
            ]);
            $forecast = $responses['forecast'] ?? null;
            $air = $responses['air'] ?? null;
        } catch (Throwable) {
            // pool 실패(연결 제한 등) 시 순차 호출로 재시도
            try {
                $forecast = $client->get($forecastUrl);
                $air = $client->get($airUrl);
            } catch (Throwable $sequentialError) {
                throw new UpstreamUnavailableException(
                    'Open-Meteo request failed: '.$sequentialError->getMessage(),
                );
            }
        }

        if (! $forecast instanceof Response || ! $forecast->ok()) {
            throw new UpstreamUnavailableException($this->formatUpstreamFailure('Forecast', $forecast));
        }

        $forecastBody = $forecast->json();
        if (is_array($forecastBody) && ($forecastBody['error'] ?? false) === true) {
            throw new UpstreamUnavailableException($this->formatApiError('Forecast', $forecastBody));
        }

        $forecastJson = is_array($forecastBody) ? $forecastBody : [];

        $airJson = $air instanceof Response && $air->ok()
            ? ($air->json() ?? [])
            : null;

        return $this->normalize($forecastJson, $airJson);
    }

    /**
     * Open-Meteo 원시 응답을 WeatherSnapshotDto 직렬화 형태로 정규화한다.
     *
     * @param  array<string, mixed>  $forecast  Forecast JSON.
     * @param  array<string, mixed>|null  $air  Air-Quality JSON (실패 시 null → pm 필드 모두 null).
     * @return array<string, mixed>
     */
    private function normalize(array $forecast, ?array $air): array
    {
        $current = (array) ($forecast['current'] ?? []);
        $daily = (array) ($forecast['daily'] ?? []);

        $sunrise = null;
        $sunset = null;
        if (isset($daily['sunrise'][0]) && is_string($daily['sunrise'][0])) {
            $sunrise = $daily['sunrise'][0];
        }
        if (isset($daily['sunset'][0]) && is_string($daily['sunset'][0])) {
            $sunset = $daily['sunset'][0];
        }

        $airCurrent = $air !== null ? (array) ($air['current'] ?? []) : [];

        return [
            'weather_code' => $this->asInt($current['weather_code'] ?? 0),
            'wind_speed_10m' => $this->asFloat($current['wind_speed_10m'] ?? 0),
            'wind_direction_10m' => $this->asFloat($current['wind_direction_10m'] ?? 0),
            'temperature_2m' => $this->asFloat($current['temperature_2m'] ?? 0),
            'is_day' => $this->asInt($current['is_day'] ?? 1) === 0 ? 0 : 1,
            'pm2_5' => $air === null ? null : $this->asNullableFloat($airCurrent['pm2_5'] ?? null),
            'pm10' => $air === null ? null : $this->asNullableFloat($airCurrent['pm10'] ?? null),
            'dust' => $air === null ? null : $this->asNullableFloat($airCurrent['dust'] ?? null),
            'sunrise' => $sunrise,
            'sunset' => $sunset,
            'fetched_at' => now()->toIso8601String(),
        ];
    }

    /**
     * 캐시된 정규화 배열을 DTO 로 복원한다. 호출자에게는 항상 DTO 가 전달된다.
     *
     * @param  array<string, mixed>  $data
     */
    private function hydrate(array $data, float $lat, float $lon): WeatherSnapshotDto
    {
        return new WeatherSnapshotDto(
            weatherCode: (int) ($data['weather_code'] ?? 0),
            windSpeed10m: (float) ($data['wind_speed_10m'] ?? 0),
            windDirection10m: (float) ($data['wind_direction_10m'] ?? 0),
            temperature2m: (float) ($data['temperature_2m'] ?? 0),
            isDay: (int) ($data['is_day'] ?? 1) === 0 ? 0 : 1,
            pm25: $this->asNullableFloat($data['pm2_5'] ?? null),
            pm10: $this->asNullableFloat($data['pm10'] ?? null),
            dust: $this->asNullableFloat($data['dust'] ?? null),
            sunrise: isset($data['sunrise']) && is_string($data['sunrise']) ? $data['sunrise'] : null,
            sunset: isset($data['sunset']) && is_string($data['sunset']) ? $data['sunset'] : null,
            fetchedAt: isset($data['fetched_at']) && is_string($data['fetched_at'])
                ? $data['fetched_at']
                : now()->toIso8601String(),
            lat: round($lat, 1),
            lon: round($lon, 1),
        );
    }

    private function asInt(mixed $value): int
    {
        return is_numeric($value) ? (int) $value : 0;
    }

    private function asFloat(mixed $value): float
    {
        return is_numeric($value) ? (float) $value : 0.0;
    }

    private function asNullableFloat(mixed $value): ?float
    {
        if ($value === null) {
            return null;
        }

        return is_numeric($value) ? (float) $value : null;
    }

    /**
     * @param  array<string, mixed>  $body
     */
    private function formatApiError(string $api, array $body): string
    {
        $reason = trim((string) ($body['reason'] ?? ''));

        return $reason !== ''
            ? sprintf('Open-Meteo %s API error: %s', $api, $reason)
            : sprintf('Open-Meteo %s API error', $api);
    }

    private function formatUpstreamFailure(string $api, mixed $response): string
    {
        if ($response instanceof Response) {
            $json = $response->json();
            if (is_array($json) && ($json['error'] ?? false) === true) {
                return $this->formatApiError($api, $json);
            }

            return sprintf(
                'Open-Meteo %s HTTP %d',
                $api,
                $response->status(),
            );
        }

        return sprintf('Open-Meteo %s request failed', $api);
    }
}
