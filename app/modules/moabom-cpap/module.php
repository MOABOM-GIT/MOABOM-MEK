<?php

namespace Modules\Moabom\Cpap;

use App\Extension\AbstractModule;
use Modules\Moabom\Cpap\Extension\MoabomCpapAdminMenus;

/**
 * moabom-cpap 모듈 진입점.
 *
 * 책임:
 *   - CPAP 마스크 피팅 측정 결과의 사용자별 저장/조회
 *     (`/api/modules/moabom-cpap/apps/cpap-mask/*`).
 *   - 관리자 마스크피팅 측정 목록 (`/admin/platform/cpap/measurements`).
 *   - DB 테이블 `moabom_system_cpap_measurements` (테이블명 보존: F1 호환).
 */
class Module extends AbstractModule
{
    public function getPermissions(): array
    {
        return [
            'name' => [
                'ko' => 'CPAP 마스크 피팅',
                'en' => 'CPAP Mask Fitting',
            ],
            'description' => [
                'ko' => '마스크 피팅 앱 측정 데이터 권한',
                'en' => 'Mask fitting measurement permissions',
            ],
            'categories' => [
                [
                    'identifier' => 'measurements',
                    'name' => [
                        'ko' => '마스크피팅 측정',
                        'en' => 'Mask Fitting Measurements',
                    ],
                    'description' => [
                        'ko' => '관리자용 마스크피팅 측정 목록 조회 권한',
                        'en' => 'Admin permissions to list mask fitting measurements',
                    ],
                    'permissions' => [
                        [
                            'action' => 'read',
                            'name' => [
                                'ko' => '측정 목록 조회',
                                'en' => 'Read Measurements',
                            ],
                            'description' => [
                                'ko' => '마스크피팅 측정 저장 목록 조회',
                                'en' => 'List stored mask fitting measurements',
                            ],
                            'type' => 'admin',
                            'roles' => ['admin'],
                        ],
                    ],
                ],
            ],
        ];
    }

    public function getAdminMenus(): array
    {
        return MoabomCpapAdminMenus::menus();
    }

    /**
     * 언인스톨 시 삭제될 동적 테이블.
     * Phase 4 분리(2026-06-02): 테이블명은 보존하되 소유권을 moabom-cpap 로 이관.
     */
    public function getDynamicTables(): array
    {
        return [
            'moabom_system_cpap_measurements',
        ];
    }
}
