<?php

namespace Modules\Moabom\Apps\Support;

use Modules\Moabom\System\Saas\TenantRequestHost;

/**
 * 생성앱 프리뷰 라우팅 SSOT.
 *
 * dedicated_host — apps.mek360.com / {id}.apps.mek360.com (SaaS 확정안)
 * tenant_path    — 레거시·로컬 폴백 ({tenant}/modules/.../preview)
 */
final class GeneratedAppPreviewRouting
{
    public const MODE_TENANT_PATH = 'tenant_path';

    public const MODE_DEDICATED_HOST = 'dedicated_host';

    public static function mode(): string
    {
        $explicit = trim((string) config('moabom-apps.preview.routing', ''));
        if ($explicit === self::MODE_TENANT_PATH || $explicit === self::MODE_DEDICATED_HOST) {
            return $explicit;
        }

        return self::MODE_DEDICATED_HOST;
    }

    public static function usesTenantPath(): bool
    {
        return self::mode() === self::MODE_TENANT_PATH;
    }

    public static function usesDedicatedHost(): bool
    {
        return self::mode() === self::MODE_DEDICATED_HOST;
    }

    public static function pathPrefix(): string
    {
        return (string) config('moabom-apps.preview.path_prefix', '/modules/moabom-apps/preview');
    }

    public static function standardPath(int $appId): string
    {
        return self::pathPrefix().'/g/'.$appId;
    }

    public static function hostedPath(int $appId): string
    {
        return self::pathPrefix().'/hosted/'.$appId;
    }

    public static function hostedDataApiPath(int $appId, string $tableKey): string
    {
        return self::hostedPath($appId).'/api/data/'.$tableKey;
    }

    public static function standardHost(): string
    {
        return trim((string) config('moabom-apps.preview.standard_host', 'apps.mek360.com'));
    }

    public static function hostedAppsDomain(): string
    {
        $configured = trim((string) config('moabom-apps.preview.hosted_apps_domain', ''));
        if ($configured !== '') {
            return $configured;
        }

        return 'apps.'.trim((string) config('moabom-apps.preview.hosted_base_domain', 'mek360.com'));
    }

    public static function hostedOriginForApp(int $appId): string
    {
        $scheme = (string) config('moabom-apps.preview.scheme', 'https');

        return $scheme.'://'.$appId.'.'.self::hostedAppsDomain();
    }

    public static function tenantOrigin(): string
    {
        return rtrim((string) config('app.url', ''), '/');
    }

    public static function isDedicatedPreviewHostRequest(): bool
    {
        if (! self::usesDedicatedHost()) {
            return false;
        }

        $host = strtolower(trim(TenantRequestHost::resolve()));
        if ($host === '') {
            return false;
        }

        $parsed = (new GeneratedAppHostParser)->parse($host);

        return $parsed['type'] === 'standard' || $parsed['type'] === 'hosted';
    }

    public static function tenantScopeKey(): string
    {
        if (! self::saasEnabled()) {
            return 'default';
        }

        if (! app()->bound(\Modules\Moabom\System\Saas\TenantContext::class)) {
            return 'unknown';
        }

        $context = app(\Modules\Moabom\System\Saas\TenantContext::class);
        if ($context->isPlatformRequest()) {
            return 'platform';
        }

        $slug = $context->tenantId();

        return $slug !== null && $slug !== '' ? $slug : 'unknown';
    }

    /**
     * apps.mek360.com 프리뷰 HTML — iframe 부모(테넌트 셸) 허용 목록.
     *
     * @return list<string>
     */
    public static function shellFrameAncestors(): array
    {
        $ancestors = [];

        foreach ((array) config('moabom-apps.preview.shell_frame_ancestors', []) as $configured) {
            $configured = trim((string) $configured);
            if ($configured !== '' && ! in_array($configured, $ancestors, true)) {
                $ancestors[] = $configured;
            }
        }

        $scheme = (string) config('moabom-apps.preview.scheme', 'https');
        $baseDomain = strtolower(trim(self::tenantShellBaseDomain()));
        if ($baseDomain !== '') {
            $wildcard = $scheme.'://*.'.$baseDomain;
            if (! in_array($wildcard, $ancestors, true)) {
                $ancestors[] = $wildcard;
            }
        }

        return $ancestors;
    }

    public static function tenantShellBaseDomain(): string
    {
        $fromPreview = trim((string) config('moabom-apps.preview.hosted_base_domain', ''));
        if ($fromPreview !== '') {
            return $fromPreview;
        }

        return trim((string) config('moabom-saas.base_domain', 'mek360.com'));
    }

    private static function saasEnabled(): bool
    {
        return (bool) config('moabom-system.saas.enabled', false)
            || (bool) config('moabom-saas.enabled', false);
    }
}
