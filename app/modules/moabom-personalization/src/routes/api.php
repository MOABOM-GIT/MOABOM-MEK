<?php

use Illuminate\Support\Facades\Route;
use Modules\Moabom\Personalization\Http\Controllers\UserMyPageActivityController;

/*
|--------------------------------------------------------------------------
| Moabom Personalization Module API Routes
|--------------------------------------------------------------------------
|
| ModuleRouteServiceProvider가 자동으로 prefix를 적용합니다.
| - URL prefix: 'api/modules/moabom-personalization'
| - Name prefix: 'api.modules.moabom-personalization.'
|
| 모든 엔드포인트는 인증된 사용자 본인의 자원만 다루므로 권한 미들웨어 없이
| `auth:sanctum` 만 사용한다.
|
*/

Route::prefix('user')->middleware(['auth:sanctum'])->group(function () {
    Route::get('activities', [UserMyPageActivityController::class, 'index'])
        ->middleware('throttle:600,1')
        ->name('user.activities.index');
});
