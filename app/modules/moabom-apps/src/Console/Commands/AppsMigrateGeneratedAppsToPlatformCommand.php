<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\SaasMysqlPdoFactory;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;

/**
 * 1회성 수동: tenant DB(및 legacy main DB) 생성앱 → moabom-platform 이관.
 *
 * SaaS 운영 쓰기 SSOT는 platform (`GeneratedAppsConnection::usesPlatformStore()`).
 * tenant legacy 에 신규 생성 경로 없음 — **배포 파이프라인에서 호출하지 않는다**
 * (잔여 legacy 행이 있으면 삭제된 앱이 재이관될 수 있음).
 *
 * idempotent: (tenant_slug, source id) 가 platform 에 이미 있으면 skip.
 */
class AppsMigrateGeneratedAppsToPlatformCommand extends Command
{
    private const APPS_TABLE = 'moabom_system_generated_apps';

    private const ROWS_TABLE = 'moabom_generated_app_rows';

    protected $signature = 'moabom:apps:migrate-to-platform
        {--tenant= : 특정 tenant slug 만 (platform legacy 는 slug=platform)}
        {--dry-run : INSERT 없이 집계만}
        {--force : 운영 환경에서도 실행}';

    protected $description = 'tenant DB 생성앱 데이터를 moabom-platform 으로 일괄 이관';

    /** @var array<string, array<int, int>> tenant_slug → source_id → platform_id */
    private array $idMaps = [];

    private int $appsInserted = 0;

    private int $appsSkipped = 0;

    private int $appsRemapped = 0;

    private int $rowsInserted = 0;

    private int $rowsSkipped = 0;

    public function handle(
        PlatformConnectionFactory $platformConnections,
        TenantDatabaseConfigurator $databaseConfigurator,
    ): int {
        $platformConnections->registerConnection();
        GeneratedAppsConnection::register();

        if (! Schema::connection(GeneratedAppsConnection::NAME)->hasTable(self::APPS_TABLE)) {
            $this->call('moabom:apps:platform-migrate', [
                '--force' => $this->option('force'),
            ]);
        }

        $dryRun = (bool) $this->option('dry-run');
        $tenantFilter = trim((string) ($this->option('tenant') ?? ''));

        if ($tenantFilter === '' || $tenantFilter === 'platform') {
            $this->migrateLegacyMainDatabase($dryRun);
        }

        $tenants = $this->loadTenants($tenantFilter === 'platform' ? '' : $tenantFilter);
        foreach ($tenants as $tenant) {
            $this->line(sprintf('--- tenant %s (db=%s) ---', $tenant->slug, $tenant->dbDatabase));
            try {
                $databaseConfigurator->apply($tenant);
                $this->migrateConnectionDatabase(
                    (string) config('database.default', 'mysql'),
                    $tenant->slug,
                    $dryRun,
                );
            } catch (\Throwable $e) {
                $this->error('  err: '.$e->getMessage());

                return self::FAILURE;
            }
        }

        $this->newLine();
        $this->info(sprintf(
            'SUMMARY apps: inserted=%d skipped=%d remapped=%d | rows: inserted=%d skipped=%d%s',
            $this->appsInserted,
            $this->appsSkipped,
            $this->appsRemapped,
            $this->rowsInserted,
            $this->rowsSkipped,
            $dryRun ? ' (dry-run)' : '',
        ));

        return self::SUCCESS;
    }

    private function migrateLegacyMainDatabase(bool $dryRun): void
    {
        $mainDb = $this->mainWriteDatabaseName();
        if ($mainDb === '' || $mainDb === (string) config('moabom-system.saas.platform_database', 'moabom-platform')) {
            return;
        }

        $this->line(sprintf('--- legacy main db (%s) → tenant_slug=platform ---', $mainDb));

        $this->withDatabase($mainDb, function (string $connection) use ($dryRun): void {
            $this->migrateConnectionDatabase($connection, 'platform', $dryRun);
        });
    }

