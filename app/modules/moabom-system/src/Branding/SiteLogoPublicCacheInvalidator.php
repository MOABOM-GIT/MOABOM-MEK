<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Branding;

use Modules\Moabom\System\Saas\SaasCoreSettingsHydrator;

/**
 * site_logo 변경 시 G7 general revision·hydrator snapshot 을 갱신해 shell-boot 캐시 miss 유도.
 */
final class SiteLogoPublicCacheInvalidator
{
    public function __construct(
        private readonly SaasCoreSettingsHydrator $coreSettingsHydrator,
    ) {}

    public function invalidate(): void
    {
        $this->coreSettingsHydrator->resetSnapshot();
        $this->coreSettingsHydrator->hydrate();
    }
}
