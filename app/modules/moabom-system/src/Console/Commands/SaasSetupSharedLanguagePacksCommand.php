<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;
use Modules\Moabom\System\Saas\SaasMysqlPdoFactory;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Saas\TenantSharedLanguagePackSchema;

/**
 * A안 — 테넌트 DB 의 language_packs 를 platform 단일 SSOT VIEW 로 전환(또는 롤백).
 *
 * 사용:
 *   php artisan moabom:saas:setup-shared-language-packs            # 모든 active tenant → VIEW
 *   php artisan moabom:saas:setup-shared-language-packs freshent   # 1건만
 *   php artisan moabom:saas:setup-shared-language-packs --revert    # VIEW → TABLE (mirror 경로 복귀)
 *
 * idempotent. `shared_language_packs` 플래그가 off 여도 명시 전환/롤백은 수행한다
 * (단, 자동 경로[mirror/reconcile]는 플래그를 따른다).
 */
final class SaasSetupSharedLanguagePacksCommand extends Command
{
    protected $signature = 'moabom:saas:setup-shared-language-packs
        {slug? : 생략·* = 모든 active tenant, 또는 slug 1건}
        {--revert : VIEW → TABLE 롤백 (platform 데이터 복사 후 mirror 경로 복귀)}';

    protected $description = 'A안 — 테넌트 language_packs 를 platform read-through VIEW 로 전환/롤백';

    public function handle(
        PlatformConnectionFactory $platformConnections,
        PlatformRuntimeConfigurator $platformRuntimeConfigurator,
        TenantDatabaseConfigurator $databaseConfigurator,
        TenantContext $tenantContext,
        TenantSharedLanguagePackSchema $sharedSchema,
    ): int {
        if (! config('moabom-system.saas.enabled', false)) {
            $this->warn('MOABOM_SAAS_ENABLED=false — 건너뜀');

            return self::SUCCESS;
        }

        $revert = (bool) $this->option('revert');
        $slugArg = (string) ($this->argument('slug') ?? '*');
        if ($slugArg === '' || $slugArg === 'all') {
            $slugArg = '*';
        }

        $platformConnections->registerConnection();
        $platformRuntimeConfigurator->applyPlatform();
        $platformDb = SaasMysqlPdoFactory::platformWriteDatabase();

        $tenants = $this->loadTenants($slugArg);
        if ($tenants === []) {
            $this->error('대상 tenant 없음.');

            return self::FAILURE;
        }

        $this->info(sprintf('mode=%s target=%s platformDb=%s', $revert ? 'REVERT(view→table)' : 'SHARED(table→view)', $slugArg, $platformDb));

        $errors = [];
        try {
            foreach ($tenants as $tenant) {
                try {
                    $databaseConfigurator->apply($tenant);
                    $tenantContext->setTenant($tenant, $tenant->host);

                    $result = $revert
                        ? $sharedSchema->revertToTableForTenantDb($tenant->dbDatabase, $platformDb)
                        : $sharedSchema->ensureViewForTenantDb($tenant->dbDatabase, $platformDb);

                    $this->line(sprintf('  %s: %s', $tenant->slug, json_encode($result, JSON_UNESCAPED_UNICODE)));
                } catch (\Throwable $e) {
                    $errors[] = sprintf('%s: %s', $tenant->slug, $e->getMessage());
                    $this->error('  '.$tenant->slug.': '.$e->getMessage());
                }
            }
        } finally {
            $platformRuntimeConfigurator->applyPlatform();
        }

        $this->info(sprintf('done tenants=%d errors=%d', count($tenants), count($errors)));

        return $errors === [] ? self::SUCCESS : self::FAILURE;
    }

    /**
     * @return list<TenantRecord>
     */
    private function loadTenants(string $slugArg): array
    {
        if (! \Illuminate\Support\Facades\Schema::connection('moabom_platform')->hasTable('moabom_saas_tenants')) {
            return [];
        }

        $query = \Illuminate\Support\Facades\DB::connection('moabom_platform')->table('moabom_saas_tenants');
        if ($slugArg !== '*' && $slugArg !== '') {
            $query->where('slug', $slugArg);
        } else {
            $query->where('status', 'active');
        }

        return $query->orderBy('slug')->get()
            ->map(fn ($row) => TenantRecord::fromRow((array) $row))
            ->all();
    }
}
