<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Saas\PlatformFilesystemSnapshot;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantFilesystemConfigurator;
use Modules\Moabom\System\Saas\TenantModuleCategoryJsonStore;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Tests\ModuleTestCase;

class TenantModuleCategoryJsonStoreTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        TenantModuleCategoryJsonStore::resetWrittenCategoriesForTesting();
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

    public function test_read_returns_decoded_category_after_replace(): void
    {
        $store = $this->app->make(TenantModuleCategoryJsonStore::class);
        $payload = [
            'themes' => [
                ['id' => 'light', 'label' => '라이트', 'enabled' => true],
            ],
            'point_color_presets' => ['#6366f1', '#a1b2c3'],
            'home_background_items' => [],
        ];

        $this->assertTrue($store->replace('appearance', $payload));
        $this->assertSame($payload['point_color_presets'], $store->read('appearance')['point_color_presets']);
    }

    public function test_replace_rejects_invalid_existing_and_writes_valid_json(): void
    {
        Storage::disk('modules')->put(
            'moabom-system/settings/appearance.json',
            '{"point_color_presets":["#6366f1"]}    }, "themes": []}',
        );

        $store = $this->app->make(TenantModuleCategoryJsonStore::class);
        $payload = [
            'themes' => [
                ['id' => 'light', 'label' => '라이트', 'enabled' => true],
            ],
            'point_color_presets' => ['#6366f1', '#a1b2c3'],
            'home_background_items' => [],
        ];

        $this->assertTrue($store->replace('appearance', $payload));

        $raw = (string) Storage::disk('modules')->get('moabom-system/settings/appearance.json');
        $this->assertTrue(function_exists('json_validate') ? json_validate($raw) : json_decode($raw) !== null);
        $this->assertStringContainsString('#a1b2c3', $raw);
        $this->assertStringNotContainsString('}    },', $raw);
    }

    public function test_replace_uses_snapshot_copy_not_in_place_put(): void
    {
        Storage::disk('modules')->put(
            'moabom-system/settings/appearance.json',
            '{"point_color_presets":["#111111"],"themes":[]}',
        );

        $store = $this->app->make(TenantModuleCategoryJsonStore::class);
        $payload = [
            'themes' => [
                ['id' => 'light', 'label' => '라이트', 'enabled' => true],
            ],
            'point_color_presets' => ['#222222'],
            'home_background_items' => [],
        ];

        $this->assertTrue($store->replace('appearance', $payload));

        $files = Storage::disk('modules')->allFiles('moabom-system/settings/_snapshots/appearance');
        $this->assertEmpty($files, 'promote 후 스냅샷 정리');

        $raw = (string) Storage::disk('modules')->get('moabom-system/settings/appearance.json');
        $this->assertStringContainsString('#222222', $raw);
        $this->assertStringNotContainsString('#111111', $raw);
    }
}
