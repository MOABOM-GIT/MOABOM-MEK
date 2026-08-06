<?php

namespace Modules\Moabom\Smart\Chat;

use App\Extension\AbstractModule;

/**
 * moabom-smart-chat 모듈 진입점.
 *
 * 셸「AI 스마트챗」— 멀티턴 LLM 대화. 사람 DM(moabom-chat)·HTML 생성(moabom-apps)과 분리.
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
