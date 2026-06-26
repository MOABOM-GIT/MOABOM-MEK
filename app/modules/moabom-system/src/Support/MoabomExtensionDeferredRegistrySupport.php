<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Support;

use App\Extension\ModuleManager;
use Illuminate\View\View;

/**
 * 코어 Blade가 `deferredModuleAssets`를 G7Config에 주입하지 않으므로,
 * 지연 확장 URL 맵을 `appConfig.moabom.extensionDeferredRegistry`에 보존한다.
 *
 * @see MoabomUserBootDeferredAssetsGhostComposer
 * @see extension-boot-meta-api.md
 */
final class MoabomExtensionDeferredRegistrySupport
{
    /**
     * @param  array<string, mixed>  $fullModules
     * @param  array<string, mixed>  $fullPlugins
     */
    public static function mergeRegistryIntoAppConfig(View $view, array $fullModules, array $fullPlugins): void
    {
        if ($fullModules === [] && $fullPlugins === []) {
            return;
        }

        $appConfig = $view->offsetGet('appConfig');
        $appConfig = is_array($appConfig) ? $appConfig : [];
        $moabom = isset($appConfig['moabom']) && is_array($appConfig['moabom']) ? $appConfig['moabom'] : [];

        $moabom['extensionDeferredRegistry'] = [
            'modules' => $fullModules,
            'plugins' => $fullPlugins,
        ];

        $appConfig['moabom'] = $moabom;
        $view->with('appConfig', $appConfig);
    }

    public static function mergeExtensionEpochIntoAppConfig(View $view): void
    {
        $appConfig = $view->offsetGet('appConfig');
        $appConfig = is_array($appConfig) ? $appConfig : [];
        $moabom = isset($appConfig['moabom']) && is_array($appConfig['moabom']) ? $appConfig['moabom'] : [];
        $moabom['extension_epoch'] = ModuleManager::getExtensionCacheVersion();
        $appConfig['moabom'] = $moabom;
        $view->with('appConfig', $appConfig);
    }
}
