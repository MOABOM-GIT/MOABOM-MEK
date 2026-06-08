<?php

use Illuminate\Support\Facades\Route;
use Modules\Moabom\Credit\Http\Controllers\Admin\CreditSettingsController;
use Modules\Moabom\Credit\Http\Controllers\CreditController;

/*
|--------------------------------------------------------------------------
| Moabom Credit Module API Routes
|--------------------------------------------------------------------------
|
| ModuleRouteServiceProvider가 자동으로 prefix를 적용합니다.
| - URL prefix: 'api/modules/moabom-credit'
| - Name prefix: 'api.modules.moabom-credit.'
|
*/

Route::prefix('user')->middleware(['auth:sanctum'])->group(function () {
    Route::get('credits', [CreditController::class, 'index'])
        ->name('user.credits.index');
    Route::post('attendance', [CreditController::class, 'attendance'])
        ->name('user.attendance.store');
});

Route::prefix('admin')->middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('settings', [CreditSettingsController::class, 'index'])
        ->middleware('permission:admin,moabom-credit.settings.read')
        ->name('admin.settings.index');
    Route::put('settings', [CreditSettingsController::class, 'store'])
        ->middleware('permission:admin,moabom-credit.settings.update')
        ->name('admin.settings.store');
    Route::post('settings/clear-cache', [CreditSettingsController::class, 'clearCache'])
        ->middleware('permission:admin,moabom-credit.settings.update')
        ->name('admin.settings.clear-cache');
});
