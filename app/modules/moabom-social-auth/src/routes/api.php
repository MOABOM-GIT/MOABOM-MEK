<?php

use Illuminate\Support\Facades\Route;
use Modules\Moabom\Social\Auth\Http\Controllers\Admin\SocialAuthSettingsController;
use Modules\Moabom\Social\Auth\Http\Controllers\SocialAuthController;

/*
|--------------------------------------------------------------------------
| Social Auth API Routes
|--------------------------------------------------------------------------
*/

Route::get('providers', [SocialAuthController::class, 'providers'])
    ->name('providers');

Route::post('exchange', [SocialAuthController::class, 'exchange'])
    ->name('exchange');

Route::post('complete-profile', [SocialAuthController::class, 'completeProfile'])
    ->name('complete-profile');

Route::middleware('web')->group(function () {
    Route::get('oauth/{provider}/start', [SocialAuthController::class, 'brokerStart'])
        ->whereIn('provider', ['google', 'kakao', 'naver'])
        ->name('broker-start');

    Route::get('oauth/{provider}/callback', [SocialAuthController::class, 'brokerCallback'])
        ->whereIn('provider', ['google', 'kakao', 'naver'])
        ->name('broker-callback');

    Route::get('{provider}/redirect', [SocialAuthController::class, 'redirect'])
        ->whereIn('provider', ['google', 'kakao', 'naver'])
        ->name('web-redirect');

    Route::get('{provider}/callback', [SocialAuthController::class, 'callback'])
        ->whereIn('provider', ['google', 'kakao', 'naver'])
        ->name('web-callback');

    Route::get('{provider}/popup-complete', [SocialAuthController::class, 'popupComplete'])
        ->whereIn('provider', ['google', 'kakao', 'naver'])
        ->name('web-popup-complete');
});

Route::prefix('admin')->middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::get('settings', [SocialAuthSettingsController::class, 'index'])
        ->middleware('permission:admin,moabom-social-auth.settings.read')
        ->name('admin.settings.index');

    Route::put('settings', [SocialAuthSettingsController::class, 'store'])
        ->middleware('permission:admin,moabom-social-auth.settings.update')
        ->name('admin.settings.store');

    Route::post('settings/clear-cache', [SocialAuthSettingsController::class, 'clearCache'])
        ->middleware('permission:admin,moabom-social-auth.settings.update')
        ->name('admin.settings.clear-cache');
});
