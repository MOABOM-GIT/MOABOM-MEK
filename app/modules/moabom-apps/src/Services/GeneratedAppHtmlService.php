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

    /** @var array<string, string> bridge JS 프로세스 캐시 (요청마다 file_get_contents 방지) */
    private static array $bridgeScriptCache = [];

    public function harden(string $html, ?GeneratedAppDataScope $runtimeScope = null, bool $injectHostedDataApiBridge = false): string
    {
        if ($html === '') {
            return $html;
        }

        $html = (string) preg_replace('/<script\b[^>]*\bid=["\']moabom-ai-preview-runtime["\'][^>]*>[\s\S]*?<\/script>/i', '', $html);
        $html = (string) preg_replace('/<script\b[^>]*\bid=["\']moabom-app-runtime["\'][^>]*>[\s\S]*?<\/script>/i', '', $html);
        $html = (string) preg_replace('/<script\b[^>]*\bid=["\']moabom-app-backdrop-probe["\'][^>]*>[\s\S]*?<\/script>/i', '', $html);
        $html = (string) preg_replace('/<script\b[^>]*\bid=["\']moabom-app-download-bridge["\'][^>]*>[\s\S]*?<\/script>/i', '', $html);
        $html = (string) preg_replace('/<script\b[^>]*\bid=["\']moabom-app-data-api-bridge["\'][^>]*>[\s\S]*?<\/script>/i', '', $html);
        $html = (string) preg_replace('/<script\b[^>]*\bid=["\']moabom-app-hosted-storage["\'][^>]*>[\s\S]*?<\/script>/i', '', $html);
        $html = (string) preg_replace('/<script\b[^>]*\bid=["\']moabom-app-shell-native-bridge["\'][^>]*>[\s\S]*?<\/script>/i', '', $html);
        $html = (string) preg_replace('/<base\b[^>]*>/i', '', $html);
        $html = (string) preg_replace('/<link\b[^>]*\brel=["\']manifest["\'][^>]*>/i', '', $html);

        $cspAndRuntime = '';

        if ($runtimeScope !== null) {
            $cspAndRuntime .= $this->runtimeScript($runtimeScope);
        }

        // 셸 오버레이 버튼(생성앱 toolbar)이 배경 명암에 맞춰 글자색을 뒤집을 수 있도록,
        // iframe 내부에서 실제 렌더된 배경 휘도를 측정해 postMessage 로 부모에 알린다.
        // 부모(셸)는 cross-origin iframe 픽셀을 읽을 수 없으므로 측정은 iframe 안에서만 가능하다.
        $cspAndRuntime .= $this->backdropProbeScript();
        // sandbox iframe 은 allow-downloads 없이 내부 다운로드를 차단한다.
        // blob/data URL + download 앵커를 가로채 부모(셸)에 postMessage 로 위임한다.
        $cspAndRuntime .= $this->downloadBridgeScript();
        $cspAndRuntime .= $this->shellNativeBridgeScript();
        if ($injectHostedDataApiBridge) {
            $cspAndRuntime .= $this->dataApiBridgeScript();
            $cspAndRuntime .= $this->hostedStorageBridgeScript();
        }

        if (! str_contains($html, 'http-equiv="Content-Security-Policy"')) {
            $cspAndRuntime = '<meta http-equiv="Content-Security-Policy" content="'.self::PREVIEW_CSP.'">'.$cspAndRuntime;
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

    /**
     * iframe 내부 배경 휘도 프로브(solid + gradient).
     *
     * @see resources/js/generated-app-backdrop-probe.js
     */
    private function backdropProbeScript(): string
    {
        return $this->cachedBridgeScript('generated-app-backdrop-probe.js', 'moabom-app-backdrop-probe');
    }

    /**
     * iframe 내부 다운로드 → 부모(셸) postMessage 브릿지.
     *
     * @see resources/js/generated-app-download-bridge.js
     */
    private function downloadBridgeScript(): string
    {
        return $this->cachedBridgeScript('generated-app-download-bridge.js', 'moabom-app-download-bridge');
    }

    /**
     * Hosted 앱 fetch('/api/data/...') — preview_token 헤더 자동 부착.
     *
     * @see resources/js/generated-app-data-api-bridge.js
     */
    private function dataApiBridgeScript(): string
    {
        return $this->cachedBridgeScript('generated-app-data-api-bridge.js', 'moabom-app-data-api-bridge');
    }

    /**
     * Hosted 앱 MoabomAppStorage — localStorage + /api/data 이중 동기화.
     *
     * @see resources/js/generated-app-hosted-storage.js
     */
    private function hostedStorageBridgeScript(): string
    {
        return $this->cachedBridgeScript('generated-app-hosted-storage.js', 'moabom-app-hosted-storage');
    }

    /**
     * iframe → 셸 allowlist API (toast / openApp).
     *
     * @see resources/js/generated-app-shell-native-bridge.js
     */
    private function shellNativeBridgeScript(): string
    {
        return $this->cachedBridgeScript('generated-app-shell-native-bridge.js', 'moabom-app-shell-native-bridge');
    }

    private function cachedBridgeScript(string $filename, string $scriptId): string
    {
        if (array_key_exists($filename, self::$bridgeScriptCache)) {
            return self::$bridgeScriptCache[$filename];
        }

        $path = dirname(__DIR__, 2).'/resources/js/'.$filename;
        if (! is_readable($path)) {
            self::$bridgeScriptCache[$filename] = '';

            return '';
        }

        $js = (string) file_get_contents($path);
        $script = $js === '' ? '' : '<script id="'.$scriptId.'">'.$js.'</script>';
        self::$bridgeScriptCache[$filename] = $script;

        return $script;
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
