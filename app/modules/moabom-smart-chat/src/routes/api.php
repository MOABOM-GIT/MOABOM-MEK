<?php

use Illuminate\Support\Facades\Route;
use Modules\Moabom\Smart\Chat\Http\Controllers\SmartChatController;
use Modules\Moabom\Smart\Chat\Http\Controllers\SmartChatPublicShareController;

Route::get('public/shares/{token}', [SmartChatPublicShareController::class, '__invoke'])
    ->where('token', '[0-9a-f-]{36}')
    ->middleware('throttle:60,1')
    ->name('public.shares.show');

Route::middleware(['auth:sanctum'])->group(function (): void {
    Route::get('models', [SmartChatController::class, 'models'])
        ->middleware('throttle:60,1')
        ->name('models.index');

    Route::get('preferences', [SmartChatController::class, 'preferences'])
        ->middleware('throttle:60,1')
        ->name('preferences.show');

    Route::put('preferences', [SmartChatController::class, 'storePreferences'])
        ->middleware('throttle:30,1')
        ->name('preferences.store');

    Route::post('handoff-prompt', [SmartChatController::class, 'handoffPrompt'])
        ->middleware('throttle:10,1')
        ->name('handoff-prompt.store');

    Route::get('tools', [SmartChatController::class, 'tools'])
        ->middleware('throttle:60,1')
        ->name('tools.index');

    Route::get('generated-apps', [SmartChatController::class, 'generatedApps'])
        ->middleware('throttle:60,1')
        ->name('generated-apps.index');

    Route::get('folders', [SmartChatController::class, 'indexFolders'])
        ->middleware('throttle:60,1')
        ->name('folders.index');

    Route::post('folders', [SmartChatController::class, 'storeFolder'])
        ->middleware('throttle:30,1')
        ->name('folders.store');

    Route::patch('folders/{uuid}', [SmartChatController::class, 'updateFolder'])
        ->where('uuid', '[0-9a-f-]{36}')
        ->middleware('throttle:30,1')
        ->name('folders.update');

    Route::delete('folders/{uuid}', [SmartChatController::class, 'destroyFolder'])
        ->where('uuid', '[0-9a-f-]{36}')
        ->middleware('throttle:30,1')
        ->name('folders.destroy');

    Route::get('memories', [SmartChatController::class, 'indexMemories'])
        ->middleware('throttle:60,1')
        ->name('memories.index');

    Route::post('memories', [SmartChatController::class, 'storeMemory'])
        ->middleware('throttle:30,1')
        ->name('memories.store');

    Route::delete('memories/{uuid}', [SmartChatController::class, 'destroyMemory'])
        ->where('uuid', '[0-9a-f-]{36}')
        ->middleware('throttle:30,1')
        ->name('memories.destroy');

    Route::post('attachments', [SmartChatController::class, 'uploadAttachment'])
        ->middleware('throttle:30,1')
        ->name('attachments.store');

    Route::get('conversations', [SmartChatController::class, 'indexConversations'])
        ->middleware('throttle:120,1')
        ->name('conversations.index');

    Route::post('conversations', [SmartChatController::class, 'storeConversation'])
        ->middleware('throttle:30,1')
        ->name('conversations.store');

    Route::patch('conversations/{uuid}', [SmartChatController::class, 'updateConversation'])
        ->where('uuid', '[0-9a-f-]{36}')
        ->middleware('throttle:30,1')
        ->name('conversations.update');

    Route::delete('conversations/{uuid}', [SmartChatController::class, 'destroyConversation'])
        ->where('uuid', '[0-9a-f-]{36}')
        ->middleware('throttle:60,1')
        ->name('conversations.destroy');

    Route::post('conversations/{uuid}/share', [SmartChatController::class, 'enableShare'])
        ->where('uuid', '[0-9a-f-]{36}')
        ->middleware('throttle:20,1')
        ->name('conversations.share.enable');

    Route::delete('conversations/{uuid}/share', [SmartChatController::class, 'disableShare'])
        ->where('uuid', '[0-9a-f-]{36}')
        ->middleware('throttle:20,1')
        ->name('conversations.share.disable');

    Route::get('conversations/{uuid}/messages', [SmartChatController::class, 'indexMessages'])
        ->where('uuid', '[0-9a-f-]{36}')
        ->middleware('throttle:120,1')
        ->name('messages.index');

    Route::post('conversations/{uuid}/messages:stream', [SmartChatController::class, 'streamMessage'])
        ->where('uuid', '[0-9a-f-]{36}')
        ->middleware('throttle:20,1')
        ->name('messages.stream');
});
