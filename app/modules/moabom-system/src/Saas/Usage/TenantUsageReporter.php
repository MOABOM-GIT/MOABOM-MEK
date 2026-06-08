<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas\Usage;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Saas\TenantBaselineManifest;
use Modules\Moabom\System\Saas\TenantDatabaseCloner;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Support\FormatBytes;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use SplFileInfo;

/**
 * Tenant DB·GCS 사용량 측정 (read-only).
 *
 * 플랫폼 Host(mek360.com) 요청에서도 TenantFilesystemConfigurator 로
 * 글로벌 disk config 를 바꾸지 않고, GCS prefix / local path 로 직접 조회한다.
 */
final class TenantUsageReporter
{
    /** @var array<int, string> */
    private const STORAGE_SUFFIXES = [
        'attachments',
        'settings',
        'modules',
        'plugins',
        'public',
    ];

    public function __construct(
        private readonly TenantBaselineManifest $manifest,
        private readonly TenantDatabaseCloner $cloner,
    ) {}

    /**
     * @return array{database: DatabaseUsage, storage: StorageUsage, measured_at: string}
     */
    public function measure(TenantRecord $tenant): array
    {
        $ttl = (int) config('moabom-system.saas.deprovision.usage_cache_ttl', 300);
        $cacheKey = 'moabom_saas_tenant_usage:'.md5($tenant->slug);

        if ($ttl > 0) {
            $cached = Cache::get($cacheKey);
            if (is_array($cached) && isset($cached['database'], $cached['storage'], $cached['measured_at'])) {
                return $cached;
            }
        }

        $database = $this->measureDatabase($tenant);
        $storage = $this->measureStorage($tenant);

        $result = [
            'slug' => $tenant->slug,
            'database' => $database->toArray(),
            'storage' => $storage->toArray(),
            'measured_at' => now()->toIso8601String(),
        ];

        if ($ttl > 0) {
            Cache::put($cacheKey, $result, $ttl);
        }

        return $result;
    }

    /**
     * @return array{
     *   db_size_human: string,
     *   db_runtime_human: string,
     *   db_baseline_human: string,
     *   storage_size_human: string,
     *   db_size_bytes: int,
     *   db_runtime_bytes: int,
     *   db_baseline_bytes: int,
     *   storage_size_bytes: int
     * }
     */
    public function measureSummary(TenantRecord $tenant, bool $includeStorage = true): array
    {
        $summary = [
            'db_size_human' => '-',
            'db_runtime_human' => '-',
            'db_baseline_human' => '-',
            'storage_size_human' => '-',
            'db_size_bytes' => 0,
            'db_runtime_bytes' => 0,
            'db_baseline_bytes' => 0,
            'storage_size_bytes' => 0,
        ];

        try {
            $database = $this->measureDatabase($tenant);
            $baselineBytes = max(0, $database->sizeBytes - $database->runtimeEstimateBytes);
            $summary['db_size_human'] = $database->sizeHuman;
            $summary['db_size_bytes'] = $database->sizeBytes;
            $summary['db_runtime_human'] = $database->runtimeEstimateHuman;
            $summary['db_runtime_bytes'] = $database->runtimeEstimateBytes;
            $summary['db_baseline_human'] = FormatBytes::human($baselineBytes);
            $summary['db_baseline_bytes'] = $baselineBytes;
        } catch (\Throwable) {
        }

        if (! $includeStorage) {
            return $summary;
        }

        try {
            $storage = $this->measureStorage($tenant);
            $summary['storage_size_human'] = $storage->totalHuman;
            $summary['storage_size_bytes'] = $storage->totalBytes;
        } catch (\Throwable) {
        }

        return $summary;
    }

    public function forgetCache(string $slug): void
    {
        Cache::forget('moabom_saas_tenant_usage:'.md5($slug));
    }

    public function measureDatabase(TenantRecord $tenant): DatabaseUsage
    {
        $dbName = $tenant->dbDatabase;
        if (! $this->cloner->databaseExists($dbName)) {
            return new DatabaseUsage(
                name: $dbName,
                sizeBytes: 0,
                sizeHuman: '0 B',
                tableCount: 0,
                runtimeEstimateBytes: 0,
                runtimeEstimateHuman: '0 B',
            );
        }

        $pdo = $this->cloner->pdo();
        $prefix = $this->tablePrefix();

        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?'
        );
        $stmt->execute([$dbName]);
        $tableCount = (int) $stmt->fetchColumn();

        $stmt = $pdo->prepare(
            'SELECT COALESCE(SUM(data_length + index_length), 0) '
            .'FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?'
        );
        $stmt->execute([$dbName]);
        $totalBytes = (int) $stmt->fetchColumn();

        $baselineTables = array_map(
            fn (string $table): string => $prefix.$table,
            $this->manifest->baselineDbTables(),
        );

        $baselineBytes = 0;
        if ($baselineTables !== []) {
            $placeholders = implode(', ', array_fill(0, count($baselineTables), '?'));
            $stmt = $pdo->prepare(
                'SELECT COALESCE(SUM(data_length + index_length), 0) '
                ."FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ({$placeholders})"
            );
            $stmt->execute(array_merge([$dbName], $baselineTables));
            $baselineBytes = (int) $stmt->fetchColumn();
        }

        $runtimeBytes = max(0, $totalBytes - $baselineBytes);

