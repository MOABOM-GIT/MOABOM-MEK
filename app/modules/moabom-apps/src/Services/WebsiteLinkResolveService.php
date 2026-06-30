<?php

namespace Modules\Moabom\Apps\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * 웹사이트 연결 앱용 URL 정규화·헤드 아이콘·포인트 컬러 해석.
 *
 * HTML head 1회(최대 64KB)만 조회한다. og:image 등 대용량 이미지는 사용하지 않는다.
 * apple-touch-icon → shortcut icon → icon → /favicon.ico 순으로 시도한다.
 * 모두 없으면 icon_url=null · icon_from_title=true 로 프론트 타이틀 기반 아이콘을 사용한다.
 */
class WebsiteLinkResolveService
{
    private const FETCH_TIMEOUT_SECONDS = 5;

    private const MAX_BODY_BYTES = 65536;

    /** @var list<string> */
    private const APPLE_TOUCH_RELS = [
        'apple-touch-icon-precomposed',
        'apple-touch-icon',
    ];

    /**
     * @return array{url: string, icon_url: ?string, theme_color: ?string, icon_from_title: bool}
     */
    public function resolve(string $rawUrl): array
    {
        $url = $this->normalizeUrl($rawUrl);
        $this->assertPublicHttpUrl($url);

        $body = $this->fetchDocumentBody($url);
        $themeColor = $body !== null ? $this->extractThemeColor($body) : null;
        $iconUrl = null;

        if ($body !== null) {
            $iconUrl = $this->resolveIconFromBody($body, $url);
        }

        $iconUrl = $iconUrl ?? $this->resolveOriginFavicon($url);

        return [
            'url' => $url,
            'icon_url' => $iconUrl,
            'theme_color' => $themeColor,
            'icon_from_title' => $iconUrl === null,
        ];
    }

    public function normalizeUrl(string $rawUrl): string
    {
        $trimmed = trim($rawUrl);
        if ($trimmed === '') {
            throw new InvalidArgumentException(__('moabom-apps::messages.apps.website_link.url_required'));
        }

        if (! preg_match('#^https?://#i', $trimmed)) {
            $trimmed = 'https://'.$trimmed;
        }

        if (filter_var($trimmed, FILTER_VALIDATE_URL) === false) {
            throw new InvalidArgumentException(__('moabom-apps::messages.apps.website_link.url_invalid'));
        }

        return $trimmed;
    }

    /**
     * 파비콘 등 바이너리 다운로드용 SSRF-safe URL 검증.
     */
    public function assertFetchableUrl(string $rawUrl): string
    {
        $url = $this->normalizeUrl($rawUrl);
        $this->assertPublicHttpUrl($url);

        return $url;
    }

    private function assertPublicHttpUrl(string $url): void
    {
        $parts = parse_url($url);
        $scheme = strtolower((string) ($parts['scheme'] ?? ''));
        if (! in_array($scheme, ['http', 'https'], true)) {
            throw new InvalidArgumentException(__('moabom-apps::messages.apps.website_link.url_invalid'));
        }

        $host = strtolower((string) ($parts['host'] ?? ''));
        if ($host === '' || $host === 'localhost' || str_ends_with($host, '.localhost')) {
            throw new InvalidArgumentException(__('moabom-apps::messages.apps.website_link.url_blocked'));
        }

        if (filter_var($host, FILTER_VALIDATE_IP)) {
            $this->assertPublicIp($host);

            return;
        }

        $records = @dns_get_record($host, DNS_A + DNS_AAAA);
        if (! is_array($records) || $records === []) {
            return;
        }

        foreach ($records as $record) {
            $ip = (string) ($record['ip'] ?? $record['ipv6'] ?? '');
            if ($ip !== '') {
                $this->assertPublicIp($ip);
            }
        }
    }

    private function assertPublicIp(string $ip): void
    {
        if (! filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            throw new InvalidArgumentException(__('moabom-apps::messages.apps.website_link.url_blocked'));
        }
    }

    private function fetchDocumentBody(string $url): ?string
    {
        try {
            $response = Http::timeout(self::FETCH_TIMEOUT_SECONDS)
                ->withHeaders([
                    'User-Agent' => 'MoabomWebsiteLinkBot/1.0',
                    'Accept' => 'text/html,application/xhtml+xml',
                ])
                ->get($url);
        } catch (\Throwable) {
            return null;
        }

        if (! $response->successful()) {
            return null;
        }

        $body = Str::limit((string) $response->body(), self::MAX_BODY_BYTES, '');

        return $body !== '' ? $body : null;
    }

