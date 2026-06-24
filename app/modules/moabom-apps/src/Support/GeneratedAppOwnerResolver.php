<?php

namespace Modules\Moabom\Apps\Support;

use App\Models\User;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\System\Saas\SaasMysqlPdoFactory;
use Modules\Moabom\System\Saas\TenantDatabaseConfigurator;
use Modules\Moabom\System\Saas\TenantRegistry;

/**
 * platform DB 생성앱 → tenant_slug 기준 올바른 users DB 에서 소유자 조회.
 */
final class GeneratedAppOwnerResolver
{
    public function __construct(
        private readonly TenantRegistry $tenantRegistry,
        private readonly TenantDatabaseConfigurator $databaseConfigurator,
    ) {}

    public function nickname(GeneratedApp $app): string
    {
        $metadata = is_array($app->metadata) ? $app->metadata : [];
        $cached = trim((string) ($metadata['owner_nickname'] ?? ''));
        if ($cached !== '') {
            return $cached;
        }

        $user = $this->resolveUser($app);
        $nickname = trim((string) ($user?->nickname ?: ($user?->name ?: '')));

        return $nickname !== '' ? $nickname : '';
    }

    public function resolveUser(GeneratedApp $app): ?User
    {
        if (! GeneratedAppsConnection::usesPlatformStore()) {
            if ($app->relationLoaded('user')) {
                return $app->user;
            }

            return $app->user()->first();
        }

        $slug = trim((string) ($app->tenant_slug ?? ''));
        if ($slug === '' || $slug === 'default') {
            return $this->userFromDatabase($this->mainWriteDatabase(), (int) $app->user_id);
        }

        if ($slug === 'platform') {
            return $this->userFromDatabase($this->mainWriteDatabase(), (int) $app->user_id);
        }

        $tenant = $this->tenantRegistry->findBySlug($slug);
        if ($tenant === null) {
            return null;
        }

        return $this->userFromDatabase($tenant->dbDatabase, (int) $app->user_id);
    }

    private function userFromDatabase(string $database, int $userId): ?User
    {
        if ($database === '' || $userId <= 0) {
            return null;
        }

        return $this->databaseConfigurator->runOnDatabase(
            $database,
            static fn (): ?User => User::query()->whereKey($userId)->first(),
        );
    }

    private function mainWriteDatabase(): string
    {
        $write = SaasMysqlPdoFactory::writeSlice();

        return (string) ($write['database'] ?? '');
    }
}
