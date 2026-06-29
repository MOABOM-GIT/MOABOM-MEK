<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;

/**
 * SaaS 업체 slug — 예상 호스트 사용 가능 여부 SSOT.
 */
final class SaasSlugAvailabilityService
{
    public function __construct(
        private readonly PlatformConnectionFactory $platformConnections,
    ) {}

    /**
     * @return array{
     *   slug: string,
     *   host: string,
     *   available: bool,
     *   reason: ?string,
     *   conflicts: list<string>
     * }
     */
    public function check(string $rawSlug): array
    {
        $slug = strtolower(trim($rawSlug));
        $baseDomain = (string) config('moabom-system.saas.base_domain', 'mek360.com');
        $host = $slug !== '' ? "{$slug}.{$baseDomain}" : '';

        if ($slug === '' || ! preg_match('/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/', $slug)) {
            return [
                'slug' => $slug,
                'host' => $host,
                'available' => false,
                'reason' => 'invalid_format',
                'conflicts' => [],
            ];
        }

        $conflicts = [];
        foreach ($this->reservedSlugs() as $reserved) {
            if ($slug === $reserved) {
                $conflicts[] = "reserved:{$reserved}";
            }
        }

        if ($this->isPlatformHostSlug($host)) {
            $conflicts[] = 'platform_host';
        }

        if ($this->tenantSlugExists($slug)) {
            $conflicts[] = 'tenant_exists';
        }

        return [
            'slug' => $slug,
            'host' => $host,
            'available' => $conflicts === [],
            'reason' => $conflicts === [] ? null : $conflicts[0],
            'conflicts' => $conflicts,
        ];
    }

    /**
     * @return list<string>
     */
    private function reservedSlugs(): array
    {
        $defaults = [
            'www', 'api', 'auth', 'apps', 'realtime', 'admin', 'platform',
            'mail', 'smtp', 'ftp', 'cdn', 'static', 'assets', 'ws', 'wss',
            'dev', 'staging', 'test', 'demo', 'default', 'platform',
        ];

        $fromHosts = [];
        $parser = new TenantHostParser(
            (string) config('moabom-system.saas.base_domain', 'mek360.com'),
            array_map('strval', (array) config('moabom-system.saas.platform_hosts', [])),
        );
        foreach ((array) config('moabom-system.saas.platform_hosts', []) as $platformHost) {
            $parsed = $parser->parse((string) $platformHost);
            if (($parsed['type'] ?? '') === 'tenant' && is_string($parsed['slug'] ?? null)) {
                $fromHosts[] = (string) $parsed['slug'];
            }
        }

        $protected = (array) config('moabom-system.saas.deprovision.protected_slugs', []);

        return array_values(array_unique(array_filter(array_map(
            static fn (string $value): string => strtolower(trim($value)),
            [...$defaults, ...$fromHosts, ...$protected],
        ))));
    }

    private function isPlatformHostSlug(string $host): bool
    {
        $platformHosts = array_map('strtolower', (array) config('moabom-system.saas.platform_hosts', []));

        return in_array(strtolower($host), $platformHosts, true);
    }

    private function tenantSlugExists(string $slug): bool
    {
        $this->platformConnections->registerConnection();
        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenants')) {
            return false;
        }

        return DB::connection('moabom_platform')
            ->table('moabom_saas_tenants')
            ->where('slug', $slug)
            ->exists();
    }
}
