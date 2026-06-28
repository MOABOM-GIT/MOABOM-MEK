<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Feature;

use App\Enums\ExtensionOwnerType;
use App\Enums\PermissionType;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Apps\Contracts\AppCommunityPostRepositoryInterface;
use Modules\Moabom\Apps\Enums\AppCommunityPostStatus;
use Modules\Moabom\Apps\Enums\AppCommunityPostType;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\Apps\Tests\ModuleTestCase;
use Modules\Moabom\System\Http\Middleware\ResolveMoabomTenant;
use Modules\Moabom\System\Providers\SystemServiceProvider;

class AppCommunityAdminControllerTest extends ModuleTestCase
{
    private User $adminUser;

    private const ENDPOINT = '/api/modules/moabom-apps/admin/app-community/posts';

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutMiddleware([ResolveMoabomTenant::class]);
        $this->app->register(SystemServiceProvider::class);

        config([
            'moabom-system.saas.enabled' => true,
            'moabom-system.saas.base_domain' => 'mek360.com',
            'moabom-system.saas.platform_hosts' => ['mek360.com'],
            'database.connections.moabom_platform' => config('database.connections.sqlite'),
        ]);

        GeneratedAppsConnection::register();
        $this->ensureCommunityTables();
        $this->adminUser = $this->createAdminWithCommunityPermissions();
    }

    public function test_tenant_scope_admin_list_uses_platform_apps_plane_not_default_connection(): void
    {
        $seed = $this->seedPost();

        config([
            'database.connections.tenant_shadow' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
            ],
        ]);

        Schema::connection('tenant_shadow')->create('moabom_system_generated_apps', function ($table): void {
            $table->id();
            $table->string('tenant_slug', 64)->default('default');
            $table->unsignedBigInteger('user_id');
            $table->string('title', 120);
        });

        config(['database.default' => 'tenant_shadow']);

        /** @var AppCommunityPostRepositoryInterface $repository */
        $repository = app(AppCommunityPostRepositoryInterface::class);
        $result = $repository->adminList([], 'default', 200);

        $this->assertSame(1, $result['total']);
        $this->assertSame($seed['post_id'], (int) $result['items']->first()?->id);
    }

    public function test_admin_can_list_and_hide_post(): void
    {
        $seed = $this->seedPost();

        $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mek360.com')
            ->getJson(self::ENDPOINT.'?generated_app_id='.$seed['app_id'])
            ->assertOk()
            ->assertJsonPath('data.meta.abilities.can_manage', true)
            ->assertJsonPath('data.meta.applied_filters.generated_app_id', $seed['app_id'])
            ->assertJsonPath('data.meta.filter_semantics.tenant_slug', 'generated_app_owner_tenant')
            ->assertJsonPath('data.meta.filter_semantics.author_tenant_slug', 'post_author_tenant')
            ->assertJsonCount(1, 'data.items');

        $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mek360.com')
            ->patchJson(self::ENDPOINT.'/'.$seed['post_id'].'/status', [
                'status' => AppCommunityPostStatus::Hidden->value,
                'hidden_reason' => 'admin',
            ])
            ->assertOk()
            ->assertJsonPath('data.item.status', AppCommunityPostStatus::Hidden->value);

        $app = GeneratedAppsConnection::apps()->find($seed['app_id']);
        $this->assertSame(0, (int) $app?->community_post_count);
    }

    public function test_admin_can_restore_hidden_post(): void
    {
        $seed = $this->seedPost();

        $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mek360.com')
            ->patchJson(self::ENDPOINT.'/'.$seed['post_id'].'/status', [
                'status' => AppCommunityPostStatus::Hidden->value,
                'hidden_reason' => 'admin',
            ])
            ->assertOk();

        $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mek360.com')
            ->patchJson(self::ENDPOINT.'/'.$seed['post_id'].'/status', [
                'status' => AppCommunityPostStatus::Published->value,
            ])
            ->assertOk()
            ->assertJsonPath('data.item.status', AppCommunityPostStatus::Published->value);

        $app = GeneratedAppsConnection::apps()->find($seed['app_id']);
        $this->assertSame(1, (int) $app?->community_post_count);
    }

    public function test_tenant_admin_lists_posts_for_tenant_apps_even_when_author_tenant_differs(): void
    {
        $owner = User::factory()->create();
        $author = User::factory()->create();

        $app = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'mosan',
            'user_id' => $owner->id,
            'title' => '병원 앱',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body>x</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
            'is_shared' => true,
        ]);

        $post = GeneratedAppsConnection::communityPosts()->create([
            'generated_app_id' => $app->id,
            'tenant_slug' => 'platform',
            'user_id' => $author->id,
            'post_type' => AppCommunityPostType::Review->value,
            'rating' => 5,
            'title' => '병원 앱 리뷰',
            'body' => '작성자 tenant 와 다를 수 있음',
            'status' => AppCommunityPostStatus::Published->value,
        ]);

        $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mosan.mek360.com')
            ->getJson(self::ENDPOINT.'?generated_app_id='.$app->id)
            ->assertOk()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.id', $post->id);
    }

    public function test_tenant_admin_generated_app_id_filter_cannot_bypass_owner_scope(): void
    {
        $owner = User::factory()->create();
        $author = User::factory()->create();

        $mosanApp = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'mosan',
            'user_id' => $owner->id,
            'title' => '모산 앱',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body>mosan</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
            'is_shared' => true,
        ]);
        GeneratedAppsConnection::communityPosts()->create([
            'generated_app_id' => $mosanApp->id,
            'tenant_slug' => 'platform',
            'user_id' => $author->id,
            'post_type' => AppCommunityPostType::Review->value,
            'rating' => 5,
            'title' => '모산 리뷰',
            'body' => 'tenant scope 확인',
            'status' => AppCommunityPostStatus::Published->value,
        ]);

        $freshentApp = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'freshent',
            'user_id' => $owner->id,
            'title' => '프레시 앱',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body>freshent</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
            'is_shared' => true,
        ]);
        $freshentPost = GeneratedAppsConnection::communityPosts()->create([
            'generated_app_id' => $freshentApp->id,
            'tenant_slug' => 'platform',
            'user_id' => $author->id,
            'post_type' => AppCommunityPostType::Review->value,
            'rating' => 4,
            'title' => '프레시 리뷰',
            'body' => '다른 병원 리뷰',
            'status' => AppCommunityPostStatus::Published->value,
        ]);

        $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mosan.mek360.com')
            ->getJson(self::ENDPOINT.'?generated_app_id='.$freshentApp->id)
            ->assertOk()
            ->assertJsonPath('data.meta.applied_filters.app_owner_tenant_slug', 'mosan')
            ->assertJsonPath('data.meta.applied_filters.app_owner_tenant_locked', true)
            ->assertJsonCount(0, 'data.items');

        $this->actingAs($this->adminUser)
            ->withHeader('Host', 'freshent.mek360.com')
            ->getJson(self::ENDPOINT.'?generated_app_id='.$freshentApp->id)
            ->assertOk()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.id', $freshentPost->id);
    }

    public function test_platform_admin_tenant_slug_filter_uses_app_owner_not_author_tenant(): void
    {
        $owner = User::factory()->create();
        $author = User::factory()->create();

        $app = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'mosan',
            'user_id' => $owner->id,
            'title' => '모산 앱',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body>x</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
            'is_shared' => true,
        ]);

        $post = GeneratedAppsConnection::communityPosts()->create([
            'generated_app_id' => $app->id,
            'tenant_slug' => 'platform',
            'user_id' => $author->id,
            'post_type' => AppCommunityPostType::Review->value,
            'rating' => 5,
            'title' => '플랫폼 작성자 리뷰',
            'body' => '작성자 tenant 는 platform',
            'status' => AppCommunityPostStatus::Published->value,
        ]);

        $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mek360.com')
            ->getJson(self::ENDPOINT.'?tenant_slug=mosan')
            ->assertOk()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.id', $post->id);

        $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mek360.com')
            ->getJson(self::ENDPOINT.'?tenant_slug=platform')
            ->assertOk()
            ->assertJsonCount(0, 'data.items');

        $this->actingAs($this->adminUser)
            ->withHeader('Host', 'mek360.com')
            ->getJson(self::ENDPOINT.'?author_tenant_slug=platform')
            ->assertOk()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.id', $post->id);
    }

    /**
     * @return array{app_id: int, post_id: int}
     */
    private function seedPost(): array
    {
        $owner = User::factory()->create();
        $author = User::factory()->create();

        $app = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'default',
            'user_id' => $owner->id,
            'title' => '관리 대상 앱',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body>x</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
            'is_shared' => true,
        ]);

        $post = GeneratedAppsConnection::communityPosts()->create([
            'generated_app_id' => $app->id,
            'tenant_slug' => 'default',
            'user_id' => $author->id,
            'post_type' => AppCommunityPostType::Review->value,
            'rating' => 4,
            'title' => '리뷰',
            'body' => '본문',
            'status' => AppCommunityPostStatus::Published->value,
        ]);

        app(\Modules\Moabom\Apps\Services\AppCommunityStatsService::class)->recalculate((int) $app->id);

        return [
            'app_id' => (int) $app->id,
            'post_id' => (int) $post->id,
        ];
    }

    private function ensureCommunityTables(): void
    {
        $base = $this->getModuleBasePath();

        if (! Schema::connection('moabom_platform')->hasTable('moabom_system_generated_apps')) {
            $this->artisan('migrate', [
                '--path' => $base.'/database/migrations/platform/2026_06_19_000001_create_generated_apps_platform_tables.php',
                '--realpath' => true,
                '--database' => 'moabom_platform',
            ]);
        }

        if (! Schema::connection('moabom_platform')->hasColumn('moabom_system_generated_apps', 'community_rating_avg')) {
            $this->artisan('migrate', [
                '--path' => $base.'/database/migrations/platform/2026_06_28_000002_add_community_stats_to_generated_apps.php',
                '--realpath' => true,
                '--database' => 'moabom_platform',
            ]);
        }

        if (! Schema::connection('moabom_platform')->hasTable('moabom_app_community_posts')) {
            $this->artisan('migrate', [
                '--path' => $base.'/database/migrations/platform/2026_06_28_000001_create_app_community_posts_table.php',
                '--realpath' => true,
                '--database' => 'moabom_platform',
            ]);
        }
    }

    private function createAdminWithCommunityPermissions(): User
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

        foreach (['moabom-apps.community.read', 'moabom-apps.community.manage'] as $identifier) {
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
