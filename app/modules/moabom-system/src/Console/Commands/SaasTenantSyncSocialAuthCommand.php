<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Saas\TenantRegistry;
use Modules\Moabom\System\Saas\TenantSocialAuthSettingsSeeder;

/**
 * tenant DB에 SNS provider 기본 row(use_master_defaults)를 seed/정규화한다.
 */
class SaasTenantSyncSocialAuthCommand extends Command
{
    protected $signature = 'moabom:saas:tenant-sync-social-auth
        {tenant? : 테넌트 slug 또는 host (예: freshent, freshent.mek360.com)}
        {--all : active 테넌트 전체 백필}';

    protected $description = 'tenant social-auth provider 기본 row를 DB에 seed/정규화 (마스터 credential 상속)';

    public function handle(TenantRegistry $registry, TenantSocialAuthSettingsSeeder $seeder): int
    {
        if ((bool) $this->option('all')) {
            return $this->syncAllTenants($registry, $seeder);
        }

        $tenantArg = strtolower(trim((string) $this->argument('tenant')));
        if ($tenantArg === '') {
            $this->error('tenant 값 또는 --all 옵션이 필요합니다.');

            return self::FAILURE;
        }

        $tenant = $this->resolveTenant($registry, $tenantArg);
        if ($tenant === null) {
            $this->error("레지스트리에 없는 tenant: {$tenantArg}");
            $this->line('힌트: moabom:saas:tenant-show {slug} 또는 --all');

            return self::FAILURE;
        }

        return $this->syncTenant($seeder, $tenant);
    }

    private function syncAllTenants(TenantRegistry $registry, TenantSocialAuthSettingsSeeder $seeder): int
    {
        $tenants = $registry->listActive();
        if ($tenants === []) {
            $this->warn('active tenant 가 없습니다.');

            return self::FAILURE;
        }

        $failed = 0;
        foreach ($tenants as $tenant) {
            $exitCode = $this->syncTenant($seeder, $tenant, false);
            if ($exitCode !== self::SUCCESS) {
                $failed++;
            }
        }

        if ($failed > 0) {
            $this->warn('완료: '.(count($tenants) - $failed).' 성공, '.$failed.' 실패');

            return self::FAILURE;
        }

        $this->info('OK: active tenant '.count($tenants).'개 SNS DB seed 완료');

        return self::SUCCESS;
    }

    private function syncTenant(
        TenantSocialAuthSettingsSeeder $seeder,
        TenantRecord $tenant,
        bool $single = true,
    ): int {
        $result = $seeder->seedFromPlatformMaster($tenant);

        if (! $result['seeded']) {
            $reason = $result['reason'] ?? $result['source'];
            if ($single) {
                $this->warn("SNS 설정 seed 실패/스킵: {$reason}");
            } else {
                $this->warn("[{$tenant->slug}] SNS seed 실패/스킵: {$reason}");
            }

            return self::FAILURE;
        }

        $created = $result['created'] ?? [];
        $createdText = $created === [] ? 'existing-normalized' : implode(',', $created);
        $message = "[{$tenant->slug}] social-auth DB seed OK (source={$result['source']}, created={$createdText})";

        if ($single) {
            $this->info("OK: {$tenant->slug} social-auth DB seed 완료 (source={$result['source']}, created={$createdText})");
        } else {
            $this->line($message);
        }

        return self::SUCCESS;
    }

    private function resolveTenant(TenantRegistry $registry, string $tenantArg): ?TenantRecord
    {
        $tenant = str_contains($tenantArg, '.')
            ? $registry->findByHost($tenantArg)
            : $registry->findBySlug($tenantArg);

        if ($tenant === null && ! str_contains($tenantArg, '.')) {
            $candidateHost = "{$tenantArg}.".((string) config('moabom-system.saas.base_domain', 'mek360.com'));
            $tenant = $registry->findByHost($candidateHost);
        }

        return $tenant;
    }
}
