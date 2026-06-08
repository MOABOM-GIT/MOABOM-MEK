<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Providers;

use App\Contracts\Repositories\ConfigRepositoryInterface;
use App\Extension\Helpers\ExtensionMenuSyncHelper;
use App\Http\View\Composers\TemplateComposer;
use App\Http\View\Composers\UserTemplateComposer;
use App\Services\ModuleSettingsService;
use App\Services\PluginSettingsService;
use Modules\Moabom\System\Extension\MoabomExtensionMenuSyncHelper;
use Modules\Moabom\System\Http\View\Composers\MoabomTemplateComposer;
use Modules\Moabom\System\Http\View\Composers\MoabomUserTemplateComposer;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Repositories\MoabomJsonConfigRepository;
use Modules\Moabom\System\Services\MoabomExtensionAssetGroupService;
use Modules\Moabom\System\Services\MoabomModuleSettingsService;
use Modules\Moabom\System\Services\MoabomPluginSettingsService;
use Modules\Moabom\System\Tests\ModuleTestCase;

class MoabomServiceContainerBindingsTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->app->register(SystemServiceProvider::class);
    }

    public function test_config_repository_resolves_to_moabom_gcs_compatible_implementation(): void
    {
        $repo = $this->app->make(ConfigRepositoryInterface::class);
        $this->assertInstanceOf(MoabomJsonConfigRepository::class, $repo);
    }

    public function test_config_repository_is_scoped_per_request(): void
    {
        $first = $this->app->make(ConfigRepositoryInterface::class);
        $second = $this->app->make(ConfigRepositoryInterface::class);
        $this->assertSame($first, $second);
    }

    public function test_saas_settings_hydrator_is_scoped_per_request(): void
    {
        $first = $this->app->make(\Modules\Moabom\System\Saas\SaasCoreSettingsHydrator::class);
        $second = $this->app->make(\Modules\Moabom\System\Saas\SaasCoreSettingsHydrator::class);
        $this->assertSame($first, $second);

        $this->app->forgetScopedInstances();

        $third = $this->app->make(\Modules\Moabom\System\Saas\SaasCoreSettingsHydrator::class);
        $this->assertNotSame($first, $third);
    }

    public function test_core_settings_services_resolve_to_moabom_implementations(): void
    {
        $this->assertInstanceOf(MoabomModuleSettingsService::class, $this->app->make(ModuleSettingsService::class));
        $this->assertInstanceOf(MoabomPluginSettingsService::class, $this->app->make(PluginSettingsService::class));
    }

    public function test_view_composers_resolve_to_moabom_wrappers(): void
    {
        $this->assertInstanceOf(MoabomUserTemplateComposer::class, $this->app->make(UserTemplateComposer::class));
        $this->assertInstanceOf(MoabomTemplateComposer::class, $this->app->make(TemplateComposer::class));
    }

    public function test_extension_asset_group_service_is_singleton(): void
    {
        $a = $this->app->make(MoabomExtensionAssetGroupService::class);
        $b = $this->app->make(MoabomExtensionAssetGroupService::class);
        $this->assertSame($a, $b);
    }

    public function test_extension_menu_sync_helper_resolves_to_moabom_implementation(): void
    {
        $this->assertInstanceOf(MoabomExtensionMenuSyncHelper::class, $this->app->make(ExtensionMenuSyncHelper::class));
    }
}
