<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit;

use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Contracts\SystemSettingsServiceInterface;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Saas\PlatformFilesystemSnapshot;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantFilesystemConfigurator;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Tests\ModuleTestCase;

class SystemSettingsServiceCategoryJsonTest extends ModuleTestCase
{
    private const APPEARANCE_PATH = 'moabom-system/settings/appearance.json';

    protected function setUp(): void
    {
        parent::setUp();

        PlatformFilesystemSnapshot::resetForTesting();
        PlatformFilesystemSnapshot::capture();

        Storage::fake('modules');

        config(['moabom-system.saas.enabled' => true]);

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
        $this->app->register(SystemServiceProvider::class);
    }

    public function test_load_deletes_concatenated_invalid_appearance_json(): void
    {
        Storage::disk('modules')->put(
            self::APPEARANCE_PATH,
            '{"point_color_presets":["#dead01"]}    }, "themes": []}',
        );

        $service = $this->app->make(SystemSettingsServiceInterface::class);
        $presets = $service->getAllSettings()['appearance']['point_color_presets'] ?? [];

        $this->assertNotContains('#dead01', $presets, '손상 JSON의 첫 청크는 무시');
        Storage::disk('modules')->assertMissing(self::APPEARANCE_PATH);
    }

    public function test_replace_settings_writes_valid_json_only(): void
    {
        Storage::disk('modules')->put(
            self::APPEARANCE_PATH,
            '{"point_color_presets":["#6366f1"]}    }, "themes": []}',
        );

        $service = $this->app->make(SystemSettingsServiceInterface::class);
        $service->clearCache();
        $defaults = $service->getAllSettings()['appearance'];
        $defaults['point_color_presets'] = [
            '#6366f1', '#03a94d', '#20cff4', '#3b82f6', '#17c0e4',
            '#f69c0f', '#f657a6', '#f05d5d', '#3a5476', '#a1b2c3',
        ];

        $this->assertTrue($service->replaceSettings(['appearance' => $defaults]));

        $raw = (string) Storage::disk('modules')->get(self::APPEARANCE_PATH);
        $this->assertTrue(function_exists('json_validate') ? json_validate($raw) : json_decode($raw) !== null);
        $this->assertStringContainsString('#a1b2c3', $raw);
        $this->assertStringNotContainsString('}    },', $raw);

        $service->clearCache();
        $presets = $service->getAllSettings()['appearance']['point_color_presets'] ?? [];
        $this->assertContains('#a1b2c3', $presets);
    }
}
