<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Extension;

/**
 * AI 생성앱 admin 메뉴 — Host 무관 동일 url·slug.
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
                'name' => ['ko' => 'AI 생성 앱 관리', 'en' => 'AI Generated Apps'],
                'slug' => 'moabom-apps-generated',
                'parent_slug' => 'platform-settings',
                'url' => '/admin/apps/generated',
                'icon' => 'fas fa-wand-magic-sparkles',
                'order' => 50,
                'permission' => 'moabom-apps.generated.read',
            ],
        ];
    }
}
