<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Support\GeneratedAppLegacyVisibilityRepair;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\Apps\Tests\ModuleTestCase;
use Modules\Moabom\System\Providers\SystemServiceProvider;

class GeneratedAppLegacyVisibilityRepairTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->app->register(SystemServiceProvider::class);

        config([
            'moabom-system.saas.enabled' => true,
            'moabom-apps.preview.routing' => 'dedicated_host',
            'database.connections.moabom_platform' => config('database.connections.sqlite'),
        ]);

        GeneratedAppsConnection::register();

        if (! Schema::connection('moabom_platform')->hasTable('moabom_system_generated_apps')) {
            $this->artisan('migrate', [
                '--path' => $this->getModuleBasePath().'/database/migrations/platform/2026_06_19_000001_create_generated_apps_platform_tables.php',
                '--realpath' => true,
                '--database' => 'moabom_platform',
            ]);
            $this->artisan('migrate', [
                '--path' => $this->getModuleBasePath().'/database/migrations/platform/2026_06_20_000001_add_visibility_and_row_tenant_slug.php',
                '--realpath' => true,
                '--database' => 'moabom_platform',
            ]);
        }
    }

    public function test_downgrades_legacy_global_with_tenant_slug_to_tenant(): void
    {
        $legacy = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'mosan',
            'user_id' => 1,
            'title' => '레거시 공유',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><head></head><body>x</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
            'is_shared' => true,
        ]);

        $repair = $this->app->make(GeneratedAppLegacyVisibilityRepair::class);
        $result = $repair->downgradeGlobalToTenant();

        $this->assertSame(1, $result['matched']);
        $this->assertSame(1, $result['updated']);

        $legacy->refresh();
        $this->assertSame(GeneratedAppVisibility::Tenant->value, $legacy->visibility);
        $this->assertTrue($legacy->is_shared);
    }

    public function test_skips_global_without_real_tenant_slug(): void
    {
        GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'default',
            'user_id' => 1,
            'title' => '플랫폼 글로벌',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><head></head><body>x</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
            'is_shared' => true,
        ]);

        $repair = $this->app->make(GeneratedAppLegacyVisibilityRepair::class);
        $result = $repair->downgradeGlobalToTenant();

        $this->assertSame(0, $result['matched']);
        $this->assertSame(0, $result['updated']);
    }

    public function test_is_idempotent_after_first_run(): void
    {
        GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'mosan',
            'user_id' => 1,
            'title' => '이미 정리됨',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><head></head><body>x</body></html>',
            'visibility' => GeneratedAppVisibility::Tenant->value,
            'is_shared' => true,
        ]);

        $repair = $this->app->make(GeneratedAppLegacyVisibilityRepair::class);
        $result = $repair->downgradeGlobalToTenant();

        $this->assertSame(0, $result['matched']);
        $this->assertSame(0, $result['updated']);
    }
}
