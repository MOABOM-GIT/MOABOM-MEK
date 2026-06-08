<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use App\Repositories\JsonConfigRepository;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;

/**
 * G7 core 의 12 카테고리 settings JSON (gs://{bucket}/settings/*.json,
 * gs://{bucket}/tenants/{slug}/settings/*.json) 을 moabom_module_settings DB 로 1회 import.
 *
 * MoabomDbConfigRepository 가 module='_g7_core_' row 를 read source 로 사용하므로,
 * 이 command 의 import 이후에야 G7 core ConfigRepositoryInterface override 가
 * 의미 있는 데이터로 동작.
 *
 * @see deploy/AGENT-FAILURE-ANALYSIS.md §10
 * @see MoabomDbConfigRepository::MODULE_KEY
 */
class SaasMigrateG7CoreSettingsToDbCommand extends Command
{
    private const MODULE = '_g7_core_';

    protected $signature = 'moabom:saas:migrate-g7-core-settings-to-db
        {--force : 실제 INSERT 수행 (기본은 dry-run)}
        {--tenant= : 특정 tenant slug 만}
        {--skip-platform : platform G7 settings import 건너뛰기}';

    protected $description = 'GCS G7 core settings JSON → moabom_module_settings(module=_g7_core_) 테이블 1회 import';

