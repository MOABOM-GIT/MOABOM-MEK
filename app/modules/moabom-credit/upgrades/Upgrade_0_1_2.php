<?php

namespace Modules\Moabom\Credit\Upgrades;

use App\Contracts\Extension\UpgradeStepInterface;
use App\Enums\MenuPermissionType;
use App\Extension\UpgradeContext;
use App\Models\Menu;
use App\Models\Role;

/**
 * 크레딧 설정 메뉴를 플랫폼 환경설정 하위로 연결합니다.
 */
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
            ->where('slug', 'moabom-credit-settings')
            ->where('extension_type', 'module')
            ->where('extension_identifier', 'moabom-credit')
            ->first();

        if (! $parent || ! $menu) {
            return;
        }

        $menu->forceFill([
            'parent_id' => $parent->id,
            'order' => 20,
            'is_active' => true,
        ])->save();

        $adminRole = Role::query()->where('identifier', 'admin')->first();
        if ($adminRole) {
            $menu->roles()->syncWithoutDetaching([
                $adminRole->id => ['permission_type' => MenuPermissionType::Read->value],
            ]);
        }
    }
}
