<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Services;

use App\Contracts\Repositories\ModuleRepositoryInterface;
use App\Contracts\Repositories\PluginRepositoryInterface;
use App\Extension\ModuleManager;
use App\Extension\PluginManager;
use Modules\Moabom\System\Support\ExtensionFrontendAssetCollector;

/**
/**
 * 확장 프론트엔드 에셋 맵을 수집한 뒤 DB 비활성 확장 항목을 제거한다.
 *
 * View Composer 바인딩 교체 후 compose 단계에서만 사용한다.
 */
final class MoabomExtensionAssetGroupService
{
    public function __construct(
        private ModuleRepositoryInterface $moduleRepository,
        private PluginRepositoryInterface $pluginRepository,
    ) {}

    /**
     * @return array{immediate: array<string, array<string, mixed>>, deferred: array<string, array<string, mixed>>}
     */
    public function collectFilteredModuleGroups(ModuleManager $moduleManager): array
    {
        $groups = ExtensionFrontendAssetCollector::collectModuleGroups($moduleManager);

        return [
            'immediate' => $this->filterModuleAssetMap($groups['immediate']),
            'deferred' => $this->filterModuleAssetMap($groups['deferred']),
        ];
    }

    /**
     * @return array{immediate: array<string, array<string, mixed>>, deferred: array<string, array<string, mixed>>}
     */
    public function collectFilteredPluginGroups(PluginManager $pluginManager): array
    {
        $groups = ExtensionFrontendAssetCollector::collectPluginGroups($pluginManager);

        return [
            'immediate' => $this->filterPluginAssetMap($groups['immediate']),
            'deferred' => $this->filterPluginAssetMap($groups['deferred']),
        ];
    }

    /**
     * @param  array<string, array<string, mixed>>  $map
     * @return array<string, array<string, mixed>>
     */
    private function filterModuleAssetMap(array $map): array
    {
        $active = array_fill_keys(ModuleManager::getActiveModuleIdentifiers(), true);

        foreach (array_keys($map) as $identifier) {
            if (! is_string($identifier) || $identifier === '') {
                continue;
            }
            if (! isset($active[$identifier])) {
                unset($map[$identifier]);
            }
        }

        return $map;
    }

    /**
     * @param  array<string, array<string, mixed>>  $map
     * @return array<string, array<string, mixed>>
     */
    private function filterPluginAssetMap(array $map): array
    {
        $active = array_fill_keys(PluginManager::getActivePluginIdentifiers(), true);

        foreach (array_keys($map) as $identifier) {
            if (! is_string($identifier) || $identifier === '') {
                continue;
            }
            if (! isset($active[$identifier])) {
                unset($map[$identifier]);
            }
        }

        return $map;
    }
}
