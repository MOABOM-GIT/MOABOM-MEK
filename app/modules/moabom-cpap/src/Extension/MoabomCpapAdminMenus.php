<?php

declare(strict_types=1);

namespace Modules\Moabom\Cpap\Extension;

/**
 * 마스크피팅 admin 메뉴 — Host 무관 동일 url·slug.
 */
final class MoabomCpapAdminMenus
{
    /**
     * @return list<array<string, mixed>>
     */
    public static function menus(): array
    {
        return [
            [
                'name' => ['ko' => '마스크피팅 관리', 'en' => 'Mask Fitting'],
                'slug' => 'moabom-cpap-measurements',
                'parent_slug' => 'platform-settings',
                'url' => '/admin/platform/cpap/measurements',
                'icon' => 'fas fa-head-side-mask',
                'order' => 60,
                'permission' => 'moabom-cpap.measurements.read',
            ],
        ];
    }
}
