<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services;

use App\Contracts\Extension\ModuleInterface;
use App\Enums\PermissionType;
use App\Extension\AbstractModule;
use App\Extension\HookManager;
use App\Extension\ModuleManager;
use App\Models\User;
use Modules\Moabom\System\Contracts\ExtensionCatalogBuilderInterface;

/**
 * 활성 모듈 중 사용자 권한으로 "존재를 노출해도 되는" 모듈 식별자를 수집합니다.
 *
 * - 권한 정의가 비어 있으면(기본 getPermissions) 게스트·회원 모두 노출 후보에 포함합니다.
 * - 카테고리·리프 권한이 있으면, 리프 식별자(`{module}.{category}.{action}`) 및
 *   `getDynamicPermissionIdentifiers()` 중 하나라도 hasPermission 이면 포함합니다.
 * - 관리자 역할(관리자 타입 권한 보유)은 활성 모듈 전체를 포함합니다.
 */
final class ExtensionCatalogBuilder implements ExtensionCatalogBuilderInterface
{
    public function __construct(
        private ModuleManager $moduleManager,
    ) {}

    public function getVisibleModuleIdentifiers(?User $user): array
    {
        $identifiers = [];

        foreach ($this->moduleManager->getActiveModules() as $module) {
            if (! $this->isModuleVisibleToUser($module, $user)) {
                continue;
            }
            $identifiers[] = $module->getIdentifier();
        }

        $identifiers = array_values(array_unique($identifiers));

        /** @var array<int, string> $filtered */
        $filtered = HookManager::applyFilters(
            'moabom.extension_catalog.module_identifiers',
            $identifiers,
            $user
        );

        return is_array($filtered) ? array_values(array_unique($filtered)) : $identifiers;
    }

    private function isModuleVisibleToUser(ModuleInterface $module, ?User $user): bool
    {
        $permConfig = $module->getPermissions();
        $categories = $permConfig['categories'] ?? null;

        if (! is_array($categories) || $categories === []) {
            return true;
        }

        if ($user === null) {
            return false;
        }

        if ($user->isAdmin()) {
            return true;
        }

        $leafIds = $this->collectLeafPermissionIdentifiers($module, $categories);
        if ($module instanceof AbstractModule) {
            $dynamic = $module->getDynamicPermissionIdentifiers();
            if (is_array($dynamic) && $dynamic !== []) {
                $leafIds = array_values(array_unique(array_merge($leafIds, $dynamic)));
            }
        }

        if ($leafIds === []) {
            return true;
        }

        foreach ($leafIds as $identifier) {
            if ($user->hasPermission($identifier, PermissionType::User)
                || $user->hasPermission($identifier, PermissionType::Admin)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  array<int, mixed>  $categories
     * @return array<int, string>
     */
    private function collectLeafPermissionIdentifiers(ModuleInterface $module, array $categories): array
    {
        $mid = $module->getIdentifier();
        $out = [];

        foreach ($categories as $categoryData) {
            if (! is_array($categoryData)) {
                continue;
            }
            $catId = $categoryData['identifier'] ?? null;
            if (! is_string($catId) || $catId === '') {
                continue;
            }
            $categoryPrefix = $mid.'.'.$catId;
            foreach ($categoryData['permissions'] ?? [] as $permData) {
                if (! is_array($permData)) {
                    continue;
                }
                $action = $permData['action'] ?? null;
                if (! is_string($action) || $action === '') {
                    continue;
                }
                $out[] = $categoryPrefix.'.'.$action;
            }
        }

        return $out;
    }
}
