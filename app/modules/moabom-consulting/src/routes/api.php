<?php

use Illuminate\Support\Facades\Route;
use Modules\Moabom\Consulting\Http\Controllers\ContractController;
use Modules\Moabom\Consulting\Http\Controllers\SimulationController;

/*
|--------------------------------------------------------------------------
| Moabom Consulting Module API Routes
|--------------------------------------------------------------------------
|
| ModuleRouteServiceProvider가 자동으로 prefix를 적용합니다.
| - URL prefix: 'api/modules/moabom-consulting'
| - Name prefix: 'api.modules.moabom-consulting.'
|
| 모든 엔드포인트는 로그인한 상담원 본인 자원만 다루므로 `auth:sanctum` 만 사용한다.
|
*/

Route::prefix('apps')->middleware(['auth:sanctum'])->group(function () {
    // 맞춤형 수익성 시뮬레이션 (서버 권위 계산)
    Route::post('consulting/simulate', [SimulationController::class, 'simulate'])
        ->name('apps.consulting.simulate');

    // 전자계약서
    Route::get('consulting/contracts', [ContractController::class, 'index'])
        ->name('apps.consulting.contracts.index');
    Route::post('consulting/contracts', [ContractController::class, 'store'])
        ->name('apps.consulting.contracts.store');
    Route::get('consulting/contracts/{id}', [ContractController::class, 'show'])
        ->whereNumber('id')
        ->name('apps.consulting.contracts.show');
});
