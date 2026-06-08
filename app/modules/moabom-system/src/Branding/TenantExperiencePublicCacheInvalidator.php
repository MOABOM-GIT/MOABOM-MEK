<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Branding;

use Modules\Moabom\System\Saas\SaasCoreSettingsHydrator;

/**
 * G7 general·seo 저장 직후 hydrator 스냅샷 갱신 — shell-boot 캐시 키(revision) 자동 분리.
 */
final class TenantExperiencePublicCacheInvalidator
{
    public function __construct(
        private readonly SaasCoreSettingsHydrator $coreSettingsHydrator,
    ) {}

    public function invalidateAfterCoreSettingsSave(string $tab): void
    {
        if (! in_array($tab, ['general', 'seo'], true)) {
            return;
        }

        $this->coreSettingsHydrator->resetSnapshot();
        $this->coreSettingsHydrator->hydrate();
    }
}
