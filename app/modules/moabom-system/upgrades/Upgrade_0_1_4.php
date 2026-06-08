<?php

namespace Modules\Moabom\System\Upgrades;

use App\Contracts\Extension\UpgradeStepInterface;
use App\Enums\ExtensionOwnerType;
use App\Extension\UpgradeContext;
use App\Models\Menu;

class Upgrade_0_1_4 implements UpgradeStepInterface
{
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

        $menu = Menu::query()->updateOrCreate(
            [
                'slug' => 'moabom-system-settings',
                'extension_type' => ExtensionOwnerType::Module->value,
                'extension_identifier' => 'moabom-system',
            ],
            [
                'name' => [
                    'ko' => '마이페이지 설정',
                    'en' => 'My Page Settings',
                ],
                'url' => '/admin/platform/settings/mypage',
                'icon' => 'fas fa-user-cog',
                'order' => 30,
                'parent_id' => $parent->id,
                'is_active' => true,
            ]
        );

        $menu->forceFill([
            'parent_id' => $parent->id,
            'order' => 30,
            'is_active' => true,
        ])->save();
    }
}
