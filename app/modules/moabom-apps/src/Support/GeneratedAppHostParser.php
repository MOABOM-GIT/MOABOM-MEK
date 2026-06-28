<?php

namespace Modules\Moabom\Apps\Support;

/**
 * 생성앱 프리뷰 Host 판별 — TenantHostParser 와 분리 (업체 slug 비충돌).
 *
 * @see docs/GENERATED-APP-TIERS.md
 */
final class GeneratedAppHostParser
{
    /**
     * @return array{type: 'none'|'standard'|'hosted', app_id: ?int, host: string}
     */
    public function parse(string $rawHost): array
    {
        $host = strtolower(trim($rawHost));
        if ($host === '') {
            return ['type' => 'none', 'app_id' => null, 'host' => ''];
        }

        if (str_contains($host, ':')) {
            $host = (string) strtok($host, ':');
        }

        $standardHost = strtolower(trim((string) config('moabom-apps.preview.standard_host', 'apps.mek360.com')));
        if ($standardHost !== '' && $host === $standardHost) {
            return ['type' => 'standard', 'app_id' => null, 'host' => $host];
        }

        $appsDomain = strtolower(trim((string) config('moabom-apps.preview.hosted_apps_domain', 'apps.mek360.com')));
        $baseDomain = strtolower(trim((string) config('moabom-apps.preview.hosted_base_domain', 'mek360.com')));
        if ($appsDomain === '') {
            $appsDomain = 'apps.'.$baseDomain;
        }

        $suffix = '.'.$appsDomain;
        if (str_ends_with($host, $suffix)) {
            $label = substr($host, 0, -strlen($suffix));
            if ($label !== '' && ctype_digit($label)) {
                return ['type' => 'hosted', 'app_id' => (int) $label, 'host' => $host];
            }
        }

        return ['type' => 'none', 'app_id' => null, 'host' => $host];
    }
}
