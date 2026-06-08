<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Modules\Moabom\System\Saas\TenantIdentityBootstrapper;
use Modules\Moabom\System\Saas\TenantRegistry;

/**
 * 기존 tenant DB에 코어 identity baseline만 주입 (legacy clone → provision v2 호환).
 *
 * users·콘텐츠는 건드리지 않고 roles/permissions/admin 1명만 복사한다.
 */
class SaasTenantBootstrapIdentityCommand extends Command
{
    protected $signature = 'moabom:saas:tenant-bootstrap-identity
        {slug : 테넌트 slug}
        {--email=admin@moabom.com : admin email}
        {--source-db= : identity source DB (기본 schema_source_db)}';

    protected $description = '기존 tenant DB — identity baseline (roles + admin) 주입';

    public function handle(
        TenantRegistry $registry,
        TenantIdentityBootstrapper $bootstrapper,
    ): int {
        $slug = strtolower((string) $this->argument('slug'));
        $email = trim((string) $this->option('email'));
        $sourceDb = trim((string) ($this->option('source-db')
            ?? config('moabom-system.saas.provision.schema_source_db', 'moabom-db')));

        $tenant = $registry->findBySlug($slug);
        if ($tenant === null) {
            $this->error("레지스트리에 없음: {$slug}");

            return self::FAILURE;
        }

        $this->info("identity bootstrap: {$sourceDb} → {$tenant->dbDatabase} (admin={$email})");
        $bootstrapper->bootstrap($sourceDb, $tenant->dbDatabase, $email);
        $this->info('✅ tenant identity baseline 완료');

        return self::SUCCESS;
    }
}
