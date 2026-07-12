<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\View\Composers;

use App\Extension\ModuleManager;
use App\Extension\PluginManager;
use App\Extension\TemplateManager;
use App\Http\View\Composers\TemplateComposer;
use App\Services\ModuleSettingsService;
use App\Services\PluginSettingsService;
use App\Services\SettingsService;
use App\Services\TemplateService;
use Illuminate\View\View;
use Modules\Moabom\System\Services\MoabomExtensionAssetGroupService;
use Modules\Moabom\System\Support\MoabomExtensionDeferredRegistrySupport;

/**
 * 코어 `TemplateComposer`(admin) 대체 — G7 compose 계약 유지 + 에셋 맵 정제.
 *
 * G7 7.0.2+ `TemplateManager` 생성자 인자를 parent 에 그대로 전달한다.
 * parent::compose() 가 bundleUrls·externals·active*Meta 를 채운 뒤
 * immediate/deferred 에셋만 Moabom 기준으로 교체한다.
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
        TemplateManager $templateManager,
        private MoabomExtensionAssetGroupService $extensionAssetGroupService,
    ) {
        parent::__construct(
            $templateService,
            $settingsService,
            $moduleSettingsService,
            $pluginSettingsService,
            $moabomModuleManager,
            $moabomPluginManager,
            $templateManager,
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
