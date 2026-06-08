<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

/**
 * config:cache 후 mergeConfigFrom 의 env() 는 null — Cloud Run env 는 getenv 로 재주입.
 */
final class SaasCachedConfigBridge
{
    public static function applyIfNeeded(): void
    {
        if (! app()->configurationIsCached()) {
            return;
        }

        $enabled = getenv('MOABOM_SAAS_ENABLED');
        if ($enabled !== false) {
            config(['moabom-system.saas.enabled' => filter_var($enabled, FILTER_VALIDATE_BOOLEAN)]);
        }

        $baseDomain = getenv('MOABOM_SAAS_BASE_DOMAIN');
        if ($baseDomain !== false && $baseDomain !== '') {
            config(['moabom-system.saas.base_domain' => $baseDomain]);
        }

        $platformHosts = getenv('MOABOM_SAAS_PLATFORM_HOSTS');
        if ($platformHosts !== false && $platformHosts !== '') {
            config(['moabom-system.saas.platform_hosts' => self::csvHosts($platformHosts)]);
        }

        $registryTtl = getenv('MOABOM_SAAS_REGISTRY_CACHE_TTL');
        if ($registryTtl !== false && $registryTtl !== '') {
            config(['moabom-system.saas.registry_cache_ttl' => (int) $registryTtl]);
        }

        $devSlug = getenv('MOABOM_SAAS_DEV_TENANT_SLUG');
        if ($devSlug !== false) {
            config(['moabom-system.saas.dev_tenant_slug' => $devSlug]);
        }

        $platformDb = getenv('MOABOM_PLATFORM_DATABASE');
        if ($platformDb !== false && $platformDb !== '') {
            config(['moabom-system.saas.platform_database' => $platformDb]);
        }

        // A안 — language_packs read-through VIEW 게이트. 누락 시 런타임에서 false 로 읽혀
        // 부팅 tenant-repair/mirror/reconcile 의 자동 view 전환이 동작하지 않는다.
        $sharedLanguagePacks = getenv('MOABOM_SAAS_SHARED_LANGUAGE_PACKS');
        if ($sharedLanguagePacks !== false && $sharedLanguagePacks !== '') {
            config(['moabom-system.saas.shared_language_packs' => filter_var($sharedLanguagePacks, FILTER_VALIDATE_BOOLEAN)]);
        }
    }

    /**
     * @return list<string>
     */
    private static function csvHosts(string $raw): array
    {
        return array_values(array_filter(array_map('trim', explode(',', $raw))));
    }
}
