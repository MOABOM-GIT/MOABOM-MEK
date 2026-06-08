<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Contracts\SystemSettingsServiceInterface;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Saas\PlatformFilesystemSnapshot;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantFilesystemConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Tests\ModuleTestCase;

/**
 * config:clear 후에도 tenant modules 디스크 prefix 가 module settings I/O 에 유지되는지.
 */
class TenantModuleStorageScopeTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        PlatformFilesystemSnapshot::resetForTesting();
        PlatformFilesystemSnapshot::capture();

        config([
            'moabom-system.saas.enabled' => true,
            'filesystems.disks.modules.driver' => 'local',
            'filesystems.disks.modules.root' => storage_path('app/modules'),
        ]);

        Storage::fake('modules');
        $this->app->register(SystemServiceProvider::class);
    }

    public function test_point_color_presets_persist_after_config_clear(): void
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

        /** @var SystemSettingsServiceInterface $service */
        $service = $this->app->make(SystemSettingsServiceInterface::class);

        $presets = [
            '#6366f1', '#03a94d', '#20cff4', '#3b82f6', '#17c0e4',
            '#f69c0f', '#f657a6', '#f05d5d', '#3a5476', '#a1b2c3',
        ];

        $this->assertTrue($service->saveSettings([
            'appearance' => ['point_color_presets' => $presets],
        ]));

        Artisan::call('config:clear');
        Config::set('filesystems.disks.modules', [
            'driver' => 'local',
            'root' => storage_path('app/modules'),
        ]);

        $service->clearCache();
        $afterClear = $service->getAllSettings()['appearance']['point_color_presets'] ?? [];
        $this->assertContains('#a1b2c3', $afterClear, 'config:clear 후에도 tenant module scope 가 read 를 복원해야 함');
    }
}
