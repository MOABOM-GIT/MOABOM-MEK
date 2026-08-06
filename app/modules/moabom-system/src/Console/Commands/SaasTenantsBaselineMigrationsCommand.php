<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\SaasMigrationPlaneCatalog;
use Modules\Moabom\System\Saas\SaasTenantMigrationBaseliner;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;
use Throwable;

/**
 * 이미 존재하는 create_* 테이블에 해당하는 migration 이름만 tenant 카탈로그에 baseline.
 * ALTER 는 넣지 않음 — 이후 schema-sync / migrate 가 적용.
 */
final class SaasTenantsBaselineMigrationsCommand extends Command
{
    protected $signature = 'moabom:saas:tenants:baseline-migrations
        {--tenant= : 특정 tenant slug 만}
        {--plane=* : 특정 plane key 만}';

    protected $description = '존재하는 create_* 테이블에 대해 tenant migrations 카탈로그 baseline (ALTER 제외)';

    public function handle(
        PlatformConnectionFactory $platformConnections,
        TenantDatabaseConfigurator $databaseConfigurator,
        SaasMigrationPlaneCatalog $catalog,
        SaasTenantMigrationBaseliner $baseliner,
    ): int {
        if (! config('moabom-system.saas.enabled', false)) {
            $this->warn('MOABOM_SAAS_ENABLED=false — 건너뜀');

            return self::SUCCESS;
        }

        $platformConnections->registerConnection();
        $tenantFilter = (string) ($this->option('tenant') ?? '');
        $planeFilter = array_values(array_filter(array_map('strval', (array) $this->option('plane'))));

        $planes = $catalog->discover();
        if ($planeFilter !== []) {
            $want = array_fill_keys($planeFilter, true);
            $planes = array_values(array_filter(
                $planes,
                static fn (array $p): bool => isset($want[$p['key']]),
            ));
        }

        $tenants = $this->loadTenants($tenantFilter);
        if ($tenants === []) {
            $this->warn('active tenant 없음.');

            return self::SUCCESS;
        }

        $failures = [];
        foreach ($tenants as $tenant) {
            $this->line(sprintf('--- %s ---', $tenant->slug));
            try {
                $databaseConfigurator->apply($tenant);
                $n = 0;
                foreach ($planes as $plane) {
                    $n += $baseliner->baselineExistingCreates($plane['path']);
                }
                $this->line(sprintf('  existing-creates baselined+=%d', $n));
            } catch (Throwable $e) {
                $this->error('  '.$e->getMessage());
                $failures[] = $tenant->slug;
            }
        }

        return $failures === [] ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @return list<TenantRecord>
     */
    private function loadTenants(string $filter): array
    {
        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenants')) {
            return [];
        }

        $query = DB::connection('moabom_platform')->table('moabom_saas_tenants');
        if ($filter !== '') {
            $query->where('slug', $filter);
        } else {
            $query->where('status', 'active');
        }

        return $query->orderBy('slug')->get()
            ->map(fn ($row) => TenantRecord::fromRow((array) $row))
            ->all();
    }
}
