<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Http\View\Composers;

use App\Extension\ModuleManager;
use Illuminate\Http\Request;
use Illuminate\View\View;
use Modules\Moabom\System\Support\MoabomExtensionDeferredRegistrySupport;

/**
 * moabom-basic 홈(등 설정 경로) 최초 페인트에서 지연 확장 에셋 맵을 최소화합니다.
 *
 * `MoabomUserTemplateComposer` 등 서비스 바인딩으로 정제된 `deferred*` 맵을 기준으로 동작한다.
 * `deferredModuleAssets` / `deferredPluginAssets` 만 덮어씁니다.
 *
 * 코어 Blade가 deferred 맵을 G7Config에 주입하지 않으므로, **모든 moabom-basic 요청**에서
 * `extensionDeferredRegistry`를 appConfig에 병합해 직접 진입(/shop 등)·Ghost 복원이 동일하게 동작한다.
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

        $deferredModules = $view->offsetGet('deferredModuleAssets');
        $deferredPlugins = $view->offsetGet('deferredPluginAssets');
        $fullModules = is_array($deferredModules) ? $deferredModules : [];
        $fullPlugins = is_array($deferredPlugins) ? $deferredPlugins : [];

        MoabomExtensionDeferredRegistrySupport::mergeRegistryIntoAppConfig($view, $fullModules, $fullPlugins);

        $request = request();
        if (! $request instanceof Request) {
            MoabomExtensionDeferredRegistrySupport::mergeExtensionEpochIntoAppConfig($view);

            return;
        }

        $paths = config('moabom-system.boot_asset_ghost.strip_deferred_on_request_paths', ['']);
        if (! is_array($paths) || $paths === []) {
            MoabomExtensionDeferredRegistrySupport::mergeExtensionEpochIntoAppConfig($view);

            return;
        }

        if (! $this->requestMatchesGhostPaths($request, $paths)) {
            MoabomExtensionDeferredRegistrySupport::mergeExtensionEpochIntoAppConfig($view);

            return;
        }

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

        MoabomExtensionDeferredRegistrySupport::mergeExtensionEpochIntoAppConfig($view);
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
