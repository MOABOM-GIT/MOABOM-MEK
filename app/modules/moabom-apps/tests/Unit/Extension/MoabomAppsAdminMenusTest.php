<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit\Extension;

use Modules\Moabom\Apps\Extension\MoabomAppsAdminMenus;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

final class MoabomAppsAdminMenusTest extends ModuleTestCase
{
    public function test_menu_declarations_include_generated_and_community(): void
    {
        $menus = MoabomAppsAdminMenus::menus();

        $this->assertCount(2, $menus);

        $bySlug = [];
        foreach ($menus as $menu) {
            $bySlug[$menu['slug'] ?? ''] = $menu;
        }

        $this->assertSame('moabom-apps-generated', $bySlug['moabom-apps-generated']['slug'] ?? null);
        $this->assertSame('platform-settings', $bySlug['moabom-apps-generated']['parent_slug'] ?? null);
        $this->assertSame(50, (int) ($bySlug['moabom-apps-generated']['order'] ?? 0));

        $this->assertSame('moabom-apps-community', $bySlug['moabom-apps-community']['slug'] ?? null);
        $this->assertSame('앱 리뷰 관리', $bySlug['moabom-apps-community']['name']['ko'] ?? null);
        $this->assertSame('/admin/apps/community/posts', $bySlug['moabom-apps-community']['url'] ?? null);
        $this->assertSame(51, (int) ($bySlug['moabom-apps-community']['order'] ?? 0));
    }
}
