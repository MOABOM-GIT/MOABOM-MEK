<?php

namespace Modules\Moabom\Consulting;

use App\Extension\AbstractModule;

/**
 * moabom-consulting 모듈 진입점.
 *
 * 책임:
 *   - 스마트케어360 영업용 컨설팅 앱의 백엔드.
 *   - 맞춤형 수익성 시뮬레이션 계산(`/api/modules/moabom-consulting/apps/consulting/simulate`).
 *   - 전자계약서 저장/조회/서명(`/api/modules/moabom-consulting/apps/consulting/contracts`).
 *   - DB 테이블 `moabom_consulting_contracts` (신규 앱 → v9 테이블 prefix 규칙 준수).
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
     */
    public function getDynamicTables(): array
    {
        return [
            'moabom_consulting_contracts',
        ];
    }
}
