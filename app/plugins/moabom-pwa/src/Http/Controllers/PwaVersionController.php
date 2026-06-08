<?php

namespace Plugins\Moabom\Pwa\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Plugins\Moabom\Pwa\Services\PwaVersionResolver;

/**
 * GET `/api/plugins/moabom-pwa/version` — 현재 `Pwa_Version_Value` 반환.
 *
 * - `If-None-Match` 헤더가 현재 버전과 일치하면 `304 Not Modified` 로 응답(Req 4.6).
 * - 응답 본문은 `{ "version": "<hex>-<hex>" }`.
 * - `ETag` 헤더에 현재 버전을, `Cache-Control: no-cache` 를 함께 설정한다(Req 4.5).
 *
 * Spec: `.kiro/specs/moabom-pwa-service-worker/` Req 4 · Design §4.7
 */
class PwaVersionController extends Controller
{
    public function __invoke(Request $request, PwaVersionResolver $resolver): Response|JsonResponse
    {
        $version = $resolver->resolve();

        $ifNoneMatch = trim((string) $request->header('If-None-Match'));

        // 브라우저가 강한 ETag 를 따옴표로 감싸 보낼 수도 있으므로 양쪽 따옴표 제거 후 비교.
        $clientEtag = trim($ifNoneMatch, '"');

        if ($clientEtag === $version && $version !== '') {
            return (new Response('', 304))
                ->header('ETag', '"'.$version.'"')
                ->header('Cache-Control', 'no-cache');
        }

        return new JsonResponse(
            ['version' => $version],
            200,
            [
                'ETag' => '"'.$version.'"',
                'Cache-Control' => 'no-cache',
            ],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES
        );
    }
}
