<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Extension;

use App\Contracts\Repositories\MenuRepositoryInterface;
use App\Contracts\Repositories\RoleRepositoryInterface;
use App\Enums\ExtensionOwnerType;
use App\Extension\Helpers\ExtensionMenuSyncHelper;
use App\Models\Menu;

/**
 * 코어 `ExtensionMenuSyncHelper` 확장.
 *
 * - `parent_slug` 해석
 * - 선언적 메뉴(core/module) sync 시 order 는 정의값을 항상 적용 (user_overrides.order 무시)
 *   → 테넌트별 platform 스냅샷·UI 드래그로 order 가 굳어 divergence 가 나는 근본 원인 제거
 */
class MoabomExtensionMenuSyncHelper extends ExtensionMenuSyncHelper
{
    public function __construct(
        private readonly MenuRepositoryInterface $moabomMenuRepository,
        RoleRepositoryInterface $roleRepository,
    ) {
        parent::__construct($moabomMenuRepository, $roleRepository);
    }

    public function syncMenu(
        string $slug,
        ExtensionOwnerType $extensionType,
        string $extensionIdentifier,
        array $newAttributes,
        ?int $parentId = null,
    ): Menu {
        $existing = $this->moabomMenuRepository->findBySlugAndExtension($slug, $extensionType, $extensionIdentifier);

        if ($existing !== null) {
            $this->clearDeclarativeOrderOverride($existing);
        }

        $menu = parent::syncMenu($slug, $extensionType, $extensionIdentifier, $newAttributes, $parentId);

        if ($existing !== null && array_key_exists('order', $newAttributes)) {
            $this->moabomMenuRepository->update($menu, [
                'order' => (int) ($newAttributes['order'] ?? 0),
            ]);

            return $menu->fresh() ?? $menu;
        }

        return $menu;
    }

    public function syncMenuRecursive(
        array $menuData,
        ExtensionOwnerType $extensionType,
        string $extensionIdentifier,
        ?int $parentId = null,
    ): Menu {
        $effectiveParentId = $parentId;
        if ($effectiveParentId === null && isset($menuData['parent_slug'])) {
            $parentSlug = $menuData['parent_slug'];
            if (is_string($parentSlug) && $parentSlug !== '') {
                $parentMenu = $this->moabomMenuRepository->findBySlug(trim($parentSlug));
                $effectiveParentId = $parentMenu?->id;
            }
        }

        return parent::syncMenuRecursive($menuData, $extensionType, $extensionIdentifier, $effectiveParentId);
    }

    private function clearDeclarativeOrderOverride(Menu $menu): void
    {
        $overrides = $menu->user_overrides ?? [];
        if (! in_array('order', $overrides, true)) {
            return;
        }

        $this->moabomMenuRepository->update($menu, [
            'user_overrides' => array_values(array_filter($overrides, static fn (mixed $field): bool => $field !== 'order')),
        ]);
    }
}
