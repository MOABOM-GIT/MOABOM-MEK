<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Support;

use Illuminate\Database\Eloquent\Builder;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\System\Saas\TenantHostParser;
use Modules\Moabom\System\Saas\TenantRequestHost;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * 생성앱 admin API — Host 기준 scope SSOT (platform 전체 · tenant 고정).
 */
final class GeneratedAppAdminScope
{
    public const MODE_PLATFORM = 'platform';

    public const MODE_TENANT = 'tenant';

    private function __construct(
        public readonly string $mode,
        public readonly ?string $tenantSlug,
    ) {}

    public static function fromRequest(): self
    {
        if (! config('moabom-system.saas.enabled', false)) {
            return new self(self::MODE_PLATFORM, null);
        }

        $parser = new TenantHostParser(
            (string) config('moabom-system.saas.base_domain', 'mek360.com'),
            (array) config('moabom-system.saas.platform_hosts', []),
        );
        $parsed = $parser->parse(TenantRequestHost::resolve());

        if ($parsed['type'] === 'tenant' && is_string($parsed['slug'] ?? null) && $parsed['slug'] !== '') {
            return new self(self::MODE_TENANT, $parsed['slug']);
        }

        return new self(self::MODE_PLATFORM, null);
    }

    public function isPlatform(): bool
    {
        return $this->mode === self::MODE_PLATFORM;
    }

    /**
     * @param  Builder<GeneratedApp>  $query
     */
    public function applyToQuery(Builder $query): void
    {
        if ($this->mode === self::MODE_TENANT && $this->tenantSlug !== null && $this->tenantSlug !== '') {
            $query->where('tenant_slug', $this->tenantSlug);
        }
    }

    public function assertCanManage(GeneratedApp $app): void
    {
        if ($this->mode !== self::MODE_TENANT) {
            return;
        }

        if ($this->tenantSlug === null || trim((string) $app->tenant_slug) !== $this->tenantSlug) {
            throw new NotFoundHttpException;
        }
    }

    public function resolveFilterTenantSlug(?string $requested): ?string
    {
        if ($this->mode === self::MODE_TENANT) {
            return $this->tenantSlug;
        }

        $slug = trim((string) ($requested ?? ''));

        return $slug !== '' ? $slug : null;
    }

    /**
     * @return array<string, mixed>
     */
    public function listMeta(): array
    {
        return [
            'scope' => $this->mode,
            'tenant_slug' => $this->tenantSlug,
            'abilities' => [
                'show_tenant_column' => $this->isPlatform(),
                'filter_tenant_slug' => $this->isPlatform(),
            ],
        ];
    }
}
