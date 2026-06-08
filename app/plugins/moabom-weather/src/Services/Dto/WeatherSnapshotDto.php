<?php

namespace Plugins\Moabom\Weather\Services\Dto;

/**
 * Weather_Snapshot 의 서버측 표현.
 *
 * `WeatherCurrentService` 가 Open-Meteo Forecast + Air-Quality 응답을 정규화해 만든다.
 * `toArray()` 는 Req 7.6 의 JSON 스키마(`data` key 하위) 와 정확히 일치한다.
 */
final readonly class WeatherSnapshotDto
{
    public function __construct(
        public int $weatherCode,
        public float $windSpeed10m,
        public float $windDirection10m,
        public float $temperature2m,
        public int $isDay,
        public ?float $pm25,
        public ?float $pm10,
        public ?float $dust,
        public ?string $sunrise,
        public ?string $sunset,
        public string $fetchedAt,
        public float $lat,
        public float $lon,
    ) {}

    /**
     * Req 7.6 의 응답 JSON 하위 구조를 그대로 반환한다.
     *
     * @return array{
     *   weather_code:int,
     *   wind_speed_10m:float,
     *   wind_direction_10m:float,
     *   temperature_2m:float,
     *   is_day:int,
     *   pm2_5:?float,
     *   pm10:?float,
     *   dust:?float,
     *   sunrise:?string,
     *   sunset:?string,
     *   fetched_at:string,
     *   location:array{lat:float,lon:float}
     * }
     */
    public function toArray(): array
    {
        return [
            'weather_code' => $this->weatherCode,
            'wind_speed_10m' => $this->windSpeed10m,
            'wind_direction_10m' => $this->windDirection10m,
            'temperature_2m' => $this->temperature2m,
            'is_day' => $this->isDay,
            'pm2_5' => $this->pm25,
            'pm10' => $this->pm10,
            'dust' => $this->dust,
            'sunrise' => $this->sunrise,
            'sunset' => $this->sunset,
            'fetched_at' => $this->fetchedAt,
            'location' => [
                'lat' => $this->lat,
                'lon' => $this->lon,
            ],
        ];
    }
}
