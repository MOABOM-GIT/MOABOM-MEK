<?php

namespace Modules\Moabom\System\Tests\Unit\Services;

use App\Extension\Storage\ModuleStorageDriver;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Services\SystemSettingsService;
use Modules\Moabom\System\Tests\ModuleTestCase;

class SystemSettingsServiceStorageTest extends ModuleTestCase
{
    public function test_module_storage_driver_writes_to_faked_modules_disk(): void
    {
        Storage::fake('modules');

        $driver = new ModuleStorageDriver('moabom-system', 'modules');
        $this->assertTrue($driver->put('settings', 'probe.json', '{}'));
        $this->assertContains('moabom-system/settings/probe.json', Storage::disk('modules')->allFiles());
    }

    public function test_save_settings_persists_via_modules_disk(): void
    {
        Storage::fake('modules');

        $service = new SystemSettingsService(new ModuleStorageDriver('moabom-system', 'modules'));

        $result = $service->setSetting('preferences.default_locale', 'ko');

        $files = Storage::disk('modules')->allFiles();
        $this->assertContains(
            'moabom-system/settings/preferences.json',
            $files,
            'setSetting='.($result ? 'true' : 'false').' files='.json_encode($files),
        );

        $content = json_decode((string) Storage::disk('modules')->get('moabom-system/settings/preferences.json'), true);
        $this->assertSame('ko', $content['default_locale'] ?? null);
    }
}
