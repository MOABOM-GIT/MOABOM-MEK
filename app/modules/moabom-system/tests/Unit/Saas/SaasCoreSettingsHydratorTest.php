<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use App\Contracts\Repositories\ConfigRepositoryInterface;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Saas\SaasCoreSettingsHydrator;
use Modules\Moabom\System\Tests\ModuleTestCase;

class SaasCoreSettingsHydratorTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->app->register(SystemServiceProvider::class);
        Storage::fake('settings');
    }

    public function test_hydrates_g7_settings_core_and_app_name_from_gcs_snapshot(): void
    {
        config(['moabom-system.saas.enabled' => true]);
        Config::set('app.name', '부팅 시점 이름');
        Config::set('g7_settings.core', []);

        $repo = $this->app->make(ConfigRepositoryInterface::class);
        $repo->saveCategory('general', [
            'site_name' => '스마트케어360',
            'site_description' => '통합 케어 플랫폼',
            'timezone' => 'Asia/Seoul',
            'language' => 'ko',
        ]);
        $repo->saveCategory('seo', [
            'generator_enabled' => true,
            'generator_content' => 'SmartCare',
        ]);
        $repo->saveCategory('drivers', [
            'websocket_enabled' => true,
            'websocket_app_id' => 'moabom-laravel',
            'websocket_app_key' => 'test-key',
            'websocket_app_secret' => 'test-secret',
            'websocket_host' => 'tenant.mek360.com',
            'websocket_port' => 443,
            'websocket_scheme' => 'https',
            'websocket_server_host' => '127.0.0.1',
            'websocket_server_port' => 6001,
            'websocket_server_scheme' => 'http',
        ]);

        app(SaasCoreSettingsHydrator::class)->hydrate();

        $this->assertSame('스마트케어360', config('app.name'));
        $this->assertSame('스마트케어360', config('g7_settings.core.general.site_name'));
        $this->assertSame('통합 케어 플랫폼', config('g7_settings.core.general.site_description'));
        $this->assertSame('SmartCare', config('g7_settings.core.seo.generator_content'));
        $this->assertSame('Asia/Seoul', config('app.default_user_timezone'));
        $this->assertSame('ko', config('app.locale'));
        $this->assertSame('tenant.mek360.com', config('g7.websocket.client.host'));
        $this->assertSame('test-key', config('broadcasting.connections.reverb.key'));
    }

    public function test_settings_revision_token_changes_when_seo_changes(): void
    {
        config(['moabom-system.saas.enabled' => true]);

        $repo = $this->app->make(ConfigRepositoryInterface::class);
        $repo->saveCategory('general', ['site_name' => 'A']);
        $repo->saveCategory('seo', ['generator_content' => 'v1']);

        $hydrator = app(SaasCoreSettingsHydrator::class);
        $hydrator->hydrate();
        $first = $hydrator->settingsRevisionToken();

        $repo->saveCategory('seo', ['generator_content' => 'v2']);
        $hydrator->hydrate();
        $second = $hydrator->settingsRevisionToken();

        $this->assertNotSame($first, $second);
    }

    public function test_no_op_when_saas_disabled(): void
    {
        config(['moabom-system.saas.enabled' => false]);
        Config::set('app.name', '유지');

        app(SaasCoreSettingsHydrator::class)->hydrate();

        $this->assertSame('유지', config('app.name'));
    }
}
