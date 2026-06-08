<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;

/**
 * Split-brain 진단 — `moabom_module_settings (module, category)` DB row 와
 * GCS `modules/{module}/settings/{category}.json` 의 list-style key 길이 비교.
 *
 * 예: mek360 의 appearance 의 `home_background_items` count 가 DB 와 GCS 에서
 * 다르면, AGENT §6 의 split-brain 확정. read SSOT / write SSOT 어느 한 쪽이
 * 다른 storage 를 보고 있음.
 *
 * 변경 0. read-only.
 *
 * @see deploy/AGENT-FAILURE-ANALYSIS.md §6, §10, §11
 * @see deploy/TENANT-EXPERIENCE-ARCHITECTURE.md §4.2
 */
class SaasMeasureSplitBrainCommand extends Command
{
    protected $signature = 'moabom:saas:measure-split-brain
        {--tenant= : tenant slug (없으면 platform = mek360)}
        {--module=moabom-system : moabom_module_settings.module 값}
        {--category=appearance : moabom_module_settings.category 값}
        {--key=home_background_items : count 측정할 list key (콤마 구분 다수)}
        {--source-db= : platform DB (기본 schema_source_db)}';

    protected $description = 'moabom_module_settings DB row vs GCS JSON 의 split-brain 측정 (read-only)';

    public function handle(
        TenantDatabaseConfigurator $databaseConfigurator,
        PlatformConnectionFactory $platformConnections,
    ): int {
        $platformConnections->registerConnection();

        $tenantSlug = trim((string) $this->option('tenant'));
        $module = (string) $this->option('module');
        $category = (string) $this->option('category');
        $sourceDb = (string) ($this->option('source-db')
            ?: config('moabom-system.saas.provision.schema_source_db', 'moabom-db'));

        /** @var list<string> $keys */
        $keys = array_values(array_filter(array_map('trim', explode(',', (string) $this->option('key')))));
        if ($keys === []) {
            $keys = ['home_background_items'];
        }

        $tenant = null;
        $contextLabel = 'platform (mek360)';
        $tenantDbName = $sourceDb;
        $gcsPrefix = '';

        if ($tenantSlug !== '') {
            $tenant = $this->loadTenant($tenantSlug);
            if ($tenant === null) {
                $this->error(sprintf('tenant %s 미존재.', $tenantSlug));

                return self::FAILURE;
            }
            $databaseConfigurator->apply($tenant);
            $contextLabel = sprintf('tenant=%s', $tenant->slug);
            $tenantDbName = $tenant->dbDatabase;
            $gcsPrefix = 'tenants/'.$tenant->slug.'/';
        }

        $this->line(sprintf('context=%s', $contextLabel));
        $this->line(sprintf('module=%s category=%s', $module, $category));
        $this->line(sprintf('DB target db=%s', $tenantDbName));
        $this->line(sprintf('GCS prefix=%s', $gcsPrefix === '' ? '(root)' : $gcsPrefix));
        $this->newLine();

        $dbPayload = $this->readDbPayload($tenantDbName, $module, $category);
        $gcsPayload = $this->readGcsPayload($module, $category, $gcsPrefix);

        $this->info('=== DB row ===');
        if ($dbPayload === null) {
            $this->warn(sprintf('  row 없음 (`%s`.`g7_moabom_module_settings` module=%s category=%s)', $tenantDbName, $module, $category));
        } else {
            $this->line(sprintf('  updated_at=%s', $dbPayload['_updated_at'] ?? '?'));
            $this->line(sprintf('  payload keys=%s', implode(',', array_keys(array_diff_key($dbPayload, ['_updated_at' => true])))));
            foreach ($keys as $key) {
                $count = $this->countList($dbPayload, $key);
                $this->line(sprintf('  %s count=%s', $key, $count));
            }
        }

        $this->newLine();
        $this->info('=== GCS JSON ===');
        if ($gcsPayload === null) {
            $this->warn(sprintf('  GCS 객체 없음 (%s)', $this->gcsObjectPath($module, $category, $gcsPrefix)));
        } else {
            $this->line(sprintf('  payload keys=%s', implode(',', array_keys($gcsPayload))));
            foreach ($keys as $key) {
                $count = $this->countList($gcsPayload, $key);
                $this->line(sprintf('  %s count=%s', $key, $count));
            }
        }

        // 비교 — split-brain 확정
        $this->newLine();
        $this->info('=== diff ===');
        foreach ($keys as $key) {
            $dbCount = $dbPayload === null ? -1 : $this->countList($dbPayload, $key);
            $gcsCount = $gcsPayload === null ? -1 : $this->countList($gcsPayload, $key);
            $mark = $dbCount === $gcsCount ? '✓' : '※';
            $this->line(sprintf('  %s %s: DB=%s GCS=%s', $mark, $key, (string) $dbCount, (string) $gcsCount));
        }

        // payload 첫 600B preview
        if ($dbPayload !== null) {
            $this->newLine();
            $this->info('=== DB payload preview (600B) ===');
            $clean = array_diff_key($dbPayload, ['_updated_at' => true]);
            $this->line(substr((string) json_encode($clean, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 0, 600));
        }
        if ($gcsPayload !== null) {
            $this->newLine();
            $this->info('=== GCS payload preview (600B) ===');
            $this->line(substr((string) json_encode($gcsPayload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 0, 600));
        }

        return self::SUCCESS;
    }

    /**
     * @return array<string,mixed>|null
     */
    private function readDbPayload(string $db, string $module, string $category): ?array
    {
        try {
            $pdo = DB::connection()->getPdo();
            $prefix = (string) DB::connection()->getTablePrefix();
            $table = $prefix.'moabom_module_settings';

            $stmt = $pdo->prepare("SELECT payload, updated_at FROM `{$db}`.`{$table}` WHERE module = ? AND category = ? LIMIT 1");
            $stmt->execute([$module, $category]);
            $row = $stmt->fetch(\PDO::FETCH_ASSOC);
            if ($row === false || $row === null) {
                return null;
            }

            $decoded = json_decode((string) $row['payload'], true);
            if (! is_array($decoded)) {
                return null;
            }
            $decoded['_updated_at'] = (string) ($row['updated_at'] ?? '');

            return $decoded;
        } catch (\Throwable $e) {
            $this->error('  DB read err: '.$e->getMessage());

            return null;
        }
    }

    /**
     * @return array<string,mixed>|null
     */
    private function readGcsPayload(string $module, string $category, string $prefix = ''): ?array
    {
        try {
            $disk = Storage::disk('gcs');
            $path = $this->gcsObjectPath($module, $category, $prefix);
            if (! $disk->exists($path)) {
                return null;
            }
            $raw = $disk->get($path);
            if (! is_string($raw) || trim($raw) === '') {
                return null;
            }
            $decoded = json_decode(ltrim($raw, "\xEF\xBB\xBF"), true);

            return is_array($decoded) ? $decoded : null;
        } catch (\Throwable $e) {
            $this->error('  GCS read err: '.$e->getMessage());

            return null;
        }
    }

    private function gcsObjectPath(string $module, string $category, string $prefix = ''): string
    {
        $base = trim($prefix, '/');
        $modulePath = 'modules/'.$module.'/settings/'.$category.'.json';

        return $base === '' ? $modulePath : $base.'/'.$modulePath;
    }

    /**
     * @param  array<string,mixed>  $payload
     */
    private function countList(array $payload, string $key): string
    {
        $val = $payload[$key] ?? null;
        if (! is_array($val)) {
            return '(no-list)';
        }

        return (string) count($val);
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
