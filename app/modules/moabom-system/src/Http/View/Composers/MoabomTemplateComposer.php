<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\View\Composers;

use App\Extension\ModuleManager;
use App\Extension\PluginManager;
use App\Http\View\Composers\TemplateComposer;
use App\Services\ModuleSettingsService;
use App\Services\PluginSettingsService;
use App\Services\SettingsService;
use App\Services\TemplateService;
use Illuminate\View\View;
use Modules\Moabom\System\Services\MoabomExtensionAssetGroupService;
use Modules\Moabom\System\Support\MoabomExtensionDeferredRegistrySupport;

/**
 * 코어 `TemplateComposer`(admin) 대체 바인딩 — 확장 에셋 맵만 DB 활성 기준으로 정제한다.
 */
final class MoabomTemplateComposer extends TemplateComposer
{
    public function __construct(
        TemplateService $templateService,
        SettingsService $settingsService,
        ModuleSettingsService $moduleSettingsService,
        PluginSettingsService $pluginSettingsService,
        private ModuleManager $moabomModuleManager,
        private PluginManager $moabomPluginManager,
        private MoabomExtensionAssetGroupService $extensionAssetGroupService,
    ) {
        parent::__construct(
            $templateService,
            $settingsService,
            $moduleSettingsService,
            $pluginSettingsService,
            $moabomModuleManager,
            $moabomPluginManager
        );
    }

    public function compose(View $view): void
    {
        parent::compose($view);

        $moduleGroups = $this->extensionAssetGroupService->collectFilteredModuleGroups($this->moabomModuleManager);
        $pluginGroups = $this->extensionAssetGroupService->collectFilteredPluginGroups($this->moabomPluginManager);

        $view->with('moduleAssets', $moduleGroups['immediate']);
        $view->with('deferredModuleAssets', $moduleGroups['deferred']);
        $view->with('pluginAssets', $pluginGroups['immediate']);
        $view->with('deferredPluginAssets', $pluginGroups['deferred']);

        MoabomExtensionDeferredRegistrySupport::mergeRegistryIntoAppConfig(
            $view,
            $moduleGroups['deferred'],
            $pluginGroups['deferred'],
        );
        MoabomExtensionDeferredRegistrySupport::mergeExtensionEpochIntoAppConfig($view);
    }
}
