<?php

/*
|--------------------------------------------------------------------------
| Moabom PWA Plugin Web Routes (미래 web-scoped 확장 지점)
|--------------------------------------------------------------------------
|
| 본 파일은 의도적으로 비어 있다.
|
| `/pwa/sw.js` 는 루트 경로에 떠야 하므로(`Service-Worker-Allowed: /` 헤더
| 요건 때문) `PluginRouteServiceProvider` 가 자동 적용하는
| `plugins/moabom-pwa/` prefix 를 우회해야 한다. 해당 라우트는
| `Plugins\Moabom\Pwa\Providers\PwaServiceProvider::boot()` 에서
| 직접 `Route::middleware(['web'])->...->get('/pwa/sw.js', ...)` 로 등록한다.
|
| 본 파일은 미래의 prefix-정상(web-scoped) 라우트 확장 지점으로 남겨둔다.
|
| 관련 스펙: .kiro/specs/moabom-pwa-service-worker/ (Task 3.7, 설계 §3.1 · §4.7).
*/
