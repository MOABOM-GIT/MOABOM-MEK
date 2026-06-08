<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;

/**
 * GCS 의 module 카테고리 JSON 을 DB (moabom_module_settings) 로 1회 import.
 *
 * 동작:
 *   1. platform 의 `gs://{bucket}/modules/moabom-system/settings/*.json` → default DB
 *   2. 각 active tenant 의 `gs://{bucket}/tenants/{slug}/modules/moabom-system/settings/*.json` → hospital_{slug} DB
 *
 * @see deploy/AGENT-FAILURE-ANALYSIS.md §9 — GCS-staleness root cause 후 DB 전환 P1
 */
class SaasMigrateModuleSettingsToDbCommand extends Command
{
    /** @var list<string> */
    private const CATEGORIES = ['mypage', 'appearance', 'preferences'];

    private const MODULE = 'moabom-system';

    protected $signature = 'moabom:saas:migrate-module-settings-to-db
        {--force : 실제 INSERT 수행 (기본은 dry-run)}
        {--tenant= : 특정 tenant slug 만}
        {--skip-platform : platform module settings import 건너뛰기}';

    protected $description = 'GCS module 카테고리 JSON → moabom_module_settings 테이블 1회 import';

    public function handle(
        PlatformConnectionFactory $platformConnections,
        TenantDatabaseConfigurator $databaseConfigurator,
    ): int {
        $dryRun = ! (bool) $this->option('force');
        $tenantFilter = (string) ($this->option('tenant') ?? '');
        $skipPlatform = (bool) $this->option('skip-platform');

        $bucket = (string) config('filesystems.disks.gcs.bucket', '');
        if ($bucket === '') {
            $this->error('filesystems.disks.gcs.bucket 미설정. FILESYSTEM_DISK=gcs 인지 확인.');

            return self::FAILURE;
        }

        $this->line(sprintf('mode=%s bucket=%s', $dryRun ? 'DRY-RUN' : 'EXECUTE', $bucket));
        $this->line(sprintf('categories=%s', implode(',', self::CATEGORIES)));
        $this->newLine();

        $platformConnections->registerConnection();

        $totalInserts = 0;
        $totalUpdates = 0;
        $totalSkips = 0;
        $errors = [];

        if (! $skipPlatform && $tenantFilter === '') {
            $this->info('=== platform module settings ===');
            [$ins, $upd, $skp, $errs] = $this->importPlatform($dryRun);
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
                [$ins, $upd, $skp, $errs] = $this->importTenant($tenant, $dryRun);
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
     * @return array{0:int,1:int,2:int,3:list<string>}
     */
    private function importPlatform(bool $dryRun): array
    {
        $inserts = 0;
        $updates = 0;
        $skips = 0;
        $errors = [];

        if (! Schema::connection(DB::getDefaultConnection())->hasTable('moabom_module_settings')) {
            $errors[] = 'platform default DB 에 moabom_module_settings 테이블 없음. migrate 먼저 실행.';

            return [0, 0, 0, $errors];
        }

        foreach (self::CATEGORIES as $category) {
            $relative = sprintf('modules/%s/settings/%s.json', self::MODULE, $category);
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
     * @return array{0:int,1:int,2:int,3:list<string>}
     */
    private function importTenant(TenantRecord $tenant, bool $dryRun): array
    {
        $inserts = 0;
        $updates = 0;
        $skips = 0;
        $errors = [];

        if (! Schema::connection(DB::getDefaultConnection())->hasTable('moabom_module_settings')) {
            $errors[] = sprintf('tenant=%s DB 에 moabom_module_settings 테이블 없음', $tenant->slug);

            return [0, 0, 0, $errors];
        }

        foreach (self::CATEGORIES as $category) {
            $prefix = rtrim($tenant->gcsPrefix, '/');
            $relative = sprintf('%s/modules/%s/settings/%s.json', $prefix, self::MODULE, $category);
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
     * GCS bucket 절대 경로(`modules/...` 또는 `tenants/.../modules/...`) 의 JSON 을 읽어 array 반환.
     *
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
