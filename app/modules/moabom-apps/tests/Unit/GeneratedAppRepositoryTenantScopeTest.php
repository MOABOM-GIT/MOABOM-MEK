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

class GeneratedAppRepositoryTenantScopeTest extends ModuleTestCase
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
        $this->ensurePlatformTable();
    }

    public function test_owned_apps_are_empty_when_tenant_scope_is_unknown(): void
    {
        $owner = User::factory()->create();

        $app = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'mosan',
            'user_id' => $owner->id,
            'title' => '스코프 미해석',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body>x</body></html>',
            'visibility' => GeneratedAppVisibility::Private->value,
            'is_shared' => false,
        ]);

        $repository = $this->app->make(GeneratedAppRepositoryInterface::class);

        $this->assertCount(0, $repository->getForUser($owner->id));
        $this->assertNull($repository->findForUser($owner->id, (int) $app->id));
    }

    public function test_owned_apps_are_scoped_when_tenant_context_is_set(): void
    {
        $owner = User::factory()->create();

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

        $app = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'mosan',
            'user_id' => $owner->id,
            'title' => '모산 앱',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body>mosan</body></html>',
            'visibility' => GeneratedAppVisibility::Private->value,
            'is_shared' => false,
        ]);

        GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'freshent',
            'user_id' => $owner->id,
            'title' => '다른 업체',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body>other</body></html>',
            'visibility' => GeneratedAppVisibility::Private->value,
            'is_shared' => false,
        ]);

        $repository = $this->app->make(GeneratedAppRepositoryInterface::class);
        $items = $repository->getForUser($owner->id);

        $this->assertCount(1, $items);
        $this->assertSame((int) $app->id, (int) $items->first()->id);
    }

    public function test_direct_platform_query_uses_shared_current_tenant_scope(): void
    {
        $owner = User::factory()->create();
        $tenant = new TenantRecord(
            id: 3,
            slug: 'freshent',
            host: 'freshent.mek360.com',
            dbDatabase: 'hospital_freshent',
            gcsPrefix: 'tenants/freshent',
            packageId: 'hospital-default',
            status: 'active',
            appUrl: 'https://freshent.mek360.com',
        );
        app(TenantContext::class)->setTenant($tenant, $tenant->host);

        foreach (['freshent', 'mosan'] as $slug) {
            GeneratedAppsConnection::apps()->create([
                'tenant_slug' => $slug,
                'user_id' => $owner->id,
                'title' => $slug,
                'app_type' => 'general',
                'tier' => 'standard',
                'html' => '<!DOCTYPE html><html><body>'.$slug.'</body></html>',
                'visibility' => GeneratedAppVisibility::Private->value,
                'is_shared' => false,
            ]);
        }

        $query = GeneratedAppsConnection::apps()->where('user_id', $owner->id);
        $items = GeneratedAppsConnection::scopeToCurrentTenant($query)->get();

        $this->assertCount(1, $items);
        $this->assertSame('freshent', $items->first()->tenant_slug);
    }

    private function ensurePlatformTable(): void
    {
        if (Schema::connection('moabom_platform')->hasTable('moabom_system_generated_apps')) {
            return;
        }

        $base = $this->getModuleBasePath();

        $this->artisan('migrate', [
            '--path' => $base.'/database/migrations/platform/2026_06_19_000001_create_generated_apps_platform_tables.php',
            '--realpath' => true,
            '--database' => 'moabom_platform',
        ]);
        $this->artisan('migrate', [
            '--path' => $base.'/database/migrations/platform/2026_06_20_000001_add_visibility_and_row_tenant_slug.php',
            '--realpath' => true,
            '--database' => 'moabom_platform',
        ]);
    }
}
