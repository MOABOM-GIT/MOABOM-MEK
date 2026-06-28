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
        $html = (string) preg_replace('/<script\b[^>]*\bid=["\']moabom-app-backdrop-probe["\'][^>]*>[\s\S]*?<\/script>/i', '', $html);
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
     * iframe 내부 배경 휘도 프로브.
     *
     * 부모(셸)가 보낸 지점(buttons 좌표)을 받아 elementFromPoint 로 해당 위치의
     * 실효 배경색을 합성·휘도 계산하고, 'light'|'dark' 톤을 postMessage 로 회신한다.
     * 로드 직후 기본(좌하단) 지점도 1회 선제 회신해 부모가 늦게 붙어도 동작한다.
     */
    private function backdropProbeScript(): string
    {
        $js = <<<'JS'
(function(){
  if (window.__moabomBackdropProbe) { return; }
  window.__moabomBackdropProbe = true;
  function parseRgb(s){
    var m = /rgba?\(([^)]+)\)/i.exec(s || '');
    if (!m) { return null; }
    var p = m[1].split(',').map(function(x){ return parseFloat(x); });
    var a = p.length > 3 ? p[3] : 1;
    return { r: p[0] || 0, g: p[1] || 0, b: p[2] || 0, a: isNaN(a) ? 1 : a };
  }
  function compositeOnWhite(c){
    var a = Math.max(0, Math.min(1, c.a));
    return { r: c.r * a + 255 * (1 - a), g: c.g * a + 255 * (1 - a), b: c.b * a + 255 * (1 - a) };
  }
  function bgAt(x, y){
    var el = document.elementFromPoint(x, y);
    while (el && el !== document.documentElement) {
      var c = parseRgb(getComputedStyle(el).backgroundColor);
      if (c && c.a > 0) { return compositeOnWhite(c); }
      el = el.parentElement;
    }
    var base = parseRgb(getComputedStyle(document.body).backgroundColor)
      || parseRgb(getComputedStyle(document.documentElement).backgroundColor);
    if (base && base.a > 0) { return compositeOnWhite(base); }
    return { r: 255, g: 255, b: 255 };
  }
  function luminance(c){
    function ch(v){ v = v / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    return 0.2126 * ch(c.r) + 0.7152 * ch(c.g) + 0.0722 * ch(c.b);
  }
  function measure(points){
    var pts = (points && points.length) ? points : [{ x: 28, y: window.innerHeight - 28 }];
    var sum = 0, n = 0;
    for (var i = 0; i < pts.length; i++) {
      var x = Math.max(0, Math.min(window.innerWidth - 1, pts[i].x));
      var y = Math.max(0, Math.min(window.innerHeight - 1, pts[i].y));
      sum += luminance(bgAt(x, y)); n++;
    }
    var L = n ? sum / n : 1;
    return { tone: L < 0.5 ? 'dark' : 'light', luminance: L };
  }
  function reply(id, points){
    try {
      var res = measure(points);
      parent.postMessage({ source: 'moabom-app', type: 'backdrop-tone', id: id, tone: res.tone, luminance: res.luminance }, '*');
    } catch (e) {}
  }
  window.addEventListener('message', function(ev){
    var d = ev.data;
    if (!d || d.source !== 'moabom-shell' || d.type !== 'backdrop-probe') { return; }
    reply(d.id, d.points);
  });
  function initial(){ reply('initial', null); }
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initial, 80);
  } else {
    window.addEventListener('DOMContentLoaded', function(){ setTimeout(initial, 80); });
  }
})();
JS;

        return '<script id="moabom-app-backdrop-probe">'.$js.'</script>';
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
