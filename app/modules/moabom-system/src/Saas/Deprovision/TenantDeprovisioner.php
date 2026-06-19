<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas\Deprovision;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;
use Modules\Moabom\System\Saas\SaasAdminCredentials;
use Modules\Moabom\System\Saas\TenantBaselineManifest;
use Modules\Moabom\System\Saas\TenantCachePurger;
use Modules\Moabom\System\Saas\TenantDatabaseCloner;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantFilesystemConfigurator;
use Modules\Moabom\System\Saas\TenantIdentityBootstrapper;
use Modules\Moabom\System\Saas\TenantProvisionAppearanceDefaultsApplier;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Saas\TenantRegistry;
use PDO;

/**
 * Tenant purge/destroy — TenantProvisioner 역방향.
 */
final class TenantDeprovisioner implements TenantDeprovisionerInterface
{
    /** @var list<string> */
    private const TENANT_STORAGE_DISKS = ['attachments', 'settings', 'modules', 'plugins', 'public'];

    public function __construct(
        private readonly TenantDeprovisionGuard $guard,
        private readonly TenantOperationLogger $operationLogger,
        private readonly TenantRegistry $registry,
        private readonly TenantBaselineManifest $manifest,
        private readonly TenantDatabaseCloner $cloner,
        private readonly TenantDatabaseConfigurator $databaseConfigurator,
        private readonly TenantFilesystemConfigurator $filesystemConfigurator,
        private readonly TenantIdentityBootstrapper $identityBootstrapper,
        private readonly TenantProvisionAppearanceDefaultsApplier $appearanceDefaultsApplier,
        private readonly PlatformRuntimeConfigurator $platformRuntimeConfigurator,
        private readonly TenantCachePurger $cachePurger,
    ) {}

    public function purgeDbData(TenantRecord $tenant, PurgeOptions $options): PurgeResult
    {
        $this->guard->assertPurgeAllowed($tenant, $options);

        $operationId = $options->operationId
            ?? $this->operationLogger->start($tenant->slug, 'db_data', $options->actorUserId);

        $this->registry->updateStatus($tenant->slug, 'purging');

        try {
            if (! $this->cloner->databaseExists($tenant->dbDatabase)) {
                throw new \RuntimeException("DB {$tenant->dbDatabase} 가 존재하지 않습니다.");
            }

            $this->databaseConfigurator->apply($tenant);
            $truncated = $this->truncateRuntimeTables($tenant->dbDatabase);

            $sourceDb = (string) config('moabom-system.saas.provision.schema_source_db', 'moabom-db');
            $adminEmail = SaasAdminCredentials::email();

            $this->identityBootstrapper->bootstrap($sourceDb, $tenant->dbDatabase, $adminEmail);
            $this->appearanceDefaultsApplier->apply($tenant);

            Artisan::call('moabom:saas:tenant-repair', [
                'slug' => $tenant->slug,
                '--apply' => true,
            ]);

            $metrics = [
                'tables_truncated' => $truncated,
            ];

            $this->registry->updateStatus($tenant->slug, 'active');
            $this->cachePurger->purgeForTenant($tenant);
            $this->operationLogger->complete($operationId, $metrics);

            return new PurgeResult($tenant->slug, 'db_data', $operationId, $metrics);
        } catch (\Throwable $e) {
            $this->registry->updateStatus($tenant->slug, 'active');
            $this->operationLogger->fail($operationId, $e->getMessage());
            throw $e;
        } finally {
            $this->platformRuntimeConfigurator->applyPlatform();
        }
    }

