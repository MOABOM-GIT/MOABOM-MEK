<?php

namespace Modules\Moabom\Apps\Services;

use InvalidArgumentException;

/**
 * 웹사이트 연결 앱용 URL 정규화·헤드 아이콘·포인트 컬러 해석.
 *
 * HTML head 1회(최대 64KB)만 조회한다. og:image 등 대용량 이미지는 사용하지 않는다.
 * 아이콘 추출은 {@see WebsiteLinkIconExtractionService} 단계별 파이프라인에 위임한다.
 */
class WebsiteLinkResolveService
{
    public function __construct(
        private readonly WebsiteLinkUrlGuard $urlGuard,
        private readonly WebsiteLinkIconExtractionService $iconExtractionService,
    ) {
    }

    /**
     * @return array{url: string, icon_url: ?string, theme_color: ?string, icon_from_title: bool}
     */
    public function resolve(string $rawUrl): array
    {
        $url = $this->urlGuard->assertFetchableUrl($rawUrl);

        $body = $this->urlGuard->fetchDocumentBody($url);
        $themeColor = $body !== null ? $this->extractThemeColor($body) : null;
        // document HTML 은 1회만 조회 — probe 에 body 를 넘겨 이중 fetch 를 막는다.
        $icon = $this->iconExtractionService->probeIconCandidate($url, $body);

        return [
            'url' => $url,
            'icon_url' => $icon['icon_url'],
            'theme_color' => $themeColor,
            'icon_from_title' => $icon['icon_from_title'],
        ];
    }

    public function normalizeUrl(string $rawUrl): string
    {
        return $this->urlGuard->normalizeUrl($rawUrl);
    }

    public function assertFetchableUrl(string $rawUrl): string
    {
        return $this->urlGuard->assertFetchableUrl($rawUrl);
    }

    public function fetchDocumentBody(string $url): ?string
    {
        return $this->urlGuard->fetchDocumentBody($url);
    }

    private function extractThemeColor(string $body): ?string
    {
        $candidates = [];

        if (preg_match('/<meta[^>]+name=["\']theme-color["\'][^>]+content=["\']([^"\']+)["\']/i', $body, $match) === 1) {
            $candidates[] = html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5);
        }
        if (preg_match('/<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']theme-color["\']/i', $body, $match) === 1) {
            $candidates[] = html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5);
        }
        if (preg_match('/<meta[^>]+name=["\']msapplication-TileColor["\'][^>]+content=["\']([^"\']+)["\']/i', $body, $match) === 1) {
            $candidates[] = html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5);
        }
        if (preg_match('/<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']msapplication-TileColor["\']/i', $body, $match) === 1) {
            $candidates[] = html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5);
        }

        foreach ($candidates as $candidate) {
            $normalized = $this->normalizeThemeColor($candidate);
            if ($normalized !== null) {
                return $normalized;
            }
        }

        return null;
    }

    private function normalizeThemeColor(string $raw): ?string
    {
        $trimmed = trim($raw);
        if ($trimmed === '') {
            return null;
        }

        if (preg_match('/^#([0-9a-f]{3}|[0-9a-f]{6})$/i', $trimmed, $match) === 1) {
            $hex = strtolower($match[1]);
            if (strlen($hex) === 3) {
                $hex = $hex[0].$hex[0].$hex[1].$hex[1].$hex[2].$hex[2];
            }

            return '#'.$hex;
        }

        if (preg_match('/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i', $trimmed, $match) === 1) {
            $r = max(0, min(255, (int) round((float) $match[1])));
            $g = max(0, min(255, (int) round((float) $match[2])));
            $b = max(0, min(255, (int) round((float) $match[3])));

            return sprintf('#%02x%02x%02x', $r, $g, $b);
        }

        return null;
    }
}
