<?php

use Illuminate\Support\Facades\Route;
use Plugins\Moabom\Pwa\Http\Controllers\PwaManifestController;
use Plugins\Moabom\Pwa\Http\Controllers\PwaVersionController;

/*
|--------------------------------------------------------------------------
| Moabom PWA Plugin API Routes
|--------------------------------------------------------------------------
|
| `PluginRouteServiceProvider` 가 `/api/plugins/moabom-pwa` prefix 를 자동
| 적용한다. 본 파일에서 정의한 모든 엔드포인트는 공개(공인) 응답이며,
| 사용자별 정보를 다루지 않으므로 인증 미들웨어를 부착하지 않는다.
|
| 루트 스코프 `/pwa/sw.js` 는 Service Worker 의 `Service-Worker-Allowed: /`
| 요건 때문에 prefix 를 우회해야 하므로, `PwaServiceProvider::boot()` 에서
| 직접 등록한다.
|
*/

Route::get('manifest.webmanifest', [PwaManifestController::class, '__invoke'])
    ->name('manifest');

Route::get('version', [PwaVersionController::class, '__invoke'])
    ->name('version');
