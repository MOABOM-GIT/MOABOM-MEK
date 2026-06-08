<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Modules\Moabom\System\Saas\TenantRegistry;
use Modules\Moabom\System\Saas\TenantSettingsSeeder;

/**
 * 운영 — tenant GCS general.json 을 레지스트리 display name 기준으로 복구.
 */
class SaasTenantReseedSettingsCommand extends Command
{
    protected $signature = 'moabom:saas:tenant-reseed-settings
        {slug : 테넌트 slug}
        {--name= : site_name (기본: 레지스트리 name)}';

    protected $description = 'tenant settings/general.json GCS 시드 복구';

    public function handle(TenantRegistry $registry, TenantSettingsSeeder $seeder): int
    {
        $slug = strtolower((string) $this->argument('slug'));
        $tenant = $registry->findBySlug($slug);
        if ($tenant === null) {
            $this->error("레지스트리에 없음: {$slug}");

            return self::FAILURE;
        }

        $name = trim((string) $this->option('name'));
        if ($name === '') {
            $name = $tenant->slug;
        }

        $seeder->seed($tenant, ['name' => $name, 'app_url' => $tenant->appUrl]);

        $this->info("OK: tenants/{$slug}/settings/general.json site_name={$name}");

        return self::SUCCESS;
    }
}
