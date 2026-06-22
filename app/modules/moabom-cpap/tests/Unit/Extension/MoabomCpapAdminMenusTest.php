<?php

declare(strict_types=1);

namespace Modules\Moabom\Cpap\Tests\Unit\Extension;

use Modules\Moabom\Cpap\Extension\MoabomCpapAdminMenus;
use Modules\Moabom\Cpap\Tests\ModuleTestCase;

final class MoabomCpapAdminMenusTest extends ModuleTestCase
{
    public function test_menu_is_child_of_platform_settings(): void
    {
        $menus = MoabomCpapAdminMenus::menus();

        $this->assertCount(1, $menus);
        $this->assertSame('moabom-cpap-measurements', $menus[0]['slug'] ?? null);
        $this->assertSame('platform-settings', $menus[0]['parent_slug'] ?? null);
        $this->assertSame(60, (int) ($menus[0]['order'] ?? 0));
    }
}
