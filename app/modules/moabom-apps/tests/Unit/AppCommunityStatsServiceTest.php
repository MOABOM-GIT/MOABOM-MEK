<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Apps\Enums\AppCommunityPostStatus;
use Modules\Moabom\Apps\Enums\AppCommunityPostType;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Services\AppCommunityStatsService;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\Apps\Tests\ModuleTestCase;
use Modules\Moabom\System\Providers\SystemServiceProvider;

class AppCommunityStatsServiceTest extends ModuleTestCase
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
        $this->ensureCommunityTables();
    }

    public function test_recalculate_updates_generated_app_cache_columns(): void
    {
        $owner = User::factory()->create();

        $app = GeneratedAppsConnection::apps()->create([
            'tenant_slug' => 'default',
            'user_id' => $owner->id,
            'title' => '집계 테스트',
            'app_type' => 'general',
            'tier' => 'standard',
            'html' => '<!DOCTYPE html><html><body>x</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
            'is_shared' => true,
        ]);

        GeneratedAppsConnection::communityPosts()->create([
            'generated_app_id' => $app->id,
            'tenant_slug' => 'default',
            'user_id' => $owner->id,
            'post_type' => AppCommunityPostType::Review->value,
            'rating' => 4,
            'title' => 'A',
            'body' => '본문',
            'status' => AppCommunityPostStatus::Published->value,
        ]);

        GeneratedAppsConnection::communityPosts()->create([
            'generated_app_id' => $app->id,
            'tenant_slug' => 'default',
            'user_id' => User::factory()->create()->id,
            'post_type' => AppCommunityPostType::Review->value,
            'rating' => 2,
            'title' => 'B',
            'body' => '본문',
            'status' => AppCommunityPostStatus::Hidden->value,
        ]);

        app(AppCommunityStatsService::class)->recalculate((int) $app->id);

        $fresh = GeneratedAppsConnection::apps()->find($app->id);
        $this->assertSame(1, (int) $fresh?->community_post_count);
        $this->assertSame(1, (int) $fresh?->community_rating_count);
        $this->assertSame(4.0, (float) $fresh?->community_rating_avg);
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
}
