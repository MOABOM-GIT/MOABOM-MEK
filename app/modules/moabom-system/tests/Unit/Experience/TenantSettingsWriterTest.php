<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Experience;

use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Experience\TenantSettingsWriter;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Saas\PlatformFilesystemSnapshot;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantFilesystemConfigurator;
use Modules\Moabom\System\Saas\TenantModuleCategoryJsonStore;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Tests\ModuleTestCase;

class TenantSettingsWriterTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        PlatformFilesystemSnapshot::resetForTesting();
        PlatformFilesystemSnapshot::capture();
        TenantModuleCategoryJsonStore::resetWrittenCategoriesForTesting();

        Storage::fake('settings');
        Storage::fake('modules');

        config(['moabom-system.saas.enabled' => false]);
        \Illuminate\Support\Facades\Cache::flush();
        $this->app->register(SystemServiceProvider::class);
        $this->app->forgetInstance(\App\Contracts\Repositories\ConfigRepositoryInterface::class);
        $this->app->forgetInstance(\Modules\Moabom\System\Repositories\MoabomJsonConfigRepository::class);
    }

    public function test_write_general_persists_via_g7_settings_disk(): void
    {
        $writer = $this->app->make(TenantSettingsWriter::class);

        $this->assertTrue($writer->write([
            'general' => [
                'site_name' => '상쾌한이비인후과',
                'site_url' => 'https://freshent.mek360.com',
                'admin_email' => 'admin@example.com',
                'timezone' => 'Asia/Seoul',
                'language' => 'ko',
            ],
        ]));

        Storage::disk('settings')->assertExists('general.json');
        $content = json_decode((string) Storage::disk('settings')->get('general.json'), true);
        $this->assertSame('상쾌한이비인후과', $content['site_name']);
    }

    public function test_partial_appearance_put_merges_with_stored_presets(): void
    {
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

        $writer = $this->app->make(TenantSettingsWriter::class);

        $this->assertTrue($writer->write([
            'appearance' => [
                'point_color_presets' => [
                    '#6366f1', '#03a94d', '#20cff4', '#3b82f6', '#17c0e4',
                    '#f69c0f', '#f657a6', '#f05d5d', '#3a5476', '#a1b2c3',
                ],
            ],
        ]));

        $service = $this->app->make(\Modules\Moabom\System\Contracts\SystemSettingsServiceInterface::class);
        $presets = $service->getAllSettings()['appearance']['point_color_presets'] ?? [];

        $this->assertContains('#a1b2c3', $presets);
        $this->assertNotEmpty($service->getAllSettings()['appearance']['themes'] ?? [], 'defaults themes 유지');
    }

    public function test_point_color_presets_replace_not_recursive_merge(): void
    {
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

        $writer = $this->app->make(TenantSettingsWriter::class);
        $service = $this->app->make(\Modules\Moabom\System\Contracts\SystemSettingsServiceInterface::class);

        $writer->write([
            'appearance' => [
                'point_color_presets' => [
                    '#6366f1', '#03a94d', '#20cff4', '#3b82f6', '#17c0e4',
                    '#f69c0f', '#f657a6', '#f05d5d', '#3a5476', '#b1c2d3',
                ],
            ],
        ]);

        $writer->write([
            'appearance' => [
                'point_color_presets' => [
                    '#6366f1', '#03a94d', '#20cff4', '#3b82f6', '#17c0e4',
                    '#f69c0f', '#f657a6', '#f05d5d', '#3a5476', '#a1b2c3', '#c0ffee',
                ],
            ],
        ]);

        $presets = $service->getAllSettings()['appearance']['point_color_presets'] ?? [];
        $this->assertCount(11, $presets);
        $this->assertContains('#c0ffee', $presets);
        $this->assertNotContains('#b1c2d3', $presets);
    }

    public function test_point_color_presets_remove_does_not_restore_from_stored(): void
    {
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

        $writer = $this->app->make(TenantSettingsWriter::class);
        $service = $this->app->make(\Modules\Moabom\System\Contracts\SystemSettingsServiceInterface::class);

        $writer->write([
            'appearance' => [
                'point_color_presets' => ['#6366f1', '#a1b2c3'],
            ],
        ]);

        $writer->write([
            'appearance' => [
                'point_color_presets' => ['#6366f1'],
            ],
        ]);

        $presets = $service->getAllSettings()['appearance']['point_color_presets'] ?? [];

        $this->assertSame(['#6366f1'], $presets);
        $this->assertNotContains('#a1b2c3', $presets);
    }

    public function test_home_background_items_replace_not_recursive_merge(): void
    {
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

        $writer = $this->app->make(TenantSettingsWriter::class);
        $service = $this->app->make(\Modules\Moabom\System\Contracts\SystemSettingsServiceInterface::class);
        $keepId = '550e8400-e29b-41d4-a716-446655440000';
        $dropId = '660e8400-e29b-41d4-a716-446655440001';

        $writer->write([
            'appearance' => [
                'home_background_items' => [
                    ['id' => $keepId, 'mode' => 'light', 'point_color' => null],
                    ['id' => $dropId, 'mode' => 'dark', 'point_color' => '#6366f1'],
                ],
            ],
        ]);

        $this->assertTrue($writer->write([
            'appearance' => [
                'home_background_items' => [
                    ['id' => $keepId, 'mode' => 'light', 'point_color' => null],
                ],
            ],
        ]));

        $items = $service->getAllSettings()['appearance']['home_background_items'] ?? [];
        $ids = array_column($items, 'id');

        $this->assertSame([$keepId], $ids);
    }
}