        return new DatabaseUsage(
            name: $dbName,
            sizeBytes: $totalBytes,
            sizeHuman: FormatBytes::human($totalBytes),
            tableCount: $tableCount,
            runtimeEstimateBytes: $runtimeBytes,
            runtimeEstimateHuman: FormatBytes::human($runtimeBytes),
        );
    }

    public function measureStorage(TenantRecord $tenant): StorageUsage
    {
        $tenantPrefix = $this->tenantStoragePrefix($tenant);
        $byDisk = [];
        $totalBytes = 0;
        $seedBytes = 0;
        $seedIds = $this->loadProvisionSeedBackgroundIds();

        foreach (self::STORAGE_SUFFIXES as $suffix) {
            if (! config()->has("filesystems.disks.{$suffix}")) {
                continue;
            }

            [$bytes, $count, $diskSeedBytes] = $this->sumStorageSuffix($tenantPrefix, $suffix, $seedIds);
            $byDisk[$suffix] = [
                'bytes' => $bytes,
                'object_count' => $count,
                'human' => FormatBytes::human($bytes),
            ];
            $totalBytes += $bytes;
            $seedBytes += $diskSeedBytes;
        }

        return new StorageUsage(
            prefix: $tenantPrefix,
            totalBytes: $totalBytes,
            totalHuman: FormatBytes::human($totalBytes),
            byDisk: $byDisk,
            provisionSeedBytes: $seedBytes,
            provisionSeedHuman: FormatBytes::human($seedBytes),
        );
    }

    private function tenantStoragePrefix(TenantRecord $tenant): string
    {
        $prefix = rtrim($tenant->gcsPrefix, '/');

        return $prefix !== '' ? $prefix : 'tenants/'.$tenant->slug;
    }

    /**
     * @param  list<string>  $seedIds
     * @return array{0: int, 1: int, 2: int} bytes, count, seedBytes
     */
    private function sumStorageSuffix(string $tenantPrefix, string $suffix, array $seedIds): array
    {
        $relativePrefix = rtrim($tenantPrefix, '/').'/'.$suffix;

        if ($this->diskUsesGcs($suffix)) {
            return $this->sumGcsPrefix($relativePrefix, $seedIds);
        }

        return $this->sumLocalDirectory(storage_path('app/'.$relativePrefix), $seedIds);
    }

    private function diskUsesGcs(string $diskName): bool
    {
        return (string) config("filesystems.disks.{$diskName}.driver", '') === 'gcs';
    }

    /**
     * @param  list<string>  $seedIds
     * @return array{0: int, 1: int, 2: int}
     */
    private function sumGcsPrefix(string $prefix, array $seedIds): array
    {
        try {
            $disk = Storage::disk('gcs');
        } catch (\Throwable) {
            return [0, 0, 0];
        }

        try {
            $files = $disk->allFiles($prefix);
        } catch (\Throwable) {
            return [0, 0, 0];
        }

        $bytes = 0;
        $count = 0;
        $seedBytes = 0;

        foreach ($files as $path) {
            try {
                $size = (int) $disk->size($path);
            } catch (\Throwable) {
                $size = 0;
            }

            $bytes += $size;
            $count++;

            if ($this->isProvisionSeedPath($path, $seedIds)) {
                $seedBytes += $size;
            }
        }

        return [$bytes, $count, $seedBytes];
    }

    /**
     * @param  list<string>  $seedIds
     * @return array{0: int, 1: int, 2: int}
     */
    private function sumLocalDirectory(string $directory, array $seedIds): array
    {
        if (! is_dir($directory)) {
            return [0, 0, 0];
        }

        $bytes = 0;
        $count = 0;
        $seedBytes = 0;

        try {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS),
            );

            /** @var SplFileInfo $file */
            foreach ($iterator as $file) {
                if (! $file->isFile()) {
                    continue;
                }

                $size = (int) $file->getSize();
                $path = str_replace('\\', '/', $file->getPathname());

                $bytes += $size;
                $count++;

                if ($this->isProvisionSeedPath($path, $seedIds)) {
                    $seedBytes += $size;
                }
            }
        } catch (\Throwable) {
            return [0, 0, 0];
        }

        return [$bytes, $count, $seedBytes];
    }

    /**
     * @return list<string>
     */
    private function loadProvisionSeedBackgroundIds(): array
    {
        $snapshotPath = trim((string) config(
            'moabom-system.saas.provision.appearance_defaults.snapshot_path',
            'saas/provision-defaults/appearance.json',
        ));

        try {
            if (! Storage::disk('gcs')->exists($snapshotPath)) {
                return [];
            }
            $raw = Storage::disk('gcs')->get($snapshotPath);
            $decoded = json_decode(ltrim((string) $raw, "\xEF\xBB\xBF"), true);
            if (! is_array($decoded)) {
                return [];
            }
            $items = $decoded['home_background_items'] ?? [];
            if (! is_array($items)) {
                return [];
            }

            $ids = [];
            foreach ($items as $item) {
                if (is_array($item) && isset($item['id']) && is_string($item['id'])) {
                    $ids[] = $item['id'];
                }
            }

            return array_values(array_unique($ids));
        } catch (\Throwable) {
            return [];
        }
    }

    /**
     * @param  list<string>  $seedIds
     */
    private function isProvisionSeedPath(string $path, array $seedIds): bool
    {
        foreach ($seedIds as $id) {
            if (str_contains($path, "home-backgrounds/{$id}/")) {
                return true;
            }
        }

        return false;
    }

    private function tablePrefix(): string
    {
        $connection = (string) config('database.default', 'mysql');

        return (string) config("database.connections.{$connection}.prefix", '');
    }
}
