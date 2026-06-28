<?php

namespace Modules\Moabom\System\Tests\Unit\Repositories;

use App\Contracts\Repositories\ConfigRepositoryInterface;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Repositories\MoabomJsonConfigRepository;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Tests\ModuleTestCase;

class MoabomJsonConfigRepositoryTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->app->register(SystemServiceProvider::class);
        Cache::flush();
    }

    public function test_container_scopes_repository_per_request(): void
    {
        $first = $this->app->make(ConfigRepositoryInterface::class);
        $second = $this->app->make(ConfigRepositoryInterface::class);

        $this->assertInstanceOf(MoabomJsonConfigRepository::class, $first);
        $this->assertSame($first, $second);
    }

    public function test_get_category_is_memoized_within_repository_instance(): void
    {
        Storage::fake('settings');

        $repo = $this->app->make(ConfigRepositoryInterface::class);
        $this->assertTrue($repo->saveCategory('general', ['site_name' => 'A']));

        $first = $repo->getCategory('general');
        Storage::disk('settings')->delete('general.json');
        $second = $repo->getCategory('general');

        $this->assertSame('A', $first['site_name']);
        $this->assertSame('A', $second['site_name']);
    }

    public function test_save_category_writes_via_storage_put_not_local_path(): void
    {
        Storage::fake('settings');

        $repo = $this->app->make(ConfigRepositoryInterface::class);

        $result = $repo->saveCategory('general', [
            'site_name' => '상쾌한이비인후과',
        ]);

        $this->assertTrue($result);
        Storage::disk('settings')->assertExists('general.json');

        $content = json_decode(Storage::disk('settings')->get('general.json'), true);
        $this->assertSame('상쾌한이비인후과', $content['site_name']);
        $this->assertArrayHasKey('_meta', $content);
    }

    public function test_all_returns_fresh_data_after_save_without_memory_cache(): void
    {
        Storage::fake('settings');
        Cache::flush();

        $repo = $this->app->make(ConfigRepositoryInterface::class);
        $this->assertTrue($repo->saveCategory('general', [
            'site_name' => '저장 전',
        ]));
        $this->assertSame('저장 전', $repo->all()['general']['site_name']);

        $this->assertTrue($repo->saveCategory('general', [
            'site_name' => '저장 후',
            'site_url' => 'https://freshent.mek360.com',
            'admin_email' => 'admin@example.com',
            'timezone' => 'Asia/Seoul',
            'language' => 'ko',
        ]));

        $this->assertSame('저장 후', $repo->all()['general']['site_name']);
    }

    public function test_tenant_scoped_cache_when_env_unavailable_after_config_cache(): void
    {
        Storage::fake('settings');
        config([
            'moabom-system.saas.enabled' => true,
            'cache.g7_json_settings_ttl' => 300,
            'filesystems.disks.settings.driver' => 'local',
        ]);
        putenv('G7_JSON_SETTINGS_CACHE_TTL');
        unset($_ENV['G7_JSON_SETTINGS_CACHE_TTL']);

        $tenant = new \Modules\Moabom\System\Saas\TenantRecord(
            1,
            'e2etest',
            'e2etest.mek360.com',
            'hospital_e2etest',
            'tenants/e2etest',
            'hospital-default',
            'active',
        );

        app(\Modules\Moabom\System\Saas\TenantContext::class)->setPlatform('mek360.com');
        app(ConfigRepositoryInterface::class)->saveCategory('general', ['site_name' => '스마트케어']);
        $this->app->forgetScopedInstances();

        app(\Modules\Moabom\System\Saas\TenantFilesystemConfigurator::class)->apply($tenant);
        app(\Modules\Moabom\System\Saas\TenantContext::class)->setTenant($tenant, 'e2etest.mek360.com');

        $repo = $this->app->make(ConfigRepositoryInterface::class);
        $repo->saveCategory('general', ['site_name' => 'E2E테스트업체']);

        $this->assertSame('E2E테스트업체', $repo->getCategory('general')['site_name']);
        $this->assertSame(
            'E2E테스트업체',
            Cache::get('g7_json_settings:e2etest:general')['site_name'] ?? null,
        );
        $this->assertNotSame(
            Cache::get('g7_json_settings:e2etest:general'),
            Cache::get('g7_json_settings:platform:general'),
        );
    }
}
