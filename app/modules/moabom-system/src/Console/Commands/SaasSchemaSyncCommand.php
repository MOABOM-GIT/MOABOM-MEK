<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;
use Modules\Moabom\System\Saas\SaasMigrationPlaneCatalog;
use Modules\Moabom\System\Saas\SaasTenantMigrationBaseliner;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;
use Throwable;

/**
 * 코어·모듈·플러그인 migration plane 을 platform(moabom-db) + active tenants 에 fail-closed 적용.
 *
 * @see deploy/DEPLOY-RECURRING-FAILURES.md RF-32
 */
final class SaasSchemaSyncCommand extends Command
{
    protected $signature = 'moabom:saas:schema-sync
        {--force : catch-up 표시 (모든 지정 plane 적용; plane 미지정 시 discover 전체)}
        {--plane=* : 특정 plane key 만 (예: core, plugin:sirsoft-gdpr)}
        {--skip-platform : moabom-db migrate 생략}
        {--skip-tenants : tenant fan-out 생략}
        {--tenant= : 특정 tenant slug 만}
        {--pretend : migrate --pretend}';

    protected $description = 'G7 코어·모듈·플러그인 DDL 을 platform + active tenants 에 동기화 (fail-closed)';

    public function handle(
        PlatformConnectionFactory $platformConnections,
        PlatformRuntimeConfigurator $platformRuntime,
        TenantDatabaseConfigurator $databaseConfigurator,
        SaasMigrationPlaneCatalog $catalog,
        SaasTenantMigrationBaseliner $baseliner,
    ): int {
        if (! config('moabom-system.saas.enabled', false)) {
            $this->warn('MOABOM_SAAS_ENABLED=false — 건너뜀');

            return self::SUCCESS;
        }

        $platformConnections->registerConnection();
        $force = (bool) $this->option('force');
        $pretend = (bool) $this->option('pretend');
        $skipPlatform = (bool) $this->option('skip-platform');
        $skipTenants = (bool) $this->option('skip-tenants');
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

        if ($planes === []) {
            $this->warn('적용할 migration plane 없음.');

            return self::SUCCESS;
        }

        $this->info(sprintf('planes=%d force=%s', count($planes), $force ? 'yes' : 'no'));

        if (! $skipPlatform) {
            $platformRuntime->applyPlatform();
            foreach ($planes as $plane) {
                $this->line(sprintf('[platform] migrate path=%s', $plane['path']));
                $code = $this->runMigratePlane($plane['path'], $pretend, $baseliner);
                if ($code !== 0) {
                    $this->error('platform migrate 실패: '.$plane['path']);

                    return self::FAILURE;
                }
            }
        }

        if ($skipTenants) {
            return self::SUCCESS;
        }

        $tenants = $this->loadTenants($tenantFilter);
        if ($tenants === []) {
            $this->warn('active tenant 없음.');

            return self::SUCCESS;
        }

        $failures = [];
        foreach ($tenants as $tenant) {
            $this->line(sprintf('=== tenant %s db=%s ===', $tenant->slug, $tenant->dbDatabase));
            try {
                $databaseConfigurator->apply($tenant);

                $baselined = 0;
                foreach ($planes as $plane) {
                    $baselined += $baseliner->baselineExistingCreates($plane['path']);
                    $this->unbaselineIncompleteCreates($plane['path']);
                }
                $this->line(sprintf('  baseline existing-creates+=%d', $baselined));

                foreach ($planes as $plane) {
                    $code = $this->runMigratePlane($plane['path'], $pretend, $baseliner);
                    if ($code !== 0) {
                        throw new \RuntimeException('migrate failed: '.$plane['path']);
                    }
                }
            } catch (Throwable $e) {
                $this->error('  FAIL: '.$e->getMessage());
                $failures[] = $tenant->slug;
            }
        }

        $this->info(sprintf('SUMMARY tenants ok=%d fail=%d', count($tenants) - count($failures), count($failures)));
        if ($failures !== []) {
            $this->error('실패: '.implode(', ', $failures));

            return self::FAILURE;
        }

        return self::SUCCESS;
    }

    /**
     * pending 파일을 하나씩 migrate — already-applied 는 해당 파일만 카탈로그에 기록.
     */
    private function runMigratePlane(string $path, bool $pretend, SaasTenantMigrationBaseliner $baseliner): int
    {
        $absolute = base_path($path);
        if (! is_dir($absolute)) {
            return self::SUCCESS;
        }

        $files = glob($absolute.DIRECTORY_SEPARATOR.'*.php') ?: [];
        sort($files);

        foreach ($files as $file) {
            $base = basename($file, '.php');
            if (DB::table('migrations')->where('migration', $base)->exists()) {
                continue;
            }

            // migrate --path 는 디렉터리 또는 단일 파일(app 상대) 가능
            $relFile = $path.'/'.basename($file);
            $this->line(sprintf('  migrate %s', $relFile));

            $args = [
                '--force' => true,
                '--no-interaction' => true,
                '--path' => $relFile,
            ];
            if ($pretend) {
                $args['--pretend'] = true;
            }

            try {
                $code = Artisan::call('migrate', $args);
                $output = Artisan::output();
                if ($code !== 0) {
                    if ($this->looksAlreadyApplied($output, '', $baseliner)) {
                        $this->warn('  already-applied → record '.$base);
                        $this->recordMigrationAsRan($base);
                        continue;
                    }
                    $this->error('  migrate exit '.$code.': '.substr($output, 0, 240));

                    return self::FAILURE;
                }
            } catch (Throwable $e) {
                $msg = $e->getMessage();
                $state = $e instanceof \Illuminate\Database\QueryException
                    ? (string) ($e->errorInfo[0] ?? '')
                    : '';
                if ($baseliner->isAlreadyAppliedSqlState($state, $msg)) {
                    $this->warn('  already-applied → record '.$base);
                    $this->recordMigrationAsRan($base);
                    continue;
                }
                $this->error('  migrate exception: '.$msg);

                return self::FAILURE;
            }
        }

        return self::SUCCESS;
    }

    private function looksAlreadyApplied(string $output, string $sqlState, SaasTenantMigrationBaseliner $baseliner): bool
    {
        return $baseliner->isAlreadyAppliedSqlState($sqlState, $output);
    }

    /**
     * create_* 가 카탈로그에만 있고 테이블이 없으면 row 제거해 migrate 가 다시 돌게 함.
     */
    private function unbaselineIncompleteCreates(string $path): void
    {
        $absolute = base_path($path);
        if (! is_dir($absolute)) {
            return;
        }

        foreach (glob($absolute.DIRECTORY_SEPARATOR.'*.php') ?: [] as $file) {
            $base = basename($file, '.php');
            $contents = (string) file_get_contents($file);
            if (! preg_match('/Schema::create\(\s*[\'"]([^\'"]+)[\'"]/', $contents, $m)) {
                continue;
            }
            $table = $m[1];
            if (Schema::hasTable($table)) {
                continue;
            }
            if (! DB::table('migrations')->where('migration', $base)->exists()) {
                continue;
            }
            DB::table('migrations')->where('migration', $base)->delete();
            $this->line(sprintf('  unbaseline %s (table %s missing)', $base, $table));
        }
    }

    private function recordMigrationAsRan(string $base): void
    {
        if (DB::table('migrations')->where('migration', $base)->exists()) {
            return;
        }
        $batch = ((int) DB::table('migrations')->max('batch')) + 1;
        DB::table('migrations')->insert(['migration' => $base, 'batch' => $batch]);
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
