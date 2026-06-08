<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use App\Services\LanguagePack\LanguagePackRegistry;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Tenant DB language_packs — platform(moabom-db) 행 미러만 담당.
 *
 * G7 LanguagePackService::list() 는 DB 행 + 가상 번들을 합친다.
 * 테넌트 환경설정 탭은 exclude_protected=1 이므로 platform 과 동일한
 * is_protected=0 행을 mirror 해야 목록이 보인다.
 *
 * bundled registrar·ensureBundledSlotRow 등 2차 보정은 G7 module install 훅에 맡긴다.
 */
final class TenantLanguagePackMirror
{
    /** @var list<string> */
    private const MIRROR_STATUSES = ['active', 'installed', 'inactive'];

    public function __construct(
        private readonly LanguagePackRegistry $languagePackRegistry,
        private readonly TenantDatabaseConfigurator $databaseConfigurator,
        private readonly TenantContext $tenantContext,
        private readonly PlatformRuntimeConfigurator $platformRuntimeConfigurator,
        private readonly TenantPackageCatalog $packageCatalog,
        private readonly TenantSharedLanguagePackSchema $sharedSchema,
    ) {}

    public function mirrorForTenant(TenantRecord $tenant, ?string $packageId = null): void
    {
        if (! Schema::hasTable('language_packs')) {
            return;
        }

        $package = $this->packageCatalog->get($packageId ?? $tenant->packageId);
        $this->databaseConfigurator->apply($tenant);
        $this->tenantContext->setTenant($tenant, $tenant->host);

        try {
            $tenantDb = (string) config('database.connections.mysql.database');
            $platformDb = SaasMysqlPdoFactory::platformWriteDatabase();
            if ($platformDb !== '' && $tenantDb !== '' && $platformDb !== $tenantDb) {
                $this->mirrorFromPlatformDatabase($platformDb, $tenantDb, $package);
            }
            $this->languagePackRegistry->invalidate();
        } finally {
            $this->platformRuntimeConfigurator->applyPlatform();
        }
    }

    public function mirrorFromPlatformDatabase(string $sourceDb, string $targetDb, TenantPackage $package): void
    {
        if (! Schema::hasTable('language_packs')) {
            return;
        }

        // A안 — shared_language_packs 활성 시: 복제(mirror) 대신 platform 을 가리키는 VIEW 로
        // routing 한다. 카탈로그 단일 SSOT → mirror 누락/지연으로 인한 빈 목록(RF-19b) 구조적 제거.
        // ($sourceDb = platform, $targetDb = tenant)
        if ($this->sharedSchema->isEnabled()) {
            $this->sharedSchema->ensureViewForTenantDb($targetDb, $sourceDb);

            return;
        }

        $pdo = DB::connection()->getPdo();
        $table = $this->prefixedTable('language_packs');
        $targets = array_merge($package->modules, $package->plugins, $package->templates);

        $statusPlaceholders = implode(', ', array_fill(0, count(self::MIRROR_STATUSES), '?'));
        $conditions = ["scope = 'core'"];
        $params = [...self::MIRROR_STATUSES];

        if ($targets !== []) {
            $targetPlaceholders = implode(', ', array_fill(0, count($targets), '?'));
            $conditions[] = "(scope IN ('module', 'plugin', 'template') AND target_identifier IN ({$targetPlaceholders}))";
            $params = array_merge($params, $targets);
        }

        $where = implode(' OR ', $conditions);
        $sql = "INSERT INTO `{$targetDb}`.`{$table}` "
            ."SELECT s.* FROM `{$sourceDb}`.`{$table}` s "
            ."WHERE s.status IN ({$statusPlaceholders}) AND ({$where}) "
            .'ON DUPLICATE KEY UPDATE '
            .'status = VALUES(status), version = VALUES(version), source_url = VALUES(source_url), '
            .'source_type = VALUES(source_type), manifest = VALUES(manifest), '
            .'is_protected = VALUES(is_protected), '
            .'activated_at = VALUES(activated_at), updated_at = VALUES(updated_at)';

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
    }

    private function prefixedTable(string $table): string
    {
        $connection = (string) config('database.default', 'mysql');
        $prefix = (string) config("database.connections.{$connection}.prefix", '');

        return $prefix.$table;
    }
}