    private function resolveIconFromBody(string $body, string $url): ?string
    {
        $links = $this->extractLinkIconCandidates($body);
        $metaTile = $this->extractMsApplicationTile($body);

        foreach ($this->iconSelectionTiers($links, $metaTile) as $href) {
            $resolved = $this->resolveAgainstBase($href, $url);
            if ($resolved !== null) {
                return $resolved;
            }
        }

        return null;
    }

    private function resolveOriginFavicon(string $url): ?string
    {
        $parts = parse_url($url);
        $origin = ($parts['scheme'] ?? 'https').'://'.($parts['host'] ?? '');
        if (isset($parts['port'])) {
            $origin .= ':'.$parts['port'];
        }

        $faviconUrl = $origin.'/favicon.ico';

        try {
            $response = Http::timeout(3)
                ->withHeaders(['User-Agent' => 'MoabomWebsiteLinkBot/1.0'])
                ->head($faviconUrl);
        } catch (\Throwable) {
            return null;
        }

        if (! $response->successful()) {
            return null;
        }

        $contentType = strtolower((string) $response->header('Content-Type'));
        if ($contentType === '' || str_contains($contentType, 'text/html')) {
            return null;
        }

        if (
            str_contains($contentType, 'image')
            || str_contains($contentType, 'icon')
            || str_contains($contentType, 'octet-stream')
        ) {
            return $faviconUrl;
        }

        return null;
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

    /**
     * @return list<array{rel: string, href: string, size: ?int}>
     */
    private function extractLinkIconCandidates(string $body): array
    {
        if (preg_match_all('/<link\b([^>]*?)>/i', $body, $matches) === false) {
            return [];
        }

        $candidates = [];
        foreach ($matches[1] as $attrChunk) {
            $attrs = $this->parseHtmlAttributes($attrChunk);
            if ($attrs === null) {
                continue;
            }

            $rel = strtolower(trim($attrs['rel'] ?? ''));
            $href = trim($attrs['href'] ?? '');
            if ($rel === '' || $href === '') {
                continue;
            }

            if (str_contains($rel, 'stylesheet') || str_contains($rel, 'manifest') || str_contains($rel, 'canonical')) {
                continue;
            }

            if (! $this->isIconRel($rel)) {
                continue;
            }

            $candidates[] = [
                'rel' => $rel,
                'href' => html_entity_decode($href, ENT_QUOTES | ENT_HTML5),
                'size' => $this->parseIconPixelSize($attrs['sizes'] ?? null),
            ];
        }

        return $candidates;
    }

    private function extractMsApplicationTile(string $body): ?string
    {
        if (preg_match('/<meta[^>]+name=["\']msapplication-TileImage["\'][^>]+content=["\']([^"\']+)["\']/i', $body, $match) === 1) {
            return html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5);
        }

        if (preg_match('/<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\']msapplication-TileImage["\']/i', $body, $match) === 1) {
            return html_entity_decode($match[1], ENT_QUOTES | ENT_HTML5);
        }

        return null;
    }

    /**
     * @param  list<array{rel: string, href: string, size: ?int}>  $links
     * @return list<string>
     */
    private function iconSelectionTiers(array $links, ?string $metaTile): array
    {
        $ordered = [];

        $apple = $this->pickSmallestInTier($links, fn (string $rel): bool => $this->matchesAppleTouchRel($rel));
        if ($apple !== null) {
            $ordered[] = $apple;
        }

        $shortcut = $this->pickSmallestInTier($links, fn (string $rel): bool => $this->matchesShortcutIconRel($rel));
        if ($shortcut !== null) {
            $ordered[] = $shortcut;
        }

        $icon = $this->pickSmallestInTier(
            $links,
            fn (string $rel): bool => $this->matchesGenericIconRel($rel) && ! $this->matchesAppleTouchRel($rel) && ! $this->matchesShortcutIconRel($rel),
        );
        if ($icon !== null) {
            $ordered[] = $icon;
        }

        $fluid = $this->pickSmallestInTier($links, fn (string $rel): bool => str_contains($rel, 'fluid-icon'));
        if ($fluid !== null) {
            $ordered[] = $fluid;
        }

        if ($metaTile !== null && trim($metaTile) !== '') {
            $ordered[] = $metaTile;
        }

        return $ordered;
    }

