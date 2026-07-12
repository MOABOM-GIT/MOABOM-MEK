<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Http\Request;

/**
 * SaaS Host SSOT — Cloud Run/LB 는 X-Forwarded-Host, 앱은 getHost() 만 쓰면
 * ResolveMoabomTenant(미부트) + Aggregator(테넌트 plane) split-brain 이 난다.
 *
 * 보안: 클라이언트가 보낸 X-Forwarded-Host 로 임의 테넌트를 고를 수 없게
 * - 이미 유효한 SaaS Host 이면 getHost() 우선 (스푸핑 무시)
 * - Cloud Run 기본 호스트(*.run.app) 일 때만 forwarded 를 쓰되, base_domain/platform allowlist 검증
 */
final class TenantRequestHost
{
    public static function resolve(?Request $request = null): string
    {
        $request ??= request();
        if (! $request instanceof Request) {
            return '';
        }

        $host = self::normalizeHost((string) $request->getHost());
        $forwardedHost = self::normalizeHost(self::firstForwardedHost($request));

        // 커스텀/테넌트 도메인으로 직접 들어온 요청: forwarded 로 덮어쓰지 않음.
        if ($host !== '' && ! self::isCloudRunDefaultHost($host) && self::isAllowedSaaSHost($host)) {
            return $host;
        }

        // LB → Cloud Run(*.run.app) 경로: forwarded 가 SaaS allowlist 일 때만 채택.
        if ($forwardedHost !== '' && self::isAllowedSaaSHost($forwardedHost)) {
            return $forwardedHost;
        }

        return $host;
    }

    private static function firstForwardedHost(Request $request): string
    {
        $forwarded = $request->header('X-Forwarded-Host');
        if (! is_string($forwarded) || trim($forwarded) === '') {
            return '';
        }

        return trim(explode(',', $forwarded)[0]);
    }

    private static function normalizeHost(string $raw): string
    {
        $host = strtolower(trim($raw));
        if ($host === '') {
            return '';
        }

        if (str_contains($host, ':')) {
            $host = (string) strtok($host, ':');
        }

        return $host;
    }

    private static function isCloudRunDefaultHost(string $host): bool
    {
        return str_ends_with($host, '.a.run.app')
            || str_ends_with($host, '.run.app');
    }

    private static function isAllowedSaaSHost(string $host): bool
    {
        $baseDomain = strtolower(trim((string) config('moabom-system.saas.base_domain', config('moabom-saas.base_domain', 'mek360.com'))));
        $platformHosts = array_values(array_filter(array_map(
            static fn ($h): string => self::normalizeHost((string) $h),
            (array) config('moabom-system.saas.platform_hosts', config('moabom-saas.platform_hosts', [])),
        )));

        $parser = new TenantHostParser($baseDomain !== '' ? $baseDomain : 'mek360.com', $platformHosts);
        $parsed = $parser->parse($host);

        return ($parsed['type'] ?? '') === 'platform' || ($parsed['type'] ?? '') === 'tenant';
    }
}
