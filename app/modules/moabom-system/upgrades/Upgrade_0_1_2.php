<?php

namespace Modules\Moabom\System\Upgrades;

use App\Contracts\Extension\UpgradeStepInterface;
use App\Extension\UpgradeContext;
use App\Models\Menu;

class Upgrade_0_1_2 implements UpgradeStepInterface
{
    /**
     * 업그레이드를 실행합니다.
     */
    public function run(UpgradeContext $context): void
    {
        $parent = Menu::query()
            ->where('slug', 'platform-settings')
            ->first();

        $menu = Menu::query()
            ->where('slug', 'moabom-system-settings')
            ->first();

        if (! $parent || ! $menu) {
            return;
        }

        $menu->forceFill([
            'parent_id' => $parent->id,
            'order' => 30,
            'is_active' => true,
        ])->save();
    }
}
