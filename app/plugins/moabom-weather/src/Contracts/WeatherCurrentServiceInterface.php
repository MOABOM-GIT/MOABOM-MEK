<?php

namespace Plugins\Moabom\Weather\Contracts;

use Plugins\Moabom\Weather\Exceptions\UpstreamUnavailableException;
use Plugins\Moabom\Weather\Services\Dto\WeatherSnapshotDto;

/**
 * Weather_Current_API (`GET /weather/current`) 의 도메인 서비스 계약.
 *
 * 구현체(`WeatherCurrentService`) 는 Open-Meteo Forecast + Air-Quality 를 병렬 호출하고
 * `Cache::remember` 로 결과를 캐시한다(Req 7.5).
 * Forecast 실패 시 `UpstreamUnavailableException` 을 throw 하여 캐시에 기록하지 않는다(Req 7.13).
 */
interface WeatherCurrentServiceInterface
{
    /**
     * 주어진 좌표·언어로 Weather_Snapshot 을 조회한다.
     *
     * @param  float  $lat  위도(Req 7.4 의 검증을 통과한 값).
     * @param  float  $lon  경도(Req 7.4 의 검증을 통과한 값).
     * @param  string  $lang  응답 라벨 언어(ko|en|ja|zh).
     *
     * @throws UpstreamUnavailableException Open-Meteo Forecast 실패 시.
     */
    public function fetch(float $lat, float $lon, string $lang): WeatherSnapshotDto;
}
