<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\View\Composers;

use App\Exceptions\TemplateNotFoundException;
use App\Extension\ModuleManager;
use App\Extension\PluginManager;
use App\Extension\Traits\ClearsTemplateCaches;
use App\Http\View\Composers\UserTemplateComposer;
use App\Services\ModuleSettingsService;
use App\Services\PluginSettingsService;
use App\Services\SettingsService;
use App\Services\TemplateService;
use Illuminate\View\View;
use Modules\Moabom\System\Services\MoabomExtensionAssetGroupService;
use Modules\Moabom\System\Support\MoabomHomeShellRequest;
use Modules\Moabom\System\Support\MoabomPublicApiCache;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;

/**
 * 코어 `UserTemplateComposer` 대체 — 에셋 1회 수집 + 홈 셸 HTML 경량화.
 *
 * parent::compose() 는 global 에셋만 수집한 뒤 Moabom 이 immediate/deferred 를 다시 수집해
 * 이중 비용이 발생하므로 호출하지 않는다.
 */
final class MoabomUserTemplateComposer extends UserTemplateComposer
{
    public function __construct(
        private readonly TemplateService $moabomTemplateService,
        private readonly SettingsService $moabomSettingsService,
        private readonly ModuleSettingsService $moabomModuleSettingsService,
        private readonly PluginSettingsService $moabomPluginSettingsService,
        private readonly ModuleManager $moabomModuleManager,
        private readonly PluginManager $moabomPluginManager,
        private readonly MoabomExtensionAssetGroupService $extensionAssetGroupService,
    ) {
        parent::__construct(
            $moabomTemplateService,
            $moabomSettingsService,
            $moabomModuleSettingsService,
            $moabomPluginSettingsService,
            $moabomModuleManager,
            $moabomPluginManager
        );
    }

    public function compose(View $view): void
    {
        $slim = $this->shouldUseSlimExtensionSettings();
        $useHomeShellCache = $slim && $this->shouldCacheHomeShellCompose();

        if ($useHomeShellCache) {
            $epoch = (int) ClearsTemplateCaches::getExtensionCacheVersion();
            $data = MoabomPublicApiCache::remember(
                MoabomPublicApiCacheKeys::appBladeHomeShell($epoch),
                fn (): array => $this->buildViewData(true),
            );
        } else {
            $data = $this->buildViewData($slim);
        }

        foreach ($data as $key => $value) {
            $view->with($key, $value);
        }
    }

    private function shouldUseSlimExtensionSettings(): bool
    {
        if (! config('moabom-system.boot_asset_ghost.slim_settings_on_same_paths', true)) {
            return false;
        }

        if (! MoabomHomeShellRequest::matchesCurrentRequest()) {
            return false;
        }

        $target = (string) config('moabom-system.boot_asset_ghost.user_template', 'moabom-basic');

        try {
            $active = $this->moabomTemplateService->getActiveTemplateIdentifier('user');
        } catch (TemplateNotFoundException) {
            return false;
        }

        return $active === $target;
    }

    private function shouldCacheHomeShellCompose(): bool
    {
        return $this->shouldUseSlimExtensionSettings()
            && MoabomPublicApiCache::ttlSeconds() > 0;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildViewData(bool $slimExtensionSettings): array
    {
        try {
            $activeTemplate = $this->moabomTemplateService->getActiveTemplateIdentifier('user');
        } catch (TemplateNotFoundException) {
            $activeTemplate = null;
        }

        try {
            $frontendSettings = $this->moabomSettingsService->getFrontendSettings();
        } catch (\Throwable) {
            $frontendSettings = [];
        }

        if ($slimExtensionSettings) {
            $pluginSettings = [];
            $moduleSettings = [];
        } else {
            try {
                $pluginSettings = $this->moabomPluginSettingsService->getAllActiveSettings();
            } catch (\Throwable) {
                $pluginSettings = [];
            }

            try {
                $moduleSettings = $this->moabomModuleSettingsService->getAllActiveSettings();
            } catch (\Throwable) {
                $moduleSettings = [];
            }
        }

        $moduleGroups = $this->extensionAssetGroupService->collectFilteredModuleGroups($this->moabomModuleManager);
        $pluginGroups = $this->extensionAssetGroupService->collectFilteredPluginGroups($this->moabomPluginManager);

        try {
            $appConfig = $this->moabomSettingsService->getAppConfigForFrontend();
        } catch (\Throwable) {
            $appConfig = [];
        }

        return [
            'activeUserTemplate' => $activeTemplate,
            'frontendSettings' => $frontendSettings,
            'pluginSettings' => $pluginSettings,
            'moduleSettings' => $moduleSettings,
            'moduleAssets' => $moduleGroups['immediate'],
            'deferredModuleAssets' => $moduleGroups['deferred'],
            'pluginAssets' => $pluginGroups['immediate'],
            'deferredPluginAssets' => $pluginGroups['deferred'],
            'appConfig' => $appConfig,
        ];
    }
}
