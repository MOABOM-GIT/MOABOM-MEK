<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Extension;

use Modules\Moabom\System\Saas\TenantContext;

/**
 * Host 기준 admin 메뉴 SSOT — G7 core(config/core.php) + moabom-system 확장 선언.
 *
 * order 는 여기·core.php 에만 정의한다. DB reconcile·catalog 덮어쓰기 없음.
 * sync 시 MoabomExtensionMenuSyncHelper 가 정의 order 를 항상 반영한다.
 */
final class MoabomSystemAdminMenus
{
    /**
     * @return list<array<string, mixed>>
     */
    public static function forCurrentRequest(): array
    {
        if (! config('moabom-system.saas.enabled', false)) {
            return self::legacyMenus();
        }

        if (! app()->bound(TenantContext::class)) {
            return self::legacyMenus();
        }

        return app(TenantContext::class)->isPlatformRequest()
            ? self::platformMenus()
            : self::forTenantHost();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public static function forTenantHost(): array
    {
        return self::platformMenuTree(includeHospital: false);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function platformMenus(): array
    {
        return self::platformMenuTree(includeHospital: true);
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function legacyMenus(): array
    {
        return self::platformMenuTree(includeHospital: false);
    }

    /**
     * 플랫폼 메뉴 그룹 — 마스터·테넌트 공통.
     *
     * 부모는 대시보드(core order 1) 위(order 0)에 둔다.
     * 업체 관리는 마스터 Host 전용 자식(order 10)이며 tenant DB 에는 금지(TenantAdminMenuPolicy).
     *
     * @return list<array<string, mixed>>
     */
    private static function platformMenuTree(bool $includeHospital): array
    {
        $menus = [
            [
                'name' => ['ko' => '플랫폼 메뉴', 'en' => 'Platform Menu'],
                'slug' => 'platform-settings',
                'url' => null,
                'icon' => 'fas fa-sliders-h',
                'order' => 0,
            ],
        ];

        if ($includeHospital) {
            $menus[] = [
                'name' => ['ko' => '업체 관리', 'en' => 'Companies'],
                'slug' => 'moabom-saas-hospitals',
                'parent_slug' => 'platform-settings',
                'url' => '/admin/saas/hospitals',
                'icon' => 'fas fa-hospital',
                'order' => 10,
                'permission' => 'moabom-system.saas.read',
            ];
        }

        $menus[] = [
            'name' => ['ko' => 'Realtime VM', 'en' => 'Realtime VM'],
            'slug' => 'moabom-realtime-vm',
            'parent_slug' => 'platform-settings',
            'url' => '/admin/platform/realtime-vm',
            'icon' => 'fas fa-satellite-dish',
            'order' => 15,
            'permission' => 'moabom-system.realtime.read',
        ];

        $menus[] = [
            'name' => ['ko' => '마이페이지 설정', 'en' => 'My Page Settings'],
            'slug' => 'moabom-system-settings',
            'parent_slug' => 'platform-settings',
            'url' => '/admin/platform/settings/mypage',
            'icon' => 'fas fa-id-card',
            'order' => 20,
            'permission' => 'moabom-system.settings.read',
        ];

        return $menus;
    }
}
