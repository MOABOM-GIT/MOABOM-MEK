<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use Plugins\Moabom\Fcm\Http\Controllers\User\FcmDeviceTokenController;
use Plugins\Moabom\Fcm\Http\Controllers\User\FcmWebConfigController;

Route::get('web-config', [FcmWebConfigController::class, '__invoke'])
    ->middleware('throttle:60,1')
    ->name('web-config');

Route::middleware('auth:sanctum')->group(function () {
    Route::post('device-tokens', [FcmDeviceTokenController::class, 'store'])
        ->middleware('throttle:30,1')
        ->name('device-tokens.store');

    Route::delete('device-tokens', [FcmDeviceTokenController::class, 'destroy'])
        ->middleware('throttle:30,1')
        ->name('device-tokens.destroy');
});
