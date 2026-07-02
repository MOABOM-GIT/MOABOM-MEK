<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Support;

/**
 * 웹사이트 연결 앱 파비콘 바이너리 검증.
 *
 * Content-Type 헤더가 부정확한 사이트 대응을 위해 매직 바이트를 우선한다.
 */
class WebsiteLinkIconBinaryValidator
{
    private const MAX_BYTES = 524288;

    public function isWithinSizeLimit(string $content): bool
    {
        return $content !== '' && strlen($content) <= self::MAX_BYTES;
    }

    public function looksLikeHtmlDocument(string $content): bool
    {
        $sample = strtolower(ltrim(substr($content, 0, 256)));

        return str_starts_with($sample, '<!doctype')
            || str_starts_with($sample, '<html')
            || str_starts_with($sample, '<head')
            || str_starts_with($sample, '<body');
    }

    /**
     * @return array{mime: string, ext: string}|null
     */
    public function detect(string $content): ?array
    {
        if (! $this->isWithinSizeLimit($content) || $this->looksLikeHtmlDocument($content)) {
            return null;
        }

        if (str_starts_with($content, "\x89PNG\r\n\x1a\n")) {
            return ['mime' => 'image/png', 'ext' => 'png'];
        }

        if (str_starts_with($content, "\xFF\xD8\xFF")) {
            return ['mime' => 'image/jpeg', 'ext' => 'jpg'];
        }

        if (str_starts_with($content, 'GIF87a') || str_starts_with($content, 'GIF89a')) {
            return ['mime' => 'image/gif', 'ext' => 'gif'];
        }

        if (strlen($content) >= 12 && str_starts_with($content, 'RIFF') && substr($content, 8, 4) === 'WEBP') {
            return ['mime' => 'image/webp', 'ext' => 'webp'];
        }

        if (strlen($content) >= 4 && substr($content, 0, 4) === "\0\0\1\0") {
            return ['mime' => 'image/x-icon', 'ext' => 'ico'];
        }

        if ($this->looksLikeIcoContainer($content)) {
            return ['mime' => 'image/x-icon', 'ext' => 'ico'];
        }

        $trimmed = ltrim($content);
        if (str_starts_with($trimmed, '<svg') || str_starts_with($trimmed, '<?xml')) {
            if (preg_match('/<svg\b/i', $trimmed) === 1) {
                return ['mime' => 'image/svg+xml', 'ext' => 'svg'];
            }
        }

        return null;
    }

    /**
     * @return array{mime: string, ext: string}|null
     */
    public function resolveFromHint(string $content, string $url, string $mime): ?array
    {
        $detected = $this->detect($content);
        if ($detected !== null) {
            return $detected;
        }

        if ($mime !== '') {
            $fromMime = $this->mapMimeToExtension($mime);
            if ($fromMime !== null && ! $this->looksLikeHtmlDocument($content)) {
                return $fromMime;
            }
        }

        $path = parse_url($url, PHP_URL_PATH);
        if (is_string($path)) {
            $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            if (in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg'], true)) {
                return [
                    'mime' => $this->guessMimeFromExtension($ext === 'jpeg' ? 'jpg' : $ext),
                    'ext' => $ext === 'jpeg' ? 'jpg' : $ext,
                ];
            }
        }

        return null;
    }

    private function looksLikeIcoContainer(string $content): bool
    {
        if (strlen($content) < 6) {
            return false;
        }

        $reserved = unpack('vreserved/vtype/vcount', substr($content, 0, 6));
        if (! is_array($reserved)) {
            return false;
        }

        return ($reserved['reserved'] ?? -1) === 0
            && ($reserved['type'] ?? -1) === 1
            && ($reserved['count'] ?? 0) >= 1
            && ($reserved['count'] ?? 0) <= 256;
    }

    /**
     * @return array{mime: string, ext: string}|null
     */
    private function mapMimeToExtension(string $mime): ?array
    {
        if (str_contains($mime, ';')) {
            $mime = trim(explode(';', $mime, 2)[0]);
        }

        return match (strtolower($mime)) {
            'image/png' => ['mime' => 'image/png', 'ext' => 'png'],
            'image/jpeg' => ['mime' => 'image/jpeg', 'ext' => 'jpg'],
            'image/gif' => ['mime' => 'image/gif', 'ext' => 'gif'],
            'image/webp' => ['mime' => 'image/webp', 'ext' => 'webp'],
            'image/x-icon', 'image/vnd.microsoft.icon' => ['mime' => 'image/x-icon', 'ext' => 'ico'],
            'image/svg+xml' => ['mime' => 'image/svg+xml', 'ext' => 'svg'],
            default => null,
        };
    }

    private function guessMimeFromExtension(string $ext): string
    {
        return match ($ext) {
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'ico' => 'image/x-icon',
            'svg' => 'image/svg+xml',
            default => 'application/octet-stream',
        };
    }
}
