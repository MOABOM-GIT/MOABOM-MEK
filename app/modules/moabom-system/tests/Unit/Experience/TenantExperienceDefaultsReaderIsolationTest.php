<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Experience;

use App\Contracts\Repositories\ConfigRepositoryInterface;
use Illuminate\Support\Facades\Config as LaravelConfig;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Experience\TenantExperienceDefaultsReader;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Saas\SaasCoreSettingsHydrator;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantFilesystemConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Saas\TenantRuntimeBootstrap;
use Modules\Moabom\System\Tests\ModuleTestCase;

/**
 * Run 워커에서 platform 요청 직후 tenant 요청 시 site_name 오염 방지.
 */
class TenantExperienceDefaultsReaderIsolationTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->app->register(SystemServiceProvider::class);
        Storage::fake('settings');
        LaravelConfig::set('moabom-system.saas.enabled', true);
        LaravelConfig::set('filesystems.disks.settings.driver', 'local');
        LaravelConfig::set('filesystems.disks.attachments.driver', 'local');
    }

    public function test_site_meta_reflects_tenant_general_after_platform_request(): void
    {
        app(TenantContext::class)->setPlatform('mek360.com');
        $platformRepo = app(ConfigRepositoryInterface::class);
        $platformRepo->saveCategory('general', [
            'site_name' => '스마트케어',
            'site_url' => 'https://mek360.com',
        ]);
        app(SaasCoreSettingsHydrator::class)->hydrate();
        $platformMeta = app(TenantExperienceDefaultsReader::class)->siteMeta();
        $this->assertSame('스마트케어', $platformMeta['site_name']);
        $this->assertTrue($platformMeta['is_platform']);

        $this->app->forgetScopedInstances();

        $tenant = new TenantRecord(
            id: 1,
            slug: 'e2etest',
            host: 'e2etest.mek360.com',
            dbDatabase: 'hospital_e2etest',
            gcsPrefix: 'tenants/e2etest',
            packageId: 'hospital-default',
            status: 'active',
            appUrl: 'https://e2etest.mek360.com',
        );

        app(TenantFilesystemConfigurator::class)->apply($tenant);
        app(TenantContext::class)->setTenant($tenant, 'e2etest.mek360.com');

        $tenantRepo = app(ConfigRepositoryInterface::class);
        $this->assertNotSame($platformRepo, $tenantRepo);

        $tenantRepo->saveCategory('general', [
            'site_name' => 'E2E테스트병원',
            'site_url' => 'https://e2etest.mek360.com',
        ]);
        app(SaasCoreSettingsHydrator::class)->hydrate();

        $tenantMeta = app(TenantExperienceDefaultsReader::class)->siteMeta();
        $this->assertSame('E2E테스트병원', $tenantMeta['site_name']);
        $this->assertFalse($tenantMeta['is_platform']);
    }

    public function test_runtime_bootstrap_clears_repository_memo_on_tenant_switch(): void
    {
        $bootstrap = app(TenantRuntimeBootstrap::class);
        $request = request();

        $bootstrap->bootstrapPlatform($request, ['type' => 'platform', 'host' => 'mek360.com', 'slug' => null]);
        app(ConfigRepositoryInterface::class)->saveCategory('general', ['site_name' => '스마트케어']);
        app(ConfigRepositoryInterface::class)->getCategory('general');

        $tenant = new TenantRecord(
            id: 1,
            slug: 'e2etest',
            host: 'e2etest.mek360.com',
            dbDatabase: 'hospital_e2etest',
            gcsPrefix: 'tenants/e2etest',
            packageId: 'hospital-default',
            status: 'active',
        );

        $bootstrap->bootstrapTenant($request, ['type' => 'tenant', 'host' => 'e2etest.mek360.com', 'slug' => 'e2etest'], $tenant);
        app(ConfigRepositoryInterface::class)->saveCategory('general', ['site_name' => 'E2E테스트병원']);

        $this->assertSame(
            'E2E테스트병원',
            app(TenantExperienceDefaultsReader::class)->siteMeta()['site_name'],
        );
    }

    /**
     * Run 워커: 요청 A(platform) 종료 후 forgetScoped → 요청 B(tenant) 시
     * singleton TenantRuntimeBootstrap 이 stale TenantContext 를 mutate 하지 않도록.
     */
    public function test_runtime_bootstrap_uses_fresh_scoped_context_after_forget_scoped(): void
    {
        $bootstrap = app(TenantRuntimeBootstrap::class);
        $request = request();

        $bootstrap->bootstrapPlatform($request, ['type' => 'platform', 'host' => 'mek360.com', 'slug' => null]);
        app(ConfigRepositoryInterface::class)->saveCategory('general', ['site_name' => '스마트케어']);

        $this->app->forgetScopedInstances();

        $tenant = new TenantRecord(
            id: 1,
            slug: 'e2etest',
            host: 'e2etest.mek360.com',
            dbDatabase: 'hospital_e2etest',
            gcsPrefix: 'tenants/e2etest',
            packageId: 'hospital-default',
            status: 'active',
        );

        $bootstrap->bootstrapTenant(
            $request,
            ['type' => 'tenant', 'host' => 'e2etest.mek360.com', 'slug' => 'e2etest'],
            $tenant,
        );
        app(ConfigRepositoryInterface::class)->saveCategory('general', ['site_name' => 'E2E테스트병원']);

        $this->assertFalse(app(TenantContext::class)->isPlatformRequest());
        $this->assertSame(
            'E2E테스트병원',
            app(TenantExperienceDefaultsReader::class)->siteMeta()['site_name'],
        );
    }
}
