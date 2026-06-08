<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;

/**
 * Read-only 진단 — platform (mek360, SSOT) vs tenant DB 의 schema 데이터 diff.
 *
 * "freshent 메뉴가 4개만 보임" 같은 분기 발생 원인 확인용:
 *  - platform 에는 있고 tenant 에는 없는 row (= clone 시점 이후 mek360 에 추가됨)
 *  - tenant 에만 있는 row (= tenant 안에서 추가/수정됨)
 *  - 양쪽 다 있는 row (정상)
 *
 * 변경 0. 같은 MySQL instance 의 cross-DB SELECT 만 사용.
 *
 * @see deploy/AGENT-FAILURE-ANALYSIS.md §12
 */
class SaasDiffTenantCommand extends Command
{
    /**
     * 비교 대상 테이블 + identifier 컬럼 (없으면 row count 만).
     *
     * @var array<string, string|null>
     */
    private const TABLES = [
        'menus' => 'slug',
        'modules' => 'identifier',
        'plugins' => 'identifier',
        'templates' => 'identifier',
        'roles' => 'identifier',
        'permissions' => 'identifier',
        'role_menus' => null,
        'role_permissions' => null,
        'template_layouts' => 'identifier',
    ];

    protected $signature = 'moabom:saas:diff-tenant
        {slug : 비교할 tenant slug}
        {--source-db= : platform DB 이름 (기본 schema_source_db, 보통 moabom-db)}
        {--table=* : 비교할 테이블 (기본: menus, modules, plugins, role_menus 등 전체)}
        {--active-only : menus.is_active=1 / modules|plugins|templates.status=active 기준 비교}
        {--show-rows : identifier diff 의 row 도 모두 출력 (large)}';

    protected $description = 'platform vs tenant DB 의 schema 데이터 diff (read-only)';

    public function handle(
        TenantDatabaseConfigurator $databaseConfigurator,
        PlatformConnectionFactory $platformConnections,
    ): int {
        $platformConnections->registerConnection();
        $slug = (string) $this->argument('slug');
        $sourceDb = (string) ($this->option('source-db')
            ?: config('moabom-system.saas.provision.schema_source_db', 'moabom-db'));

        /** @var list<string> $tableFilter */
        $tableFilter = (array) $this->option('table');
        $activeOnly = (bool) $this->option('active-only');
        $showRows = (bool) $this->option('show-rows');

        $tenant = $this->loadTenant($slug);
        if ($tenant === null) {
            $this->error(sprintf('tenant %s 미존재.', $slug));

            return self::FAILURE;
        }

        $this->line(sprintf('platform=%s vs tenant=%s (db=%s)', $sourceDb, $tenant->slug, $tenant->dbDatabase));
        $this->newLine();

        $databaseConfigurator->apply($tenant);
        $pdo = DB::connection()->getPdo();
        $prefix = (string) DB::connection()->getTablePrefix();
        $tenantDb = $tenant->dbDatabase;

        $tables = self::TABLES;
        if ($tableFilter !== []) {
            $tables = array_intersect_key($tables, array_flip($tableFilter));
        }

        $summaryRows = [];

        foreach ($tables as $logicalTable => $idColumn) {
            $physical = $prefix.$logicalTable;
            $platformExists = $this->tableExists($pdo, $sourceDb, $physical);
            $tenantExists = $this->tableExists($pdo, $tenantDb, $physical);

            if (! $platformExists && ! $tenantExists) {
                $summaryRows[] = [$logicalTable, '—', '—', '없음 (양쪽)'];

                continue;
            }
            if (! $platformExists) {
                $summaryRows[] = [$logicalTable, '없음', '?', 'platform 누락'];

                continue;
            }
            if (! $tenantExists) {
                $summaryRows[] = [$logicalTable, '?', '없음', 'tenant 누락'];

                continue;
            }

            $platformCount = $this->countRows($pdo, $sourceDb, $physical);
            $tenantCount = $this->countRows($pdo, $tenantDb, $physical);

            $note = '';
            $onlyPlatform = [];
            $onlyTenant = [];

            if ($idColumn !== null) {
                $whereClause = $this->whereClauseFor($logicalTable, $activeOnly);
                $platformSet = $this->fetchColumn($pdo, $sourceDb, $physical, $idColumn, $whereClause);
                $tenantSet = $this->fetchColumn($pdo, $tenantDb, $physical, $idColumn, $whereClause);

                $onlyPlatform = array_values(array_diff($platformSet, $tenantSet));
                $onlyTenant = array_values(array_diff($tenantSet, $platformSet));

                $note = sprintf('only-platform=%d only-tenant=%d', count($onlyPlatform), count($onlyTenant));
            }

            $summaryRows[] = [$logicalTable, (string) $platformCount, (string) $tenantCount, $note];

            if ($idColumn !== null && ($onlyPlatform !== [] || $onlyTenant !== [])) {
                $this->newLine();
                $this->info(sprintf('--- %s diff (%s) ---', $logicalTable, $idColumn));
                if ($onlyPlatform !== []) {
                    $this->line(sprintf('  only in %s (platform):', $sourceDb));
                    $rows = $showRows ? $onlyPlatform : array_slice($onlyPlatform, 0, 20);
                    foreach ($rows as $val) {
                        $this->line('    + '.$val);
                    }
                    if (! $showRows && count($onlyPlatform) > 20) {
                        $this->line(sprintf('    … (%d more, use --show-rows)', count($onlyPlatform) - 20));
                    }
                }
                if ($onlyTenant !== []) {
                    $this->line(sprintf('  only in %s (tenant):', $tenantDb));
                    $rows = $showRows ? $onlyTenant : array_slice($onlyTenant, 0, 20);
                    foreach ($rows as $val) {
                        $this->line('    - '.$val);
                    }
                    if (! $showRows && count($onlyTenant) > 20) {
                        $this->line(sprintf('    … (%d more, use --show-rows)', count($onlyTenant) - 20));
                    }
                }
            }
        }

        $this->newLine();
        $this->info('=== SUMMARY ===');
        $this->table(['table', 'platform', 'tenant', 'note'], $summaryRows);

        // 모듈 / 플러그인 status 추가 정보 — active 인지 비교.
        if (isset($tables['modules'])) {
            $this->newLine();
            $this->info('--- modules.status (platform vs tenant) ---');
            $this->dumpStatus($pdo, $sourceDb, $tenantDb, $prefix.'modules', 'identifier', 'status');
        }
        if (isset($tables['plugins'])) {
            $this->newLine();
            $this->info('--- plugins.status (platform vs tenant) ---');
            $this->dumpStatus($pdo, $sourceDb, $tenantDb, $prefix.'plugins', 'identifier', 'status');
        }

        return self::SUCCESS;
    }

