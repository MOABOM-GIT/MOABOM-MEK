<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Support;

use Modules\Moabom\Apps\Models\GeneratedApp;

/**
 * Hosted row·localStorage 격리 키 — 회원(tenant_slug + user_id) 단위.
 */
final readonly class GeneratedAppDataScope
{
    public function __construct(
        public int $appId,
        public int $userId,
        public string $tenantSlug,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function fromAccessPayload(GeneratedApp $app, array $payload): ?self
    {
        $appId = (int) ($payload['app_id'] ?? 0);
        $userId = (int) ($payload['user_id'] ?? 0);
        $tenantScope = trim((string) ($payload['tenant_scope'] ?? ''));
        $exp = (int) ($payload['exp'] ?? 0);

        if ($appId !== (int) $app->id || $userId <= 0 || $exp < time()) {
            return null;
        }

        if (! self::tenantScopeMatches($app, $tenantScope)) {
            return null;
        }

        return new self(
            appId: $appId,
            userId: $userId,
            tenantSlug: $tenantScope !== '' ? $tenantScope : self::appTenantSlug($app),
        );
    }

    public function storageKeyPrefix(): string
    {
        return 'ga'.$this->appId.'.t'.$this->tenantSlug.'.u'.$this->userId.'.';
    }

    private static function tenantScopeMatches(GeneratedApp $app, string $scope): bool
    {
        $expectedScope = GeneratedAppPreviewRouting::tenantScopeKey();
        $tenantSlug = self::appTenantSlug($app);

        return $scope === $expectedScope
            || ($scope === 'default' && $expectedScope === 'default')
            || ($tenantSlug !== '' && $scope === $tenantSlug);
    }

    private static function appTenantSlug(GeneratedApp $app): string
    {
        $slug = trim((string) ($app->tenant_slug ?? ''));

        return $slug !== '' ? $slug : 'default';
    }
}
