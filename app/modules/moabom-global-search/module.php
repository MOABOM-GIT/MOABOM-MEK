<?php

namespace Modules\Moabom\Global\Search;

use App\Extension\AbstractModule;

/**
 * moabom-global-search 모듈 진입점.
 *
 * 셸 전체검색 앱 — 앱 카탈로그·생성앱·게시판 통합 검색 UI.
 * G7 identifier 네임스페이스: moabom-global-search → Moabom\Global\Search
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
