<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use App\Contracts\Repositories\ConfigRepositoryInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Models\ModuleSetting;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Tests\ModuleTestCase;

class MoabomDbConfigRepositoryGcsSyncTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->app->register(SystemServiceProvider::class);
        Storage::fake('settings');
    }

    public function test_save_category_writes_matching_json_to_settings_disk(): void
    {
        $repo = $this->app->make(ConfigRepositoryInterface::class);

        $this->assertTrue($repo->saveCategory('drivers', [
            'storage_driver' => 'gcs',
            'websocket_enabled' => true,
            'websocket_host' => 'mek360.com',
        ]));

        Storage::disk('settings')->assertExists('drivers.json');
        $decoded = json_decode((string) Storage::disk('settings')->get('drivers.json'), true);
        $this->assertSame('gcs', $decoded['storage_driver'] ?? null);
        $this->assertTrue($decoded['websocket_enabled'] ?? false);

        $row = ModuleSetting::query()
            ->where('module', '_g7_core_')
            ->where('category', 'drivers')
            ->first();
        $this->assertNotNull($row);
        $this->assertSame('gcs', $row->payload['storage_driver'] ?? null);
    }
}
