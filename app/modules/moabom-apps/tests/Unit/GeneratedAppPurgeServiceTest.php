<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Services\GeneratedAppHostingService;
use Modules\Moabom\Apps\Services\GeneratedAppPurgeService;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\Apps\Tests\ModuleTestCase;
use Modules\Moabom\System\Providers\SystemServiceProvider;

class GeneratedAppPurgeServiceTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->app->register(SystemServiceProvider::class);
        config([
            'moabom-system.saas.enabled' => true,
            'database.connections.moabom_platform' => config('database.connections.sqlite'),
        ]);
        GeneratedAppsConnection::register();

        $mock = $this->createMock(GeneratedAppHostingService::class);
        $mock->method('teardownHosted');
        $this->app->instance(GeneratedAppHostingService::class, $mock);
    }

    public function test_purge_datastore_removes_platform_and_legacy_main_db_row(): void
    {
        if (! Schema::hasTable('moabom_system_generated_apps')) {
            $this->markTestSkipped('legacy apps table missing');
        }

        $legacyId = (int) DB::table('moabom_system_generated_apps')->insertGetId([
            'user_id' => 1,
            'title' => 'legacy-only',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body>x</body></html>',
            'visibility' => GeneratedAppVisibility::Private->value,
            'is_shared' => false,
            'metadata' => json_encode([], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $app = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'default',
            'user_id' => 1,
            'title' => 'platform copy',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body>x</body></html>',
            'visibility' => GeneratedAppVisibility::Private->value,
            'is_shared' => false,
            'metadata' => ['owner_nickname' => 'tester'],
        ]);

        DB::table('moabom_system_generated_apps')->where('id', $legacyId)->delete();
        DB::table('moabom_system_generated_apps')->insert([
            'id' => $app->id,
            'user_id' => 1,
            'title' => 'legacy ghost',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body>x</body></html>',
            'visibility' => GeneratedAppVisibility::Private->value,
            'is_shared' => false,
            'metadata' => json_encode([], JSON_THROW_ON_ERROR),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->assertNotNull(DB::table('moabom_system_generated_apps')->where('id', $app->id)->first());
        $this->assertNotNull(GeneratedAppsConnection::apps()->find($app->id));

        app(GeneratedAppPurgeService::class)->purgeDatastore($app->fresh());

        $this->assertNull(GeneratedAppsConnection::apps()->find($app->id));
        $this->assertNull(DB::table('moabom_system_generated_apps')->where('id', $app->id)->first());
    }
}
