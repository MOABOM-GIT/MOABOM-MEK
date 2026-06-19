<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Modules\Moabom\System\Saas\TenantAdminMenuSynchronizer;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;

/**
 * 모든 active tenant 에 Host-aware moabom-system 메뉴 동기화 + platform 메뉴 오염 제거.
 */
final class SaasSyncTenantAdminMenusCommand extends Command
{
    protected $signature = 'moabom:saas:sync-tenant-admin-menus
        {slug? : 생략·* = 모든 active tenant, 또는 slug 1건}';

    protected $description = 'Platform/Tenant admin 메뉴·언어팩 SSOT 동기화 (core·확장·order 정규화)';

    public function handle(
        TenantAdminMenuSynchronizer $synchronizer,
        TenantDatabaseConfigurator $databaseConfigurator,
    ): int {
        if (! config('moabom-system.saas.enabled', false)) {
            $this->warn('MOABOM_SAAS_ENABLED=false — 건너뜀');

            return self::SUCCESS;
        }

        $slugArg = (string) ($this->argument('slug') ?? '*');
        if ($slugArg === '' || $slugArg === 'all') {
            $slugArg = '*';
        }

        if ($slugArg === '*') {
            $summary = $synchronizer->syncAllActiveTenants();
            $repairCode = $this->repairRoleMenus('*');
            $this->info(sprintf(
                'platform=%s tenants=%d synced=%d purged=%d linked=%d role_menus_repair=%s errors=%d',
                ($summary['platform_synced'] ?? false) ? 'yes' : 'no',
                $summary['tenants'],
                $summary['synced'],
                $summary['purged'],
                $summary['linked'],
                $repairCode === self::SUCCESS ? 'ok' : 'failed',
                count($summary['errors']),
            ));
            foreach ($summary['errors'] as $error) {
                $this->error('  '.$error);
            }

            return count($summary['errors']) === 0 && $repairCode === self::SUCCESS ? self::SUCCESS : self::FAILURE;
        }

        $tenant = $this->loadTenant($slugArg);
        if ($tenant === null) {
            $this->error("tenant 없음: {$slugArg}");

            return self::FAILURE;
        }

        $result = $synchronizer->syncForTenant($tenant);
        $hygiene = $result['hygiene'];
        $this->info(sprintf(
            '%s: synced=%s purged=%d linked=%d',
            $tenant->slug,
            $result['synced'] ? 'yes' : 'no',
            $hygiene['purged'] ?? 0,
            $hygiene['linked'] ?? 0,
        ));

        return $this->repairRoleMenus($tenant->slug);
    }

    private function repairRoleMenus(string $slug): int
    {
        return Artisan::call('moabom:saas:tenant-repair', [
            'slug' => $slug,
            '--apply' => true,
            '--skip-menu-rows' => true,
            '--skip-purge-tenant-forbidden-menus' => true,
            '--skip-modules' => true,
            '--skip-templates' => true,
            '--skip-plugins' => true,
            '--skip-legal-pages' => true,
            '--skip-language-packs' => true,
            '--no-interaction' => true,
        ], $this->output);
    }

    private function loadTenant(string $slug): ?TenantRecord
    {
        $row = \Illuminate\Support\Facades\DB::connection('moabom_platform')
            ->table('moabom_saas_tenants')
            ->where('slug', $slug)
            ->first();

        return $row !== null ? TenantRecord::fromRow((array) $row) : null;
    }
}
