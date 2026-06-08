<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Modules\Moabom\System\Http\Controllers\Admin\SystemSettingsController;

/*
|--------------------------------------------------------------------------
| Legacy tenant-settings API → admin/settings (DB 레이아웃 전환기)
|--------------------------------------------------------------------------
|
| tenant DB 의 admin_mypage_settings 가 구 endpoint 를 참조하는 동안
| 404 대신 SystemSettingsController 로 위임한다.
| moabom:saas:sync-module-layouts 로 DB 갱신 후에도 구 클라이언트·캐시 대비.
|
*/

if (! config('moabom-system.legacy_tenant_settings_api_compat', true)) {
    return;
}

Route::prefix('admin')->middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('tenant-settings', [SystemSettingsController::class, 'index'])
        ->middleware('permission:admin,moabom-system.settings.read')
        ->name('admin.tenant-settings.legacy.index');
    Route::put('tenant-settings', [SystemSettingsController::class, 'store'])
        ->middleware('permission:admin,moabom-system.settings.update')
        ->name('admin.tenant-settings.legacy.store');
});
