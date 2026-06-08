<?php

namespace Plugins\Moabom\Weather\Http\Controllers;

use App\Helpers\ResponseHelper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Plugins\Moabom\Weather\Contracts\IpGeolocationServiceInterface;

/**
 * Weather_Geolocate_API — `GET /api/plugins/moabom-weather/weather/geolocate`.
 *
 * Req 7.9: 외부 실패·빈 결과를 포함한 모든 상태에서 200 OK 를 반환한다.
 * 성공 시 `{ data: { lat, lon, city?, country? } }`, 실패·빈 결과 시 `{ data: {} }` 를 돌려준다.
 */
class WeatherGeolocateController extends Controller
{
    public function __invoke(
        Request $request,
        IpGeolocationServiceInterface $service,
    ): JsonResponse {
        $location = $service->resolve($request);

        if ($location === []) {
            $location = new \stdClass();
        }

        return ResponseHelper::pluginSuccess(
            'moabom-weather',
            'messages.weather.geolocate_success',
            $location,
        );
    }
}
