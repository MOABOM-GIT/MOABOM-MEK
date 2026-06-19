<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Upgrades;

use App\Contracts\Extension\UpgradeStepInterface;
use App\Extension\UpgradeContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 알림 템플릿 click_url — sirsoft-basic 레거시 `/mypage` → Moabom 셸 `/me/*` 정규화.
 */
class Upgrade_0_7_7 implements UpgradeStepInterface
{
    public function run(UpgradeContext $context): void
    {
        if (! Schema::hasTable('notification_templates')) {
            return;
        }

        $replacements = [
            '/mypage/change-password' => '/me/account',
            '/mypage' => '/me/profile',
        ];

        foreach ($replacements as $from => $to) {
            DB::table('notification_templates')
                ->where('click_url', $from)
                ->update(['click_url' => $to]);
        }
    }
}
