<?php

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class TenantRegistry
{
    public function __construct(
        private readonly PlatformConnectionFactory $platformConnections,
    ) {}

    public function findByHost(string $host): ?TenantRecord
    {
        $this->platformConnections->registerConnection();

        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenants')) {
            return null;
        }

        $ttl = (int) config('moabom-system.saas.registry_cache_ttl', 60);
        $cacheKey = 'moabom_saas_tenant_host:'.md5($host);

        if ($ttl > 0) {
            $cached = Cache::get($cacheKey);
            if ($cached instanceof TenantRecord) {
                return $cached;
            }

            $found = $this->queryByHost($host);
            if ($found !== null) {
                Cache::put($cacheKey, $found, $ttl);
            }

            return $found;
        }

        return $this->queryByHost($host);
    }

    public function findBySlug(string $slug): ?TenantRecord
    {
        $this->platformConnections->registerConnection();

        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenants')) {
            return null;
        }

        $row = DB::connection('moabom_platform')
            ->table('moabom_saas_tenants')
            ->where('slug', $slug)
            ->first();

        return $row ? TenantRecord::fromRow((array) $row) : null;
    }

    /**
     * @return list<TenantRecord>
     */
    public function listActive(): array
    {
        $this->platformConnections->registerConnection();

        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenants')) {
            return [];
        }

        $rows = DB::connection('moabom_platform')
            ->table('moabom_saas_tenants')
            ->where('status', 'active')
            ->orderBy('slug')
            ->get();

        $tenants = [];
        foreach ($rows as $row) {
            $tenants[] = TenantRecord::fromRow((array) $row);
        }

        return $tenants;
    }

    public function forgetHostCache(string $host): void
    {
        Cache::forget('moabom_saas_tenant_host:'.md5($host));
    }

    public function updateStatus(string $slug, string $status): void
    {
        $this->platformConnections->registerConnection();

        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenants')) {
            return;
        }

        DB::connection('moabom_platform')
            ->table('moabom_saas_tenants')
            ->where('slug', strtolower($slug))
            ->update([
                'status' => $status,
                'updated_at' => now(),
            ]);

        $row = DB::connection('moabom_platform')
            ->table('moabom_saas_tenants')
            ->where('slug', strtolower($slug))
            ->first(['host']);

        if ($row !== null && isset($row->host)) {
            $this->forgetHostCache((string) $row->host);
        }
    }

    public function deleteBySlug(string $slug): bool
    {
        $this->platformConnections->registerConnection();

        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenants')) {
            return false;
        }

        $row = DB::connection('moabom_platform')
            ->table('moabom_saas_tenants')
            ->where('slug', strtolower($slug))
            ->first(['host']);

        $deleted = DB::connection('moabom_platform')
            ->table('moabom_saas_tenants')
            ->where('slug', strtolower($slug))
            ->delete();

        if ($row !== null && isset($row->host)) {
            $this->forgetHostCache((string) $row->host);
        }

        return $deleted > 0;
    }

    private function queryByHost(string $host): ?TenantRecord
    {
        $row = DB::connection('moabom_platform')
            ->table('moabom_saas_tenants')
            ->where('host', $host)
            ->first();

        if ($row) {
            return TenantRecord::fromRow((array) $row);
        }

        $parser = new TenantHostParser(
            (string) config('moabom-system.saas.base_domain', 'mek360.com'),
            (array) config('moabom-system.saas.platform_hosts', []),
        );
        $parsed = $parser->parse($host);
        if ($parsed['type'] !== 'tenant' || $parsed['slug'] === null) {
            return null;
        }

        $row = DB::connection('moabom_platform')
            ->table('moabom_saas_tenants')
            ->where('slug', $parsed['slug'])
            ->first();

        return $row ? TenantRecord::fromRow((array) $row) : null;
    }
}
