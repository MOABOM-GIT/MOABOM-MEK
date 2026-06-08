<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Listeners;

use App\Contracts\Extension\HookListenerInterface;
use App\Contracts\Repositories\MenuRepositoryInterface;
use App\Enums\ExtensionOwnerType;

/**
 * 관리자 UI 메뉴 순서 드래그 후 declarative 메뉴에 order override 가 굳지 않도록 방지.
 *
 * G7 MenuUserOverridesListener 는 모든 메뉴에 order 를 기록한다.
 * core/module 선언 메뉴는 sync 시 정의 order 가 SSOT 이므로 override 를 즉시 제거한다.
 */
final class DeclarativeMenuOrderGuardListener implements HookListenerInterface
{
    public function __construct(
        private readonly MenuRepositoryInterface $menuRepository,
    ) {}

    public static function getSubscribedHooks(): array
    {
        return [
            'core.menu.after_update_order' => ['method' => 'handleAfterUpdateOrder', 'priority' => 25],
        ];
    }

    public function handle(...$args): void {}

    /**
     * @param  array<string, mixed>  $orderData
     */
    public function handleAfterUpdateOrder(array $orderData): void
    {
        foreach ($this->collectMenuIds($orderData) as $menuId) {
            $menu = $this->menuRepository->findById($menuId);
            if ($menu === null || ! $this->isDeclarativeMenu($menu)) {
                continue;
            }

            $overrides = $menu->user_overrides ?? [];
            if (! in_array('order', $overrides, true)) {
                continue;
            }

            $this->menuRepository->update($menu, [
                'user_overrides' => array_values(array_filter($overrides, static fn (mixed $field): bool => $field !== 'order')),
            ]);
        }
    }

    /**
     * @param  array<string, mixed>  $orderData
     * @return list<int>
     */
    private function collectMenuIds(array $orderData): array
    {
        $menuIds = [];

        foreach ($orderData['parent_menus'] ?? [] as $item) {
            if (isset($item['id'])) {
                $menuIds[] = (int) $item['id'];
            }
        }

        foreach ($orderData['child_menus'] ?? [] as $children) {
            foreach ($children as $item) {
                if (isset($item['id'])) {
                    $menuIds[] = (int) $item['id'];
                }
            }
        }

        return array_values(array_unique($menuIds));
    }

    private function isDeclarativeMenu(\App\Models\Menu $menu): bool
    {
        $type = $menu->extension_type;
        if ($type === ExtensionOwnerType::Core->value) {
            return true;
        }

        if ($type === ExtensionOwnerType::Module->value || $type === ExtensionOwnerType::Plugin->value) {
            return is_string($menu->extension_identifier) && $menu->extension_identifier !== '';
        }

        return false;
    }
}
