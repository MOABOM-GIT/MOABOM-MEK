<?php

use Illuminate\Support\Facades\Route;
use Plugins\Moabom\Weather\Http\Controllers\WeatherCurrentController;
use Plugins\Moabom\Weather\Http\Controllers\WeatherGeolocateController;

/*
|--------------------------------------------------------------------------
| Moabom Weather Plugin API Routes
|--------------------------------------------------------------------------
|
| `PluginRouteServiceProvider` 가 `/api/plugins/moabom-weather` prefix 를 자동
| 적용한다. 모든 엔드포인트는 공개 응답이며 사용자별 정보를 다루지 않으므로
| 인증 미들웨어를 부착하지 않고 throttle 만 사용한다.
|
| - GET /weather/current   → Weather_Snapshot (Open-Meteo Forecast + Air-Quality)
| - GET /weather/geolocate → IP-based 위치(Cloudflare 헤더 우선, ipinfo.io fallback)
|
*/

Route::prefix('weather')->group(function () {
    Route::get('current', [WeatherCurrentController::class, '__invoke'])
        ->middleware('throttle:60,1')
        ->name('weather.current');

    Route::get('geolocate', [WeatherGeolocateController::class, '__invoke'])
        ->middleware('throttle:60,1')
        ->name('weather.geolocate');
});
