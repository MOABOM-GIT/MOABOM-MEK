<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Support\GeneratedAppsConnection;
use Modules\Moabom\Apps\Tests\ModuleTestCase;
use Modules\Moabom\System\Http\Middleware\ResolveMoabomTenant;
use Modules\Moabom\System\Providers\SystemServiceProvider;

class PublicUserGeneratedAppControllerTest extends ModuleTestCase
{
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
        $this->ensureGeneratedAppsTable();
    }

    public function test_guest_can_list_published_apps_for_user(): void
    {
        $user = User::factory()->create();

        $published = GeneratedAppsConnection::apps()->create([
            'user_id' => $user->id,
            'tenant_slug' => 'default',
            'title' => '공개 앱',
            'app_type' => 'general',
            'html' => '<html><body>p</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
            'is_shared' => true,
        ]);

        GeneratedAppsConnection::apps()->create([
            'user_id' => $user->id,
            'tenant_slug' => 'default',
            'title' => '비공개 앱',
            'app_type' => 'general',
            'html' => '<html><body>x</body></html>',
            'visibility' => GeneratedAppVisibility::Private->value,
            'is_shared' => false,
        ]);

        $this->getJson("/api/modules/moabom-apps/users/{$user->uuid}/generated-apps")
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(1, 'data.data')
            ->assertJsonPath('data.data.0.title', '공개 앱')
            ->assertJsonPath('data.data.0.shell_id', 'generated-app-'.$published->id);
    }

    public function test_guest_can_list_recent_shell_apps_for_user(): void
    {
        $this->ensureUserSettingsTable();
        $user = User::factory()->create();

        \Modules\Moabom\System\Models\UserSystemSetting::query()->create([
            'user_id' => $user->id,
            'settings' => [
                'shell' => [
                    'home' => [
                        'recentAppIds' => ['cpap-mask', 'hospital-info', 'mypage'],
                    ],
                ],
            ],
        ]);

        $this->getJson("/api/modules/moabom-apps/users/{$user->uuid}/frequent-apps?limit=10")
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(2, 'data.data')
            ->assertJsonPath('data.data.0.id', 'cpap-mask')
            ->assertJsonPath('data.data.1.id', 'hospital-info');
    }

    public function test_recent_apps_empty_for_user_without_settings(): void
    {
        $user = User::factory()->create();

        $this->getJson("/api/modules/moabom-apps/users/{$user->uuid}/frequent-apps?limit=10")
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonCount(0, 'data.data');
    }

    private function ensureUserSettingsTable(): void
    {
        if (Schema::hasTable('moabom_system_user_settings')) {
            return;
        }

        $base = dirname(__DIR__, 2).'/moabom-system/database/migrations';
        $this->artisan('migrate', [
            '--path' => $base.'/2026_05_03_000001_create_moabom_system_user_settings_table.php',
            '--realpath' => true,
        ]);
    }

    private function ensureGeneratedAppsTable(): void
    {
        $base = $this->getModuleBasePath();

        if (! Schema::connection('moabom_platform')->hasTable('moabom_system_generated_apps')) {
            $this->artisan('migrate', [
                '--path' => $base.'/database/migrations/platform/2026_06_19_000001_create_generated_apps_platform_tables.php',
                '--database' => 'moabom_platform',
                '--force' => true,
            ]);
        }
    }
}
