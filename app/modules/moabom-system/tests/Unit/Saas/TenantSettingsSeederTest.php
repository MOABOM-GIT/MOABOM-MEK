<?php

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Illuminate\Support\Facades\Storage;
use App\Models\User;
use Modules\Moabom\System\Models\ModuleSetting;
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
        User::factory()->create([
            'email' => 'admin@mek360.com',
            'nickname' => '변경 전',
        ]);

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
        $this->assertSame('대구', $general['site_note']);
        $this->assertSame('대구광역시 중구', $general['site_address']);
        $this->assertSame('admin@mek360.com', $general['admin_email']);

        Storage::disk('settings')->assertExists('drivers.json');
        $drivers = json_decode((string) Storage::disk('settings')->get('drivers.json'), true);
        $this->assertSame('gcs', $drivers['storage_driver']);
        $this->assertTrue($drivers['websocket_enabled']);
        $this->assertSame('miso.mek360.com', $drivers['websocket_host']);
        $this->assertSame('moabom-laravel', $drivers['websocket_app_id']);
        $this->assertSame('moabom-laravel-key', $drivers['websocket_app_key']);
        $this->assertSame(443, $drivers['websocket_port']);
        $this->assertSame('https', $drivers['websocket_scheme']);
        $this->assertSame('127.0.0.1', $drivers['websocket_server_host']);
        $this->assertSame(6001, $drivers['websocket_server_port']);

        $generalRow = ModuleSetting::query()
            ->where('module', '_g7_core_')
            ->where('category', 'general')
            ->first();
        $this->assertNotNull($generalRow);
        $this->assertSame('미소이비인후과', $generalRow->payload['site_name'] ?? null);

        $row = ModuleSetting::query()
            ->where('module', '_g7_core_')
            ->where('category', 'drivers')
            ->first();
        $this->assertNotNull($row);
        $this->assertSame('gcs', $row->payload['storage_driver'] ?? null);
        $this->assertTrue($row->payload['websocket_enabled'] ?? false);
        $this->assertSame('miso.mek360.com', $row->payload['websocket_host'] ?? null);
        $this->assertSame(
            '미소이비인후과',
            User::query()->where('email', 'admin@mek360.com')->value('nickname'),
        );
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
