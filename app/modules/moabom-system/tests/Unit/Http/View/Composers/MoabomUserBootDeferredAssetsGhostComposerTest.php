<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Http\View\Composers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Modules\Moabom\System\Http\View\Composers\MoabomUserBootDeferredAssetsGhostComposer;
use Modules\Moabom\System\Tests\ModuleTestCase;

class MoabomUserBootDeferredAssetsGhostComposerTest extends ModuleTestCase
{
    private function mergeBootGhostConfig(array $ghost): void
    {
        $base = config('moabom-system', []);
        if (! is_array($base)) {
            $base = [];
        }
        $base['boot_asset_ghost'] = array_replace_recursive(
            config('moabom-system.boot_asset_ghost', []),
            $ghost
        );
        Config::set('moabom-system', $base);
    }

    public function test_root_request_strips_deferred_maps_for_moabom_basic_when_allowlists_empty(): void
    {
        $this->mergeBootGhostConfig([
            'enabled' => true,
            'user_template' => 'moabom-basic',
            'strip_deferred_on_request_paths' => [''],
            'home_shell_deferred_module_allowlist' => [],
            'strip_deferred_plugins_on_same_paths' => true,
            'home_shell_deferred_plugin_allowlist' => [],
        ]);

        $this->app->instance('request', Request::create('/', 'GET'));

        $view = app('view')->file(resource_path('views/errors/404.blade.php'), [
            'activeUserTemplate' => 'moabom-basic',
            'appConfig' => [],
            'deferredModuleAssets' => [
                'sirsoft-ecommerce' => ['js' => '/api/modules/assets/sirsoft-ecommerce/x.js'],
            ],
            'deferredPluginAssets' => [
                'moabom-pwa' => ['js' => '/api/plugins/assets/moabom-pwa/y.js'],
            ],
        ]);

        (new MoabomUserBootDeferredAssetsGhostComposer)->compose($view);

        $data = $view->gatherData();
        $this->assertSame([], $data['deferredModuleAssets']);
        $this->assertSame([], $data['deferredPluginAssets']);
        $this->assertArrayHasKey('extensionDeferredRegistry', $data['appConfig']['moabom']);
        $this->assertArrayHasKey('sirsoft-ecommerce', $data['appConfig']['moabom']['extensionDeferredRegistry']['modules']);
        $this->assertArrayHasKey('moabom-pwa', $data['appConfig']['moabom']['extensionDeferredRegistry']['plugins']);
        $this->assertIsInt($data['appConfig']['moabom']['extension_epoch']);
    }

    public function test_non_root_path_leaves_deferred_unchanged(): void
    {
        $this->mergeBootGhostConfig([
            'enabled' => true,
            'user_template' => 'moabom-basic',
            'strip_deferred_on_request_paths' => [''],
        ]);

        $originalModules = ['sirsoft-ecommerce' => ['js' => '/x.js']];
        $originalPlugins = ['moabom-pwa' => ['js' => '/y.js']];

        $this->app->instance('request', Request::create('/shop', 'GET'));

        $view = app('view')->file(resource_path('views/errors/404.blade.php'), [
            'activeUserTemplate' => 'moabom-basic',
            'appConfig' => [],
            'deferredModuleAssets' => $originalModules,
            'deferredPluginAssets' => $originalPlugins,
        ]);

        (new MoabomUserBootDeferredAssetsGhostComposer)->compose($view);

        $data = $view->gatherData();
        $this->assertSame($originalModules, $data['deferredModuleAssets']);
        $this->assertSame($originalPlugins, $data['deferredPluginAssets']);
        $this->assertArrayHasKey('extensionDeferredRegistry', $data['appConfig']['moabom']);
        $this->assertSame($originalModules, $data['appConfig']['moabom']['extensionDeferredRegistry']['modules']);
        $this->assertSame($originalPlugins, $data['appConfig']['moabom']['extensionDeferredRegistry']['plugins']);
        $this->assertIsInt($data['appConfig']['moabom']['extension_epoch']);
    }

    public function test_module_allowlist_preserves_matching_keys_only(): void
    {
        $this->mergeBootGhostConfig([
            'enabled' => true,
            'user_template' => 'moabom-basic',
            'strip_deferred_on_request_paths' => [''],
            'home_shell_deferred_module_allowlist' => ['keep-mod'],
            'strip_deferred_plugins_on_same_paths' => false,
        ]);

        $this->app->instance('request', Request::create('/', 'GET'));

        $view = app('view')->file(resource_path('views/errors/404.blade.php'), [
            'activeUserTemplate' => 'moabom-basic',
            'appConfig' => [],
            'deferredModuleAssets' => [
                'keep-mod' => ['js' => '/a.js'],
                'drop-mod' => ['js' => '/b.js'],
            ],
            'deferredPluginAssets' => ['p' => ['js' => '/c.js']],
        ]);

        (new MoabomUserBootDeferredAssetsGhostComposer)->compose($view);

        $data = $view->gatherData();
        $this->assertSame(['keep-mod' => ['js' => '/a.js']], $data['deferredModuleAssets']);
        $this->assertSame(['p' => ['js' => '/c.js']], $data['deferredPluginAssets']);
        $this->assertArrayHasKey('drop-mod', $data['appConfig']['moabom']['extensionDeferredRegistry']['modules']);
    }
}