    public function purgeStorageData(TenantRecord $tenant, PurgeOptions $options): PurgeResult
    {
        $this->guard->assertPurgeAllowed($tenant, $options);

        $operationId = $options->operationId
            ?? $this->operationLogger->start($tenant->slug, 'storage_data', $options->actorUserId);

        $this->registry->updateStatus($tenant->slug, 'purging');

        try {
            $this->filesystemConfigurator->apply($tenant);
            $seedIds = $this->loadProvisionSeedBackgroundIds();

            $deletedObjects = 0;
            foreach ($this->manifest->runtimeGcsPrefixes() as $prefix) {
                $deletedObjects += $this->deleteAllOnDisk($prefix);
            }

            if ($this->manifest->runtimeGcsModulesExceptSeed()) {
                $deletedObjects += $this->purgeModulesExceptSeeds($seedIds);
            }

            $metrics = [
                'objects_deleted' => $deletedObjects,
                'seed_uuids_preserved' => count($seedIds),
            ];

            $this->registry->updateStatus($tenant->slug, 'active');
            $this->cachePurger->purgeForTenant($tenant);
            $this->operationLogger->complete($operationId, $metrics);

            return new PurgeResult($tenant->slug, 'storage_data', $operationId, $metrics);
        } catch (\Throwable $e) {
            $this->registry->updateStatus($tenant->slug, 'active');
            $this->operationLogger->fail($operationId, $e->getMessage());
            throw $e;
        } finally {
            $this->platformRuntimeConfigurator->applyPlatform();
        }
    }

    public function destroy(TenantRecord $tenant, DestroyOptions $options): DestroyResult
    {
        $this->guard->assertDestroyAllowed($tenant, $options);

        $operationId = $options->operationId
            ?? $this->operationLogger->start($tenant->slug, 'full_destroy', $options->actorUserId);

        $slug = $tenant->slug;
        $host = $tenant->host;
        $dbName = $tenant->dbDatabase;
        $gcsPrefix = rtrim($tenant->gcsPrefix !== '' ? $tenant->gcsPrefix : 'tenants/'.$slug, '/');

        $this->registry->updateStatus($slug, 'purging');
        $this->registry->forgetHostCache($host);

        try {
            $storageDeleted = $this->deleteTenantStorageRecursive($tenant, $gcsPrefix);

            $dbDropped = false;
            if ($this->cloner->databaseExists($dbName)) {
                $this->cloner->dropDatabase($dbName);
                $dbDropped = true;
            }

            $registryDeleted = $this->registry->deleteBySlug($slug);

            $metrics = [
                'gcs_objects_deleted' => $storageDeleted,
                'storage_objects_deleted' => $storageDeleted,
                'database_dropped' => $dbDropped,
                'registry_deleted' => $registryDeleted,
            ];

            $this->cachePurger->purgeAfterDestroy($slug, $host);
            $this->operationLogger->complete($operationId, $metrics);

            return new DestroyResult($slug, $operationId, $metrics);
        } catch (\Throwable $e) {
            $this->operationLogger->fail($operationId, $e->getMessage());
            throw $e;
        } finally {
            $this->platformRuntimeConfigurator->applyPlatform();
        }
    }

    private function truncateRuntimeTables(string $database): int
    {
        $pdo = $this->cloner->pdo();
        $prefix = $this->tablePrefix();
        $runtimeTables = array_reverse($this->manifest->runtimeDbTables());
        $truncated = 0;

        $pdo->exec('SET FOREIGN_KEY_CHECKS=0');

        try {
            foreach ($runtimeTables as $logicalTable) {
                $physical = $prefix.$logicalTable;
                if (! $this->tableExists($pdo, $database, $physical)) {
                    continue;
                }

                $pdo->exec("TRUNCATE TABLE `{$database}`.`{$physical}`");
                $truncated++;
            }
        } finally {
            $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
        }

        return $truncated;
    }

    /**
     * @param  list<string>  $seedIds
     */
    private function purgeModulesExceptSeeds(array $seedIds): int
    {
        if (! config()->has('filesystems.disks.modules')) {
            return 0;
        }

        $storage = Storage::disk('modules');
        $deleted = 0;

        try {
            $paths = $storage->allFiles('');
        } catch (\Throwable) {
            return 0;
        }

        foreach ($paths as $path) {
            if ($this->isProvisionSeedModulesPath($path, $seedIds)) {
                continue;
            }

            if ($storage->delete($path)) {
                $deleted++;
            }
        }

        try {
            $directories = $storage->allDirectories('');
        } catch (\Throwable) {
            return $deleted;
        }

        foreach (array_reverse($directories) as $directory) {
            if ($this->isProvisionSeedModulesDirectory($directory, $seedIds)) {
                continue;
            }

            try {
                $storage->deleteDirectory($directory);
            } catch (\Throwable) {
            }
        }

        return $deleted;
    }

