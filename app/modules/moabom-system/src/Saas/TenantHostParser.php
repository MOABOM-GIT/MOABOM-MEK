<?php

namespace Modules\Moabom\System\Saas;

/**
 * Host 헤더 → 플랫폼 vs 테넌트 서브도메인(slug) 판별.
 */
final class TenantHostParser
{
    /**
     * @param  array<int, string>  $platformHosts  apex·www 등 (소문자, 포트 제거 후)
     */
    public function __construct(
        private readonly string $baseDomain,
        private readonly array $platformHosts,
    ) {}

    /**
     * @return array{type: 'platform'|'tenant'|'unknown', slug: ?string, host: string}
     */
    public function parse(string $rawHost): array
    {
        $host = strtolower(trim($rawHost));
        if ($host === '') {
            return ['type' => 'unknown', 'slug' => null, 'host' => ''];
        }

        if (str_contains($host, ':')) {
            $host = (string) strtok($host, ':');
        }

        if (in_array($host, $this->platformHosts, true)) {
            return ['type' => 'platform', 'slug' => null, 'host' => $host];
        }

        $base = strtolower($this->baseDomain);
        $suffix = '.'.$base;

        if ($host === $base) {
            return ['type' => 'platform', 'slug' => null, 'host' => $host];
        }

        if (! str_ends_with($host, $suffix)) {
            return ['type' => 'unknown', 'slug' => null, 'host' => $host];
        }

        $subdomain = substr($host, 0, -strlen($suffix));
        if ($subdomain === '' || str_contains($subdomain, '.')) {
            return ['type' => 'unknown', 'slug' => null, 'host' => $host];
        }

        if (! preg_match('/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/', $subdomain)) {
            return ['type' => 'unknown', 'slug' => null, 'host' => $host];
        }

        return ['type' => 'tenant', 'slug' => $subdomain, 'host' => $host];
    }
}
