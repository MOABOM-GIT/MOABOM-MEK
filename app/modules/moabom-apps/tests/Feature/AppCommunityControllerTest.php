<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Apps\Enums\AppCommunityPostStatus;
use Modules\Moabom\Apps\Enums\AppCommunityPostType;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\Apps\Tests\ModuleTestCase;
use Modules\Moabom\System\Http\Middleware\ResolveMoabomTenant;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantRecord;

class AppCommunityControllerTest extends ModuleTestCase
{
    private User $owner;

    private User $visitor;

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

        $this->owner = User::factory()->create();
        $this->visitor = User::factory()->create();
    }

    public function test_guest_can_read_published_app_community_summary(): void
    {
        $app = $this->createPublishedApp($this->owner->id);

        $this->getJson("/api/modules/moabom-apps/apps/generated/{$app->id}/community/summary")
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonStructure([
                'data' => ['rating_avg', 'rating_count', 'post_count', 'my_review', 'creators'],
            ]);
    }

    public function test_private_app_community_is_hidden_from_guest(): void
    {
        $app = $this->createPrivateApp($this->owner->id);

        $this->getJson("/api/modules/moabom-apps/apps/generated/{$app->id}/community/summary")
            ->assertNotFound();
    }

    public function test_global_app_community_posts_are_visible_from_other_tenant(): void
    {
        $app = $this->createApp($this->owner->id, GeneratedAppVisibility::Global, 'mosan');
        $this->seedCommunityPost((int) $app->id, $this->visitor->id, 'mosan');

        $this->bindTenantContext('freshent');

        $this->getJson("/api/modules/moabom-apps/apps/generated/{$app->id}/community/posts")
            ->assertOk()
            ->assertJsonCount(1, 'data.items');
    }

    public function test_tenant_app_community_posts_are_visible_only_inside_owner_tenant(): void
    {
        $app = $this->createApp($this->owner->id, GeneratedAppVisibility::Tenant, 'mosan');
        $this->seedCommunityPost((int) $app->id, $this->visitor->id, 'mosan');

        $this->bindTenantContext('mosan');

        $this->getJson("/api/modules/moabom-apps/apps/generated/{$app->id}/community/posts")
            ->assertOk()
            ->assertJsonCount(1, 'data.items');

        $this->bindTenantContext('freshent');

        $this->getJson("/api/modules/moabom-apps/apps/generated/{$app->id}/community/posts")
            ->assertNotFound();
    }

    public function test_private_app_community_posts_are_visible_only_to_owner(): void
    {
        $app = $this->createApp($this->owner->id, GeneratedAppVisibility::Private, 'default');
        $this->seedCommunityPost((int) $app->id, $this->owner->id, 'default');
        $this->bindTenantContext('default');

        $this->getJson("/api/modules/moabom-apps/apps/generated/{$app->id}/community/posts")
            ->assertNotFound();

        $this->actingAs($this->owner)
            ->getJson("/api/modules/moabom-apps/apps/generated/{$app->id}/community/posts")
            ->assertOk()
            ->assertJsonCount(1, 'data.items');

        $this->actingAs($this->visitor)
            ->getJson("/api/modules/moabom-apps/apps/generated/{$app->id}/community/posts")
            ->assertNotFound();
    }

    public function test_owner_can_create_review_on_private_app(): void
    {
        $app = $this->createPrivateApp($this->owner->id);

        $this->actingAs($this->owner)
            ->postJson("/api/modules/moabom-apps/apps/generated/{$app->id}/community/posts", [
                'title' => '좋아요',
                'body' => '비공개 앱 리뷰',
                'rating' => 5,
            ])
            ->assertCreated()
            ->assertJsonPath('data.item.rating', 5);

        $fresh = GeneratedAppsConnection::apps()->find($app->id);
        $this->assertSame(1, (int) $fresh?->community_post_count);
        $this->assertSame(5.0, (float) $fresh?->community_rating_avg);
    }

    public function test_visitor_cannot_create_duplicate_review(): void
    {
        $app = $this->createPublishedApp($this->owner->id);

        $this->actingAs($this->visitor)
            ->postJson("/api/modules/moabom-apps/apps/generated/{$app->id}/community/posts", [
                'title' => '첫 리뷰',
                'body' => '본문',
                'rating' => 4,
            ])
            ->assertCreated();

        $this->actingAs($this->visitor)
            ->postJson("/api/modules/moabom-apps/apps/generated/{$app->id}/community/posts", [
                'title' => '중복',
                'body' => '본문',
                'rating' => 3,
            ])
            ->assertStatus(409);
    }

    public function test_owner_can_update_and_delete_review(): void
    {
        $app = $this->createPublishedApp($this->owner->id);

        $create = $this->actingAs($this->visitor)
            ->postJson("/api/modules/moabom-apps/apps/generated/{$app->id}/community/posts", [
                'title' => '초안',
                'body' => '본문',
                'rating' => 3,
            ])
            ->assertCreated();

        $postId = (int) $create->json('data.item.id');

        $this->actingAs($this->visitor)
            ->putJson("/api/modules/moabom-apps/apps/generated/{$app->id}/community/posts/{$postId}", [
                'title' => '수정',
                'body' => '수정 본문',
                'rating' => 5,
            ])
            ->assertOk()
            ->assertJsonPath('data.item.title', '수정');

        $this->actingAs($this->visitor)
            ->deleteJson("/api/modules/moabom-apps/apps/generated/{$app->id}/community/posts/{$postId}")
            ->assertOk();

        $fresh = GeneratedAppsConnection::apps()->find($app->id);
        $this->assertSame(0, (int) $fresh?->community_post_count);
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

        $this->artisan('migrate', [
            '--path' => $base.'/database/migrations/2026_06_28_000001_create_app_community_posts_table.php',
            '--realpath' => true,
        ]);
        $this->artisan('migrate', [
            '--path' => $base.'/database/migrations/2026_06_28_000002_add_community_stats_to_generated_apps.php',
            '--realpath' => true,
        ]);
    }

    public function test_owner_can_create_review_on_private_app_from_platform_host(): void
    {
        $app = $this->createPrivateApp($this->owner->id);

        $this->actingAs($this->owner)
            ->withHeader('Host', 'mek360.com')
            ->postJson("/api/modules/moabom-apps/apps/generated/{$app->id}/community/posts", [
                'title' => '플랫폼 host 리뷰',
                'body' => '비공개 앱 소유자 cross-host',
                'rating' => 4,
            ])
            ->assertCreated()
            ->assertJsonPath('data.item.rating', 4);
    }

    public function test_member_can_list_only_own_app_reviews_for_mypage(): void
    {
        $app = $this->createPublishedApp($this->owner->id);
        $this->seedCommunityPost((int) $app->id, $this->visitor->id, 'default');
        $this->bindTenantContext('default');

        $this->actingAs($this->visitor)
            ->getJson('/api/modules/moabom-apps/apps/community/reviews?limit=10&offset=0')
            ->assertOk()
            ->assertJsonPath('data.summary.reviews_count', 1)
            ->assertJsonPath('data.items.0.type', 'review')
            ->assertJsonPath('data.items.0.board_name', '공개 앱')
            ->assertJsonPath('data.items.0.target_url', '/app/generated-app-'.$app->id)
            ->assertJsonPath('data.pagination.has_more', false);

        $this->actingAs($this->owner)
            ->getJson('/api/modules/moabom-apps/apps/community/reviews')
            ->assertOk()
            ->assertJsonPath('data.summary.reviews_count', 0)
            ->assertJsonCount(0, 'data.items');
    }

    private function createPublishedApp(int $userId): \Modules\Moabom\Apps\Models\GeneratedApp
    {
        return $this->createApp($userId, GeneratedAppVisibility::Global, 'default');
    }

    private function createPrivateApp(int $userId): \Modules\Moabom\Apps\Models\GeneratedApp
    {
        return $this->createApp($userId, GeneratedAppVisibility::Private, 'default');
    }

    private function createApp(
        int $userId,
        GeneratedAppVisibility $visibility,
        string $tenantSlug,
    ): \Modules\Moabom\Apps\Models\GeneratedApp {
        return GeneratedAppsConnection::apps()->create([
            'tenant_slug' => $tenantSlug,
            'user_id' => $userId,
            'title' => $visibility === GeneratedAppVisibility::Private ? '비공개 앱' : '공개 앱',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body>x</body></html>',
            'visibility' => $visibility->value,
            'is_shared' => $visibility->isPublished(),
        ]);
    }

    private function seedCommunityPost(int $appId, int $userId, string $tenantSlug): void
    {
        GeneratedAppsConnection::communityPosts()->create([
            'generated_app_id' => $appId,
            'tenant_slug' => $tenantSlug,
            'user_id' => $userId,
            'post_type' => AppCommunityPostType::Review->value,
            'rating' => 5,
            'title' => '리뷰',
            'body' => '공개 범위 회귀 테스트',
            'status' => AppCommunityPostStatus::Published->value,
        ]);
    }

    private function bindTenantContext(string $tenantSlug): void
    {
        $host = $tenantSlug.'.mek360.com';
        $context = new TenantContext;
        $context->setTenant(new TenantRecord(
            id: 1,
            slug: $tenantSlug,
            host: $host,
            dbDatabase: 'tenant_'.$tenantSlug,
            gcsPrefix: 'tenants/'.$tenantSlug,
            packageId: 'hospital-default',
            status: 'active',
        ), $host);

        $this->app->instance(TenantContext::class, $context);
    }
}
