<?php

use Illuminate\Support\Facades\Route;
use Modules\Moabom\Apps\Http\Controllers\AiAppController;
use Modules\Moabom\Apps\Http\Controllers\AiGenerationSessionController;
use Modules\Moabom\Apps\Http\Controllers\PublicGeneratedAppController;

/*
|--------------------------------------------------------------------------
| Moabom Apps Module API Routes
|--------------------------------------------------------------------------
|
| ModuleRouteServiceProvider가 자동으로 prefix를 적용합니다.
| - URL prefix: 'api/modules/moabom-apps'
| - Name prefix: 'api.modules.moabom-apps.'
|
| 모든 엔드포인트는 사용자 본인 자원만 다루므로 `auth:sanctum` 만 사용한다.
|
*/

Route::prefix('apps')->middleware(['optional.sanctum'])->group(function () {
    Route::get('generated/shared', [PublicGeneratedAppController::class, 'shared'])
        ->name('apps.generated.shared.public');
    Route::get('generated/shared/{id}', [PublicGeneratedAppController::class, 'show'])
        ->whereNumber('id')
        ->name('apps.generated.show.public');
});

Route::prefix('apps')->middleware(['auth:sanctum'])->group(function () {
    Route::post('ai/generate', [AiAppController::class, 'generate'])
        ->middleware('throttle:20,1')
        ->name('apps.ai.generate');

    Route::post('ai/generate/stream', [AiAppController::class, 'stream'])
        ->middleware('throttle:20,1')
        ->name('apps.ai.generate.stream');

    Route::get('ai/sessions/active', [AiGenerationSessionController::class, 'active'])
        ->name('apps.ai.sessions.active');
    Route::delete('ai/sessions/streaming', [AiGenerationSessionController::class, 'cancelStreaming'])
        ->name('apps.ai.sessions.cancel_streaming');
    Route::get('ai/sessions/{id}', [AiGenerationSessionController::class, 'show'])
        ->whereNumber('id')
        ->name('apps.ai.sessions.show');
    Route::delete('ai/sessions/{id}', [AiGenerationSessionController::class, 'destroy'])
        ->whereNumber('id')
        ->name('apps.ai.sessions.destroy');

    Route::get('generated', [AiAppController::class, 'index'])
        ->name('apps.generated.index');
    Route::get('generated/{id}', [AiAppController::class, 'show'])
        ->whereNumber('id')
        ->name('apps.generated.show');
    Route::post('generated', [AiAppController::class, 'store'])
        ->name('apps.generated.store');
    Route::put('generated/{id}', [AiAppController::class, 'update'])
        ->whereNumber('id')
        ->name('apps.generated.update');
    Route::patch('generated/{id}/share', [AiAppController::class, 'share'])
        ->whereNumber('id')
        ->name('apps.generated.share');
    Route::delete('generated/{id}', [AiAppController::class, 'destroy'])
        ->whereNumber('id')
        ->name('apps.generated.destroy');
});
