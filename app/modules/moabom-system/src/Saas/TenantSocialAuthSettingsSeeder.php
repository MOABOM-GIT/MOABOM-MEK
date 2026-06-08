<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Modules\Moabom\Social\Auth\Services\TenantSocialAuthDatabaseSeeder;

/**
 * 신규/기존 tenant DB에 moabom-social-auth provider 기본 row를 시드한다.
 *
 * SSOT: tenant DB `social_auth_settings` (enabled/on-off만 tenant 로컬, credential 은 마스터 상속).
 */
final class TenantSocialAuthSettingsSeeder
{
    public function __construct(
        private readonly TenantDatabaseConfigurator $databaseConfigurator,
        private readonly PlatformRuntimeConfigurator $platformRuntimeConfigurator,
    ) {}

    /**
     * @return array{seeded: bool, source: string, created?: list<string>, reason?: string}
     */
    public function seedFromPlatformMaster(TenantRecord $tenant): array
    {
        if (! class_exists(TenantSocialAuthDatabaseSeeder::class)) {
            return [
                'seeded' => false,
                'source' => 'module_unavailable',
                'reason' => 'moabom-social-auth module is not loaded',
            ];
        }

        $this->databaseConfigurator->apply($tenant);

        try {
            /** @var TenantSocialAuthDatabaseSeeder $seeder */
            $seeder = app(TenantSocialAuthDatabaseSeeder::class);
            $result = $seeder->seedDefaults();

            return [
                'seeded' => (bool) ($result['seeded'] ?? false),
                'source' => (string) ($result['source'] ?? 'unknown'),
                'created' => is_array($result['created'] ?? null) ? $result['created'] : [],
                'reason' => isset($result['reason']) ? (string) $result['reason'] : null,
            ];
        } finally {
            $this->platformRuntimeConfigurator->applyPlatform();
        }
    }
}
