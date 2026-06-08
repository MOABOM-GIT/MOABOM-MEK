<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use App\Contracts\Extension\ModuleInterface;
use App\Contracts\Repositories\ModuleRepositoryInterface;
use App\Extension\ExtensionManager;
use App\Extension\ModuleManager;
use App\Services\CoreUpdateService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Platform/Tenant DB admin 메뉴 SSOT 동기화.
 *
 * order: config/core.php + MoabomSystemAdminMenus 선언 → ExtensionMenuSyncHelper (override 금지).
 */
final class TenantAdminMenuSynchronizer
{
    public function __construct(
        private readonly TenantDatabaseConfigurator $databaseConfigurator,
        private readonly TenantContext $tenantContext,
        private readonly PlatformRuntimeConfigurator $platformRuntimeConfigurator,
        private readonly ModuleManager $moduleManager,
        private readonly ModuleRepositoryInterface $moduleRepository,
        private readonly TenantAdminMenuPolicy $menuPolicy,
        private readonly TenantPackageCatalog $packageCatalog,
        private readonly CoreUpdateService $coreUpdateService,
    ) {}

    public function syncForTenant(TenantRecord $tenant): array
    {
        $this->databaseConfigurator->apply($tenant);
        $this->tenantContext->setTenant($tenant, $tenant->host);

        try {
            $this->coreUpdateService->syncCoreMenus();
            $package = $this->packageCatalog->get($tenant->packageId);
            $this->syncPackageDeclarativeArtifacts($package);
            $hygiene = $this->menuPolicy->applyHygiene();

            return ['synced' => true, 'hygiene' => $hygiene];
        } finally {
            $this->platformRuntimeConfigurator->applyPlatform();
            $this->tenantContext->setPlatform($this->resolvePlatformHost());
        }
    }

    /**
     * @return array{synced: bool, hygiene: array<string, mixed>}
     */
    public function syncPlatform(): array
    {
        $host = $this->resolvePlatformHost();
        $this->platformRuntimeConfigurator->applyPlatform();
        $this->tenantContext->setPlatform($host);

        try {
            $this->coreUpdateService->syncCoreMenus();
            $this->syncActivePlatformModules();
            $hygiene = $this->menuPolicy->applyHygiene();

            return ['synced' => true, 'hygiene' => $hygiene];
        } catch (\Throwable $e) {
            return [
                'synced' => false,
                'error' => $e->getMessage(),
                'hygiene' => [
                    'purged' => 0,
                    'linked' => 0,
                    'missing_parent' => [],
                    'missing_child' => [],
                ],
            ];
        }
    }

    /**
     * @return array{tenants: int, synced: int, purged: int, linked: int, platform_synced: bool, errors: list<string>}
     */
    public function syncAllActiveTenants(): array
    {
        $platformResult = $this->syncPlatform();
        $platformSynced = (bool) ($platformResult['synced'] ?? false);

        $tenants = $this->loadActiveTenants();
        $synced = 0;
        $purged = 0;
        $linked = 0;
        $errors = [];

        if (! $platformSynced) {
            $errors[] = 'platform: '.($platformResult['error'] ?? 'menu sync failed');
        }

        foreach ($tenants as $tenant) {
            try {
                $result = $this->syncForTenant($tenant);
                if ($result['synced']) {
                    $synced++;
                    $purged += (int) ($result['hygiene']['purged'] ?? 0);
                    $linked += (int) ($result['hygiene']['linked'] ?? 0);
                }
                if (($result['hygiene']['missing_parent'] ?? []) !== [] || ($result['hygiene']['missing_child'] ?? []) !== []) {
                    $errors[] = sprintf(
                        '%s: menu hierarchy incomplete parent=%s child=%s',
                        $tenant->slug,
                        implode(',', $result['hygiene']['missing_parent'] ?? []),
                        implode(',', $result['hygiene']['missing_child'] ?? []),
                    );
                }
            } catch (\Throwable $e) {
                $errors[] = sprintf('%s: %s', $tenant->slug, $e->getMessage());
            }
        }

        return [
            'tenants' => count($tenants),
            'synced' => $synced,
            'purged' => $purged,
            'linked' => $linked,
            'platform_synced' => $platformSynced,
            'errors' => $errors,
        ];
    }

    private function syncPackageDeclarativeArtifacts(TenantPackage $package): void
    {
        $this->moduleManager->loadModules();

        foreach ($package->modules as $identifier) {
            $module = $this->resolveModule($identifier);
            if ($module !== null) {
                $this->moduleManager->syncDeclarativeArtifacts($module);
            }
        }
    }

    private function syncActivePlatformModules(): void
    {
        $this->moduleManager->loadModules();

        if (! Schema::hasTable('modules')) {
            $module = $this->resolveMoabomSystemModule();
            if ($module !== null) {
                $this->moduleManager->syncDeclarativeArtifacts($module);
            }

            return;
        }

        $identifiers = DB::table('modules')
            ->where('status', 'active')
            ->orderBy('identifier')
            ->pluck('identifier')
            ->all();

        foreach ($identifiers as $identifier) {
            if (! is_string($identifier) || $identifier === '') {
                continue;
            }

            $module = $this->resolveModule($identifier);
            if ($module !== null) {
                $this->moduleManager->syncDeclarativeArtifacts($module);
            }
        }
    }

    private function resolveModule(string $identifier): ?ModuleInterface
    {
        if ($identifier === 'moabom-system') {
            return $this->resolveMoabomSystemModule();
        }

        $loaded = $this->moduleManager->getModule($identifier);

        return $loaded instanceof ModuleInterface ? $loaded : null;
    }

    private function resolveMoabomSystemModule(): ?ModuleInterface
    {
        if ($this->moduleManager->getModule('moabom-system') === null) {
            $this->moduleManager->loadModules();
        }

        $loaded = $this->moduleManager->getModule('moabom-system');
        if ($loaded instanceof ModuleInterface) {
            return $loaded;
        }

        $record = $this->moduleRepository->findByIdentifier('moabom-system');
        if ($record === null) {
            return null;
        }

        $moduleFile = base_path('modules/moabom-system/module.php');
        if (! is_file($moduleFile)) {
            return null;
        }

        $namespace = ExtensionManager::directoryToNamespace('moabom-system');
        $moduleClass = "Modules\\{$namespace}\\Module";

        if (! class_exists($moduleClass, false)) {
            require_once $moduleFile;
        }

        $instance = new $moduleClass;

        return $instance instanceof ModuleInterface ? $instance : null;
    }

    /**
     * @return list<TenantRecord>
     */
    private function loadActiveTenants(): array
    {
        Artisan::call('moabom:saas:platform-migrate', ['--force' => true]);

        $rows = DB::connection('moabom_platform')
            ->table('moabom_saas_tenants')
            ->where('status', 'active')
            ->orderBy('slug')
            ->get();

        return $rows->map(fn ($row) => TenantRecord::fromRow((array) $row))->all();
    }

    private function resolvePlatformHost(): string
    {
        $hosts = (array) config('moabom-system.saas.platform_hosts', ['mek360.com']);
        $host = $hosts[0] ?? 'mek360.com';

        return is_string($host) && $host !== '' ? $host : 'mek360.com';
    }
}
