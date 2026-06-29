<?php

use Illuminate\Support\Facades\Route;
use Modules\Moabom\Apps\Http\Controllers\AppSeoController;
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

if ((bool) config('moabom-apps.seo.serve_robots', true)) {
    // 정적 public/robots.txt 가 있으면 웹서버가 우선 서빙한다(이 라우트는 폴백).
    Route::get('robots.txt', [AppSeoController::class, 'robots'])
        ->name('moabom-apps.seo.robots');
    Route::get('llms.txt', [AppSeoController::class, 'llms'])
        ->name('moabom-apps.seo.llms');
}

Route::get('g/{id}', [GeneratedAppPreviewController::class, 'standard'])
    ->whereNumber('id')
    ->name('preview.standard.short');

Route::get('preview/g/{id}', [GeneratedAppPreviewController::class, 'standard'])
    ->whereNumber('id')
    ->name('preview.standard');

Route::get('preview/hosted/{id}', [GeneratedAppPreviewController::class, 'hostedPathFallback'])
    ->whereNumber('id')
    ->name('preview.hosted');
