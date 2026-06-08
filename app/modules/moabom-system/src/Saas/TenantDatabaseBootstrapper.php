<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

/**
 * Provision v2 — empty schema + package extension seed (no full DB clone).
 */
final class TenantDatabaseBootstrapper
{
    public function __construct(
        private readonly TenantDatabaseCloner $cloner,
        private readonly TenantPackageCatalog $packageCatalog,
        private readonly TenantPackageDatabaseSeeder $packageDatabaseSeeder,
    ) {}

    /**
     * @return array{tables: int, package_id: string}
     */
    public function bootstrap(string $targetDb, string $schemaSourceDb, string $packageId): array
    {
        $package = $this->packageCatalog->get($packageId);

        $this->cloner->createDatabaseIfNotExists($targetDb);
        $tables = $this->cloner->cloneSchemaOnly($schemaSourceDb, $targetDb);
        $this->packageDatabaseSeeder->seed($schemaSourceDb, $targetDb, $package);

        return [
            'tables' => $tables,
            'package_id' => $package->id,
        ];
    }
}
