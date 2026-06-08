<?php

namespace Plugins\Moabom\Pwa\Http\Controllers;

use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Plugins\Moabom\Pwa\Services\PwaVersionResolver;

/**
 * GET `/pwa/sw.js` — 루트 스코프 Service Worker 스크립트 서빙.
 *
 * `PwaServiceProvider::boot()` 에서 플러그인 prefix(`plugins/moabom-pwa/`) 를
 * 우회하여 루트 경로에 직접 등록된다(Req 1.3 의 `Service-Worker-Allowed: /` 를
 * 위해 필수).
 *
 * 응답 본문은 `templates/moabom-basic/dist/pwa/sw.bundled.js` 를 읽어 다음
 * 플레이스홀더를 치환한 결과다:
 *
 *  - `__PRECACHE_MANIFEST_JSON__` → `dist/pwa/precache-manifest.json` 내용(JSON 문자열 리터럴)
 *  - `{{VERSION}}` → `PwaVersionResolver::resolve()` 결과 문자열
 *
 * Spec: `.kiro/specs/moabom-pwa-service-worker/` Req 1.3 · Design §3.1 · §4.7 · §8
 */
class PwaServiceWorkerController extends Controller
{
    public function __invoke(PwaVersionResolver $resolver): Response
    {
        $swPath = base_path('templates/moabom-basic/dist/pwa/sw.bundled.js');
        $manifestPath = base_path('templates/moabom-basic/dist/pwa/precache-manifest.json');

        if (! is_file($swPath)) {
            // dist/pwa 가 아직 빌드되지 않은 환경(테스트 · 신규 설치) — SW 는 no-op 으로 서빙.
            return $this->respondNoOpSw();
        }

        $body = (string) file_get_contents($swPath);
        if ($body === '') {
            return $this->respondNoOpSw();
        }

        $precacheJson = '[]';
        if (is_file($manifestPath)) {
            $raw = (string) file_get_contents($manifestPath);
            // 유효 JSON 이 아니면 무시하고 빈 배열 fallback.
            if ($raw !== '' && json_decode($raw) !== null) {
                $precacheJson = $raw;
            }
        }

        $version = $resolver->resolve();
        $precacheJsonString = json_encode($precacheJson, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (! is_string($precacheJsonString)) {
            $precacheJsonString = '"[]"';
        }

        $body = strtr($body, [
            '"__PRECACHE_MANIFEST_JSON__"' => $precacheJsonString,
            "'__PRECACHE_MANIFEST_JSON__'" => $precacheJsonString,
            '{{VERSION}}' => $version,
        ]);

        return $this->respondSw($body);
    }

    /**
     * SW 번들 부재 시 no-op SW 를 내려보내 브라우저가 등록은 성공하되 아무 요청도
     * 가로채지 않도록 한다. 등록 실패(SecurityError) 가 나면 사용자에게 콘솔 오류가
     * 보이므로, 빈 SW 로 graceful 폴백(Req 11.4).
     */
    private function respondNoOpSw(): Response
    {
        $body = "// moabom-pwa-service-worker: no-op (build pending)\nself.addEventListener('install', e => self.skipWaiting());\nself.addEventListener('activate', e => self.clients.claim());\n";

        return $this->respondSw($body);
    }

    private function respondSw(string $body): Response
    {
        return (new Response($body, 200))
            ->header('Content-Type', 'application/javascript; charset=utf-8')
            ->header('Service-Worker-Allowed', '/')
            ->header('Cache-Control', 'no-cache');
    }
}
