<?php

namespace Modules\Moabom\System\Tests\Unit\Listeners;

use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Listeners\SaasSettingsRuntimeRestoreListener;
use Modules\Moabom\System\Saas\PlatformFilesystemSnapshot;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Tests\ModuleTestCase;

class SaasSettingsRuntimeRestoreListenerTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        PlatformFilesystemSnapshot::resetForTesting();
        PlatformFilesystemSnapshot::capture();
    }

    public function test_restores_tenant_settings_prefix_after_settings_save_hook(): void
    {
        config([
            'moabom-system.saas.enabled' => true,
            'filesystems.disks.settings.driver' => 'local',
            'filesystems.disks.settings.root' => storage_path('app/settings'),
        ]);

        Storage::fake('settings');

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

        Config::set('filesystems.disks.settings', [
            'driver' => 'local',
            'root' => storage_path('app/settings'),
        ]);

        $listener = new SaasSettingsRuntimeRestoreListener;
        $listener->onSettingsAfterSave('general', ['site_name' => '테스트'], true);

        $diskConfig = config('filesystems.disks.settings');
        $this->assertStringContainsString('tenants/freshent/settings', (string) ($diskConfig['root'] ?? ''));
    }
}
