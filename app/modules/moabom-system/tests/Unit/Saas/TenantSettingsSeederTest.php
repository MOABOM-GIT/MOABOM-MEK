<?php

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Saas\TenantFilesystemConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Saas\TenantSettingsSeeder;
use Modules\Moabom\System\Tests\ModuleTestCase;

class TenantSettingsSeederTest extends ModuleTestCase
{
    public function test_seeds_general_json_under_tenant_gcs_prefix(): void
    {
        config(['moabom-system.saas.enabled' => true]);
        Storage::fake('settings');

        $tenant = new TenantRecord(
            id: 1,
            slug: 'miso',
            host: 'miso.mek360.com',
            dbDatabase: 'hospital_miso',
            gcsPrefix: 'tenants/miso',
            packageId: 'hospital-default',
            status: 'provisioning',
            appUrl: 'https://miso.mek360.com',
        );

        $seeder = new TenantSettingsSeeder(new TenantFilesystemConfigurator);
        $seeder->seed($tenant, [
            'name' => '미소이비인후과',
            'region' => '대구',
            'address' => '대구광역시 중구',
        ]);

        Storage::disk('settings')->assertExists('general.json');

        $general = json_decode((string) Storage::disk('settings')->get('general.json'), true);
        $this->assertSame('미소이비인후과', $general['site_name']);
        $this->assertSame('https://miso.mek360.com', $general['site_url']);
        $this->assertSame('대구 · 대구광역시 중구', $general['site_description']);
    }

    public function test_note_overrides_legacy_region_for_site_description(): void
    {
        config(['moabom-system.saas.enabled' => true]);
        Storage::fake('settings');

        $tenant = new TenantRecord(
            id: 1,
            slug: 'noteclinic',
            host: 'noteclinic.mek360.com',
            dbDatabase: 'hospital_noteclinic',
            gcsPrefix: 'tenants/noteclinic',
            packageId: 'hospital-default',
            status: 'provisioning',
            appUrl: 'https://noteclinic.mek360.com',
        );

        $seeder = new TenantSettingsSeeder(new TenantFilesystemConfigurator);
        $seeder->seed($tenant, [
            'name' => '비고병원',
            'region' => 'legacy-region',
            'note' => '비고 메모',
            'address' => '서울시',
        ]);

        $general = json_decode((string) Storage::disk('settings')->get('general.json'), true);
        $this->assertSame('비고 메모 · 서울시', $general['site_description']);
    }
}
