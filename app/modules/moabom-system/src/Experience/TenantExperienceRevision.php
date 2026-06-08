<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Experience;

use Modules\Moabom\System\Contracts\SystemSettingsServiceInterface;
use Modules\Moabom\System\Saas\SaasCoreSettingsHydrator;

/**
 * G7 general·seo 와 moabom-system module revision 을 하나의 정수 revision 으로 노출.
 */
final class TenantExperienceRevision
{
    public function __construct(
        private readonly SystemSettingsServiceInterface $systemSettings,
    ) {}

    public function token(): string
    {
        return md5(
            app(SaasCoreSettingsHydrator::class)->settingsRevisionToken()
            .':'
            .$this->systemSettings->getFrontendDefaultsRevision()
        );
    }

    public function asInt(): int
    {
        return abs(crc32($this->token()));
    }
}
