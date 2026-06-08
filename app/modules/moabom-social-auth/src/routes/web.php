<?php

use Illuminate\Support\Facades\Route;
use Modules\Moabom\Social\Auth\Http\Controllers\SocialAuthController;

/*
|--------------------------------------------------------------------------
| Social Auth Web Routes
|--------------------------------------------------------------------------
*/

Route::get('{provider}/redirect', [SocialAuthController::class, 'redirect'])
    ->name('redirect');

Route::get('{provider}/callback', [SocialAuthController::class, 'callback'])
    ->name('callback');

Route::get('{provider}/popup-complete', [SocialAuthController::class, 'popupComplete'])
    ->name('popup-complete');
