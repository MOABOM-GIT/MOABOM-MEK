<?php

use Illuminate\Support\Facades\Route;
use Modules\Moabom\Apps\Http\Controllers\GeneratedAppPreviewController;

/*
|--------------------------------------------------------------------------
| moabom-apps 웹 라우트 — 생성 앱 프리뷰(경로 폴백·로컬 dev)
|--------------------------------------------------------------------------
|
| 운영 Standard: https://apps.mek360.com/g/{id}
| 운영 Hosted:    https://{id}.apps.mek360.com/
| 로컬 폴백:     /modules/moabom-apps/preview/...
|
*/

Route::get('g/{id}', [GeneratedAppPreviewController::class, 'standard'])
    ->whereNumber('id')
    ->name('preview.standard.short');

Route::get('preview/g/{id}', [GeneratedAppPreviewController::class, 'standard'])
    ->whereNumber('id')
    ->name('preview.standard');

Route::get('preview/hosted/{id}', [GeneratedAppPreviewController::class, 'hostedPathFallback'])
    ->whereNumber('id')
    ->name('preview.hosted');

Route::prefix('preview/hosted/{hostedApp}')
    ->whereNumber('hostedApp')
    ->group(function (): void {
        Route::get('api/data/{tableKey}', [GeneratedAppPreviewController::class, 'listHostedData'])
            ->where('tableKey', '[A-Za-z0-9_-]+');
        Route::post('api/data/{tableKey}', [GeneratedAppPreviewController::class, 'storeHostedData'])
            ->where('tableKey', '[A-Za-z0-9_-]+');
        Route::put('api/data/{tableKey}/{rowId}', [GeneratedAppPreviewController::class, 'updateHostedData'])
            ->whereNumber('rowId')
            ->where('tableKey', '[A-Za-z0-9_-]+');
        Route::delete('api/data/{tableKey}/{rowId}', [GeneratedAppPreviewController::class, 'destroyHostedData'])
            ->whereNumber('rowId')
            ->where('tableKey', '[A-Za-z0-9_-]+');
    });
