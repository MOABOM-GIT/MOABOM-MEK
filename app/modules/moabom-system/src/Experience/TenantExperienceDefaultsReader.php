<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Experience;

use App\Contracts\Repositories\ConfigRepositoryInterface;
use Modules\Moabom\System\Branding\MoabomSiteLogoResolver;
use Modules\Moabom\System\Contracts\SystemSettingsServiceInterface;
use Modules\Moabom\System\Saas\TenantContext;

/**
 * shell-boot · user/settings · public defaults 가 공유하는 tenant experience defaults.
 */
final class TenantExperienceDefaultsReader
{
    /** @var list<string> */
    private const SITE_META_KEYS = [
        'site_name',
        'site_description',
        'site_note',
        'site_address',
        'site_url',
        'language',
        'timezone',
    ];

    public function __construct(
        private readonly SystemSettingsServiceInterface $systemSettings,
        private readonly ConfigRepositoryInterface $configRepository,
        private readonly TenantExperienceRevision $revision,
        private readonly MoabomSiteLogoResolver $siteLogoResolver,
    ) {}

    /**
     * 프론트 expose 스키마 (기존 getFrontendSettings 와 동일 shape).
     *
     * @return array<string, mixed>
     */
    public function frontendDefaults(): array
    {
        return $this->systemSettings->getFrontendSettings();
    }

    /**
     * @return array<string, mixed>
     */
    public function siteMeta(): array
    {
        $general = $this->configRepository->getCategory('general');
        $site = [];

        foreach (self::SITE_META_KEYS as $key) {
            if (array_key_exists($key, $general)) {
                $site[$key] = $general[$key];
            }
        }

        $logoIds = $general['site_logo'] ?? [];
        $logoIds = is_array($logoIds) ? $logoIds : [];
        $branding = $this->siteLogoResolver->resolve($logoIds);

        $site['logo_light_url'] = $branding['light_url'];
        $site['logo_dark_url'] = $branding['dark_url'];
        $site['has_custom_site_logo'] = $branding['has_custom_light'] || $branding['has_custom_dark'];

        if (app()->bound(TenantContext::class)) {
            $site['is_platform'] = app(TenantContext::class)->isPlatformRequest();
        }

        return $site;
    }

    public function combinedRevision(): int
    {
        return $this->revision->asInt();
    }

    /**
     * module-only revision (하위 호환·디버그).
     */
    public function moduleRevision(): int
    {
        return $this->systemSettings->getFrontendDefaultsRevision();
    }
}
