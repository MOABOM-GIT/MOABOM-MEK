<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Saas\PlatformBootSettingsRepository;
use Modules\Moabom\System\Tests\ModuleTestCase;

class PlatformBootSettingsRepositoryTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('settings');
    }

    public function test_prefers_platform_db_over_stale_settings_json(): void
    {
        Storage::disk('settings')->put('drivers.json', json_encode([
            '_meta' => ['version' => '1.0.0'],
            'storage_driver' => 'local',
            'websocket_enabled' => false,
        ], JSON_THROW_ON_ERROR));

        DB::table('moabom_module_settings')->updateOrInsert(
            ['module' => '_g7_core_', 'category' => 'drivers'],
            [
                'payload' => json_encode([
                    '_meta' => ['version' => '1.0.0', 'updated_at' => now()->toIso8601String()],
                    'storage_driver' => 'gcs',
                    'websocket_enabled' => true,
                    'websocket_host' => 'mek360.com',
                ], JSON_THROW_ON_ERROR),
                'updated_at' => now(),
                'created_at' => now(),
            ],
        );

        $repo = new PlatformBootSettingsRepository;
        $drivers = $repo->getCategory('drivers');

        $this->assertSame('gcs', $drivers['storage_driver'] ?? null);
        $this->assertTrue($drivers['websocket_enabled'] ?? false);
        $this->assertSame('mek360.com', $drivers['websocket_host'] ?? null);
    }
}
