<?php

use Illuminate\Support\Facades\Route;
use Modules\Moabom\Cpap\Http\Controllers\CpapMeasurementController;

/*
|--------------------------------------------------------------------------
| Moabom CPAP Module API Routes
|--------------------------------------------------------------------------
|
| ModuleRouteServiceProvider가 자동으로 prefix를 적용합니다.
| - URL prefix: 'api/modules/moabom-cpap'
| - Name prefix: 'api.modules.moabom-cpap.'
|
| 모든 엔드포인트는 사용자 본인 자원만 다루므로 `auth:sanctum` 만 사용한다.
|
*/

Route::prefix('apps')->middleware(['auth:sanctum'])->group(function () {
    Route::get('cpap-mask/measurements/latest', [CpapMeasurementController::class, 'latest'])
        ->name('apps.cpap-mask.measurements.latest');
    Route::post('cpap-mask/measurements', [CpapMeasurementController::class, 'store'])
        ->name('apps.cpap-mask.measurements.store');
});