    /**
     * @param  list<array{rel: string, href: string, size: ?int}>  $links
     */
    private function pickSmallestInTier(array $links, callable $relMatcher): ?string
    {
        $tier = array_values(array_filter(
            $links,
            static fn (array $candidate): bool => $relMatcher($candidate['rel']),
        ));

        if ($tier === []) {
            return null;
        }

        usort($tier, function (array $a, array $b): int {
            $sizeA = $a['size'] ?? PHP_INT_MAX;
            $sizeB = $b['size'] ?? PHP_INT_MAX;
            if ($sizeA !== $sizeB) {
                return $sizeA <=> $sizeB;
            }

            return strlen($a['href']) <=> strlen($b['href']);
        });

        return $tier[0]['href'];
    }

    private function isIconRel(string $rel): bool
    {
        return $this->matchesAppleTouchRel($rel)
            || $this->matchesShortcutIconRel($rel)
            || $this->matchesGenericIconRel($rel)
            || str_contains($rel, 'fluid-icon')
            || str_contains($rel, 'mask-icon');
    }

    private function matchesAppleTouchRel(string $rel): bool
    {
        foreach (self::APPLE_TOUCH_RELS as $token) {
            if (str_contains($rel, $token)) {
                return true;
            }
        }

        return false;
    }

    private function matchesShortcutIconRel(string $rel): bool
    {
        return str_contains($rel, 'shortcut') && str_contains($rel, 'icon');
    }

    private function matchesGenericIconRel(string $rel): bool
    {
        return preg_match('/\bicon\b/', $rel) === 1;
    }

    private function parseIconPixelSize(?string $sizes): ?int
    {
        if ($sizes === null) {
            return null;
        }

        $normalized = strtolower(trim($sizes));
        if ($normalized === '' || $normalized === 'any') {
            return null;
        }

        if (preg_match_all('/(\d+)x(\d+)/', $normalized, $matches) === false || $matches[1] === []) {
            return null;
        }

        $minEdge = null;
        foreach ($matches[1] as $index => $widthRaw) {
            $width = (int) $widthRaw;
            $height = (int) ($matches[2][$index] ?? $widthRaw);
            $edge = min($width, $height);
            $minEdge = $minEdge === null ? $edge : min($minEdge, $edge);
        }

        return $minEdge;
    }

    /**
     * @return array<string, string>|null
     */
    private function parseHtmlAttributes(string $attrChunk): ?array
    {
        $attrs = [];
        if (preg_match_all('/(\w[\w:-]*)\s*=\s*(["\'])(.*?)\2/i', $attrChunk, $matches, PREG_SET_ORDER) !== false) {
            foreach ($matches as $match) {
                $attrs[strtolower($match[1])] = $match[3];
            }
        }

        return $attrs === [] ? null : $attrs;
    }

    private function resolveAgainstBase(string $candidate, string $baseUrl): ?string
    {
        $trimmed = trim($candidate);
        if ($trimmed === '') {
            return null;
        }

        if (str_starts_with(strtolower($trimmed), 'data:')) {
            return strlen($trimmed) >= 120 ? $trimmed : null;
        }

        if (preg_match('#^https?://#i', $trimmed)) {
            return filter_var($trimmed, FILTER_VALIDATE_URL) !== false ? $trimmed : null;
        }

        if (str_starts_with($trimmed, '//')) {
            $parts = parse_url($baseUrl);
            $scheme = (string) ($parts['scheme'] ?? 'https');

            return $scheme.':'.$trimmed;
        }

        $base = parse_url($baseUrl);
        $origin = ($base['scheme'] ?? 'https').'://'.($base['host'] ?? '');
        if (isset($base['port'])) {
            $origin .= ':'.$base['port'];
        }

        if (str_starts_with($trimmed, '/')) {
            return $origin.$trimmed;
        }

        $path = (string) ($base['path'] ?? '/');
        $directory = str_contains($path, '/') ? substr($path, 0, (int) strrpos($path, '/')) : '';

        return $origin.$directory.'/'.$trimmed;
    }
}
