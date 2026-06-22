<?php

use Illuminate\Support\Facades\Route;
use Modules\Moabom\Presence\Http\Controllers\Public\PresencePublicController;
use Modules\Moabom\Presence\Http\Controllers\User\FriendshipController;
use Modules\Moabom\Presence\Http\Controllers\User\PresenceSettingsController;

Route::prefix('public')->group(function (): void {
    Route::get('summary', [PresencePublicController::class, 'summary'])
        ->name('public.summary');
    Route::get('online', [PresencePublicController::class, 'online'])
        ->name('public.online');
    Route::post('heartbeat', [PresencePublicController::class, 'heartbeat'])
        ->name('public.heartbeat');
    Route::get('users/{userUuid}/presence', [PresencePublicController::class, 'userPresence'])
        ->where('userUuid', '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
        ->name('public.users.presence');
});

Route::prefix('user')->middleware(['auth:sanctum'])->group(function (): void {
    Route::get('presence/settings', [PresenceSettingsController::class, 'show'])
        ->name('user.presence.settings.show');
    Route::put('presence/settings', [PresenceSettingsController::class, 'update'])
        ->name('user.presence.settings.update');

    Route::get('friends', [FriendshipController::class, 'index'])
        ->name('user.friends.index');
    Route::post('friends', [FriendshipController::class, 'store'])
        ->name('user.friends.store');
    Route::post('friends/accept', [FriendshipController::class, 'accept'])
        ->name('user.friends.accept');
    Route::delete('friends/{userUuid}', [FriendshipController::class, 'destroy'])
        ->where('userUuid', '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
        ->name('user.friends.destroy');
});
