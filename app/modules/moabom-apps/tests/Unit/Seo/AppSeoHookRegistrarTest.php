<?php

namespace Modules\Moabom\Apps\Tests\Unit\Seo;

use Modules\Moabom\Apps\Apps\AppRegistryInterface;
use Modules\Moabom\Apps\Seo\AppSeoDataService;
use Modules\Moabom\Apps\Seo\AppSeoHookRegistrar;
use Modules\Moabom\Apps\Tests\ModuleTestCase;
use ReflectionMethod;

class AppSeoHookRegistrarTest extends ModuleTestCase
{
    private function registrar(): AppSeoHookRegistrar
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

        return new AppSeoHookRegistrar(new AppSeoDataService($registry));
    }

    private function seedConfig(): void
    {
        config([
            'app.url' => 'https://example.test',
            'moabom-apps.seo.enabled' => true,
            'moabom-apps.seo.canonical_base' => '',
            'moabom-apps.seo.detail_path_prefix' => '/app',
            'moabom-apps.seo.index_path' => '/apps',
            'moabom-apps.seo.max_generated' => 100,
            'moabom-apps.seo.exclude' => [],
            'moabom-apps.seo.ai_crawler_user_agents' => ['GPTBot', 'ClaudeBot'],
            'moabom-apps.seo.builtin' => [
                [
                    'id' => 'demo-app',
                    'category' => 'basic',
                    'name' => ['en' => 'Demo'],
                    'description' => ['en' => 'Demo description'],
                ],
            ],
        ]);
    }

    private function call(AppSeoHookRegistrar $r, string $method, array $args): mixed
    {
        $ref = new ReflectionMethod($r, $method);
        $ref->setAccessible(true);

        return $ref->invokeArgs($r, $args);
    }

    private function baseViewData(string $canonical): array
    {
        return [
            'title' => 'site',
            'titleSuffix' => ' | MOABOM',
            'description' => '',
            'keywords' => '',
            'canonicalUrl' => $canonical,
            'ogTags' => '',
            'twitterTags' => '',
            'jsonLd' => null,
            'extraHeadTags' => '',
            'extraBodyEnd' => '',
        ];
    }

    public function test_resolve_is_bot_detects_ai_crawler(): void
    {
        $this->seedConfig();
        $r = $this->registrar();

        $this->assertTrue($this->call($r, 'resolveIsBot', [null, ['userAgent' => 'Mozilla/5.0 (compatible; GPTBot/1.0)']]));
        $this->assertNull($this->call($r, 'resolveIsBot', [null, ['userAgent' => 'Mozilla/5.0 Chrome']]));
        // 이미 판정된 값은 존중.
        $this->assertFalse($this->call($r, 'resolveIsBot', [false, ['userAgent' => 'GPTBot']]));
    }

    public function test_detail_injects_meta_structured_and_body(): void
    {
        $this->seedConfig();
        $r = $this->registrar();

        $out = $this->call($r, 'filterViewData', [
            $this->baseViewData('https://example.test/app/demo-app'),
            ['layoutName' => 'seo/app_detail'],
        ]);

        $this->assertSame('Demo', $out['title']);
        $this->assertStringContainsString('Demo description', $out['description']);
        $this->assertStringContainsString('SoftwareApplication', (string) $out['jsonLd']);
        $this->assertStringContainsString('<main class="moa-seo-app"', $out['extraBodyEnd']);
        $this->assertStringContainsString('og:title', $out['ogTags']);
        $this->assertSame('https://example.test/app/demo-app', $out['canonicalUrl']);
    }

    public function test_unknown_app_is_marked_noindex(): void
    {
        $this->seedConfig();
        $r = $this->registrar();

        $out = $this->call($r, 'filterViewData', [
            $this->baseViewData('https://example.test/app/ghost-app'),
            ['layoutName' => 'seo/app_detail'],
        ]);

        $this->assertStringContainsString('noindex', $out['extraHeadTags']);
    }

    public function test_index_injects_collection_page(): void
    {
        $this->seedConfig();
        $r = $this->registrar();

        $out = $this->call($r, 'filterViewData', [
            $this->baseViewData('https://example.test/apps'),
            ['layoutName' => 'seo/apps_index'],
        ]);

        $this->assertStringContainsString('CollectionPage', (string) $out['jsonLd']);
        $this->assertStringContainsString('<main class="moa-seo-apps"', $out['extraBodyEnd']);
    }

    public function test_non_target_layout_is_untouched(): void
    {
        $this->seedConfig();
        $r = $this->registrar();

        $input = $this->baseViewData('https://example.test/board/notice');
        $out = $this->call($r, 'filterViewData', [$input, ['layoutName' => 'board/show']]);

        $this->assertSame($input, $out);
    }
}
