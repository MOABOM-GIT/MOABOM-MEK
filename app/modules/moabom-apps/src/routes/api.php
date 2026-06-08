<?php

use Illuminate\Support\Facades\Route;
use Modules\Moabom\Apps\Http\Controllers\AiAppController;

/*
|--------------------------------------------------------------------------
| Moabom Apps Module API Routes
|--------------------------------------------------------------------------
|
| ModuleRouteServiceProvider가 자동으로 prefix를 적용합니다.
| - URL prefix: 'api/modules/moabom-apps'
| - Name prefix: 'api.modules.moabom-apps.'
|
| 모든 엔드포인트는 사용자 본인 자원만 다루므로 `auth:sanctum` 만 사용한다.
|
*/

Route::prefix('apps')->middleware(['auth:sanctum'])->group(function () {
    Route::post('ai/generate', [AiAppController::class, 'generate'])
        ->middleware('throttle:20,1')
        ->name('apps.ai.generate');

    Route::get('generated', [AiAppController::class, 'index'])
        ->name('apps.generated.index');
    Route::get('generated/{id}', [AiAppController::class, 'show'])
        ->whereNumber('id')
        ->name('apps.generated.show');
    Route::post('generated', [AiAppController::class, 'store'])
        ->name('apps.generated.store');
    Route::put('generated/{id}', [AiAppController::class, 'update'])
        ->whereNumber('id')
        ->name('apps.generated.update');
});
