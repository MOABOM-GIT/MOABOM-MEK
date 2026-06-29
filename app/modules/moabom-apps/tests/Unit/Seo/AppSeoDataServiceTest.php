<?php

namespace Modules\Moabom\Apps\Tests\Unit\Seo;

use Modules\Moabom\Apps\Apps\AppRegistryInterface;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Seo\AppSeoDataService;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class AppSeoDataServiceTest extends ModuleTestCase
{
    private function service(): AppSeoDataService
    {
        $registry = new class implements AppRegistryInterface
        {
            public function all(): array
            {
                return [];
            }

            public function forShell(string $template): array
            {
                return [];
            }
        };

        return new AppSeoDataService($registry);
    }

    private function seedConfig(): void
    {
        config([
            'app.url' => 'https://example.test',
            'app.fallback_locale' => 'en',
            'moabom-apps.seo.enabled' => true,
            'moabom-apps.seo.canonical_base' => '',
            'moabom-apps.seo.detail_path_prefix' => '/app',
            'moabom-apps.seo.index_path' => '/apps',
            'moabom-apps.seo.max_generated' => 100,
            'moabom-apps.seo.exclude' => ['secret-app'],
            'moabom-apps.seo.builtin' => [
                [
                    'id' => 'demo-app',
                    'category' => 'basic',
                    'name' => ['ko' => '데모', 'en' => 'Demo'],
                    'description' => ['ko' => '데모 설명', 'en' => 'Demo description'],
                    'keywords' => ['demo', 'test'],
                ],
                [
                    'id' => 'secret-app',
                    'category' => 'basic',
                    'name' => ['en' => 'Secret'],
                ],
            ],
        ]);
    }

    public function test_builtin_apps_are_localized_and_use_canonical_url(): void
    {
        $this->seedConfig();
        $service = $this->service();

        $ids = array_column($service->publicApps('en'), 'id');
        $this->assertContains('demo-app', $ids);
        $this->assertNotContains('secret-app', $ids, 'excluded builtin must never appear');

        $en = $service->findPublicApp('demo-app', 'en');
        $this->assertNotNull($en);
        $this->assertSame('Demo', $en['title']);
        $this->assertSame('https://example.test/app/demo-app', $en['url']);
        $this->assertSame('builtin', $en['type']);

        $ko = $service->findPublicApp('demo-app', 'ko');
        $this->assertSame('데모', $ko['title']);
    }

    public function test_excluded_and_unknown_builtin_return_null(): void
    {
        $this->seedConfig();
        $service = $this->service();

        $this->assertNull($service->findPublicApp('secret-app', 'en'));
        $this->assertNull($service->findPublicApp('does-not-exist', 'en'));
    }

    public function test_only_global_generated_apps_are_exposed(): void
    {
        $this->seedConfig();
        $service = $this->service();

        $global = GeneratedApp::create([
            'user_id' => 1,
            'title' => 'Global App',
            'app_type' => 'general',
            'prompt' => '전역 공개 데모 앱입니다.',
            'html' => '<html><head></head><body>ok</body></html>',
            'visibility' => GeneratedAppVisibility::Global->value,
        ]);

        $private = GeneratedApp::create([
            'user_id' => 1,
            'title' => 'Private App',
            'app_type' => 'general',
            'prompt' => 'private',
            'html' => '<html><head></head><body>no</body></html>',
            'visibility' => GeneratedAppVisibility::Private->value,
        ]);

        $ids = array_column($service->publicApps('en'), 'id');
        $this->assertContains('generated-app-'.$global->id, $ids);
        $this->assertNotContains('generated-app-'.$private->id, $ids);

        $this->assertNotNull($service->findPublicApp('generated-app-'.$global->id, 'en'));
        $this->assertNull($service->findPublicApp('generated-app-'.$private->id, 'en'));
    }

    public function test_disabled_returns_empty(): void
    {
        $this->seedConfig();
        config(['moabom-apps.seo.enabled' => false]);
        $service = $this->service();

        $this->assertSame([], $service->publicApps('en'));
        $this->assertNull($service->findPublicApp('demo-app', 'en'));
    }
}
