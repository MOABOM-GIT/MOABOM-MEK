<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Support;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Saas\SaasCoreSettingsHydrator;
use Modules\Moabom\System\Support\MoabomPublicApiCacheKeys;
use Modules\Moabom\System\Tests\ModuleTestCase;

class MoabomPublicApiCacheKeysTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->app->register(SystemServiceProvider::class);
        Storage::fake('settings');
    }

    public function test_core_settings_revision_token_changes_when_site_name_changes(): void
    {
        config(['moabom-system.saas.enabled' => true]);

        $repo = app(\App\Contracts\Repositories\ConfigRepositoryInterface::class);
        $repo->saveCategory('general', ['site_name' => '스마트케어']);
        app(SaasCoreSettingsHydrator::class)->hydrate();
        $first = MoabomPublicApiCacheKeys::coreSettingsRevisionToken();

        $repo->saveCategory('general', ['site_name' => '스마트케어360']);
        app(SaasCoreSettingsHydrator::class)->hydrate();
        $second = MoabomPublicApiCacheKeys::coreSettingsRevisionToken();

        $this->assertNotSame($first, $second);
    }

    public function test_app_blade_home_shell_key_includes_core_settings_revision(): void
    {
        config(['moabom-system.saas.enabled' => true]);

        app(\App\Contracts\Repositories\ConfigRepositoryInterface::class)
            ->saveCategory('general', ['site_name' => '스마트케어360']);
        app(SaasCoreSettingsHydrator::class)->hydrate();

        $token = MoabomPublicApiCacheKeys::coreSettingsRevisionToken();
        $key = MoabomPublicApiCacheKeys::appBladeHomeShell(3);

        $this->assertStringContainsString($token, $key);
        $this->assertStringStartsWith('moabom.public.app_blade_shell:3:', $key);
    }
}