    private function tableExists(\PDO $pdo, string $db, string $table): bool
    {
        try {
            $stmt = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ? LIMIT 1');
            $stmt->execute([$db, $table]);

            return (bool) $stmt->fetchColumn();
        } catch (\Throwable) {
            return false;
        }
    }

    private function countRows(\PDO $pdo, string $db, string $table): int
    {
        try {
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM `{$db}`.`{$table}`");
            $stmt->execute();

            return (int) $stmt->fetchColumn();
        } catch (\Throwable) {
            return -1;
        }
    }

    /**
     * @return list<string>
     */
    private function fetchColumn(\PDO $pdo, string $db, string $table, string $column, string $whereClause = ''): array
    {
        try {
            $stmt = $pdo->prepare("SELECT `{$column}` FROM `{$db}`.`{$table}` {$whereClause}");
            $stmt->execute();

            $out = [];
            while (($v = $stmt->fetchColumn()) !== false) {
                $out[] = (string) $v;
            }

            return $out;
        } catch (\Throwable) {
            return [];
        }
    }

    private function whereClauseFor(string $table, bool $activeOnly): string
    {
        if (! $activeOnly) {
            return '';
        }

        return match ($table) {
            'menus' => 'WHERE `is_active` = 1',
            'modules', 'plugins', 'templates' => "WHERE `status` = 'active'",
            default => '',
        };
    }

    private function dumpStatus(\PDO $pdo, string $sourceDb, string $tenantDb, string $table, string $idColumn, string $statusColumn): void
    {
        try {
            $platform = [];
            $stmt = $pdo->prepare("SELECT `{$idColumn}`, `{$statusColumn}` FROM `{$sourceDb}`.`{$table}`");
            $stmt->execute();
            while ($row = $stmt->fetch(\PDO::FETCH_ASSOC)) {
                $platform[(string) $row[$idColumn]] = (string) ($row[$statusColumn] ?? '');
            }
            $tenant = [];
            $stmt = $pdo->prepare("SELECT `{$idColumn}`, `{$statusColumn}` FROM `{$tenantDb}`.`{$table}`");
            $stmt->execute();
            while ($row = $stmt->fetch(\PDO::FETCH_ASSOC)) {
                $tenant[(string) $row[$idColumn]] = (string) ($row[$statusColumn] ?? '');
            }

            $ids = array_unique(array_merge(array_keys($platform), array_keys($tenant)));
            sort($ids);

            $rows = [];
            foreach ($ids as $id) {
                $p = $platform[$id] ?? '—';
                $t = $tenant[$id] ?? '—';
                $diff = $p === $t ? '' : '※';
                $rows[] = [$id, $p, $t, $diff];
            }
            $this->table(['identifier', 'platform', 'tenant', '差'], $rows);
        } catch (\Throwable $e) {
            $this->error('  dumpStatus err: '.$e->getMessage());
        }
    }

    private function loadTenant(string $slug): ?TenantRecord
    {
        try {
            $row = DB::connection('moabom_platform')
                ->table('moabom_saas_tenants')
                ->where('slug', $slug)
                ->first();
        } catch (\Throwable $e) {
            $this->error('platform DB query err: '.$e->getMessage());

            return null;
        }

        return $row === null ? null : TenantRecord::fromRow((array) $row);
    }
}
