<?php

namespace Modules\Moabom\Apps\Tests\Unit;

use Modules\Moabom\Apps\Enums\AppTier;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class AppTierTest extends ModuleTestCase
{
    public function test_app_tier_values(): void
    {
        $this->assertSame(['standard', 'hosted'], AppTier::values());
        $this->assertTrue(AppTier::Hosted->isHosted());
        $this->assertFalse(AppTier::Standard->isHosted());
    }
}