    public function handle(
        PlatformConnectionFactory $platformConnections,
        TenantDatabaseConfigurator $databaseConfigurator,
        JsonConfigRepository $fallback,
    ): int {
        $dryRun = ! (bool) $this->option('force');
        $tenantFilter = (string) ($this->option('tenant') ?? '');
        $skipPlatform = (bool) $this->option('skip-platform');

        $bucket = (string) config('filesystems.disks.gcs.bucket', '');
        if ($bucket === '') {
            $this->error('filesystems.disks.gcs.bucket 미설정. FILESYSTEM_DISK=gcs 인지 확인.');

            return self::FAILURE;
        }

        $categories = $fallback->getCategories();
        if ($categories === []) {
            $this->error('JsonConfigRepository::getCategories() 비어 있음. defaults.json 확인.');

            return self::FAILURE;
        }

        $this->line(sprintf('mode=%s bucket=%s', $dryRun ? 'DRY-RUN' : 'EXECUTE', $bucket));
        $this->line(sprintf('module=%s categories=%s', self::MODULE, implode(',', $categories)));
        $this->newLine();

        $platformConnections->registerConnection();

        $totalInserts = 0;
        $totalUpdates = 0;
        $totalSkips = 0;
        $errors = [];

        if (! $skipPlatform && $tenantFilter === '') {
            $this->info('=== platform G7 core settings ===');
            [$ins, $upd, $skp, $errs] = $this->importPlatform($categories, $dryRun);
            $totalInserts += $ins;
            $totalUpdates += $upd;
            $totalSkips += $skp;
            $errors = array_merge($errors, $errs);
            $this->newLine();
        }

        $tenants = $this->loadTenants($tenantFilter);
        $this->info(sprintf('=== tenants (%d) ===', count($tenants)));

        foreach ($tenants as $tenant) {
            $this->line(sprintf('--- %s (host=%s db=%s) ---', $tenant->slug, $tenant->host, $tenant->dbDatabase));
            try {
                $databaseConfigurator->apply($tenant);
                [$ins, $upd, $skp, $errs] = $this->importTenant($tenant, $categories, $dryRun);
                $totalInserts += $ins;
                $totalUpdates += $upd;
                $totalSkips += $skp;
                $errors = array_merge($errors, $errs);
            } catch (\Throwable $e) {
                $errors[] = sprintf('tenant=%s err=%s', $tenant->slug, $e->getMessage());
                $this->error('  err: '.$e->getMessage());
            }
        }

        $this->newLine();
        $this->info('=== SUMMARY ===');
        $this->line(sprintf('inserts=%d updates=%d skips=%d errors=%d', $totalInserts, $totalUpdates, $totalSkips, count($errors)));
        if ($errors !== []) {
            foreach ($errors as $err) {
                $this->error('  '.$err);
            }
        }

        return count($errors) === 0 ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @param  list<string>  $categories
     * @return array{0:int,1:int,2:int,3:list<string>}
     */
    private function importPlatform(array $categories, bool $dryRun): array
    {
        $inserts = 0;
        $updates = 0;
        $skips = 0;
        $errors = [];

        if (! Schema::connection(DB::getDefaultConnection())->hasTable('moabom_module_settings')) {
            $errors[] = 'platform default DB 에 moabom_module_settings 테이블 없음. migrate 먼저 실행.';

            return [0, 0, 0, $errors];
        }

        foreach ($categories as $category) {
            $relative = sprintf('settings/%s.json', $category);
            $payload = $this->readGcsJson($relative);
            if ($payload === null) {
                $skips++;
                $this->line(sprintf('  [SKIP] platform/%s — GCS 미존재', $category));

                continue;
            }

            $existing = DB::table('moabom_module_settings')
                ->where('module', self::MODULE)
                ->where('category', $category)
                ->first();

            $action = $existing ? 'UPDATE' : 'INSERT';
            $this->line(sprintf('  [%s] platform/%s — bytes=%d', $action, $category, strlen(json_encode($payload))));

            if ($dryRun) {
                $existing ? $updates++ : $inserts++;

                continue;
            }

            try {
                DB::table('moabom_module_settings')->updateOrInsert(
                    ['module' => self::MODULE, 'category' => $category],
                    [
                        'payload' => json_encode($payload, JSON_UNESCAPED_UNICODE),
                        'updated_at' => now(),
                        'created_at' => $existing->created_at ?? now(),
                    ],
                );
                $existing ? $updates++ : $inserts++;
            } catch (\Throwable $e) {
                $errors[] = sprintf('platform/%s err=%s', $category, $e->getMessage());
            }
        }

        return [$inserts, $updates, $skips, $errors];
    }

    /**
     * @param  list<string>  $categories
     * @return array{0:int,1:int,2:int,3:list<string>}
     */
    private function importTenant(TenantRecord $tenant, array $categories, bool $dryRun): array
    {
        $inserts = 0;
        $updates = 0;
        $skips = 0;
        $errors = [];

        if (! Schema::connection(DB::getDefaultConnection())->hasTable('moabom_module_settings')) {
            $errors[] = sprintf('tenant=%s DB 에 moabom_module_settings 테이블 없음', $tenant->slug);

            return [0, 0, 0, $errors];
        }

        foreach ($categories as $category) {
            $prefix = rtrim($tenant->gcsPrefix, '/');
            $relative = sprintf('%s/settings/%s.json', $prefix, $category);
            $payload = $this->readGcsJson($relative);
            if ($payload === null) {
                $skips++;
                $this->line(sprintf('  [SKIP] %s/%s — GCS 미존재', $tenant->slug, $category));

                continue;
            }

            $existing = DB::table('moabom_module_settings')
                ->where('module', self::MODULE)
                ->where('category', $category)
                ->first();

            $action = $existing ? 'UPDATE' : 'INSERT';
            $this->line(sprintf('  [%s] %s/%s — bytes=%d', $action, $tenant->slug, $category, strlen(json_encode($payload))));

            if ($dryRun) {
                $existing ? $updates++ : $inserts++;

                continue;
            }

            try {
                DB::table('moabom_module_settings')->updateOrInsert(
                    ['module' => self::MODULE, 'category' => $category],
                    [
                        'payload' => json_encode($payload, JSON_UNESCAPED_UNICODE),
                        'updated_at' => now(),
                        'created_at' => $existing->created_at ?? now(),
                    ],
                );
                $existing ? $updates++ : $inserts++;
            } catch (\Throwable $e) {
                $errors[] = sprintf('%s/%s err=%s', $tenant->slug, $category, $e->getMessage());
            }
        }

        return [$inserts, $updates, $skips, $errors];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function readGcsJson(string $relativeKey): ?array
    {
        try {
            if (! Storage::disk('gcs')->exists($relativeKey)) {
                return null;
            }
            $raw = Storage::disk('gcs')->get($relativeKey);
            if ($raw === null || trim($raw) === '') {
                return null;
            }
            $decoded = json_decode(ltrim($raw, "\xEF\xBB\xBF"), true);

            return is_array($decoded) ? $decoded : null;
        } catch (\Throwable) {
            return null;
        }
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

        $rows = $query->orderBy('slug')->get();

        return $rows->map(fn ($row) => TenantRecord::fromRow((array) $row))->all();
    }
}