    private function deleteAllOnDisk(string $disk): int
    {
        if (! config()->has("filesystems.disks.{$disk}")) {
            return 0;
        }

        $storage = Storage::disk($disk);
        $deleted = 0;

        try {
            $files = $storage->allFiles('');
        } catch (\Throwable) {
            return 0;
        }

        foreach ($files as $file) {
            if ($storage->delete($file)) {
                $deleted++;
            }
        }

        return $deleted;
    }

    private function deleteTenantStorageRecursive(TenantRecord $tenant, string $prefix): int
    {
        $this->filesystemConfigurator->apply($tenant);

        $deleted = $this->deleteGcsPrefixRecursive($prefix);

        foreach (self::TENANT_STORAGE_DISKS as $disk) {
            $deleted += $this->deleteConfiguredDiskRecursive($disk);
        }

        $localRoot = storage_path('app/'.trim($prefix, '/'));
        if (is_dir($localRoot)) {
            try {
                File::deleteDirectory($localRoot);
            } catch (\Throwable) {
            }
        }

        return $deleted;
    }

    private function deleteConfiguredDiskRecursive(string $disk): int
    {
        if (! config()->has("filesystems.disks.{$disk}")) {
            return 0;
        }

        $storage = Storage::disk($disk);
        $deleted = 0;

        try {
            $files = $storage->allFiles('');
        } catch (\Throwable) {
            return 0;
        }

        foreach ($files as $file) {
            if ($storage->delete($file)) {
                $deleted++;
            }
        }

        try {
            foreach (array_reverse($storage->allDirectories('')) as $directory) {
                $storage->deleteDirectory($directory);
            }
        } catch (\Throwable) {
        }

        return $deleted;
    }

    private function deleteGcsPrefixRecursive(string $prefix): int
    {
        $prefix = trim($prefix, '/');
        if ($prefix === '') {
            return 0;
        }

        try {
            $disk = Storage::disk('gcs');
        } catch (\Throwable) {
            return 0;
        }

        $deleted = 0;

        try {
            $files = $disk->allFiles($prefix);
        } catch (\Throwable) {
            return 0;
        }

        foreach ($files as $file) {
            if ($disk->delete($file)) {
                $deleted++;
            }
        }

        try {
            foreach (array_reverse($disk->allDirectories($prefix)) as $directory) {
                $disk->deleteDirectory($directory);
            }
        } catch (\Throwable) {
        }

        return $deleted;
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
    private function isProvisionSeedModulesPath(string $path, array $seedIds): bool
    {
        foreach ($seedIds as $id) {
            if (str_contains($path, "home-backgrounds/{$id}/")) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  list<string>  $seedIds
     */
    private function isProvisionSeedModulesDirectory(string $directory, array $seedIds): bool
    {
        foreach ($seedIds as $id) {
            if (str_contains($directory, "home-backgrounds/{$id}")) {
                return true;
            }
        }

        return str_starts_with($directory, 'moabom-system/images/home-backgrounds')
            && $this->directoryContainsSeedId($directory, $seedIds);
    }

    /**
     * @param  list<string>  $seedIds
     */
    private function directoryContainsSeedId(string $directory, array $seedIds): bool
    {
        foreach ($seedIds as $id) {
            if (str_contains($directory, $id)) {
                return true;
            }
        }

        return false;
    }

    private function tableExists(PDO $pdo, string $database, string $table): bool
    {
        $stmt = $pdo->prepare(
            'SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?'
        );
        $stmt->execute([$database, $table]);

        return (int) $stmt->fetchColumn() > 0;
    }

    private function tablePrefix(): string
    {
        $connection = (string) config('database.default', 'mysql');

        return (string) config("database.connections.{$connection}.prefix", '');
    }
}
