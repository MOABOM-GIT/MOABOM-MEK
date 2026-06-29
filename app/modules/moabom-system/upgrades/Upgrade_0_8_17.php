<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Upgrades;

use App\Contracts\Extension\UpgradeStepInterface;
use App\Extension\UpgradeContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 회원가입 환영 알림 click_url — 계정 정보 입력(`/me/account`)으로 정규화.
 */
class Upgrade_0_8_17 implements UpgradeStepInterface
{
    public function run(UpgradeContext $context): void
    {
        if (! Schema::hasTable('notification_templates') || ! Schema::hasTable('notification_definitions')) {
            return;
        }

        $definitionId = DB::table('notification_definitions')
            ->where('type', 'welcome')
            ->value('id');

        if ($definitionId === null) {
            return;
        }

        DB::table('notification_templates')
            ->where('definition_id', $definitionId)
            ->where('channel', 'database')
            ->whereIn('click_url', ['/mypage', '/me/profile', '/login'])
            ->update(['click_url' => '/me/account']);
    }
}
