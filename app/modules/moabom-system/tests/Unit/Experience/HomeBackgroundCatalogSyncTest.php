<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Experience;

use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Experience\HomeBackgroundCatalogSync;
use Modules\Moabom\System\Experience\TenantSettingsWriter;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Saas\PlatformFilesystemSnapshot;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantFilesystemConfigurator;
use Modules\Moabom\System\Saas\TenantModuleCategoryJsonStore;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Tests\ModuleTestCase;

class HomeBackgroundCatalogSyncTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        TenantModuleCategoryJsonStore::resetWrittenCategoriesForTesting();
        PlatformFilesystemSnapshot::resetForTesting();
        PlatformFilesystemSnapshot::capture();

        Storage::fake('settings');
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

    public function test_remove_completely_drops_meta_and_blob(): void
    {
        $keepId = '550e8400-e29b-41d4-a716-446655440000';
        $dropId = '660e8400-e29b-41d4-a716-446655440001';

        Storage::disk('modules')->put(
            "moabom-system/images/home-backgrounds/{$dropId}/full.jpg",
            'full-bytes',
        );

        $writer = $this->app->make(TenantSettingsWriter::class);
        $this->assertTrue($writer->write([
            'appearance' => [
                'home_background_items' => [
                    ['id' => $keepId, 'mode' => 'light', 'point_color' => null],
                    ['id' => $dropId, 'mode' => 'dark', 'point_color' => null],
                ],
            ],
        ]));

        $sync = $this->app->make(HomeBackgroundCatalogSync::class);
        $this->assertTrue($sync->removeCompletely($dropId));

        $service = $this->app->make(\Modules\Moabom\System\Contracts\SystemSettingsServiceInterface::class);
        $ids = array_column(
            $service->getAllSettings()['appearance']['home_background_items'] ?? [],
            'id',
        );
        $this->assertSame([$keepId], $ids);
        $this->assertFalse(
            Storage::disk('modules')->exists("moabom-system/images/home-backgrounds/{$dropId}/full.jpg"),
        );
    }

    public function test_prune_uses_written_snapshot_not_stale_get_all_settings(): void
    {
        $newId = '880e8400-e29b-41d4-a716-446655440003';

        Storage::disk('modules')->put(
            "moabom-system/images/home-backgrounds/{$newId}/thumb.jpg",
            'thumb-bytes',
        );

        $sync = $this->app->make(HomeBackgroundCatalogSync::class);
        $sync->pruneOrphanBlobs([$newId => true]);

        $this->assertTrue(
            Storage::disk('modules')->exists("moabom-system/images/home-backgrounds/{$newId}/thumb.jpg"),
            'snapshot ids must protect blobs from stale meta reload',
        );
    }

    public function test_prune_orphan_blobs_after_appearance_put(): void
    {
        $keepId = '550e8400-e29b-41d4-a716-446655440000';
        $orphanId = '770e8400-e29b-41d4-a716-446655440002';

        Storage::disk('modules')->put(
            "moabom-system/images/home-backgrounds/{$orphanId}/full.jpg",
            'orphan',
        );

        $writer = $this->app->make(TenantSettingsWriter::class);
        $this->assertTrue($writer->write([
            'appearance' => [
                'home_background_items' => [
                    ['id' => $keepId, 'mode' => 'light', 'point_color' => null],
                ],
            ],
        ]));

        $this->assertFalse(
            Storage::disk('modules')->exists("moabom-system/images/home-backgrounds/{$orphanId}/full.jpg"),
        );
    }
}
