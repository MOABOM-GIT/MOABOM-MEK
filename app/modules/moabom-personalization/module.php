<?php

namespace Modules\Moabom\Personalization;

use App\Extension\AbstractModule;

/**
 * moabom-personalization 모듈 진입점.
 *
 * 현재 책임:
 *   - 마이페이지 "내 활동" 피드(`/api/modules/moabom-personalization/user/activities`).
 *
 * 권한 카테고리는 정의하지 않는다. 모든 엔드포인트는 본인 자원만 노출하며
 * `auth:sanctum` 인증만으로 충분하다. (관리자 영역 추가 시 별도 카테고리 도입)
 *
 * sirsoft-board 의 `posts`/`comments` 테이블이 없는 tenant 에서는
 * `UserMyPageActivityController` 가 `Schema::hasTable()` 가드로 빈 피드를 반환한다.
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

    public function getDynamicTables(): array
    {
        return [];
    }
}
