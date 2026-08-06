<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;
use Modules\Moabom\System\Saas\TenantAdminMenuPolicy;
use Modules\Moabom\System\Saas\TenantAdminMenuSynchronizer;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantLanguagePackMirror;
use Modules\Moabom\System\Saas\TenantLegalPagesSynchronizer;
use Modules\Moabom\System\Saas\TenantPackageCatalog;
use Modules\Moabom\System\Saas\TenantRecord;

/**
 * Tenant DB 의 누락 데이터를 idempotent 하게 복구.
 *
 * 한 달 동안 누적된 SaaS provision 흐름의 분기 누락을 한 명령으로 정상화:
 *
 *  1. `role_menus` pivot — admin role × 모든 활성 menu × 'read' 매핑.
 *     `ExtensionMenuSyncHelper::grantDefaultRoles` 가 신규 row 에만 동작하므로
 *     기존 row 에 대해 매핑이 비어있던 케이스 (= freshent admin "메뉴 없음") 복구.
 *
 *  2. `plugins` 테이블 누락 row — `hospital-default.json` 패키지 정의 + `--plugin=identifier`
 *     로 지정한 plugin 을 platform DB 에서 SELECT * → tenant DB INSERT, status='active'.
 *     (예: `sirsoft-daum_postcode` 가 누락되어 admin profile 의 `setFieldReadOnly`
 *     action handler 가 unknown 으로 떨어지던 케이스 복구.)
 *
 * 안전 원칙:
 *  - 기본 = dry-run. `--apply` 없으면 변경 0.
 *  - 모든 변경은 INSERT-only / sync-without-detaching → 기존 데이터 손실 없음.
 *  - 한 step 실패해도 다른 step 진행 + SUMMARY 에 errors 표시.
 *  - tenant DB connection 전환은 `TenantDatabaseConfigurator::apply()` SSOT 사용.
 *
 * @see deploy/AGENT-FAILURE-ANALYSIS.md §12
 */
class SaasTenantRepairCommand extends Command
{
    /**
     * Tenant host 에 항상 유지해야 하는 공통 플랫폼 설정 메뉴.
     *
     * 마스터/테넌트 공통 요구사항(플랫폼 메뉴 하위):
     * - 플랫폼 메뉴
     * - 마이페이지 설정
     * - SNS 연결 설정
     * - 크레딧 설정
     * - 마이앱 관리
     * - 마스크피팅 관리
     *
     * @var list<string>
     */
    private const TENANT_REQUIRED_MENU_SLUGS = [
        'platform-settings',
        'moabom-system-settings',
        'moabom-social-auth-settings',
        'moabom-credit-settings',
        'moabom-apps-generated',
        'moabom-cpap-measurements',
    ];

    protected $signature = 'moabom:saas:tenant-repair
        {slug? : 대상 tenant slug (생략/__all__ = 모든 active; Cloud Run Job 에서 * 금지 RF-12)}
        {--apply : 실제 변경 (기본은 dry-run)}
        {--sync-active-from-source : package 식별자 + source DB active 식별자 union 적용}
        {--skip-purge-tenant-forbidden-menus : tenant 금지 메뉴(slug) purge 건너뛰기}
        {--prune-tenant-only-menus : source DB 에 없는 tenant active menus 를 비활성화}
        {--skip-menu-rows : menus row 복구 건너뛰기}
        {--skip-menus : role_menus 복구 건너뛰기}
        {--skip-modules : modules 복구 건너뛰기}
        {--skip-templates : templates 복구 건너뛰기}
        {--skip-plugins : plugins 복구 건너뛰기}
        {--skip-legal-pages : 이용약관·개인정보 pages 동기화 건너뛰기}
        {--skip-language-packs : language_packs platform mirror 건너뛰기}
        {--plugin=* : 명시적으로 복구할 plugin identifier (패키지 정의 추가분)}
        {--package=hospital-default : 패키지 정의 (plugins list 소스)}
        {--source-db= : plugins row 복사 원본 DB (기본 schema_source_db, 보통 moabom-db)}
        {--insert-only : modules/plugins/templates — row 가 이미 있으면 status(on/off) 유지, 누락분만 INSERT}';

    protected $description = 'Tenant DB 의 admin role_menus + plugins 누락 데이터를 idempotent 하게 복구';