    private function migrateConnectionDatabase(string $connection, string $tenantSlug, bool $dryRun): void
    {
        if (! Schema::connection($connection)->hasTable(self::APPS_TABLE)) {
            $this->line('  (no apps table)');

            return;
        }

        $apps = DB::connection($connection)
            ->table(self::APPS_TABLE)
            ->orderBy('id')
            ->get();

        if ($apps->isEmpty()) {
            $this->line('  apps=0');

            return;
        }

        $platform = DB::connection(GeneratedAppsConnection::NAME);
        $this->idMaps[$tenantSlug] = $this->idMaps[$tenantSlug] ?? [];

        foreach ($apps as $app) {
            $source = (array) $app;
            $sourceId = (int) ($source['id'] ?? 0);
            if ($sourceId <= 0) {
                continue;
            }

            if ($platform->table(self::APPS_TABLE)
                ->where('tenant_slug', $tenantSlug)
                ->where('id', $sourceId)
                ->exists()) {
                $this->idMaps[$tenantSlug][$sourceId] = $sourceId;
                $this->appsSkipped++;

                continue;
            }

            $targetId = $sourceId;
            $existingSlug = $platform->table(self::APPS_TABLE)
                ->where('id', $sourceId)
                ->value('tenant_slug');

            if ($existingSlug !== null && (string) $existingSlug !== $tenantSlug) {
                $targetId = (int) $platform->table(self::APPS_TABLE)->max('id') + 1;
                while ($platform->table(self::APPS_TABLE)->where('id', $targetId)->exists()) {
                    $targetId++;
                }
                $this->appsRemapped++;
            }

            $this->idMaps[$tenantSlug][$sourceId] = $targetId;
            $payload = $this->appPayload($source, $tenantSlug, $targetId, $sourceId);

            if (! $dryRun) {
                $ownerNickname = $this->resolveOwnerNickname($connection, (int) ($source['user_id'] ?? 0));
                if ($ownerNickname !== null) {
                    $metadata = is_array($source['metadata'] ?? null) ? $source['metadata'] : [];
                    $metadata['owner_nickname'] = $ownerNickname;
                    $payload['metadata'] = json_encode($metadata, JSON_THROW_ON_ERROR);
                }
                $platform->table(self::APPS_TABLE)->insert($payload);
            }

            $this->appsInserted++;
            $this->line(sprintf(
                '  app id %d → %d (%s)%s',
                $sourceId,
                $targetId,
                $payload['title'] ?? '',
                $targetId !== $sourceId ? ' [remapped]' : '',
            ));
        }

        if (! Schema::connection($connection)->hasTable(self::ROWS_TABLE)) {
            return;
        }

        $rows = DB::connection($connection)
            ->table(self::ROWS_TABLE)
            ->orderBy('id')
            ->get();

        foreach ($rows as $row) {
            $source = (array) $row;
            $sourceAppId = (int) ($source['generated_app_id'] ?? 0);
            $sourceRowId = (int) ($source['id'] ?? 0);
            if ($sourceAppId <= 0 || $sourceRowId <= 0) {
                continue;
            }

            $targetAppId = $this->idMaps[$tenantSlug][$sourceAppId] ?? $sourceAppId;

            if ($platform->table(self::ROWS_TABLE)
                ->where('generated_app_id', $targetAppId)
                ->where('id', $sourceRowId)
                ->exists()) {
                $this->rowsSkipped++;

                continue;
            }

            $targetRowId = $sourceRowId;
            if ($platform->table(self::ROWS_TABLE)->where('id', $targetRowId)->exists()) {
                $targetRowId = (int) $platform->table(self::ROWS_TABLE)->max('id') + 1;
                while ($platform->table(self::ROWS_TABLE)->where('id', $targetRowId)->exists()) {
                    $targetRowId++;
                }
            }

            if (! $dryRun) {
                $platform->table(self::ROWS_TABLE)->insert([
                    'id' => $targetRowId,
                    'generated_app_id' => $targetAppId,
                    'user_id' => $source['user_id'] ?? null,
                    'table_key' => (string) ($source['table_key'] ?? ''),
                    'payload' => $source['payload'] ?? '{}',
                    'created_at' => $source['created_at'] ?? now(),
                    'updated_at' => $source['updated_at'] ?? now(),
                ]);
            }

            $this->rowsInserted++;
        }
    }

    /**
     * @param  array<string, mixed>  $source
     * @return array<string, mixed>
     */
    private function appPayload(array $source, string $tenantSlug, int $targetId, int $sourceId): array
    {
        $tier = (string) ($source['tier'] ?? 'standard');
        $hostedSubdomain = $source['hosted_subdomain'] ?? null;
        if ($tier === 'hosted') {
            $legacy = [
                (string) $sourceId,
                'hosted/'.$sourceId,
                'app'.$sourceId,
            ];
            if ($hostedSubdomain === null || in_array((string) $hostedSubdomain, $legacy, true)) {
                $hostedSubdomain = (string) $targetId;
            }
        }

        return [
            'id' => $targetId,
            'tenant_slug' => $tenantSlug,
            'user_id' => (int) ($source['user_id'] ?? 0),
            'title' => (string) ($source['title'] ?? ''),
            'app_type' => (string) ($source['app_type'] ?? 'general'),
            'tier' => $tier,
            'hosted_subdomain' => $hostedSubdomain,
            'storage_prefix' => $source['storage_prefix'] ?? null,
            'provision_status' => $source['provision_status'] ?? null,
            'provisioned_at' => $source['provisioned_at'] ?? null,
            'model_id' => $source['model_id'] ?? null,
            'prompt' => $source['prompt'] ?? null,
            'html' => (string) ($source['html'] ?? ''),
            'is_shared' => (bool) ($source['is_shared'] ?? false),
            'visibility' => ($source['is_shared'] ?? false)
                ? GeneratedAppVisibility::Tenant->value
                : GeneratedAppVisibility::Private->value,
            'parent_app_id' => $source['parent_app_id'] ?? null,
            'version' => (int) ($source['version'] ?? 1),
            'metadata' => $source['metadata'] ?? null,
            'created_at' => $source['created_at'] ?? now(),
            'updated_at' => $source['updated_at'] ?? now(),
        ];
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

    private function resolveOwnerNickname(string $connection, int $userId): ?string
    {
        if ($userId <= 0 || ! Schema::connection($connection)->hasTable('users')) {
            return null;
        }

        $row = DB::connection($connection)->table('users')->where('id', $userId)->first();
        if ($row === null) {
            return null;
        }

        $source = (array) $row;
        $nickname = trim((string) ($source['nickname'] ?? ($source['name'] ?? '')));

        return $nickname !== '' ? $nickname : null;
    }

    /**
     * @param  callable(string): void  $callback
     */
    private function withDatabase(string $database, callable $callback): void
    {
        $connection = (string) config('database.default', 'mysql');
        $original = config("database.connections.{$connection}");
        if (! is_array($original)) {
            return;
        }

        $config = $original;
        if (isset($config['write']) && is_array($config['write'])) {
            $config['write']['database'] = $database;
        }
        if (isset($config['read']) && is_array($config['read'])) {
            $config['read']['database'] = $database;
        }
        if (! isset($config['write'])) {
            $config['database'] = $database;
        }

        config(["database.connections.{$connection}" => $config]);
        DB::purge($connection);
        DB::reconnect($connection);

        try {
            $callback($connection);
        } finally {
            config(["database.connections.{$connection}" => $original]);
            DB::purge($connection);
            DB::reconnect($connection);
        }
    }
}
