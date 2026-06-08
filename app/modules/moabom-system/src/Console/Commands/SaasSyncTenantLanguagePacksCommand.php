<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;
use Modules\Moabom\System\Saas\TenantLanguagePackMirror;
use Modules\Moabom\System\Saas\TenantRecord;

/**
 * Platform(moabom-db) language_packs → tenant DB mirror.
 */
final class SaasSyncTenantLanguagePacksCommand extends Command
{
    protected $signature = 'moabom:saas:sync-tenant-language-packs
        {slug? : 생략·* = 모든 active tenant, 또는 slug 1건}';

    protected $description = 'Tenant DB language_packs mirror (platform SSOT → tenant)';

    public function handle(
        TenantLanguagePackMirror $mirror,
        PlatformConnectionFactory $platformConnections,
        PlatformRuntimeConfigurator $platformRuntimeConfigurator,
    ): int {
        if (! config('moabom-system.saas.enabled', false)) {
            $this->warn('MOABOM_SAAS_ENABLED=false — 건너뜀');

            return self::SUCCESS;
        }

        Artisan::call('moabom:saas:platform-migrate', ['--force' => true]);
        $platformConnections->registerConnection();

        $slugArg = (string) ($this->argument('slug') ?? '*');
        if ($slugArg === '' || $slugArg === 'all') {
            $slugArg = '*';
        }

        if ($slugArg === '*') {
            $tenants = $this->loadActiveTenants();
            $synced = 0;
            $errors = [];

            foreach ($tenants as $tenant) {
                try {
                    $mirror->mirrorForTenant($tenant);
                    $synced++;
                    $this->line("  {$tenant->slug}: mirrored");
                } catch (\Throwable $e) {
                    $errors[] = "{$tenant->slug}: {$e->getMessage()}";
                }
            }

            $platformRuntimeConfigurator->applyPlatform();
            $this->info(sprintf('tenants=%d mirrored=%d errors=%d', count($tenants), $synced, count($errors)));
            foreach ($errors as $error) {
                $this->error('  '.$error);
            }

            return $errors === [] ? self::SUCCESS : self::FAILURE;
        }

        $tenant = $this->loadTenant($slugArg);
        if ($tenant === null) {
            $this->error("tenant 없음: {$slugArg}");

            return self::FAILURE;
        }

        $mirror->mirrorForTenant($tenant);
        $platformRuntimeConfigurator->applyPlatform();
        $this->info("{$tenant->slug}: language_packs mirrored");

        return self::SUCCESS;
    }

    /**
     * @return list<TenantRecord>
     */
    private function loadActiveTenants(): array
    {
        $rows = \Illuminate\Support\Facades\DB::connection('moabom_platform')
            ->table('moabom_saas_tenants')
            ->where('status', 'active')
            ->orderBy('slug')
            ->get();

        return $rows->map(fn ($row) => TenantRecord::fromRow((array) $row))->all();
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