    public function handle(
        PlatformConnectionFactory $platformConnections,
        PlatformRuntimeConfigurator $platformRuntimeConfigurator,
        TenantDatabaseConfigurator $databaseConfigurator,
        TenantPackageCatalog $packageCatalog,
        TenantContext $tenantContext,
        TenantAdminMenuPolicy $tenantMenuPolicy,
        TenantAdminMenuSynchronizer $menuSynchronizer,
        TenantLanguagePackMirror $languagePackMirror,
        TenantLegalPagesSynchronizer $legalPagesSynchronizer,
    ): int {
        $slugArg = (string) $this->argument('slug');
        $dryRun = ! (bool) $this->option('apply');
        $syncActiveFromSource = (bool) $this->option('sync-active-from-source');
        $skipPurgeTenantForbiddenMenus = (bool) $this->option('skip-purge-tenant-forbidden-menus');
        $pruneTenantOnlyMenus = (bool) $this->option('prune-tenant-only-menus');
        $skipMenuRows = (bool) $this->option('skip-menu-rows');
        $skipMenus = (bool) $this->option('skip-menus');
        $skipModules = (bool) $this->option('skip-modules');
        $skipTemplates = (bool) $this->option('skip-templates');
        $skipPlugins = (bool) $this->option('skip-plugins');
        $skipLegalPages = (bool) $this->option('skip-legal-pages');
        $skipLanguagePacks = (bool) $this->option('skip-language-packs');
        $insertOnly = (bool) $this->option('insert-only');
        /** @var list<string> $extraPlugins */
        $extraPlugins = (array) $this->option('plugin');
        $packageId = (string) $this->option('package');

        $this->line(sprintf('mode=%s slug=%s', $dryRun ? 'DRY-RUN' : 'APPLY', $slugArg));
        $this->line(sprintf(
            'sync-active-from-source=%s insert-only=%s skip-purge-tenant-forbidden-menus=%s prune-tenant-only-menus=%s skip-menu-rows=%s skip-menus=%s skip-modules=%s skip-templates=%s skip-plugins=%s',
            $syncActiveFromSource ? 'y' : 'n',
            $insertOnly ? 'y' : 'n',
            $skipPurgeTenantForbiddenMenus ? 'y' : 'n',
            $pruneTenantOnlyMenus ? 'y' : 'n',
            $skipMenuRows ? 'y' : 'n',
            $skipMenus ? 'y' : 'n',
            $skipModules ? 'y' : 'n',
            $skipTemplates ? 'y' : 'n',
            $skipPlugins ? 'y' : 'n',
        ));
        $this->newLine();

        $platformConnections->registerConnection();

        $package = null;
        try {
            $package = $packageCatalog->get($packageId);
        } catch (\Throwable $e) {
            $this->warn(sprintf('package %s 로드 실패 (계속 진행, --plugin 만 사용): %s', $packageId, $e->getMessage()));
        }

        $packagePlugins = $package?->plugins ?? [];
        $packageModules = $package?->modules ?? [];
        $packageTemplates = $package?->templates ?? [];

        $sourceDb = (string) ($this->option('source-db')
            ?: config('moabom-system.saas.provision.schema_source_db', 'moabom-db'));
        $sourceActiveModules = $syncActiveFromSource
            ? $this->fetchActiveIdentifiersFromSource($sourceDb, 'modules')
            : [];
        $sourceActivePlugins = $syncActiveFromSource
            ? $this->fetchActiveIdentifiersFromSource($sourceDb, 'plugins')
            : [];
        $pluginsToEnsure = array_values(array_unique(array_merge($packagePlugins, $sourceActivePlugins, $extraPlugins)));
        $modulesToEnsure = array_values(array_unique(array_merge($packageModules, $sourceActiveModules)));
        // templates 는 build-reference 정책(sirsoft-* 런타임 제외) 때문에 package 정의를 SSOT로 유지.
        $templatesToEnsure = $packageTemplates;

        $tenants = $this->loadTenants($slugArg);
        if ($tenants === []) {
            $this->error('대상 tenant 없음.');

            return self::FAILURE;
        }

        $totalMenuInserts = 0;
        $totalMenuRowInserts = 0;
        $totalMenuParentsLinked = 0;
        $totalMenuPurged = 0;
        $totalMenuPruned = 0;
        $totalModuleInserts = 0;
        $totalModuleActivations = 0;
        $totalTemplateInserts = 0;
        $totalTemplateActivations = 0;
        $totalPluginInserts = 0;
        $totalPluginActivations = 0;
        $totalLegalPagesSynced = 0;
        $totalLanguagePacksMirrored = 0;
        $errors = [];

        try {
            foreach ($tenants as $tenant) {
                $this->info(sprintf('=== %s (host=%s db=%s) ===', $tenant->slug, $tenant->host, $tenant->dbDatabase));

                try {
                    $databaseConfigurator->apply($tenant);
                    $tenantContext->setTenant($tenant, $tenant->host);
                } catch (\Throwable $e) {
                    $errors[] = sprintf('tenant=%s DB switch err=%s', $tenant->slug, $e->getMessage());
                    $this->error('  DB switch err: '.$e->getMessage());

                    continue;
                }

                if (! $skipMenuRows) {
                    [$menuRowInserted, $errs] = $this->repairMenus(
                        tenantSlug: $tenant->slug,
                        tenantDb: $tenant->dbDatabase,
                        sourceDb: $sourceDb,
                        dryRun: $dryRun,
                    );
                    $totalMenuRowInserts += $menuRowInserted;
                    $errors = array_merge($errors, $errs);

                    if (! $dryRun) {
                        $hygiene = $tenantMenuPolicy->applyHygiene();
                        $totalMenuParentsLinked += $hygiene['linked'];
                        if ($hygiene['missing_parent'] !== [] || $hygiene['missing_child'] !== []) {
                            $errors[] = sprintf(
                                '%s: menu hierarchy incomplete parent=%s child=%s',
                                $tenant->slug,
                                implode(',', $hygiene['missing_parent']),
                                implode(',', $hygiene['missing_child']),
                            );
                        }
                        $this->line(sprintf(
                            '  [menu-hygiene] %s: purged=%d linked=%d',
                            $tenant->slug,
                            $hygiene['purged'],
                            $hygiene['linked'],
                        ));

                        try {
                            $menuSynchronizer->syncForTenant($tenant);
                            $this->line(sprintf('  [menu-sync] %s: declarative order applied', $tenant->slug));
                        } catch (\Throwable $e) {
                            $errors[] = sprintf('%s: menu declarative sync err=%s', $tenant->slug, $e->getMessage());
                        }
                    }
                }

                if ($pruneTenantOnlyMenus) {
                    [$menuPruned, $errs] = $this->pruneTenantOnlyMenus(
                        tenantSlug: $tenant->slug,
                        tenantDb: $tenant->dbDatabase,
                        sourceDb: $sourceDb,
                        dryRun: $dryRun,
                    );
                    $totalMenuPruned += $menuPruned;
                    $errors = array_merge($errors, $errs);
                }

                if (! $skipPurgeTenantForbiddenMenus) {
                    [$menuPurged, $errs] = $this->purgeTenantForbiddenMenus(
                        tenantSlug: $tenant->slug,
                        dryRun: $dryRun,
                    );
                    $totalMenuPurged += $menuPurged;
                    $errors = array_merge($errors, $errs);
                }

                if (! $skipMenus) {
                    [$inserted, $errs] = $this->repairRoleMenus($tenant->slug, $dryRun);
                    $totalMenuInserts += $inserted;
                    $errors = array_merge($errors, $errs);
                }

                if (! $skipModules) {
                    [$moduleIns, $moduleAct, $errs] = $this->repairExtensions(
                        tenantSlug: $tenant->slug,
                        tenantDb: $tenant->dbDatabase,
                        sourceDb: $sourceDb,
                        table: 'modules',
                        identifiersToEnsure: $modulesToEnsure,
                        dryRun: $dryRun,
                        insertOnly: $insertOnly,
                    );
                    $totalModuleInserts += $moduleIns;
                    $totalModuleActivations += $moduleAct;
                    $errors = array_merge($errors, $errs);
                }

                if (! $skipTemplates) {
                    [$templateIns, $templateAct, $errs] = $this->repairExtensions(
                        tenantSlug: $tenant->slug,
                        tenantDb: $tenant->dbDatabase,
                        sourceDb: $sourceDb,
                        table: 'templates',
                        identifiersToEnsure: $templatesToEnsure,
                        dryRun: $dryRun,
                        insertOnly: $insertOnly,
                    );
                    $totalTemplateInserts += $templateIns;
                    $totalTemplateActivations += $templateAct;
                    $errors = array_merge($errors, $errs);
                }

                if (! $skipPlugins) {
                    [$pluginIns, $pluginAct, $errs] = $this->repairPlugins(
                        tenantSlug: $tenant->slug,
                        tenantDb: $tenant->dbDatabase,
                        pluginsToEnsure: $pluginsToEnsure,
                        sourceDb: $sourceDb,
                        dryRun: $dryRun,
                        insertOnly: $insertOnly,
                    );
                    $totalPluginInserts += $pluginIns;
                    $totalPluginActivations += $pluginAct;
                    $errors = array_merge($errors, $errs);
                }

                if (! $skipLanguagePacks && ! $dryRun) {
                    try {
                        $languagePackMirror->mirrorForTenant($tenant, $packageId);
                        $totalLanguagePacksMirrored++;
                        $this->line(sprintf('  [language-packs] %s: mirrored from %s', $tenant->slug, $sourceDb));
                    } catch (\Throwable $e) {
                        $errors[] = sprintf('%s: language_packs mirror err=%s', $tenant->slug, $e->getMessage());
                    }
                }

                if (! $skipLegalPages && ! $dryRun) {
                    $legalResult = $legalPagesSynchronizer->syncForTenant($tenant, $sourceDb);
                    $totalLegalPagesSynced += $legalResult['synced'];
                    $this->line(sprintf(
                        '  [legal-pages] %s: inserted=%d updated=%d',
                        $tenant->slug,
                        $legalResult['inserted'],
                        $legalResult['updated'],
                    ));
                    $errors = array_merge($errors, $legalResult['errors']);
                }

                $this->newLine();
            }
        } finally {
            $platformRuntimeConfigurator->applyPlatform();
        }

        $this->info('=== SUMMARY ===');
        $this->line(sprintf(
            'menu_rows inserted=%d parent-linked=%d pruned=%d purged=%d | role_menus inserted=%d | modules inserted=%d activated=%d | templates inserted=%d activated=%d | plugins inserted=%d activated=%d | language-packs mirrored=%d | legal-pages synced=%d | errors=%d',
            $totalMenuRowInserts,
            $totalMenuParentsLinked,
            $totalMenuPruned,
            $totalMenuPurged,
            $totalMenuInserts,
            $totalModuleInserts,
            $totalModuleActivations,
            $totalTemplateInserts,
            $totalTemplateActivations,
            $totalPluginInserts,
            $totalPluginActivations,
            $totalLanguagePacksMirrored,
            $totalLegalPagesSynced,
            count($errors),
        ));
        if ($errors !== []) {
            foreach ($errors as $err) {
                $this->error('  '.$err);
            }
        }
        if ($dryRun && ($totalMenuRowInserts + $totalMenuPruned + $totalMenuPurged + $totalMenuInserts + $totalModuleInserts + $totalModuleActivations + $totalTemplateInserts + $totalTemplateActivations + $totalPluginInserts + $totalPluginActivations) > 0) {
            $this->newLine();
            $this->warn('변경 안 했음 (dry-run). 실행: --apply 추가.');
        }

        return count($errors) === 0 ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @return array{0:int,1:list<string>}
     */
    private function repairRoleMenus(string $slug, bool $dryRun): array
    {
        $errors = [];

        if (! Schema::connection(DB::getDefaultConnection())->hasTable('role_menus')
            || ! Schema::connection(DB::getDefaultConnection())->hasTable('menus')
            || ! Schema::connection(DB::getDefaultConnection())->hasTable('roles')
        ) {
            $errors[] = sprintf('%s: roles/menus/role_menus 테이블 누락', $slug);

            return [0, $errors];
        }

        $adminRole = DB::table('roles')->where('identifier', 'admin')->first();
        if ($adminRole === null) {
            $errors[] = sprintf('%s: admin role 없음', $slug);

            return [0, $errors];
        }

        $activeMenuIds = DB::table('menus')
            ->where('is_active', true)
            ->pluck('id')
            ->all();

        if ($activeMenuIds === []) {
            $this->line(sprintf('  [menus] %s: 활성 menu 0개 — 건너뜀', $slug));

            return [0, $errors];
        }

        $existing = DB::table('role_menus')
            ->where('role_id', $adminRole->id)
            ->where('permission_type', 'read')
            ->pluck('menu_id')
            ->all();

        $missing = array_values(array_diff($activeMenuIds, $existing));

        $this->line(sprintf(
            '  [menus] %s: active=%d already-mapped=%d missing=%d',
            $slug,
            count($activeMenuIds),
            count($existing),
            count($missing),
        ));

        if ($missing === []) {
            return [0, $errors];
        }

        if ($dryRun) {
            return [count($missing), $errors];
        }

        $now = now();
        $rows = array_map(fn (int|string $menuId): array => [
            'role_id' => $adminRole->id,
            'menu_id' => (int) $menuId,
            'permission_type' => 'read',
            'created_at' => $now,
            'updated_at' => $now,
        ], $missing);

        try {
            DB::table('role_menus')->insertOrIgnore($rows);
            $this->line(sprintf('  [menus] %s: INSERTED %d', $slug, count($missing)));

            return [count($missing), $errors];
        } catch (\Throwable $e) {
            $errors[] = sprintf('%s: role_menus insert err=%s', $slug, $e->getMessage());

            return [0, $errors];
        }
    }

    /**
     * platform active menu row 를 tenant 에 mirror (slug 기준 누락분만 INSERT).
     *
     * @return array{0:int,1:list<string>}
     */
    private function repairMenus(string $tenantSlug, string $tenantDb, string $sourceDb, bool $dryRun): array
    {
        $errors = [];
        $inserted = 0;

        $tenantConn = DB::getDefaultConnection();
        if (! Schema::connection($tenantConn)->hasTable('menus')) {
            $errors[] = sprintf('%s: menus 테이블 누락', $tenantSlug);

            return [0, $errors];
        }

        $prefix = (string) DB::connection()->getTablePrefix();
        $menusTable = $prefix.'menus';
        $tenantPdo = DB::connection()->getPdo();

        try {
            $stmt = $tenantPdo->prepare("SELECT * FROM `{$sourceDb}`.`{$menusTable}` WHERE `is_active` = 1");
            $stmt->execute();
            $sourceRows = [];
            while (($row = $stmt->fetch(\PDO::FETCH_ASSOC)) !== false) {
                $slug = trim((string) ($row['slug'] ?? ''));
                if ($slug === '') {
                    continue;
                }
                if (in_array($slug, TenantAdminMenuPolicy::FORBIDDEN_SLUGS, true)) {
                    continue;
                }
                if (in_array($slug, TenantAdminMenuPolicy::DEPRECATED_SLUGS, true)) {
                    continue;
                }
                $sourceRows[$slug] = $row;
            }
        } catch (\Throwable $e) {
            $errors[] = sprintf('%s: source menus 읽기 실패=%s', $tenantSlug, $e->getMessage());

            return [0, $errors];
        }

        // 공통 플랫폼 설정 메뉴는 source active 상태와 무관하게 강제로 확보한다.
        // (이전 정리/비활성화 이력으로 active 목록에서 빠져도 tenant 에는 반드시 있어야 함)
        if (self::TENANT_REQUIRED_MENU_SLUGS !== []) {
            try {
                $requiredPlaceholders = implode(',', array_fill(0, count(self::TENANT_REQUIRED_MENU_SLUGS), '?'));
                $requiredStmt = $tenantPdo->prepare(
                    "SELECT * FROM `{$sourceDb}`.`{$menusTable}` WHERE `slug` IN ({$requiredPlaceholders})"
                );
                $requiredStmt->execute(self::TENANT_REQUIRED_MENU_SLUGS);
                while (($row = $requiredStmt->fetch(\PDO::FETCH_ASSOC)) !== false) {
                    $slug = trim((string) ($row['slug'] ?? ''));
                    if ($slug === '' || in_array($slug, TenantAdminMenuPolicy::FORBIDDEN_SLUGS, true)) {
                        continue;
                    }
                    if (in_array($slug, TenantAdminMenuPolicy::DEPRECATED_SLUGS, true)) {
                        continue;
                    }
                    $row['is_active'] = 1;
                    $sourceRows[$slug] = $row;
                }
            } catch (\Throwable $e) {
                $errors[] = sprintf('%s: source required menus 읽기 실패=%s', $tenantSlug, $e->getMessage());
            }
        }

        $sourceSlugs = array_keys($sourceRows);
        if ($sourceSlugs === []) {
            $this->line(sprintf('  [menu-rows] %s: source active menu 0개', $tenantSlug));

            return [0, $errors];
        }

        $existingSlugs = DB::table('menus')->pluck('slug')->all();
        $missingSlugs = array_values(array_diff($sourceSlugs, $existingSlugs));
        $this->line(sprintf(
            '  [menu-rows] %s: source-active=%d existing=%d missing=%d',
            $tenantSlug,
            count($sourceSlugs),
            count($existingSlugs),
            count($missingSlugs),
        ));

        if ($missingSlugs === []) {
            return [0, $errors];
        }

        if ($dryRun) {
            return [count($missingSlugs), $errors];
        }

        $columns = Schema::connection($tenantConn)->getColumnListing('menus');
        $insertableColumns = array_values(array_diff($columns, ['id']));
        $sourceIdToSlug = [];
        foreach ($sourceRows as $slug => $row) {
            $sourceIdToSlug[(string) ($row['id'] ?? '')] = $slug;
        }

        try {
            // slug 기준으로만 누락 row 를 생성하고, parent_id 는 2차 패스에서 slug 기반으로 재매핑한다.
            $slugToTenantId = DB::table('menus')->pluck('id', 'slug')->all();

            $insertedIdsBySlug = [];
            foreach ($missingSlugs as $slug) {
                $source = $sourceRows[$slug] ?? null;
                if ($source === null) {
                    continue;
                }

                $payload = [];
                foreach ($insertableColumns as $column) {
                    if ($column === 'parent_id') {
                        $payload[$column] = null;

                        continue;
                    }
                    // order·user_overrides 는 platform 스냅샷을 복사하면 테넌트별 divergence 가 생긴다.
                    // declarative sync(moabom:saas:sync-tenant-admin-menus)가 G7·module 정의 order 를 적용한다.
                    if (in_array($column, ['order', 'user_overrides'], true)) {
                        continue;
                    }
                    $payload[$column] = $source[$column] ?? null;
                }

                $newId = DB::table('menus')->insertGetId($payload);
                $insertedIdsBySlug[$slug] = $newId;
                $slugToTenantId[$slug] = $newId;
                $inserted++;
            }

            foreach ($insertedIdsBySlug as $slug => $menuId) {
                $source = $sourceRows[$slug] ?? null;
                if ($source === null) {
                    continue;
                }
                $sourceParentId = (string) ($source['parent_id'] ?? '');
                if ($sourceParentId === '' || $sourceParentId === '0') {
                    continue;
                }

                $parentSlug = $sourceIdToSlug[$sourceParentId] ?? null;
                if ($parentSlug === null) {
                    continue;
                }

                $tenantParentId = $slugToTenantId[$parentSlug] ?? null;
                if ($tenantParentId === null) {
                    continue;
                }

                DB::table('menus')->where('id', $menuId)->update(['parent_id' => $tenantParentId]);
            }

            $this->line(sprintf('  [menu-rows] %s: INSERTED %d', $tenantSlug, $inserted));
        } catch (\Throwable $e) {
            $errors[] = sprintf('%s: menu rows insert err=%s', $tenantSlug, $e->getMessage());
        }

        return [$inserted, $errors];
    }

    /**
     * source(active) 에 없는 tenant active menu 를 비활성화.
     *
     * @return array{0:int,1:list<string>}
     */
    private function pruneTenantOnlyMenus(string $tenantSlug, string $tenantDb, string $sourceDb, bool $dryRun): array
    {
        $errors = [];

        $tenantConn = DB::getDefaultConnection();
        if (! Schema::connection($tenantConn)->hasTable('menus')) {
            $errors[] = sprintf('%s: menus 테이블 누락', $tenantSlug);

            return [0, $errors];
        }

        $prefix = (string) DB::connection()->getTablePrefix();
        $menusTable = $prefix.'menus';
        $tenantPdo = DB::connection()->getPdo();

        try {
            $stmt = $tenantPdo->prepare("SELECT `slug` FROM `{$sourceDb}`.`{$menusTable}` WHERE `is_active` = 1");
            $stmt->execute();
            $sourceSlugs = [];
            while (($slug = $stmt->fetchColumn()) !== false) {
                $slug = trim((string) $slug);
                if ($slug !== '') {
                    if (in_array($slug, TenantAdminMenuPolicy::FORBIDDEN_SLUGS, true)) {
                        continue;
                    }
                    $sourceSlugs[] = $slug;
                }
            }
        } catch (\Throwable $e) {
            $errors[] = sprintf('%s: source menus(active) 조회 실패=%s', $tenantSlug, $e->getMessage());

            return [0, $errors];
        }

        $tenantActiveSlugs = DB::table('menus')
            ->where('is_active', true)
            ->pluck('slug')
            ->filter(fn ($slug): bool => trim((string) $slug) !== '')
            ->map(fn ($slug): string => trim((string) $slug))
            ->values()
            ->all();

        $extraSlugs = array_values(array_diff($tenantActiveSlugs, $sourceSlugs));
        $protectedSlugs = array_values(array_unique(array_merge(
            self::TENANT_REQUIRED_MENU_SLUGS,
            TenantAdminMenuPolicy::protectedFromPrune(),
        )));
        $extraSlugs = array_values(array_filter(
            $extraSlugs,
            fn (string $slug): bool => ! in_array($slug, $protectedSlugs, true)
        ));
        $this->line(sprintf(
            '  [menu-prune] %s: tenant-active=%d source-active=%d tenant-only=%d',
            $tenantSlug,
            count($tenantActiveSlugs),
            count($sourceSlugs),
            count($extraSlugs),
        ));

        if ($extraSlugs === []) {
            return [0, $errors];
        }

        foreach ($extraSlugs as $slug) {
            $this->line(sprintf('  [menu-prune] %s: [PRUNE] %s', $tenantSlug, $slug));
        }

        if ($dryRun) {
            return [count($extraSlugs), $errors];
        }

        try {
            DB::table('menus')
                ->whereIn('slug', $extraSlugs)
                ->update(['is_active' => false, 'updated_at' => now()]);

            return [count($extraSlugs), $errors];
        } catch (\Throwable $e) {
            $errors[] = sprintf('%s: menu prune err=%s', $tenantSlug, $e->getMessage());

            return [0, $errors];
        }
    }

    /**
     * modules / templates 공통 복구.
     *
     * @param  list<string>  $identifiersToEnsure
     * @return array{0:int,1:int,2:list<string>}
     */
    private function repairExtensions(
        string $tenantSlug,
        string $tenantDb,
        string $sourceDb,
        string $table,
        array $identifiersToEnsure,
        bool $dryRun,
        bool $insertOnly = false,
    ): array {
        $errors = [];
        $inserted = 0;
        $activated = 0;

        if (! in_array($table, ['modules', 'templates'], true)) {
            return [0, 0, [sprintf('%s: unsupported table %s', $tenantSlug, $table)]];
        }

        $tenantConn = DB::getDefaultConnection();
        if (! Schema::connection($tenantConn)->hasTable($table)) {
            return [0, 0, [sprintf('%s: %s 테이블 누락', $tenantSlug, $table)]];
        }

        if ($identifiersToEnsure === []) {
            $this->line(sprintf('  [%s] %s: 패키지 식별자 비어있음 — 건너뜀', $table, $tenantSlug));

            return [0, 0, []];
        }

        $prefix = (string) DB::connection()->getTablePrefix();
        $physicalTable = $prefix.$table;
        $tenantPdo = DB::connection()->getPdo();
        $columns = Schema::connection($tenantConn)->getColumnListing($table);
        $columnsNoId = array_values(array_diff($columns, ['id']));
        $columnListNoId = '`'.implode('`,`', $columnsNoId).'`';

        foreach ($identifiersToEnsure as $identifier) {
            $identifier = trim((string) $identifier);
            if ($identifier === '') {
                continue;
            }

            $existing = DB::table($table)->where('identifier', $identifier)->first();
            if ($existing === null) {
                try {
                    $check = $tenantPdo->prepare("SELECT 1 FROM `{$sourceDb}`.`{$physicalTable}` WHERE `identifier` = ? LIMIT 1");
                    $check->execute([$identifier]);
                    $sourceExists = (bool) $check->fetchColumn();
                } catch (\Throwable $e) {
                    $errors[] = sprintf('%s/%s(%s): source check err=%s', $tenantSlug, $table, $identifier, $e->getMessage());

                    continue;
                }

                if (! $sourceExists) {
                    if ($insertOnly) {
                        $this->line(sprintf(
                            '  [%s] %s: [SKIP] %s (source DB %s 미존재 — insert-only)',
                            $table,
                            $tenantSlug,
                            $identifier,
                            $sourceDb,
                        ));

                        continue;
                    }
                    $errors[] = sprintf('%s/%s(%s): source DB(%s) 미존재', $tenantSlug, $table, $identifier, $sourceDb);
                    continue;
                }

                $this->line(sprintf('  [%s] %s: [INSERT] %s (from %s)', $table, $tenantSlug, $identifier, $sourceDb));
                if (! $dryRun) {
                    try {
                        $sql = "INSERT INTO `{$tenantDb}`.`{$physicalTable}` ({$columnListNoId}) "
                            ."SELECT {$columnListNoId} FROM `{$sourceDb}`.`{$physicalTable}` WHERE `identifier` = ?";
                        $stmt = $tenantPdo->prepare($sql);
                        $stmt->execute([$identifier]);
                        // insert-only(가용성): 신규 row 는 inactive — 테넌트 on/off 자율.
                        // provision(!insertOnly): source 스냅샷 status 유지 후 active 보장 경로와 맞춤.
                        if ($insertOnly) {
                            DB::table($table)->where('identifier', $identifier)->update([
                                'status' => 'inactive',
                                'updated_at' => now(),
                            ]);
                        } else {
                            DB::table($table)->where('identifier', $identifier)->update([
                                'status' => 'active',
                                'updated_at' => now(),
                            ]);
                        }
                        $inserted++;
                    } catch (\Throwable $e) {
                        $errors[] = sprintf('%s/%s(%s): insert err=%s', $tenantSlug, $table, $identifier, $e->getMessage());
                    }
                } else {
                    $inserted++;
                }

                continue;
            }

            if ($insertOnly) {
                $this->line(sprintf(
                    '  [%s] %s: [OK] %s status=%s (insert-only — on/off 유지)',
                    $table,
                    $tenantSlug,
                    $identifier,
                    (string) ($existing->status ?? ''),
                ));

                continue;
            }

            if ((string) ($existing->status ?? '') !== 'active') {
                $this->line(sprintf('  [%s] %s: [ACTIVATE] %s', $table, $tenantSlug, $identifier));
                if (! $dryRun) {
                    try {
                        DB::table($table)->where('identifier', $identifier)->update(['status' => 'active', 'updated_at' => now()]);
                        $activated++;
                    } catch (\Throwable $e) {
                        $errors[] = sprintf('%s/%s(%s): activate err=%s', $tenantSlug, $table, $identifier, $e->getMessage());
                    }
                } else {
                    $activated++;
                }
            } else {
                $this->line(sprintf('  [%s] %s: [OK] %s 이미 active', $table, $tenantSlug, $identifier));
            }
        }

        return [$inserted, $activated, $errors];
    }

    /**
     * @param  list<string>  $pluginsToEnsure
     * @return array{0:int,1:int,2:list<string>}
     */
    private function repairPlugins(
        string $tenantSlug,
        string $tenantDb,
        array $pluginsToEnsure,
        string $sourceDb,
        bool $dryRun,
        bool $insertOnly = false,
    ): array
    {
        $errors = [];
        $inserted = 0;
        $activated = 0;

        $tenantConn = DB::getDefaultConnection();
        if (! Schema::connection($tenantConn)->hasTable('plugins')) {
            $errors[] = sprintf('%s: plugins 테이블 누락', $tenantSlug);

            return [0, 0, $errors];
        }

        if ($pluginsToEnsure === []) {
            $this->line(sprintf('  [plugins] %s: 패키지·--plugin 둘 다 비어있음 — 건너뜀', $tenantSlug));

            return [0, 0, $errors];
        }

        $tenantDbName = $tenantDb;
        if ($tenantDbName === '' || $sourceDb === '') {
            $errors[] = sprintf('%s: db name 미해결 (source=%s tenant=%s)', $tenantSlug, $sourceDb, $tenantDbName);

            return [0, 0, $errors];
        }

        // DB_PREFIX (예: g7_) 를 raw SQL 에도 반드시 반영해야 함.
        $prefix = (string) DB::connection()->getTablePrefix();
        $pluginsTable = $prefix.'plugins';

        // source DB 의 plugins 테이블 존재 검증 — same MySQL instance, cross-DB SELECT 가능.
        $tenantPdo = DB::connection()->getPdo();
        try {
            $check = $tenantPdo->prepare("SELECT COUNT(*) FROM `{$sourceDb}`.`{$pluginsTable}` LIMIT 1");
            $check->execute();
            $check->fetchColumn();
        } catch (\Throwable $e) {
            $errors[] = sprintf('%s: source DB(%s).%s 접근 실패 (%s)', $tenantSlug, $sourceDb, $pluginsTable, $tenantSlug, $e->getMessage());

            return [0, 0, $errors];
        }

        $columns = Schema::connection($tenantConn)->getColumnListing('plugins');
        $columnsNoId = array_values(array_diff($columns, ['id']));
        $columnListNoId = '`'.implode('`,`', $columnsNoId).'`';

        foreach ($pluginsToEnsure as $identifier) {
            $identifier = trim($identifier);
            if ($identifier === '') {
                continue;
            }

            $existing = DB::table('plugins')->where('identifier', $identifier)->first();
            if ($existing === null) {
                // source DB 에 존재하는지 cross-DB 확인.
                $sourceRow = null;
                try {
                    $stmt = $tenantPdo->prepare("SELECT 1 FROM `{$sourceDb}`.`{$pluginsTable}` WHERE identifier = ? LIMIT 1");
                    $stmt->execute([$identifier]);
                    $sourceRow = $stmt->fetchColumn();
                } catch (\Throwable $e) {
                    $errors[] = sprintf('%s/%s: source check err=%s', $tenantSlug, $identifier, $e->getMessage());

                    continue;
                }

                if (! $sourceRow) {
                    if ($insertOnly) {
                        $this->line(sprintf(
                            '  [plugins] %s: [SKIP] %s (source DB %s 미존재 — insert-only)',
                            $tenantSlug,
                            $identifier,
                            $sourceDb,
                        ));

                        continue;
                    }
                    $errors[] = sprintf('%s/%s: source DB(%s) 에도 없음 — skip', $tenantSlug, $identifier, $sourceDb);
                    $this->line(sprintf('  [plugins] %s: [SKIP] %s (source DB %s 미존재)', $tenantSlug, $identifier, $sourceDb));

                    continue;
                }

                $this->line(sprintf('  [plugins] %s: [INSERT] %s (from %s)', $tenantSlug, $identifier, $sourceDb));
                if (! $dryRun) {
                    try {
                        // id 자동 채번. 그 외 컬럼 전체 복사.
                        $sql = "INSERT INTO `{$tenantDbName}`.`{$pluginsTable}` ({$columnListNoId}) "
                            ."SELECT {$columnListNoId} FROM `{$sourceDb}`.`{$pluginsTable}` WHERE identifier = ?";
                        $stmt = $tenantPdo->prepare($sql);
                        $stmt->execute([$identifier]);

                        // insert-only(가용성): 신규 row 는 inactive — 테넌트 on/off 자율.
                        // provision(!insertOnly): source 에서 복사한 status 유지 (마스터 스냅샷).
                        if ($insertOnly) {
                            DB::table('plugins')->where('identifier', $identifier)->update([
                                'status' => 'inactive',
                                'updated_at' => now(),
                            ]);
                        }

                        $inserted++;
                    } catch (\Throwable $e) {
                        $errors[] = sprintf('%s/%s: insert err=%s', $tenantSlug, $identifier, $e->getMessage());
                    }
                } else {
                    $inserted++;
                }

                continue;
            }

            if ($insertOnly) {
                $this->line(sprintf(
                    '  [plugins] %s: [OK]  %s status=%s (insert-only — on/off 유지)',
                    $tenantSlug,
                    $identifier,
                    (string) ($existing->status ?? ''),
                ));

                continue;
            }

            if ((string) ($existing->status ?? '') !== 'active') {
                $this->line(sprintf('  [plugins] %s: [ACTIVATE] %s (status=%s → active)', $tenantSlug, $identifier, (string) ($existing->status ?? '')));
                if (! $dryRun) {
                    try {
                        DB::table('plugins')->where('identifier', $identifier)->update(['status' => 'active', 'updated_at' => now()]);
                        $activated++;
                    } catch (\Throwable $e) {
                        $errors[] = sprintf('%s/%s: activate err=%s', $tenantSlug, $identifier, $e->getMessage());
                    }
                } else {
                    $activated++;
                }
            } else {
                $this->line(sprintf('  [plugins] %s: [OK]  %s 이미 active', $tenantSlug, $identifier));
            }
        }

        return [$inserted, $activated, $errors];
    }

    /**
     * tenant 에서 platform 전용/레거시 금지 메뉴를 물리 삭제한다.
     *
     * @return array{0:int,1:list<string>}
     */
    private function purgeTenantForbiddenMenus(string $tenantSlug, bool $dryRun): array
    {
        $errors = [];
        $tenantConn = DB::getDefaultConnection();
        if (! Schema::connection($tenantConn)->hasTable('menus')) {
            return [0, [sprintf('%s: menus 테이블 누락', $tenantSlug)]];
        }

        $purgeSlugs = array_values(array_unique(array_merge(
            TenantAdminMenuPolicy::FORBIDDEN_SLUGS,
            TenantAdminMenuPolicy::DEPRECATED_SLUGS,
        )));
        $forbiddenRows = DB::table('menus')
            ->whereIn('slug', $purgeSlugs)
            ->get(['id', 'slug']);
        $forbiddenMenuIds = $forbiddenRows
            ->pluck('id')
            ->map(fn ($id): int => (int) $id)
            ->values()
            ->all();
        $forbiddenSlugs = $forbiddenRows
            ->pluck('slug')
            ->map(fn ($slug): string => trim((string) $slug))
            ->filter(fn (string $slug): bool => $slug !== '')
            ->values()
            ->all();

        $this->line(sprintf(
            '  [menu-purge] %s: forbidden-found=%d',
            $tenantSlug,
            count($forbiddenMenuIds),
        ));

        if ($forbiddenMenuIds === []) {
            return [0, $errors];
        }

        foreach ($forbiddenSlugs as $slug) {
            $this->line(sprintf('  [menu-purge] %s: [PURGE] %s', $tenantSlug, $slug));
        }

        if ($dryRun) {
            return [count($forbiddenMenuIds), $errors];
        }

        try {
            if (Schema::connection($tenantConn)->hasTable('role_menus')) {
                DB::table('role_menus')->whereIn('menu_id', $forbiddenMenuIds)->delete();
            }
            DB::table('menus')->whereIn('id', $forbiddenMenuIds)->delete();

            return [count($forbiddenMenuIds), $errors];
        } catch (\Throwable $e) {
            $errors[] = sprintf('%s: menu purge err=%s', $tenantSlug, $e->getMessage());

            return [0, $errors];
        }
    }

    /**
     * @return list<TenantRecord>
     */
    private function loadTenants(string $slugArg): array
    {
        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenants')) {
            return [];
        }

        $query = DB::connection('moabom_platform')->table('moabom_saas_tenants');
        // 전체: 인자 생략 · __all__ · 레거시 * (Cloud Run Job 인자로는 * 금지 RF-12)
        if ($slugArg !== '' && $slugArg !== '*' && $slugArg !== '__all__') {
            $query->where('slug', $slugArg);
        } else {
            $query->where('status', 'active');
        }

        $rows = $query->orderBy('slug')->get();

        return $rows->map(fn ($row) => TenantRecord::fromRow((array) $row))->all();
    }

    /**
     * source DB 의 active 식별자 목록 조회.
     *
     * @return list<string>
     */
    private function fetchActiveIdentifiersFromSource(string $sourceDb, string $table): array
    {
        if ($sourceDb === '' || ! in_array($table, ['modules', 'plugins', 'templates'], true)) {
            return [];
        }

        $prefix = (string) DB::connection()->getTablePrefix();
        $physicalTable = $prefix.$table;
        $tenantPdo = DB::connection()->getPdo();
        try {
            $stmt = $tenantPdo->prepare(
                "SELECT `identifier` FROM `{$sourceDb}`.`{$physicalTable}` WHERE `status` = 'active'"
            );
            $stmt->execute();

            $identifiers = [];
            while (($identifier = $stmt->fetchColumn()) !== false) {
                $identifier = trim((string) $identifier);
                if ($identifier !== '') {
                    $identifiers[] = $identifier;
                }
            }

            sort($identifiers);

            return array_values(array_unique($identifiers));
        } catch (\Throwable) {
            return [];
        }
    }
}
