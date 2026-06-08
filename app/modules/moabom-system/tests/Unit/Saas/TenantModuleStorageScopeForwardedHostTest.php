<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Saas\PlatformFilesystemSnapshot;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantFilesystemConfigurator;
use Modules\Moabom\System\Saas\TenantModuleCategoryJsonStore;
use Modules\Moabom\System\Saas\TenantModuleStorageScope;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Saas\TenantRequestHost;
use Modules\Moabom\System\Tests\ModuleTestCase;

class TenantModuleStorageScopeForwardedHostTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        TenantModuleCategoryJsonStore::resetWrittenCategoriesForTesting();
        PlatformFilesystemSnapshot::resetForTesting();
        PlatformFilesystemSnapshot::capture();

        config([
            'moabom-system.saas.enabled' => true,
            'filesystems.disks.modules.driver' => 'local',
            'filesystems.disks.modules.root' => storage_path('app/modules'),
        ]);

        Storage::fake('modules');
    }

    public function test_tenant_request_host_prefers_forwarded_header(): void
    {
        $request = Request::create(
            'https://internal.run.app/api/test',
            'GET',
            server: [
                'HTTP_HOST' => 'internal.run.app',
                'HTTP_X_FORWARDED_HOST' => 'freshent.mek360.com',
            ],
        );

        $this->assertSame('freshent.mek360.com', TenantRequestHost::resolve($request));
    }

    public function test_read_restores_tenant_scope_after_platform_root_drift(): void
    {
        $tenant = new TenantRecord(
            id: 1,
            slug: 'freshent',
            host: 'freshent.mek360.com',
            dbDatabase: 'hospital_freshent',
            gcsPrefix: 'tenants/freshent',
            packageId: 'hospital-default',
            status: 'active',
            appUrl: 'https://freshent.mek360.com',
        );

        app(TenantContext::class)->setTenant($tenant, $tenant->host);
        app(TenantFilesystemConfigurator::class)->apply($tenant);

        $presets = [
            '#6366f1', '#03a94d', '#20cff4', '#3b82f6', '#17c0e4',
            '#f69c0f', '#f657a6', '#f05d5d', '#3a5476', '#a1b2c3',
        ];

        $store = $this->app->make(TenantModuleCategoryJsonStore::class);
        $this->assertTrue($store->replace('appearance', [
            'themes' => [['id' => 'light', 'label' => '라이트', 'enabled' => true]],
            'point_color_presets' => $presets,
            'home_background_items' => [],
        ]));

        Config::set('filesystems.disks.modules.root', storage_path('app/modules'));
        Storage::forgetDisk('modules');

        $this->assertContains(
            '#a1b2c3',
            $store->read('appearance')['point_color_presets'] ?? [],
        );
        $this->assertFileExists(
            storage_path('app/tenants/freshent/modules/moabom-system/settings/appearance.json'),
        );
    }
}
