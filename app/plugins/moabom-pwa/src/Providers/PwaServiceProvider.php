<?php

namespace Plugins\Moabom\Pwa\Providers;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\ServiceProvider;
use Illuminate\View\Middleware\ShareErrorsFromSession;
use Plugins\Moabom\Pwa\Http\Controllers\PwaServiceWorkerController;

/**
 * moabom-pwa 플러그인 서비스 프로바이더.
 *
 * 책임:
 *   1) `src/lang/{ko,en,ja,zh}/pwa.php` 를 `moabom-pwa::pwa.*` 네임스페이스로 등록.
 *   2) 루트 스코프 `/pwa/sw.js` 라우트를 등록(플러그인 prefix `plugins/moabom-pwa/`
 *      를 우회). 브라우저가 Service Worker 의 scope 를 `/` 로 인식하려면
 *      `Service-Worker-Allowed: /` 헤더와 함께 루트 경로 응답이 필요하다.
 */
class PwaServiceProvider extends ServiceProvider
{
    /**
     * 서비스 바인딩 등록(현재 별도 바인딩 없음).
     */
    public function register(): void
    {
        // 별도 바인딩 없음 — Controller/Service 모두 PSR-4 자동 해석.
    }

    /**
     * 부팅 시점에 다국어와 루트 스코프 라우트를 등록한다.
     */
    public function boot(): void
    {
        $this->loadPluginTranslations();

        if ($this->shouldRegisterRootScopedRoutes()) {
            $this->registerPwaServiceWorkerRoute();
        }
    }

    /**
     * 플러그인 다국어 파일을 `moabom-pwa::*` 네임스페이스로 로드한다.
     *
     * 플러그인 lang 경로 규약은 모듈과 달리 루트 `lang/` 이다(코어
     * `PluginManager` 가 install 시점에 `src/lang/` 을 거부한다).
     */
    protected function loadPluginTranslations(): void
    {
        $langPath = dirname(__DIR__, 2).'/lang';

        if (is_dir($langPath)) {
            $this->loadTranslationsFrom($langPath, 'moabom-pwa');
        }
    }

    /**
     * 인스톨러 이전 / DB 미준비 환경에서는 루트 라우트 등록을 건너뛴다.
     *
     * 같은 가드를 `PluginRouteServiceProvider` · `moabom-auth-hardening` 이
     * 사용한다(`.env` 부재 또는 `plugins` 테이블 미존재 시 graceful skip).
     */
    private function shouldRegisterRootScopedRoutes(): bool
    {
        if (! File::exists(base_path('.env'))) {
            return false;
        }

        if (! config('app.installer_completed')) {
            try {
                return Schema::hasTable('plugins');
            } catch (\Throwable) {
                return false;
            }
        }

        return true;
    }

    /**
     * `/pwa/sw.js` 루트 스코프 라우트 등록(moabom-pwa-service-worker 스펙 Req 1.3).
     *
     * `PluginRouteServiceProvider` 는 `src/routes/web.php` 에 `plugins/moabom-pwa/`
     * prefix 를 붙이므로, 루트 경로(`/pwa/sw.js`) 에 붙이려면 prefix 를 적용하지
     * 않은 `Route::get` 을 직접 호출해야 한다. CSRF · 세션 · 에러 공유 미들웨어는
     * Service Worker 스크립트 서빙에 불필요하므로 `withoutMiddleware` 로 제거한다.
     */
    private function registerPwaServiceWorkerRoute(): void
    {
        Route::middleware(['web'])
            ->withoutMiddleware([
                VerifyCsrfToken::class,
                StartSession::class,
                ShareErrorsFromSession::class,
            ])
            ->get('/pwa/sw.js', PwaServiceWorkerController::class)
            ->name('pwa.sw');
    }
}
