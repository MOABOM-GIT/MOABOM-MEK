<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Feature;

use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class AppSeoControllerTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'app.url' => 'https://example.test',
            'moabom-apps.seo.enabled' => true,
            'moabom-apps.seo.canonical_base' => '',
            'moabom-apps.seo.detail_path_prefix' => '/app',
            'moabom-apps.seo.index_path' => '/apps',
            'moabom-apps.seo.max_generated' => 100,
            'moabom-apps.seo.exclude' => ['secret-app'],
            'moabom-apps.seo.builtin' => [
                ['id' => 'demo-app', 'category' => 'basic', 'name' => ['en' => 'Demo', 'ko' => '데모'], 'description' => ['en' => 'Demo description']],
                ['id' => 'secret-app', 'category' => 'basic', 'name' => ['en' => 'Secret']],
            ],
        ]);
    }

    public function test_index_lists_public_apps(): void
    {
        $this->getJson('/api/modules/moabom-apps/seo/apps')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonFragment(['id' => 'demo-app']);
    }

    public function test_show_returns_builtin_descriptor(): void
    {
        $this->getJson('/api/modules/moabom-apps/seo/apps/demo-app')
            ->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', 'demo-app')
            ->assertJsonPath('data.type', 'builtin');
    }

    public function test_excluded_builtin_is_not_found(): void
    {
        $this->getJson('/api/modules/moabom-apps/seo/apps/secret-app')
            ->assertStatus(404);
    }

    public function test_only_global_generated_app_is_exposed(): void
    {
        $global = GeneratedApp::create([
            'user_id' => 1,
            'title' => 'Global',
            'app_type' => 'general',
            'prompt' => 'p',
            'html' => '<html><head></head><body>x</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
        ]);

        $private = GeneratedApp::create([
            'user_id' => 1,
            'title' => 'Private',
            'app_type' => 'general',
            'prompt' => 'p',
            'html' => '<html><head></head><body>x</body></html>',
            'visibility' => GeneratedAppVisibility::Private->value,
        ]);

        $this->getJson('/api/modules/moabom-apps/seo/apps/generated-app-'.$global->id)
            ->assertOk()
            ->assertJsonPath('data.type', 'generated');

        $this->getJson('/api/modules/moabom-apps/seo/apps/generated-app-'.$private->id)
            ->assertStatus(404);
    }
}
