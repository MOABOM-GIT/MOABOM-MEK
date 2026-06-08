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
        return self::platformSettingsMenus();
    }

    /**
     * Platform host 전용 top-level 메뉴 (tenant DB 에는 금지).
     *
     * 병원 관리(SaaS) — 대시보드(core order 1) 바로 밑(order 2)에 top-level 로 노출한다.
     * 과거 'platform-saas' 그룹 wrapper 는 제거하고 병원 관리만 단독 top-level 로 둔다.
     *
     * @return list<array<string, mixed>>
     */
    public static function platformOnlyTopLevelMenus(): array
    {
        return [
            [
                'name' => ['ko' => '병원 관리', 'en' => 'Hospitals'],
                'slug' => 'moabom-saas-hospitals',
                'url' => '/admin/saas/hospitals',
                'icon' => 'fas fa-hospital',
                'order' => 2,
                'permission' => 'moabom-system.saas.read',
            ],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function platformMenus(): array
    {
        return array_merge(
            self::platformSettingsMenus(),
            self::platformOnlyTopLevelMenus(),
        );
    }

    /**
     * @return list<array<string, mixed>>
     */
    private static function legacyMenus(): array
    {
        return self::platformSettingsMenus();
    }

    /**
     * 플랫폼 환경설정 그룹 — 마스터·테넌트 공통 order 3 (G7 환경설정[core order 2] 바로 밑,
     * 알림 발송 이력[core order 4] 위).
     *
     * @return list<array<string, mixed>>
     */
    private static function platformSettingsMenus(): array
    {
        return [
            [
                'name' => ['ko' => '플랫폼 환경설정', 'en' => 'Platform Settings'],
                'slug' => 'platform-settings',
                'url' => null,
                'icon' => 'fas fa-sliders-h',
                'order' => 3,
            ],
            [
                'name' => ['ko' => '마이페이지 설정', 'en' => 'My Page Settings'],
                'slug' => 'moabom-system-settings',
                'parent_slug' => 'platform-settings',
                'url' => '/admin/platform/settings/mypage',
                'icon' => 'fas fa-id-card',
                'order' => 10,
                'permission' => 'moabom-system.settings.read',
            ],
        ];
    }
}
