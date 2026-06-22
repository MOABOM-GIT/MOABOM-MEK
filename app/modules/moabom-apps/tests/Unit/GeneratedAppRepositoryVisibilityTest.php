<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Apps\Contracts\GeneratedAppRepositoryInterface;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\Apps\Tests\ModuleTestCase;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantRecord;

class GeneratedAppRepositoryVisibilityTest extends ModuleTestCase
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

    public function test_tenant_registered_app_is_visible_only_on_same_tenant_host(): void
    {
        $viewer = User::factory()->create();
        $owner = User::factory()->create();

        $app = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'mosan',
            'user_id' => $owner->id,
            'title' => '수면 측정',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><head></head><body>sleep</body></html>',
            'visibility' => GeneratedAppVisibility::Tenant->value,
            'is_shared' => true,
        ]);

        $repository = $this->app->make(GeneratedAppRepositoryInterface::class);

        $tenant = new TenantRecord(
            id: 2,
            slug: 'mosan',
            host: 'mosan.mek360.com',
            dbDatabase: 'hospital_mosan',
            gcsPrefix: 'tenants/mosan',
            packageId: 'hospital-default',
            status: 'active',
            appUrl: 'https://mosan.mek360.com',
        );
        app(TenantContext::class)->setTenant($tenant, $tenant->host);

        $this->assertNotNull($repository->findPublished($app->id));
        $this->assertNotNull($repository->findVisibleForUser($viewer->id, $app->id));

        app(TenantContext::class)->setPlatform('mek360.com');

        $this->assertNull($repository->findPublished($app->id));
    }

    public function test_global_registered_app_is_visible_on_platform_host(): void
    {
        $viewer = User::factory()->create();
        $owner = User::factory()->create();

        app(TenantContext::class)->setPlatform('mek360.com');

        $app = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'mosan',
            'user_id' => $owner->id,
            'title' => '전체 공개',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><head></head><body>global</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
            'is_shared' => true,
        ]);

        $repository = $this->app->make(GeneratedAppRepositoryInterface::class);

        $this->assertNotNull($repository->findPublished($app->id));
        $this->assertNotNull($repository->findVisibleForUser($viewer->id, $app->id));
    }

    public function test_private_app_from_other_tenant_is_not_visible_on_platform_host(): void
    {
        $viewer = User::factory()->create();
        $owner = User::factory()->create();

        app(TenantContext::class)->setPlatform('mek360.com');

        $app = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'mosan',
            'user_id' => $owner->id,
            'title' => '비공개 앱',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><head></head><body>private</body></html>',
            'visibility' => GeneratedAppVisibility::Private->value,
            'is_shared' => false,
        ]);

        $repository = $this->app->make(GeneratedAppRepositoryInterface::class);

        $this->assertNull($repository->findVisibleForUser($viewer->id, $app->id));
        $this->assertNull($repository->findVisibleForUser($owner->id, $app->id));
    }
}
