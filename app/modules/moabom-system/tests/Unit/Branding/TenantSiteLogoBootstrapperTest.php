<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Branding;

use Modules\Moabom\System\Tests\ModuleTestCase;

final class TenantSiteLogoBootstrapperTest extends ModuleTestCase
{
    public function test_apply_syncs_general_json_before_invalidating_public_cache(): void
    {
        $source = (string) file_get_contents($this->getModuleBasePath().'/src/Saas/TenantSiteLogoBootstrapper.php');

        $this->assertStringContainsString('SiteLogoPublicCacheInvalidator', $source);
        $syncPos = strpos($source, 'siteLogoGeneralConfigSync->syncFromCollection()');
        $invalidatePos = strpos($source, 'siteLogoPublicCacheInvalidator->invalidate()');

        $this->assertIsInt($syncPos);
        $this->assertIsInt($invalidatePos);
        $this->assertLessThan($invalidatePos, $syncPos, 'site_logo IDs must be persisted before shell-boot cache invalidation.');
    }
}
