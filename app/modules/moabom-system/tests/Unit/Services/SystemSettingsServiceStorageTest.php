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

    public function test_legacy_system_options_are_merged_by_id_without_duplicate_weather(): void
    {
        Storage::fake('modules');
        Storage::disk('modules')->put('moabom-system/settings/preferences.json', json_encode([
            'system_options' => [
                ['id' => 'sound', 'label' => '사운드 효과', 'on_by_default' => true, 'user_editable' => true],
                ['id' => 'animation', 'label' => '애니메이션', 'on_by_default' => true, 'user_editable' => true],
                ['id' => 'haptic', 'label' => '햅틱 피드백', 'on_by_default' => true, 'user_editable' => true],
                ['id' => 'weather', 'label' => '날씨 효과', 'on_by_default' => false, 'user_editable' => true],
            ],
        ], JSON_UNESCAPED_UNICODE));

        $service = new SystemSettingsService(new ModuleStorageDriver('moabom-system', 'modules'));
        $options = $service->getAllSettings()['preferences']['system_options'];
        $ids = array_column($options, 'id');

        $this->assertSame($ids, array_values(array_unique($ids)));
        $this->assertSame(1, count(array_filter($ids, fn (string $id): bool => $id === 'weather')));
        $this->assertFalse(
            collect($options)->firstWhere('id', 'weather')['on_by_default'],
        );
    }
}
