<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Moabom\Apps\Http\Controllers\AiAppController;
use Modules\Moabom\Cpap\Http\Controllers\CpapMeasurementController;
use Modules\Moabom\Personalization\Http\Controllers\UserMyPageActivityController;
use Plugins\Moabom\Weather\Http\Controllers\WeatherCurrentController;
use Plugins\Moabom\Weather\Http\Controllers\WeatherGeolocateController;

/*
|--------------------------------------------------------------------------
| Decomposition API compat — legacy moabom-system prefix → 분리된 핸들러
|--------------------------------------------------------------------------
|
| SSOT: deploy/ssot/decomposition-api-compat.json
| dist·PWA·구 클라이언트가 구 URL 을 호출하는 동안 moabom-system prefix 로
| 동일 컨트롤러에 위임한다. v8-16(dist 구 URL 0건) + MOABOM_DECOMPOSITION_COMPAT=false
| 로 제거한다.
|
| 주의: 신규 prefix 가 canonical. 본 파일은 전환기 호환 레이어이며 증상 패치가 아니다.
|
*/

if (! config('moabom-system.decomposition_compat.enabled', true)) {
    return;
}

// Phase 2 — moabom-personalization
if (class_exists(UserMyPageActivityController::class)) {
    Route::prefix('user')->middleware(['auth:sanctum'])->group(function () {
        Route::get('activities', [UserMyPageActivityController::class, 'index'])
            ->middleware('throttle:600,1')
            ->name('decomposition_compat.user.activities');
    });
}

// Phase 1 — moabom-weather (플러그인 컨트롤러, prefix 만 moabom-system)
if (class_exists(WeatherCurrentController::class)) {
    Route::prefix('weather')->group(function () {
        Route::get('current', [WeatherCurrentController::class, '__invoke'])
            ->middleware('throttle:60,1')
            ->name('decomposition_compat.weather.current');

        Route::get('geolocate', [WeatherGeolocateController::class, '__invoke'])
            ->middleware('throttle:60,1')
            ->name('decomposition_compat.weather.geolocate');
    });
}

// Phase 3 — moabom-apps
if (class_exists(AiAppController::class)) {
    Route::prefix('apps')->middleware(['auth:sanctum'])->group(function () {
        Route::post('ai/generate', [AiAppController::class, 'generate'])
            ->middleware('throttle:20,1')
            ->name('decomposition_compat.apps.ai.generate');

        Route::post('ai/generate/stream', [AiAppController::class, 'stream'])
            ->middleware('throttle:20,1')
            ->name('decomposition_compat.apps.ai.generate.stream');

        Route::get('generated', [AiAppController::class, 'index'])
            ->name('decomposition_compat.apps.generated.index');
        Route::get('generated/{id}', [AiAppController::class, 'show'])
            ->whereNumber('id')
            ->name('decomposition_compat.apps.generated.show');
        Route::post('generated', [AiAppController::class, 'store'])
            ->name('decomposition_compat.apps.generated.store');
        Route::put('generated/{id}', [AiAppController::class, 'update'])
            ->whereNumber('id')
            ->name('decomposition_compat.apps.generated.update');
    });
}

// Phase 4 — moabom-cpap
if (class_exists(CpapMeasurementController::class)) {
    Route::prefix('apps')->middleware(['auth:sanctum'])->group(function () {
        Route::get('cpap-mask/measurements/latest', [CpapMeasurementController::class, 'latest'])
            ->name('decomposition_compat.apps.cpap-mask.measurements.latest');
        Route::post('cpap-mask/measurements', [CpapMeasurementController::class, 'store'])
            ->name('decomposition_compat.apps.cpap-mask.measurements.store');
    });
}
