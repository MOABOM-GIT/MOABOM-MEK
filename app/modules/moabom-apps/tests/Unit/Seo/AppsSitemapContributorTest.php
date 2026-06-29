<?php

namespace Modules\Moabom\Apps\Tests\Unit\Seo;

use Modules\Moabom\Apps\Apps\AppRegistryInterface;
use Modules\Moabom\Apps\Enums\GeneratedAppVisibility;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Seo\AppSeoDataService;
use Modules\Moabom\Apps\Seo\AppsSitemapContributor;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class AppsSitemapContributorTest extends ModuleTestCase
{
    private function contributor(): AppsSitemapContributor
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

        return new AppsSitemapContributor(new AppSeoDataService($registry));
    }

    public function test_includes_index_builtin_and_global_generated_only(): void
    {
        config([
            'app.url' => 'https://example.test',
            'app.locale' => 'en',
            'moabom-apps.seo.enabled' => true,
            'moabom-apps.seo.canonical_base' => '',
            'moabom-apps.seo.detail_path_prefix' => '/app',
            'moabom-apps.seo.index_path' => '/apps',
            'moabom-apps.seo.max_generated' => 100,
            'moabom-apps.seo.exclude' => [],
            'moabom-apps.seo.builtin' => [
                ['id' => 'demo-app', 'category' => 'basic', 'name' => ['en' => 'Demo']],
            ],
        ]);

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

        $locs = array_column($this->contributor()->getUrls(), 'loc');

        $this->assertContains('https://example.test/apps', $locs);
        $this->assertContains('https://example.test/app/demo-app', $locs);
        $this->assertContains('https://example.test/app/generated-app-'.$global->id, $locs);
        $this->assertNotContains('https://example.test/app/generated-app-'.$private->id, $locs);
    }

    public function test_identifier(): void
    {
        $this->assertSame('moabom-apps', $this->contributor()->getIdentifier());
    }
}
