<?php

namespace Modules\Moabom\Apps\Services;

use Modules\Moabom\Apps\Support\GeneratedAppDataScope;

/**
 * AI 생성 HTML 저장·프리뷰 서빙용 sanitize(CSP 주입, 위험 태그 제거).
 *
 * 레이아웃·스크롤바 주입은 프론트 injectAiPreviewSafety(moabom-ai-preview-safety) 가 담당한다.
 */
class GeneratedAppHtmlService
{
    private const PREVIEW_CSP =
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; "
        ."script-src 'unsafe-inline' 'unsafe-eval' https: blob:; "
        ."style-src 'unsafe-inline' https:; "
        ."img-src 'self' data: blob: https:; "
        ."font-src 'self' data: https:; "
        ."media-src 'self' data: blob: https:; "
        ."connect-src https:; "
        ."base-uri 'none'; form-action 'self' https:;";

    public function harden(string $html, ?GeneratedAppDataScope $runtimeScope = null): string
    {
        if ($html === '') {
            return $html;
        }

        $html = (string) preg_replace('/<script\b[^>]*\bid=["\']moabom-ai-preview-runtime["\'][^>]*>[\s\S]*?<\/script>/i', '', $html);
        $html = (string) preg_replace('/<script\b[^>]*\bid=["\']moabom-app-runtime["\'][^>]*>[\s\S]*?<\/script>/i', '', $html);
        $html = (string) preg_replace('/<base\b[^>]*>/i', '', $html);
        $html = (string) preg_replace('/<link\b[^>]*\brel=["\']manifest["\'][^>]*>/i', '', $html);

        $cspAndRuntime = '';

        if ($runtimeScope !== null) {
            $cspAndRuntime .= $this->runtimeScript($runtimeScope);
        }

        if (! str_contains($html, 'http-equiv="Content-Security-Policy"')) {
            $cspAndRuntime = '<meta http-equiv="Content-Security-Policy" content="'.self::PREVIEW_CSP.'">'.$cspAndRuntime;
        }

        if ($cspAndRuntime === '') {
            return $html;
        }

        return $this->injectAfterHeadOpen($html, $cspAndRuntime);
    }

    private function runtimeScript(GeneratedAppDataScope $scope): string
    {
        $payload = json_encode([
            'appId' => $scope->appId,
            'userId' => $scope->userId,
            'tenantSlug' => $scope->tenantSlug,
            'storagePrefix' => $scope->storageKeyPrefix(),
            'previewTokenParam' => 'preview_token',
        ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);

        return '<script id="moabom-app-runtime">window.__MOABOM_APP_RUNTIME__='.$payload.';</script>';
    }

    private function injectAfterHeadOpen(string $html, string $injection): string
    {
        if ($injection === '') {
            return $html;
        }

        if (preg_match('/<head[^>]*>/i', $html, $matches) === 1) {
            return (string) preg_replace('/<head[^>]*>/i', $matches[0].$injection, $html, 1);
        }
        if (stripos($html, '<body') !== false) {
            return (string) preg_replace('/<body/i', '<head>'.$injection.'</head><body', $html, 1);
        }

        return $injection.$html;
    }
}
