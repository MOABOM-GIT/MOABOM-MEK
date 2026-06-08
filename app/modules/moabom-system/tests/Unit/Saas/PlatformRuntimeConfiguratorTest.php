<?php

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Saas\PlatformFilesystemSnapshot;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;
use Modules\Moabom\System\Saas\TenantFilesystemConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Tests\ModuleTestCase;

class PlatformRuntimeConfiguratorTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        PlatformFilesystemSnapshot::resetForTesting();
        PlatformFilesystemSnapshot::capture();
    }

    public function test_platform_request_restores_settings_disk_after_tenant_apply(): void
    {
        config([
            'moabom-system.saas.enabled' => true,
            'filesystems.disks.attachments.driver' => 'gcs',
            'filesystems.disks.settings.driver' => 'gcs',
            'filesystems.disks.settings.path_prefix' => 'settings',
        ]);
        Storage::fake('settings');
        PlatformFilesystemSnapshot::resetForTesting();
        PlatformFilesystemSnapshot::capture();

        $tenant = new TenantRecord(
            id: 1,
            slug: 'freshent',
            host: 'freshent.mek360.com',
            dbDatabase: 'hospital_freshent',
            gcsPrefix: 'tenants/freshent',
            packageId: 'hospital-default',
            status: 'active',
        );

        app(TenantFilesystemConfigurator::class)->apply($tenant);
        $this->assertStringContainsString(
            'tenants/freshent',
            (string) config('filesystems.disks.settings.path_prefix'),
        );

        app(PlatformRuntimeConfigurator::class)->applyPlatform();

        $this->assertSame(
            'settings',
            (string) config('filesystems.disks.settings.path_prefix'),
        );
    }
}
