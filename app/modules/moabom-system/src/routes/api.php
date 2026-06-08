<?php

use Illuminate\Support\Facades\Route;
use Modules\Moabom\System\Http\Controllers\Admin\HomeBackgroundController;
use Modules\Moabom\System\Http\Controllers\Admin\SystemSettingsController;
use Modules\Moabom\System\Http\Controllers\HomeBackgroundFileController;
use Modules\Moabom\System\Http\Controllers\Platform\SaasHospitalController;
use Modules\Moabom\System\Http\Controllers\PublicExtensionBootMetaController;
use Modules\Moabom\System\Http\Controllers\PublicFrontendDefaultsController;
use Modules\Moabom\System\Http\Controllers\PublicLegalPageController;
use Modules\Moabom\System\Http\Controllers\PublicShellBootController;
use Modules\Moabom\System\Http\Controllers\PublicTemplateRoutesShellController;
use Modules\Moabom\System\Http\Controllers\UserSystemSettingsController;
use Modules\Moabom\System\Http\Middleware\RequireMoabomPlatformHost;

/*
|--------------------------------------------------------------------------
| Moabom System API Routes
|--------------------------------------------------------------------------
|
| ModuleRouteServiceProvider가 prefix를 자동 적용합니다.
|
*/

Route::get('home-backgrounds/{id}/{variant}', [HomeBackgroundFileController::class, 'show'])
    ->whereUuid('id')
    ->whereIn('variant', ['full', 'thumb'])
    ->name('home-backgrounds.show');

Route::get('public/shell-boot', [PublicShellBootController::class, '__invoke'])
    ->middleware('throttle:120,1')
    ->name('public.shell-boot');

Route::get('public/frontend-defaults', [PublicFrontendDefaultsController::class, '__invoke'])
    ->name('public.frontend-defaults');

Route::get('public/extension-boot-meta', [PublicExtensionBootMetaController::class, '__invoke'])
    ->middleware('throttle:120,1')
    ->name('public.extension-boot-meta');

Route::get('public/template-routes-shell', [PublicTemplateRoutesShellController::class, '__invoke'])
    ->middleware('throttle:120,1')
    ->name('public.template-routes-shell');

Route::get('public/legal-pages/{slug}', PublicLegalPageController::class)
    ->whereIn('slug', ['terms', 'privacy'])
    ->middleware('throttle:120,1')
    ->name('public.legal-pages.show');

/*
 * Weather 프록시 엔드포인트는 `moabom-weather` 플러그인으로 분리되었다(2026-06-02).
 * - 신규 경로: `/api/plugins/moabom-weather/weather/{current,geolocate}`
 * - 본 파일에서는 등록하지 않는다.
 */

Route::prefix('user')->middleware(['auth:sanctum'])->group(function () {
    Route::get('settings', [UserSystemSettingsController::class, 'show'])
        ->name('user.settings.show');
    Route::put('settings', [UserSystemSettingsController::class, 'store'])
        ->name('user.settings.store');

    // `user/activities` 는 moabom-personalization 모듈로 분리되었다(2026-06-02).
    // 신규 경로: `/api/modules/moabom-personalization/user/activities`.
});

/*
 * apps 라우트는 모두 별도 모듈로 분리되었다(2026-06-02).
 * - AI 앱(ai/generate, generated/*)   : `/api/modules/moabom-apps/apps/...`
 * - CPAP 마스크 피팅(cpap-mask/*)     : `/api/modules/moabom-cpap/apps/cpap-mask/...`
 */

Route::prefix('platform/saas')
    ->middleware([RequireMoabomPlatformHost::class, 'auth:sanctum', 'admin'])
    ->group(function () {
        Route::prefix('hospitals')->group(function () {
            Route::get('/', [SaasHospitalController::class, 'index'])
                ->middleware('permission:admin,moabom-system.saas.read')
                ->name('platform.saas.hospitals.index');
            Route::post('/', [SaasHospitalController::class, 'store'])
                ->middleware('permission:admin,moabom-system.saas.create')
                ->name('platform.saas.hospitals.store');
            Route::get('{slug}/usage', [SaasHospitalController::class, 'usage'])
                ->middleware('permission:admin,moabom-system.saas.read')
                ->name('platform.saas.hospitals.usage');
            Route::post('{slug}/purge', [SaasHospitalController::class, 'purge'])
                ->middleware('permission:admin,moabom-system.saas.purge')
                ->name('platform.saas.hospitals.purge');
            Route::delete('{slug}', [SaasHospitalController::class, 'destroy'])
                ->middleware('permission:admin,moabom-system.saas.destroy')
                ->name('platform.saas.hospitals.destroy');
            Route::get('{slug}/operations/{operationId}', [SaasHospitalController::class, 'operation'])
                ->middleware('permission:admin,moabom-system.saas.read')
                ->whereNumber('operationId')
                ->name('platform.saas.hospitals.operation');
            Route::get('{slug}', [SaasHospitalController::class, 'show'])
                ->middleware('permission:admin,moabom-system.saas.read')
                ->name('platform.saas.hospitals.show');
        });

        Route::get('packages', [SaasHospitalController::class, 'packages'])
            ->middleware('permission:admin,moabom-system.saas.read')
            ->name('platform.saas.packages');
    });

Route::prefix('admin')->middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('settings', [SystemSettingsController::class, 'index'])
        ->middleware('permission:admin,moabom-system.settings.read')
        ->name('admin.settings.index');
    Route::put('settings', [SystemSettingsController::class, 'store'])
        ->middleware('permission:admin,moabom-system.settings.update')
        ->name('admin.settings.store');
    Route::post('settings/clear-cache', [SystemSettingsController::class, 'clearCache'])
        ->middleware('permission:admin,moabom-system.settings.update')
        ->name('admin.settings.clear-cache');
    Route::post('home-backgrounds', [HomeBackgroundController::class, 'store'])
        ->middleware('permission:admin,moabom-system.settings.update')
        ->name('admin.home-backgrounds.store');
    Route::delete('home-backgrounds/{id}', [HomeBackgroundController::class, 'destroy'])
        ->whereUuid('id')
        ->middleware('permission:admin,moabom-system.settings.update')
        ->name('admin.home-backgrounds.destroy');
});

/*
 * 분리 전환기 compat — deploy/ssot/decomposition-api-compat.json
 * MOABOM_DECOMPOSITION_COMPAT=false 시 비활성.
 */
require __DIR__.'/decomposition-compat.php';

/*
 * DB 레이아웃 전환기 — 구 admin_mypage_settings 가 tenant-settings 를 호출하는 동안 위임.
 */
require __DIR__.'/legacy-tenant-settings-compat.php';
