<?php

use Illuminate\Support\Facades\Route;
use Modules\Moabom\Cpap\Http\Controllers\Admin\CpapMeasurementAdminController;
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
*/

Route::prefix('apps')->middleware(['auth:sanctum'])->group(function () {
    Route::get('cpap-mask/measurements/latest', [CpapMeasurementController::class, 'latest'])
        ->name('apps.cpap-mask.measurements.latest');
    Route::post('cpap-mask/measurements', [CpapMeasurementController::class, 'store'])
        ->name('apps.cpap-mask.measurements.store');
});

Route::prefix('admin')->middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('measurements', [CpapMeasurementAdminController::class, 'index'])
        ->middleware('permission:admin,moabom-cpap.measurements.read')
        ->name('admin.measurements.index');
});
