<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Feature;

use App\Enums\ExtensionOwnerType;
use App\Enums\PermissionType;
use App\Enums\UserStatus;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Services\GeneratedAppHostingService;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\Apps\Tests\ModuleTestCase;
use Modules\Moabom\System\Http\Middleware\ResolveMoabomTenant;
use Modules\Moabom\System\Providers\SystemServiceProvider;

class GeneratedAppAdminControllerTest extends ModuleTestCase
{
    private User $adminUser;

    private const ENDPOINT = '/api/modules/moabom-apps/admin/generated-apps';

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([ResolveMoabomTenant::class]);
        $this->app->register(SystemServiceProvider::class);

        config([
            'moabom-system.saas.enabled' => true,
            'moabom-system.saas.base_domain' => 'mek360.com',
            'moabom-system.saas.platform_hosts' => ['mek360.com', 'www.mek360.com'],
            'moabom-apps.preview.routing' => 'dedicated_host',
            'database.connections.moabom_platform' => config('database.connections.sqlite'),
        ]);

        GeneratedAppsConnection::register();
        $this->ensurePlatformGeneratedAppsTable();
        $this->mockHostingTeardown();
        $this->adminUser = $this->createAdminWithGeneratedAppPermissions();
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson(self::ENDPOINT)->assertUnauthorized();
    }

    public function test_platform_host_lists_all_tenants(): void
    {
        $this->seedApps();

        $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mek360.com')
            ->getJson(self::ENDPOINT)
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.meta.scope', 'platform')
            ->assertJsonPath('data.meta.abilities.show_tenant_column', true)
            ->assertJsonPath('data.meta.abilities.can_manage', true)
            ->assertJsonCount(2, 'data.items')
            ->assertJsonStructure([
                'data' => [
                    'items' => [
                        '*' => [
                            'id',
                            'title',
                            'tenant_slug',
                            'tier',
                            'app_type',
                            'version',
                            'visibility',
                            'owner',
                            'is_fork',
                            'created_at',
                            'updated_at',
                            'preview_url',
                        ],
                    ],
                ],
            ]);
    }

    public function test_tenant_host_lists_only_same_slug(): void
    {
        $apps = $this->seedApps();

        $response = $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mosan.mek360.com')
            ->getJson(self::ENDPOINT)
            ->assertOk()
            ->assertJsonPath('data.meta.scope', 'tenant')
            ->assertJsonPath('data.meta.tenant_slug', 'mosan')
            ->assertJsonPath('data.meta.abilities.show_tenant_column', false);

        $ids = collect($response->json('data.items'))->pluck('id')->all();
        $this->assertSame([(int) $apps['mosan']->id], $ids);
    }

    public function test_tenant_host_cannot_patch_other_tenant_app(): void
    {
        $apps = $this->seedApps();

        $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mosan.mek360.com')
            ->patchJson(self::ENDPOINT.'/'.$apps['freshent']->id.'/visibility', [
                'visibility' => GeneratedAppVisibility::Tenant->value,
            ])
            ->assertNotFound();
    }

    public function test_platform_host_can_patch_visibility(): void
    {
        $apps = $this->seedApps();

        $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mek360.com')
            ->patchJson(self::ENDPOINT.'/'.$apps['freshent']->id.'/visibility', [
                'visibility' => GeneratedAppVisibility::Global->value,
            ])
            ->assertOk()
            ->assertJsonPath('data.item.visibility', GeneratedAppVisibility::Global->value);

        $fresh = GeneratedAppsConnection::apps()->find($apps['freshent']->id);
        $this->assertSame(GeneratedAppVisibility::Global->value, $fresh?->visibility);
        $this->assertTrue($fresh?->is_shared);
    }

    public function test_tenant_host_can_patch_own_tenant_app_visibility(): void
    {
        $apps = $this->seedApps();

        $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mosan.mek360.com')
            ->patchJson(self::ENDPOINT.'/'.$apps['mosan']->id.'/visibility', [
                'visibility' => GeneratedAppVisibility::Global->value,
            ])
            ->assertOk()
            ->assertJsonPath('data.item.visibility', GeneratedAppVisibility::Global->value);
    }

    public function test_platform_host_can_delete_any_tenant_app(): void
    {
        $apps = $this->seedApps();

        $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mek360.com')
            ->deleteJson(self::ENDPOINT.'/'.$apps['freshent']->id)
            ->assertOk()
            ->assertJsonPath('data.deleted_id', (int) $apps['freshent']->id);

        $this->assertNull(GeneratedAppsConnection::apps()->find($apps['freshent']->id));
    }

    public function test_owner_withdrawn_filter_returns_matching_apps(): void
    {
        $owner = User::factory()->create(['status' => UserStatus::Withdrawn->value]);

        GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'default',
            'user_id' => $owner->id,
            'title' => '탈퇴 회원 앱',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body>x</body></html>',
            'visibility' => GeneratedAppVisibility::Private->value,
            'is_shared' => false,
            'metadata' => ['owner_nickname' => '탈퇴유저'],
        ]);

        $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mek360.com')
            ->getJson(self::ENDPOINT.'?owner_withdrawn=1')
            ->assertOk()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.owner.status', UserStatus::Withdrawn->value);
    }

    public function test_q_filter_matches_title(): void
    {
        $this->seedApps();

        $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mek360.com')
            ->getJson(self::ENDPOINT.'?q='.urlencode('모산'))
            ->assertOk()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.title', '모산 앱');
    }

    public function test_admin_preview_url_includes_token_for_private_html_paste(): void
    {
        $owner = User::factory()->create();

        $app = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'mosan',
            'user_id' => $owner->id,
            'title' => '직접입력 앱',
            'app_type' => 'html_paste',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body><h1>paste</h1></body></html>',
            'visibility' => GeneratedAppVisibility::Private->value,
            'is_shared' => false,
            'metadata' => ['owner_nickname' => '붙여넣기'],
        ]);

        $response = $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mek360.com')
            ->getJson(self::ENDPOINT.'?q='.urlencode('직접입력'))
            ->assertOk();

        $previewUrl = (string) $response->json('data.items.0.preview_url');
        $this->assertStringContainsString('/g/'.$app->id, $previewUrl);
        $this->assertStringContainsString('preview_token=', $previewUrl);
    }

    public function test_admin_preview_url_for_website_link_uses_external_url(): void
    {
        $owner = User::factory()->create();

        GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'mosan',
            'user_id' => $owner->id,
            'title' => '웹사이트 연결 앱',
            'app_type' => 'website_link',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body data-moabom-website-link="1"></body></html>',
            'visibility' => GeneratedAppVisibility::Private->value,
            'is_shared' => false,
            'metadata' => [
                'owner_nickname' => '링크',
                'website_url' => 'https://www.example.com',
            ],
        ]);

        $response = $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mek360.com')
            ->getJson(self::ENDPOINT.'?q='.urlencode('웹사이트 연결'))
            ->assertOk();

        $this->assertSame(
            'https://www.example.com',
            $response->json('data.items.0.preview_url'),
        );
    }

    /**
     * @return array{mosan: \Modules\Moabom\Apps\Models\GeneratedApp, freshent: \Modules\Moabom\Apps\Models\GeneratedApp}
     */
    private function seedApps(): array
    {
        $owner = User::factory()->create();

        $mosan = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'mosan',
            'user_id' => $owner->id,
            'title' => '모산 앱',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body>mosan</body></html>',
            'visibility' => GeneratedAppVisibility::Tenant->value,
            'is_shared' => true,
            'metadata' => ['owner_nickname' => '모산유저'],
        ]);

        $freshent = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'freshent',
            'user_id' => $owner->id,
            'title' => '프레시 앱',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body>freshent</body></html>',
            'visibility' => GeneratedAppVisibility::Private->value,
            'is_shared' => false,
            'metadata' => ['owner_nickname' => '프레시유저'],
        ]);

        return compact('mosan', 'freshent');
    }

    private function ensurePlatformGeneratedAppsTable(): void
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

    private function mockHostingTeardown(): void
    {
        $mock = $this->createMock(GeneratedAppHostingService::class);
        $mock->method('teardownHosted');
        $this->app->instance(GeneratedAppHostingService::class, $mock);
    }

    private function createAdminWithGeneratedAppPermissions(): User
    {
        $role = Role::firstOrCreate(
            ['identifier' => 'admin'],
            [
                'name' => ['ko' => '관리자', 'en' => 'Administrator'],
                'description' => ['ko' => '시스템 관리자', 'en' => 'System administrator'],
                'extension_type' => ExtensionOwnerType::Core,
                'extension_identifier' => 'core',
                'is_active' => true,
            ],
        );

        foreach (['moabom-apps.generated.read', 'moabom-apps.generated.manage'] as $identifier) {
            $permission = Permission::firstOrCreate(
                ['identifier' => $identifier],
                [
                    'name' => ['ko' => $identifier, 'en' => $identifier],
                    'description' => ['ko' => $identifier, 'en' => $identifier],
                    'extension_type' => ExtensionOwnerType::Module,
                    'extension_identifier' => 'moabom-apps',
                    'type' => PermissionType::Admin->value,
                ],
            );
            $role->permissions()->syncWithoutDetaching([$permission->id]);
        }

        $adminAccess = Permission::firstOrCreate(
            ['identifier' => 'core.admin.access'],
            [
                'name' => ['ko' => '관리자 접근', 'en' => 'Admin Access'],
                'description' => ['ko' => '관리자 접근', 'en' => 'Admin Access'],
                'extension_type' => ExtensionOwnerType::Core,
                'extension_identifier' => 'core',
                'type' => PermissionType::Admin->value,
            ],
        );
        $role->permissions()->syncWithoutDetaching([$adminAccess->id]);

        $user = User::factory()->create();
        $user->roles()->attach($role->id);

        return $user->fresh(['roles.permissions']);
    }
}
