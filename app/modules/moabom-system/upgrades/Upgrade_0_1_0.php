<?php

namespace Modules\Moabom\System\Upgrades;

use App\Contracts\Extension\UpgradeStepInterface;
use App\Extension\UpgradeContext;
use App\Models\Menu;

class Upgrade_0_1_0 implements UpgradeStepInterface
{
    /**
     * 업그레이드 스텝 설명을 반환합니다.
     */
    public function description(): string
    {
        return '마이페이지 설정 메뉴를 플랫폼 환경설정 하위로 배치합니다.';
    }

    /**
     * 업그레이드를 실행합니다.
     */
    public function run(UpgradeContext $context): void
    {
        $parent = Menu::query()
            ->where('slug', 'platform-settings')
            ->first();

        if (! $parent) {
            return;
        }

        $menu = Menu::query()
            ->where('slug', 'moabom-system-settings')
            ->first();

        if (! $menu) {
            return;
        }

        $menu->forceFill([
            'parent_id' => $parent->id,
            'order' => 30,
            'is_active' => true,
        ])->save();
    }
}
