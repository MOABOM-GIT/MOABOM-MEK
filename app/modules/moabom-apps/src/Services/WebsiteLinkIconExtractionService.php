<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use Modules\Moabom\Apps\DTO\WebsiteLinkIconFetchResult;
use Modules\Moabom\Apps\Support\WebsiteLinkIconBinaryValidator;

/**
 * 웹사이트 연결 앱 파비콘 단계별 추출 파이프라인.
 *
 * ## probe (resolve API — 빠른 미리보기)
 * HTML head 1회 → 후보 URL 목록 → 첫 후보만 반환 (GET 없음)
 *
 * ## fetch (저장·repair — 확정)
 * HTML head 1회 → 후보 URL 순회 → GET + 매직 바이트 검증 → 첫 성공 바이너리 반환
 */
class WebsiteLinkIconExtractionService
{
    private const FETCH_TIMEOUT_SECONDS = 5;

    /** @var list<string> */
    private const WELL_KNOWN_ICON_PATHS = [
        '/favicon.ico',
        '/favicon.png',
        '/apple-touch-icon.png',
        '/apple-touch-icon-precomposed.png',
    ];

    /** @var list<string> */
    private const APPLE_TOUCH_RELS = [
        'apple-touch-icon-precomposed',
        'apple-touch-icon',
    ];

    public function __construct(
        private readonly WebsiteLinkUrlGuard $urlGuard,
        private readonly WebsiteLinkIconBinaryValidator $binaryValidator,
    ) {
    }

    /**
     * resolve API용 — HTML 파싱만 수행하고 후보 URL을 반환합니다 (바이너리 GET 없음).
     *
     * @param  string|null  $documentBody  이미 조회한 HTML(있으면 document GET 생략)
     * @return array{icon_url: ?string, icon_from_title: bool}
     */
    public function probeIconCandidate(string $websiteUrl, ?string $documentBody = null): array
    {
        $url = $this->urlGuard->normalizeUrl($websiteUrl);
        $body = $documentBody ?? $this->urlGuard->fetchDocumentBody($url);
        $candidates = $this->collectCandidateUrls($body, $url);

        if ($candidates === []) {
            return [
                'icon_url' => null,
                'icon_from_title' => true,
            ];
        }

        return [
            'icon_url' => $candidates[0],
            'icon_from_title' => false,
        ];
    }

    /**
     * 저장·repair용 — 후보 URL을 GET 검증하여 바이너리를 반환합니다.
     */
    public function fetchIconForWebsite(string $websiteUrl, ?string $preferredSourceUrl = null): ?WebsiteLinkIconFetchResult
    {
        $url = $this->urlGuard->normalizeUrl($websiteUrl);
        $body = $this->urlGuard->fetchDocumentBody($url);
        $candidates = $this->collectCandidateUrls($body, $url);

        if ($preferredSourceUrl !== null && trim($preferredSourceUrl) !== '') {
            $candidates = $this->prioritizeCandidate($candidates, trim($preferredSourceUrl));
        }

        foreach ($candidates as $candidateUrl) {
            $binary = $this->fetchIconBinary($candidateUrl);
            if ($binary !== null) {
                return new WebsiteLinkIconFetchResult($candidateUrl, $binary);
            }
        }

        return null;
    }

    /**
     * @return list<string>
     */
    public function collectCandidateUrls(?string $documentBody, string $websiteUrl): array
    {
        $ordered = [];

        if ($documentBody !== null && $documentBody !== '') {
            $links = $this->extractLinkIconCandidates($documentBody);
            $metaTile = $this->extractMsApplicationTile($documentBody);

            foreach ($this->iconSelectionTiers($links, $metaTile) as $href) {
                $resolved = $this->resolveAgainstBase($href, $websiteUrl);
                if ($resolved !== null) {
                    $ordered[] = $resolved;
                }
            }
        }

        foreach ($this->wellKnownIconUrls($websiteUrl) as $wellKnownUrl) {
            $ordered[] = $wellKnownUrl;
        }

        return $this->dedupeUrls($ordered);
    }

    /**
     * @return array{content: string, mime: string, ext: string}|null
     */
    public function fetchIconBinary(string $rawUrl): ?array
    {
        if (str_starts_with(strtolower(trim($rawUrl)), 'data:')) {
            return null;
        }

        try {
            $url = $this->urlGuard->assertFetchableUrl($rawUrl);
        } catch (InvalidArgumentException) {
            return null;
        }

        try {
            $response = Http::timeout(self::FETCH_TIMEOUT_SECONDS)
                ->withHeaders([
                    'User-Agent' => 'MoabomWebsiteLinkBot/1.0',
                    'Accept' => 'image/*,*/*;q=0.8',
                ])
                ->get($url);
        } catch (\Throwable $exception) {
            Log::warning('moabom-apps.website_link.icon_fetch_failed', [
                'url' => $url,
                'message' => $exception->getMessage(),
            ]);

            return null;
        }

        if (! $response->successful()) {
            return null;
        }

        $content = (string) $response->body();
        if (! $this->binaryValidator->isWithinSizeLimit($content)) {
            return null;
        }

        $mime = trim((string) $response->header('Content-Type', ''));
        if (str_contains($mime, ';')) {
            $mime = trim(explode(';', $mime, 2)[0]);
        }

        $detected = $this->binaryValidator->resolveFromHint($content, $url, $mime);
        if ($detected === null) {
            return null;
        }

        return [
            'content' => $content,
            'mime' => $detected['mime'],
            'ext' => $detected['ext'],
        ];
    }

    /**
     * @param  list<string>  $candidates
     * @return list<string>
     */
    private function prioritizeCandidate(array $candidates, string $preferredSourceUrl): array
    {
        $preferred = strtolower($preferredSourceUrl);

        return $this->dedupeUrls([
            $preferredSourceUrl,
            ...array_values(array_filter(
                $candidates,
                static fn (string $candidate): bool => strtolower($candidate) !== $preferred,
            )),
        ]);
    }

    /**
     * @return list<string>
     */
    private function wellKnownIconUrls(string $websiteUrl): array
    {
        $parts = parse_url($websiteUrl);
        $origin = ($parts['scheme'] ?? 'https').'://'.($parts['host'] ?? '');
        if (isset($parts['port'])) {
            $origin .= ':'.$parts['port'];
        }

        $urls = [];
        foreach (self::WELL_KNOWN_ICON_PATHS as $path) {
            $urls[] = $origin.$path;
        }

        return $urls;
    }

    /**
     * @param  list<string>  $urls
     * @return list<string>
     */
    private function dedupeUrls(array $urls): array
    {
        $seen = [];
        $deduped = [];

        foreach ($urls as $url) {
            $normalized = strtolower(trim($url));
            if ($normalized === '' || isset($seen[$normalized])) {
                continue;
            }

            $seen[$normalized] = true;
            $deduped[] = $url;
        }

        return $deduped;
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
            return null;
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
