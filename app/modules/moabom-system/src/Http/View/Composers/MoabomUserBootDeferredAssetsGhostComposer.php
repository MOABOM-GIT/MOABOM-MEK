<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\View\Composers;

use App\Extension\ModuleManager;
use Illuminate\Http\Request;
use Illuminate\View\View;

/**
 * moabom-basic 홈(등 설정 경로) 최초 페인트에서 지연 확장 에셋 맵을 최소화합니다.
 *
 * `MoabomUserTemplateComposer` 등 서비스 바인딩으로 정제된 `deferred*` 맵을 기준으로 동작한다.
 * `deferredModuleAssets` / `deferredPluginAssets` 만 덮어씁니다.
 */
final class MoabomUserBootDeferredAssetsGhostComposer
{
    public function compose(View $view): void
    {
        if (! config('moabom-system.boot_asset_ghost.enabled', true)) {
            return;
        }

        $targetTemplate = (string) config('moabom-system.boot_asset_ghost.user_template', 'moabom-basic');
        $active = $view->offsetGet('activeUserTemplate');

        if (! is_string($active) || $active === '' || $active !== $targetTemplate) {
            return;
        }

        $request = request();
        if (! $request instanceof Request) {
            return;
        }

        $paths = config('moabom-system.boot_asset_ghost.strip_deferred_on_request_paths', ['']);
        if (! is_array($paths) || $paths === []) {
            return;
        }

        if (! $this->requestMatchesGhostPaths($request, $paths)) {
            $this->mergeExtensionEpochOnly($view);

            return;
        }

        $deferredModules = $view->offsetGet('deferredModuleAssets');
        $deferredPlugins = $view->offsetGet('deferredPluginAssets');
        $fullModules = is_array($deferredModules) ? $deferredModules : [];
        $fullPlugins = is_array($deferredPlugins) ? $deferredPlugins : [];

        // Ghost 표면은 비우되, 라우트 전환 후 loadDeferredExtensionAssets 가 URL을 찾을 수 있도록
        // 전체 맵을 appConfig.moabom.extensionDeferredRegistry 에 보존한다(코어 Blade 변경 없음).
        $this->mergeExtensionRegistryIntoAppConfig($view, $fullModules, $fullPlugins);

        if ($fullModules !== []) {
            $allowModules = config('moabom-system.boot_asset_ghost.home_shell_deferred_module_allowlist', []);
            $allowModules = is_array($allowModules) ? $allowModules : [];
            $view->with('deferredModuleAssets', $this->filterDeferredMap($fullModules, $allowModules));
        }

        if (config('moabom-system.boot_asset_ghost.strip_deferred_plugins_on_same_paths', true) && $fullPlugins !== []) {
            $allowPlugins = config('moabom-system.boot_asset_ghost.home_shell_deferred_plugin_allowlist', []);
            $allowPlugins = is_array($allowPlugins) ? $allowPlugins : [];
            $view->with('deferredPluginAssets', $this->filterDeferredMap($fullPlugins, $allowPlugins));
        }

        $this->mergeExtensionEpochOnly($view);
    }

    /**
     * @param  array<string, mixed>  $fullModules
     * @param  array<string, mixed>  $fullPlugins
     */
    private function mergeExtensionRegistryIntoAppConfig(View $view, array $fullModules, array $fullPlugins): void
    {
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

    private function mergeExtensionEpochOnly(View $view): void
    {
        $appConfig = $view->offsetGet('appConfig');
        $appConfig = is_array($appConfig) ? $appConfig : [];
        $moabom = isset($appConfig['moabom']) && is_array($appConfig['moabom']) ? $appConfig['moabom'] : [];
        $moabom['extension_epoch'] = ModuleManager::getExtensionCacheVersion();
        $appConfig['moabom'] = $moabom;
        $view->with('appConfig', $appConfig);
    }

    /**
     * @param  array<string, mixed>  $deferred
     * @param  array<int, string>  $allowlist
     * @return array<string, mixed>
     */
    private function filterDeferredMap(array $deferred, array $allowlist): array
    {
        if ($allowlist === []) {
            return [];
        }

        $flip = array_flip($allowlist);

        return array_intersect_key($deferred, $flip);
    }

    /**
     * @param  array<int, string>  $paths
     */
    private function requestMatchesGhostPaths(Request $request, array $paths): bool
    {
        $current = trim($request->path(), '/');

        foreach ($paths as $p) {
            $normalized = trim((string) $p, '/');
            if ($current === $normalized) {
                return true;
            }
        }

        return false;
    }
}
