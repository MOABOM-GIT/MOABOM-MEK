<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Branding;

use App\Contracts\Repositories\ConfigRepositoryInterface;
use Modules\Moabom\System\Branding\SiteLogoPublicCacheInvalidator;
use Modules\Moabom\System\Saas\SaasCoreSettingsHydrator;
use Modules\Moabom\System\Tests\ModuleTestCase;
use Mockery;

final class SiteLogoPublicCacheInvalidatorTest extends ModuleTestCase
{
    public function test_invalidate_resets_hydrator_snapshot(): void
    {
        config(['moabom-system.saas.enabled' => true]);

        $configRepo = Mockery::mock(ConfigRepositoryInterface::class);
        $configRepo->shouldReceive('all')
            ->twice()
            ->andReturn(['general' => ['site_name' => 'A']], ['general' => ['site_name' => 'B']]);

        $hydrator = new SaasCoreSettingsHydrator($configRepo);
        $hydrator->hydrate();
        $first = $hydrator->settingsRevisionToken();

        $invalidator = new SiteLogoPublicCacheInvalidator($hydrator);
        $invalidator->invalidate();

        $second = $hydrator->settingsRevisionToken();
        $this->assertNotSame($first, $second);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }
}
