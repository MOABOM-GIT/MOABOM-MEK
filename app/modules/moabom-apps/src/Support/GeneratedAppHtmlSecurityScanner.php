<?php

namespace Modules\Moabom\Apps\Support;

/**
 * AI 생성 앱 HTML — 실행 표면(스크립트·이벤트·위험 URL)만 스캔합니다.
 *
 * CDN(Three.js / Phaser / Chart.js 등) HTTPS 로드는 허용합니다.
 */
final class GeneratedAppHtmlSecurityScanner
{
    /**
     * @var array<int, array{id: string, pattern: string}>|null
     */
    private ?array $rules = null;

    public function scan(string $html): GeneratedAppHtmlSecurityScanResult
    {
        if (trim($html) === '') {
            return new GeneratedAppHtmlSecurityScanResult([]);
        }

        $violations = [];
        $seen = [];

        foreach ($this->extractExecutableSurfaces($html) as $surface) {
            foreach ($this->rules() as $rule) {
                $ruleId = (string) $rule['id'];
                if (isset($seen[$ruleId])) {
                    continue;
                }

                if (@preg_match((string) $rule['pattern'], $surface) === 1) {
                    $violations[] = new GeneratedAppHtmlSecurityViolation($ruleId);
                    $seen[$ruleId] = true;
                }
            }
        }

        return new GeneratedAppHtmlSecurityScanResult($violations);
    }

    /**
     * @return array<int, string>
     */
    public function extractExecutableSurfaces(string $html): array
    {
        $surfaces = [];

        if (preg_match_all('/<script\b([^>]*)>([\s\S]*?)<\/script>/i', $html, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $attrs = (string) ($match[1] ?? '');
                $body = (string) ($match[2] ?? '');
                if (preg_match('/\bsrc\s*=\s*["\']([^"\']+)["\']/i', $attrs, $srcMatch) === 1) {
                    $surfaces[] = 'src="'.$srcMatch[1].'"';
                }
                if (trim($body) !== '') {
                    $surfaces[] = $body;
                }
            }
        }

        if (preg_match_all('/\s(on[a-z]+)\s*=\s*("|\')([\s\S]*?)\2/i', $html, $handlerMatches, PREG_SET_ORDER)) {
            foreach ($handlerMatches as $match) {
                $surfaces[] = (string) ($match[3] ?? '');
            }
        }

        if (preg_match_all('/\b(href|src|action|formaction|data)\s*=\s*("|\')([^"\']*)\2/i', $html, $urlMatches, PREG_SET_ORDER)) {
            foreach ($urlMatches as $match) {
                $surfaces[] = (string) ($match[3] ?? '');
            }
        }

        if (preg_match('/<meta\b[^>]*http-equiv\s*=\s*["\']refresh["\'][^>]*>/i', $html, $metaMatch) === 1) {
            $surfaces[] = (string) $metaMatch[0];
        }

        if (preg_match_all('/<iframe\b[^>]*>/i', $html, $iframeMatches)) {
            foreach ($iframeMatches[0] as $iframeTag) {
                $surfaces[] = (string) $iframeTag;
            }
        }

        return $surfaces;
    }

    /**
     * @return array<int, array{id: string, pattern: string}>
     */
    private function rules(): array
    {
        if ($this->rules !== null) {
            return $this->rules;
        }

        /** @var array{rules?: array<int, array{id: string, pattern: string}>} $config */
        $config = require dirname(__DIR__, 2).'/config/generated-app-html-security.php';

        $this->rules = array_values($config['rules'] ?? []);

        return $this->rules;
    }
}
