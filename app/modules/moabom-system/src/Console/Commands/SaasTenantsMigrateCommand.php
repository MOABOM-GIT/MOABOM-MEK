<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;

/**
 * 모든 active tenant 의 hospital_{slug} DB 에 module migration 일괄 적용.
 *
 * 운영 환경에서 신규 module DB 테이블 추가 시 사용.
 */
class SaasTenantsMigrateCommand extends Command
{
    protected $signature = 'moabom:saas:tenants:migrate
        {--path=modules/moabom-system/database/migrations/2026_05_28_module_settings : migration 경로 (default DB 기준)}
        {--tenant= : 특정 tenant slug 만}
        {--force : 운영 환경에서도 실행}
        {--pretend : 실제 적용 없이 SQL 만 표시}';

    protected $description = '모든 active tenant 의 hospital_{slug} DB 에 module migration 일괄 적용';

    public function handle(
        PlatformConnectionFactory $platformConnections,
        TenantDatabaseConfigurator $databaseConfigurator,
    ): int {
        $platformConnections->registerConnection();

        $path = (string) $this->option('path');
        $tenantFilter = (string) ($this->option('tenant') ?? '');
        $force = (bool) $this->option('force');
        $pretend = (bool) $this->option('pretend');

        $tenants = $this->loadTenants($tenantFilter);
        $this->info(sprintf('대상 tenant: %d 개 (path=%s)', count($tenants), $path));

        if ($tenants === []) {
            $this->warn('active tenant 없음.');

            return self::SUCCESS;
        }

        $failures = [];
        foreach ($tenants as $tenant) {
            $this->line(sprintf('--- %s (db=%s) ---', $tenant->slug, $tenant->dbDatabase));
            try {
                $databaseConfigurator->apply($tenant);
                $args = [
                    '--database' => DB::getDefaultConnection(),
                    '--path' => $path,
                    '--force' => $force,
                ];
                if ($pretend) {
                    $args['--pretend'] = true;
                }
                $code = $this->call('migrate', $args);
                if ($code !== 0) {
                    $failures[] = $tenant->slug;
                }
            } catch (\Throwable $e) {
                $this->error('  err: '.$e->getMessage());
                $failures[] = $tenant->slug;
            }
        }

        $this->newLine();
        $this->info(sprintf('SUMMARY ok=%d fail=%d', count($tenants) - count($failures), count($failures)));
        if ($failures !== []) {
            $this->error('실패 tenant: '.implode(', ', $failures));
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
