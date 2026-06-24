<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Models\ModuleSetting;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Saas\MoabomModuleCategoryDbStore;
use Modules\Moabom\System\Tests\ModuleTestCase;

class MoabomModuleCategoryDbStoreTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->app->register(SystemServiceProvider::class);
        Storage::fake('modules');
    }

    public function test_replace_writes_db_and_modules_disk_mirror(): void
    {
        $store = new MoabomModuleCategoryDbStore('moabom-credit');

        $this->assertTrue($store->replace('general', [
            'enabled' => true,
            'label' => '크레딧',
        ]));

        $row = ModuleSetting::query()
            ->where('module', 'moabom-credit')
            ->where('category', 'general')
            ->first();
        $this->assertNotNull($row);
        $this->assertTrue($row->payload['enabled'] ?? false);

        Storage::disk('modules')->assertExists('moabom-credit/settings/general.json');
        $decoded = json_decode((string) Storage::disk('modules')->get('moabom-credit/settings/general.json'), true);
        $this->assertSame('크레딧', $decoded['label'] ?? null);
    }

    public function test_read_strips_meta_and_hydrates_from_modules_disk(): void
    {
        Storage::disk('modules')->put('moabom-credit/settings/billing.json', json_encode([
            '_meta' => ['version' => '0.0.1'],
            'currency' => 'KRW',
        ], JSON_UNESCAPED_UNICODE));

        $store = new MoabomModuleCategoryDbStore('moabom-credit');
        $settings = $store->read('billing');

        $this->assertSame('KRW', $settings['currency'] ?? null);
        $this->assertArrayNotHasKey('_meta', $settings);

        $this->assertTrue(ModuleSetting::query()
            ->where('module', 'moabom-credit')
            ->where('category', 'billing')
            ->exists());
    }
}
