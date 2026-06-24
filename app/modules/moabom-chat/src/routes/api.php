<?php

use Illuminate\Support\Facades\Route;
use Modules\Moabom\Chat\Http\Controllers\User\BlockController;
use Modules\Moabom\Chat\Http\Controllers\User\ConversationController;
use Modules\Moabom\Chat\Http\Controllers\User\EligibilityController;
use Modules\Moabom\Chat\Http\Controllers\User\MessageController;

Route::prefix('user')->middleware(['auth:sanctum'])->group(function (): void {
    Route::get('conversations', [ConversationController::class, 'index'])
        ->name('user.conversations.index');
    Route::post('conversations', [ConversationController::class, 'store'])
        ->name('user.conversations.store');
    Route::post('conversations/{conversationUuid}/read', [ConversationController::class, 'read'])
        ->where('conversationUuid', '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
        ->name('user.conversations.read');
    Route::post('conversations/{conversationUuid}/focus', [ConversationController::class, 'focus'])
        ->where('conversationUuid', '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
        ->name('user.conversations.focus');
    Route::delete('conversations/{conversationUuid}/focus', [ConversationController::class, 'unfocus'])
        ->where('conversationUuid', '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
        ->name('user.conversations.unfocus');

    Route::get('conversations/{conversationUuid}/messages', [MessageController::class, 'index'])
        ->where('conversationUuid', '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
        ->name('user.messages.index');
    Route::post('conversations/{conversationUuid}/messages', [MessageController::class, 'store'])
        ->where('conversationUuid', '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
        ->name('user.messages.store');

    Route::get('blocks', [BlockController::class, 'index'])
        ->name('user.blocks.index');
    Route::post('blocks', [BlockController::class, 'store'])
        ->name('user.blocks.store');
    Route::delete('blocks/{userUuid}', [BlockController::class, 'destroy'])
        ->where('userUuid', '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
        ->name('user.blocks.destroy');

    Route::get('users/{userUuid}/eligibility', [EligibilityController::class, 'show'])
        ->where('userUuid', '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}')
        ->name('user.users.eligibility');
    Route::get('users', [EligibilityController::class, 'index'])
        ->name('user.users.index');
});
