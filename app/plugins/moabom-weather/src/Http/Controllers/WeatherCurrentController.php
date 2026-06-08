<?php

namespace Plugins\Moabom\Weather\Http\Controllers;

use App\Helpers\ResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Plugins\Moabom\Weather\Contracts\WeatherCurrentServiceInterface;
use Plugins\Moabom\Weather\Exceptions\UpstreamUnavailableException;
use Plugins\Moabom\Weather\Http\Requests\GetWeatherCurrentRequest;

/**
 * Weather_Current_API — `GET /api/plugins/moabom-weather/weather/current?lat&lon&lang`.
 *
 * Open-Meteo Forecast + Air-Quality 를 병렬로 조회해 Weather_Snapshot 을 반환한다(Req 7.4–7.6).
 * Forecast 실패 시 서비스가 `UpstreamUnavailableException` 을 throw 하고 본 컨트롤러가 503 으로 매핑한다(Req 7.13).
 */
class WeatherCurrentController extends Controller
{
    public function __invoke(
        GetWeatherCurrentRequest $request,
        WeatherCurrentServiceInterface $service,
    ): JsonResponse {
        $resolved = $request->resolved();

        try {
            $snapshot = $service->fetch(
                $resolved['lat'],
                $resolved['lon'],
                $resolved['lang'],
            );
        } catch (UpstreamUnavailableException) {
            return ResponseHelper::pluginError(
                'moabom-weather',
                'messages.weather.upstream_unavailable',
                503,
            );
        }

        return ResponseHelper::pluginSuccess(
            'moabom-weather',
            'messages.weather.fetch_success',
            $snapshot->toArray(),
        );
    }
}
