<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit\Extension;

use Modules\Moabom\Apps\Extension\MoabomAppsAdminMenus;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

final class MoabomAppsAdminMenusTest extends ModuleTestCase
{
    public function test_menu_is_child_of_platform_settings(): void
    {
        $menus = MoabomAppsAdminMenus::menus();

        $this->assertCount(1, $menus);
        $this->assertSame('moabom-apps-generated', $menus[0]['slug'] ?? null);
        $this->assertSame('platform-settings', $menus[0]['parent_slug'] ?? null);
        $this->assertSame(50, (int) ($menus[0]['order'] ?? 0));
    }
}
