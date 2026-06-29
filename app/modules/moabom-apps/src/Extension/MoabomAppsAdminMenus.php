<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Extension;

/**
 * 마이앱 admin 메뉴 — Host 무관 동일 url·slug.
 */
final class MoabomAppsAdminMenus
{
    /**
     * @return list<array<string, mixed>>
     */
    public static function menus(): array
    {
        return [
            [
                'name' => ['ko' => '마이앱 관리', 'en' => 'My app management'],
                'slug' => 'moabom-apps-generated',
                'parent_slug' => 'platform-settings',
                'url' => '/admin/apps/generated',
                'icon' => 'fas fa-wand-magic-sparkles',
                'order' => 50,
                'permission' => 'moabom-apps.generated.read',
            ],
            [
                'name' => ['ko' => '앱 리뷰 관리', 'en' => 'App Review Posts'],
                'slug' => 'moabom-apps-community',
                'parent_slug' => 'platform-settings',
                'url' => '/admin/apps/community/posts',
                'icon' => 'fas fa-comments',
                'order' => 51,
                'permission' => 'moabom-apps.community.read',
            ],
        ];
    }
}
