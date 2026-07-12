<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\View\Composers;

use App\Exceptions\TemplateNotFoundException;
use App\Extension\ModuleManager;
use App\Extension\PluginManager;
use App\Extension\TemplateManager;
use App\Extension\Traits\ClearsTemplateCaches;
use App\Http\View\Composers\UserTemplateComposer;
use App\Services\ModuleSettingsService;
use App\Services\PluginSettingsService;
use App\Services\SettingsService;
use App\Services\TemplateService;
use App\Support\TemplateExternals;
use Illuminate\Support\Facades\Log;
use Illuminate\View\View;
use Modules\Moabom\System\Services\MoabomExtensionAssetGroupService;
use Modules\Moabom\System\Services\Shell\MoabomShellCriticalSnapshot;
use Modules\Moabom\System\Support\MoabomHomeShellRequest;
use Modules\Moabom\System\Support\MoabomPublicApiCache;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;
use Modules\Moabom\System\Support\MoabomUserSurfaceBootAssetPolicy;

/**
 * 코어 `UserTemplateComposer` 대체 — G7 compose 계약 유지 + immediate/deferred 에셋.
 *
 * G7 7.0.2+ 는 `TemplateManager`·`bundleUrls`·`templateExternals`·`active*Meta`·
 * `extensionCacheVersion` 을 SPA 셸 계약에 포함한다. parent private trait 메서드를
 * 우회하지 않고 동일 공개 API 로 계약을 채운 뒤, Moabom 에셋 그룹만 교체한다.
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
        private readonly TemplateManager $moabomTemplateManager,
        private readonly MoabomExtensionAssetGroupService $extensionAssetGroupService,
        private readonly MoabomShellCriticalSnapshot $shellCriticalSnapshot,
    ) {
        parent::__construct(
            $moabomTemplateService,
            $moabomSettingsService,
            $moabomModuleSettingsService,
            $moabomPluginSettingsService,
            $moabomModuleManager,
            $moabomPluginManager,
            $moabomTemplateManager,
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

        $ghostTemplate = (string) config('moabom-system.boot_asset_ghost.user_template', 'moabom-basic');
        $useHomeShellDefer = is_string($activeTemplate)
            && $activeTemplate === $ghostTemplate
            && MoabomHomeShellRequest::matchesCurrentRequest();
        if ($useHomeShellDefer) {
            $moduleGroups = MoabomUserSurfaceBootAssetPolicy::forceDeferModules($moduleGroups);
            $pluginGroups = MoabomUserSurfaceBootAssetPolicy::forceDeferPlugins($pluginGroups);
        }

        $extensionCacheVersion = ClearsTemplateCaches::getExtensionCacheVersion();

        try {
            $appConfig = $this->moabomSettingsService->getAppConfigForFrontend();
        } catch (\Throwable) {
            $appConfig = [];
        }

        $appConfig = $this->withDeferredRegistry(
            is_array($appConfig) ? $appConfig : [],
            $moduleGroups['deferred'],
            $pluginGroups['deferred'],
        );
        $appConfig = $this->withExtensionEpoch($appConfig);

        $shellCritical = null;
        if ($useHomeShellDefer && is_string($activeTemplate) && $activeTemplate !== '') {
            try {
                $shellCritical = $this->shellCriticalSnapshot->buildInline($activeTemplate);
            } catch (\Throwable) {
                $shellCritical = null;
            }
        }

        // 홈 셸에서는 concat 번들 대신 immediate 개별 에셋만 로드 (force-defer 와 정합)
        $bundleUrls = $useHomeShellDefer
            ? null
            : $this->resolveBundleUrls(
                $moduleGroups['immediate'],
                $pluginGroups['immediate'],
                $extensionCacheVersion,
            );

        return [
            'activeUserTemplate' => $activeTemplate,
            'extensionCacheVersion' => $extensionCacheVersion,
            'frontendSettings' => $frontendSettings,
            'pluginSettings' => $pluginSettings,
            'moduleSettings' => $moduleSettings,
            'moduleAssets' => $moduleGroups['immediate'],
            'deferredModuleAssets' => $moduleGroups['deferred'],
            'pluginAssets' => $pluginGroups['immediate'],
            'deferredPluginAssets' => $pluginGroups['deferred'],
            'bundleUrls' => $bundleUrls,
            'activeModulesMeta' => $this->resolveActiveModulesMeta(),
            'activePluginsMeta' => $this->resolveActivePluginsMeta(),
            'appConfig' => $appConfig,
            'templateExternals' => $this->resolveTemplateExternals($activeTemplate),
            'shellCritical' => $shellCritical,
        ];
    }

    /**
     * @param  array<string, mixed>  $moduleAssets
     * @param  array<string, mixed>  $pluginAssets
     * @return array{moduleJs: ?string, moduleCss: ?string, pluginJs: ?string, pluginCss: ?string}
     */
    private function resolveBundleUrls(array $moduleAssets, array $pluginAssets, int $version): array
    {
        $hasJs = static fn (array $assets): bool => ! empty(array_filter($assets, fn ($a) => ! empty($a['js'])));
        $hasCss = static fn (array $assets): bool => ! empty(array_filter($assets, fn ($a) => ! empty($a['css'])));

        return [
            'moduleJs' => $hasJs($moduleAssets) ? "/api/modules/bundle.js?v={$version}" : null,
            'moduleCss' => $hasCss($moduleAssets) ? "/api/modules/bundle.css?v={$version}" : null,
            'pluginJs' => $hasJs($pluginAssets) ? "/api/plugins/bundle.js?v={$version}" : null,
            'pluginCss' => $hasCss($pluginAssets) ? "/api/plugins/bundle.css?v={$version}" : null,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function resolveTemplateExternals(?string $templateIdentifier): array
    {
        if ($templateIdentifier === null || $templateIdentifier === '') {
            return [];
        }

        try {
            $template = $this->moabomTemplateManager->getTemplate($templateIdentifier);
            if (! $template || empty($template['externals']) || ! is_array($template['externals'])) {
                return [];
            }

            return TemplateExternals::normalize($template['externals']);
        } catch (\Throwable $e) {
            Log::warning('Failed to collect template externals: '.$e->getMessage());

            return [];
        }
    }

    /**
     * @return array<int, array{identifier: string, display_name: string|array, version: string}>
     */
    private function resolveActiveModulesMeta(): array
    {
        $meta = [];

        try {
            foreach ($this->moabomModuleManager->getActiveModules() as $module) {
                $meta[] = [
                    'identifier' => $module->getIdentifier(),
                    'display_name' => $module->getName(),
                    'version' => $module->getVersion(),
                ];
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to collect active modules meta: '.$e->getMessage());
        }

        return $meta;
    }

    /**
     * @return array<int, array{identifier: string, display_name: string|array, version: string}>
     */
    private function resolveActivePluginsMeta(): array
    {
        $meta = [];

        try {
            foreach ($this->moabomPluginManager->getActivePlugins() as $plugin) {
                $meta[] = [
                    'identifier' => $plugin->getIdentifier(),
                    'display_name' => $plugin->getName(),
                    'version' => $plugin->getVersion(),
                ];
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to collect active plugins meta: '.$e->getMessage());
        }

        return $meta;
    }

    /**
     * @param  array<string, mixed>  $appConfig
     * @param  array<string, mixed>  $fullModules
     * @param  array<string, mixed>  $fullPlugins
     * @return array<string, mixed>
     */
    private function withDeferredRegistry(array $appConfig, array $fullModules, array $fullPlugins): array
    {
        if ($fullModules === [] && $fullPlugins === []) {
            return $appConfig;
        }

        $moabom = isset($appConfig['moabom']) && is_array($appConfig['moabom']) ? $appConfig['moabom'] : [];
        $moabom['extensionDeferredRegistry'] = [
            'modules' => $fullModules,
            'plugins' => $fullPlugins,
        ];
        $appConfig['moabom'] = $moabom;

        return $appConfig;
    }

    /**
     * @param  array<string, mixed>  $appConfig
     * @return array<string, mixed>
     */
    private function withExtensionEpoch(array $appConfig): array
    {
        $moabom = isset($appConfig['moabom']) && is_array($appConfig['moabom']) ? $appConfig['moabom'] : [];
        $moabom['extension_epoch'] = ModuleManager::getExtensionCacheVersion();
        $appConfig['moabom'] = $moabom;

        return $appConfig;
    }
}
