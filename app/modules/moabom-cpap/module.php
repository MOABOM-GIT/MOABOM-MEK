<?php

namespace Modules\Moabom\Cpap;

use App\Extension\AbstractModule;

/**
 * moabom-cpap 모듈 진입점.
 *
 * 책임:
 *   - CPAP 마스크 피팅 측정 결과의 사용자별 저장/조회
 *     (`/api/modules/moabom-cpap/apps/cpap-mask/*`).
 *   - DB 테이블 `moabom_system_cpap_measurements` (테이블명 보존: F1 호환).
 *
 * 권한 카테고리는 정의하지 않는다. 모든 엔드포인트는 본인 자원만 노출하며
 * `auth:sanctum` 만으로 충분하다.
 */
class Module extends AbstractModule
{
    public function getPermissions(): array
    {
        return [];
    }

    public function getAdminMenus(): array
    {
        return [];
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
