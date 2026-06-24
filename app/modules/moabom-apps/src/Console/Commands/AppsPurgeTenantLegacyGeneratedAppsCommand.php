<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\System\Saas\SaasMysqlPdoFactory;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;

/**
 * tenant DB(및 legacy main write DB) 에 남은 `moabom_system_generated_apps` ghost 행 일괄 삭제.
 *
 * SaaS 쓰기 SSOT는 platform — tenant legacy 에 신규 생성 경로 없음.
 * 배포 migrate-to-platform 제거 후에도 잔여 행이 있으면 이 명령으로 1회 정리.
 */
class AppsPurgeTenantLegacyGeneratedAppsCommand extends Command
{
    private const APPS_TABLE = 'moabom_system_generated_apps';

    private const ROWS_TABLE = 'moabom_generated_app_rows';

    protected $signature = 'moabom:apps:purge-tenant-legacy-generated
        {--tenant= : 특정 tenant slug 만 (미지정 시 active 전체 + main write DB)}
        {--dry-run : 삭제 없이 집계만}
        {--force : 운영 환경에서도 실행}';

    protected $description = 'tenant legacy DB 의 moabom_system_generated_apps 잔여 행 일괄 삭제 (platform SSOT)';

    private int $databasesScanned = 0;

    private int $appsDeleted = 0;

    private int $rowsDeleted = 0;

    private TenantDatabaseConfigurator $databaseConfigurator;

    public function handle(TenantDatabaseConfigurator $databaseConfigurator): int
    {
        $this->databaseConfigurator = $databaseConfigurator;

        GeneratedAppsConnection::register();

        if ($this->laravel->environment('production') && ! $this->option('force')) {
            $this->error('운영 환경에서는 --force 가 필요합니다.');

            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');
        $tenantFilter = trim((string) ($this->option('tenant') ?? ''));

        $platformDb = (string) config('moabom-system.saas.platform_database', 'moabom-platform');
        $mainDb = $this->mainWriteDatabaseName();

        if ($tenantFilter === '' && $mainDb !== '' && $mainDb !== $platformDb) {
            $this->line(sprintf('--- main write db (%s) ---', $mainDb));
            $this->purgeConnectionDatabase($mainDb, 'main-write', $dryRun);
        }

        foreach ($this->loadTenants($tenantFilter) as $tenant) {
            $this->line(sprintf('--- tenant %s (db=%s) ---', $tenant->slug, $tenant->dbDatabase));
            $this->purgeConnectionDatabase($tenant->dbDatabase, $tenant->slug, $dryRun);
        }

        $this->newLine();
        $this->info(sprintf(
            'SUMMARY databases=%d apps_deleted=%d rows_deleted=%d%s',
            $this->databasesScanned,
            $this->appsDeleted,
            $this->rowsDeleted,
            $dryRun ? ' (dry-run)' : '',
        ));

        return self::SUCCESS;
    }

    private function purgeConnectionDatabase(string $database, string $label, bool $dryRun): void
    {
        if ($database === '') {
            $this->line('  (skip: empty database name)');

            return;
        }

        $this->databaseConfigurator->runOnDatabase($database, function (string $connection) use ($dryRun, $label): void {
            $this->databasesScanned++;

            if (! Schema::connection($connection)->hasTable(self::APPS_TABLE)) {
                $this->line('  (no apps table)');

                return;
            }

            $appsCount = (int) DB::connection($connection)->table(self::APPS_TABLE)->count();
            $rowsCount = 0;
            if (Schema::connection($connection)->hasTable(self::ROWS_TABLE)) {
                $rowsCount = (int) DB::connection($connection)->table(self::ROWS_TABLE)->count();
            }

            $this->line(sprintf('  apps=%d rows=%d', $appsCount, $rowsCount));

            if ($appsCount === 0 && $rowsCount === 0) {
                return;
            }

            if ($dryRun) {
                return;
            }

            if ($rowsCount > 0) {
                $deleted = DB::connection($connection)->table(self::ROWS_TABLE)->delete();
                $this->rowsDeleted += $deleted;
                $this->line(sprintf('  deleted rows=%d (%s)', $deleted, $label));
            }

            if ($appsCount > 0) {
                $deleted = DB::connection($connection)->table(self::APPS_TABLE)->delete();
                $this->appsDeleted += $deleted;
                $this->line(sprintf('  deleted apps=%d (%s)', $deleted, $label));
            }
        });
    }

    /**
     * @return list<TenantRecord>
     */
    private function loadTenants(string $filter): array
    {
        if (! Schema::connection(GeneratedAppsConnection::NAME)->hasTable('moabom_saas_tenants')) {
            return [];
        }

        $query = DB::connection(GeneratedAppsConnection::NAME)->table('moabom_saas_tenants');
        if ($filter !== '') {
            $query->where('slug', $filter);
        } else {
            $query->where('status', 'active');
        }

        return $query->orderBy('slug')->get()
            ->map(fn ($row) => TenantRecord::fromRow((array) $row))
            ->all();
    }

    private function mainWriteDatabaseName(): string
    {
        $write = SaasMysqlPdoFactory::writeSlice();

        return (string) ($write['database'] ?? '');
    }
}
