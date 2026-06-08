<?php

namespace Plugins\Moabom\Pwa\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Plugins\Moabom\Pwa\Services\PwaManifestBuilder;

/**
 * GET `/api/plugins/moabom-pwa/manifest.webmanifest` — W3C PWA manifest 서빙.
 *
 * 응답은 표준 매니페스트 스키마(루트에 `name`, `icons`, `start_url` 등) 이며,
 * `ResponseHelper` 의 래핑(`{success, data, ...}`) 은 적용하지 않는다. 브라우저가
 * `<link rel="manifest">` 를 파싱할 때 W3C 규격 JSON 만 받아들이기 때문이다.
 *
 * Spec: `.kiro/specs/moabom-pwa-service-worker/` Req 3 · Design §4.7
 */
class PwaManifestController extends Controller
{
    public function __invoke(Request $request, PwaManifestBuilder $builder): JsonResponse
    {
        $manifest = $builder->build((string) $request->header('Accept-Language', ''));

        return new JsonResponse(
            $manifest,
            200,
            [
                'Content-Type' => 'application/manifest+json; charset=utf-8',
                'Cache-Control' => 'public, max-age=300',
            ],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
    }
}
