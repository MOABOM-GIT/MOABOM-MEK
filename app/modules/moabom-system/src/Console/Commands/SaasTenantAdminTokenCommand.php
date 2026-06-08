<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRegistry;

/**
 * E2E·smoke — tenant DB context에서 Sanctum admin token 발급.
 */
class SaasTenantAdminTokenCommand extends Command
{
    protected $signature = 'moabom:saas:tenant-admin-token
        {slug : 테넌트 slug}
        {--email=admin@moabom.com : admin 사용자 email}';

    protected $description = '테넌트 DB admin Sanctum token (E2E·smoke)';

    public function handle(
        TenantRegistry $registry,
        TenantDatabaseConfigurator $databaseConfigurator,
    ): int {
        $slug = strtolower((string) $this->argument('slug'));
        $email = trim((string) $this->option('email'));

        $tenant = $registry->findBySlug($slug);
        if ($tenant === null) {
            $this->error("레지스트리에 없음: {$slug}");

            return self::FAILURE;
        }

        $databaseConfigurator->apply($tenant);

        $user = User::query()->where('email', $email)->first();
        if ($user === null) {
            $this->error("tenant DB admin 없음: {$email} (db={$tenant->dbDatabase})");

            return self::FAILURE;
        }

        $this->line($user->createToken('saas-tenant-admin-token')->plainTextToken);

        return self::SUCCESS;
    }
}
