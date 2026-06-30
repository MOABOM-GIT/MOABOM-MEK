<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use InvalidArgumentException;

/**
 * 웹사이트 연결 앱 URL 정규화·SSRF 검증·HTML head 조회.
 */
class WebsiteLinkUrlGuard
{
    private const FETCH_TIMEOUT_SECONDS = 5;

    private const MAX_BODY_BYTES = 65536;

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

    public function assertFetchableUrl(string $rawUrl): string
    {
        $url = $this->normalizeUrl($rawUrl);
        $this->assertPublicHttpUrl($url);

        return $url;
    }

    public function fetchDocumentBody(string $url): ?string
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
}
