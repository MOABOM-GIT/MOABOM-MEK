<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

/**
 * 테넌트 DB 전환 후 **디스크 SSOT** artisan만 실행.
 *
 * 금지: module:update --force, template:update --force, template:install --force
 */
final class TenantProvisionArtisanRunner
{
    public function __construct(
        private readonly TenantDatabaseConfigurator $databaseConfigurator,
        private readonly TenantFilesystemConfigurator $filesystemConfigurator,
        private readonly TenantContext $tenantContext,
        private readonly PlatformRuntimeConfigurator $platformRuntimeConfigurator,
        private readonly TenantPackageCatalog $packageCatalog,
    ) {}

    public function run(TenantRecord $tenant, string $packageId): void
    {
        $package = $this->packageCatalog->get($packageId);
        $sourceDb = (string) config('moabom-system.saas.provision.schema_source_db', 'moabom-db');
        $moduleSyncDeclarations = array_values(array_unique(array_merge(
            $package->moduleSyncDeclarations,
            $this->resolvePlatformActiveModuleIdentifiers($sourceDb),
        )));

        $this->databaseConfigurator->apply($tenant);
        $this->filesystemConfigurator->apply($tenant);
        $this->tenantContext->setTenant($tenant, $tenant->host);

        try {
            foreach ($moduleSyncDeclarations as $moduleId) {
                $this->callArtisanOrFail('moabom:module-sync-declarations', [
                    'identifier' => $moduleId,
                ]);
            }

            foreach ($package->moduleRefreshLayout as $moduleId) {
                $this->callArtisanOrFail('module:refresh-layout', [
                    'identifier' => $moduleId,
                ]);
            }

            // platform clone 은 구 template_layouts 를 복사 — filesystem SSOT 로 admin 덮어쓰기
            if ($package->activeAdminTemplate !== '') {
                $this->callArtisanOrFail('template:refresh-layout', [
                    'identifier' => $package->activeAdminTemplate,
                ]);
            }

            $this->callArtisanOrFail('template:cache-clear');

            // 신규 tenant 안전망 — ExtensionMenuSyncHelper::grantDefaultRoles 가
            // 신규 row 에서만 동작하므로, sync 후 admin role × menus 매핑이 비어있을 수
            // 있다 (freshent 케이스). idempotent 한 repair 명령으로 보장.
            // @see deploy/AGENT-FAILURE-ANALYSIS.md §12
            $this->callArtisanOrFail('moabom:saas:tenant-repair', [
                'slug' => $tenant->slug,
                '--apply' => true,
                '--package' => $packageId,
                '--source-db' => $sourceDb,
                '--sync-active-from-source' => true,
                '--prune-tenant-only-menus' => true,
            ]);

            // Host-aware moabom-system 메뉴 선언 + platform 오염 slug 제거 (provision SSOT).
            $this->callArtisanOrFail('moabom:saas:sync-tenant-admin-menus', [
                'slug' => $tenant->slug,
            ]);

            // sync 가 신규 menu row 를 추가한 뒤 role_menus 가 비는 레이스 방지 (최초 로그인 4메뉴 증상).
            $this->callArtisanOrFail('moabom:saas:tenant-repair', [
                'slug' => $tenant->slug,
                '--apply' => true,
                '--skip-menu-rows' => true,
                '--skip-purge-tenant-forbidden-menus' => true,
                '--skip-modules' => true,
                '--skip-templates' => true,
                '--skip-plugins' => true,
                '--skip-legal-pages' => true,
                '--skip-language-packs' => true,
            ]);

            $this->callArtisanOrFail('cache:clear');

            $this->callArtisanOrFail('moabom:saas:sync-tenant-language-packs', [
                'slug' => $tenant->slug,
            ]);

            // B안 — 신규 tenant 수렴+검증 단일 패스. 위 개별 동기화 후 module_layouts 누락분까지
            // idempotent 하게 보강하고, 환경설정>언어팩 목록·admin_settings 정합성을 검증한다.
            // 메뉴/언어팩 검증 실패를 active tenant 로 넘기지 않도록 종료코드를 전파한다.
            $this->callArtisanOrFail('moabom:saas:tenant-reconcile', [
                'slug' => $tenant->slug,
            ]);

            app(TenantLegalPagesSynchronizer::class)->syncForTenant($tenant, $sourceDb);
        } finally {
            $this->platformRuntimeConfigurator->applyPlatform();
        }
    }

    /**
     * @return list<string>
     */
    private function resolvePlatformActiveModuleIdentifiers(string $sourceDb): array
    {
        if ($sourceDb === '') {
            return [];
        }

        $table = $this->tablePrefix().'modules';
        try {
            $pdo = DB::connection()->getPdo();
            $stmt = $pdo->prepare("SELECT `identifier` FROM `{$sourceDb}`.`{$table}` WHERE `status` = 'active'");
            $stmt->execute();

            $modules = [];
            while (($identifier = $stmt->fetchColumn()) !== false) {
                $identifier = trim((string) $identifier);
                if ($identifier !== '') {
                    $modules[] = $identifier;
                }
            }

            sort($modules);

            return array_values(array_unique($modules));
        } catch (\Throwable) {
            return [];
        }
    }

    private function tablePrefix(): string
    {
        $connection = (string) config('database.default', 'mysql');

        return (string) config("database.connections.{$connection}.prefix", '');
    }

    /**
     * @param  array<string, mixed>  $parameters
     */
    private function callArtisanOrFail(string $command, array $parameters = []): void
    {
        $exitCode = Artisan::call($command, $parameters);
        if ($exitCode === 0) {
            return;
        }

        $output = trim(Artisan::output());
        throw new \RuntimeException(sprintf(
            '%s 실패(exit=%d)%s',
            $command,
            $exitCode,
            $output !== '' ? ': '.$output : '',
        ));
    }
}
