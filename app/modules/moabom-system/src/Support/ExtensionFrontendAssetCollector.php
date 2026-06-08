<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Support;

use App\Extension\AbstractModule;
use App\Extension\AbstractPlugin;
use App\Extension\ModuleManager;
use App\Extension\PluginManager;
use App\Extension\Traits\ClearsTemplateCaches;
use Illuminate\Support\Facades\Log;

/**
 * 활성 확장의 프론트엔드 에셋을 immediate / deferred 그룹으로 수집한다.
 *
 * {@see MoabomExtensionAssetGroupService} 가 DB 활성 기준으로 필터링한다.
 */
final class ExtensionFrontendAssetCollector
{
    /**
     * @return array{immediate: array<string, array<string, mixed>>, deferred: array<string, array<string, mixed>>}
     */
    public static function collectModuleGroups(ModuleManager $moduleManager): array
    {
        return self::collectGroups($moduleManager->getActiveModules(), 'modules');
    }

    /**
     * @return array{immediate: array<string, array<string, mixed>>, deferred: array<string, array<string, mixed>>}
     */
    public static function collectPluginGroups(PluginManager $pluginManager): array
    {
        return self::collectGroups($pluginManager->getActivePlugins(), 'plugins');
    }

    /**
     * @param  iterable<string, AbstractModule|AbstractPlugin>  $extensions
     * @return array{immediate: array<string, array<string, mixed>>, deferred: array<string, array<string, mixed>>}
     */
    private static function collectGroups(iterable $extensions, string $assetType): array
    {
        $immediate = [];
        $deferred = [];

        try {
            $cacheVersion = ClearsTemplateCaches::getExtensionCacheVersion();

            foreach ($extensions as $identifier => $extension) {
                if (! $extension->hasAssets()) {
                    continue;
                }

                $entry = self::buildAssetEntry($extension, (string) $identifier, $assetType, $cacheVersion);
                if ($entry === null) {
                    continue;
                }

                $strategy = $extension->getAssetLoadingConfig()['strategy'] ?? 'global';
                if (in_array($strategy, ['lazy', 'layout'], true)) {
                    $deferred[$identifier] = $entry;
                } else {
                    $immediate[$identifier] = $entry;
                }
            }

            uasort($immediate, fn (array $a, array $b): int => $a['priority'] <=> $b['priority']);
            uasort($deferred, fn (array $a, array $b): int => $a['priority'] <=> $b['priority']);
        } catch (\Throwable $e) {
            Log::warning('Failed to collect extension frontend assets: '.$e->getMessage());
        }

        return [
            'immediate' => $immediate,
            'deferred' => $deferred,
        ];
    }

    /**
     * @return array{js?: string, css?: string, priority: int, external?: array}|null
     */
    private static function buildAssetEntry(
        AbstractModule|AbstractPlugin $extension,
        string $identifier,
        string $assetType,
        int|string $cacheVersion,
    ): ?array {
        $builtPaths = $extension->getBuiltAssetPaths();
        $loadingConfig = $extension->getAssetLoadingConfig();
        $assetConfig = $extension->getAssets();

        $entry = [
            'priority' => $loadingConfig['priority'],
        ];

        if (! empty($builtPaths['js'])) {
            $entry['js'] = "/api/{$assetType}/assets/{$identifier}/".$builtPaths['js']."?v={$cacheVersion}";
        }

        if (! empty($builtPaths['css'])) {
            $entry['css'] = "/api/{$assetType}/assets/{$identifier}/".$builtPaths['css']."?v={$cacheVersion}";
        }

        if (! empty($assetConfig['external'])) {
            $entry['external'] = $assetConfig['external'];
        }

        if (empty($entry['js']) && empty($entry['css']) && empty($entry['external'] ?? null)) {
            return null;
        }

        return $entry;
    }
}
