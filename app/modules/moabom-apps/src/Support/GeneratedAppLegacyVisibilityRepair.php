<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Support;

use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;

/**
 * 레거시 is_shared=true → visibility=global 백필을 업체(tenant) 범위로 1회 정리.
 */
final class GeneratedAppLegacyVisibilityRepair
{
    /** @var list<string> */
    private const NON_TENANT_SLUGS = ['', 'unknown', 'platform', 'default'];

    /**
     * @return array{matched: int, updated: int}
     */
    public function downgradeGlobalToTenant(bool $dryRun = false): array
    {
        if (! GeneratedAppsConnection::usesPlatformStore()) {
            return ['matched' => 0, 'updated' => 0];
        }

        $query = GeneratedAppsConnection::apps()
            ->where('visibility', GeneratedAppVisibility::Global->value)
            ->whereNotNull('tenant_slug')
            ->whereNotIn('tenant_slug', self::NON_TENANT_SLUGS);

        $matched = (int) $query->count();
        if ($matched === 0 || $dryRun) {
            return ['matched' => $matched, 'updated' => 0];
        }

        $updated = $query->update([
            'visibility' => GeneratedAppVisibility::Tenant->value,
            'is_shared' => true,
            'updated_at' => now(),
        ]);

        return ['matched' => $matched, 'updated' => (int) $updated];
    }
}
