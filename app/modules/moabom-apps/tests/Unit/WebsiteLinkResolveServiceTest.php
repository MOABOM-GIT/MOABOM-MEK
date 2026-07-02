<?php

namespace Modules\Moabom\Apps\Tests\Unit;

use Illuminate\Support\Facades\Http;
use Modules\Moabom\Apps\Support\WebsiteLinkIconBinaryValidator;
use Modules\Moabom\Apps\Services\WebsiteLinkIconExtractionService;
use Modules\Moabom\Apps\Services\WebsiteLinkResolveService;
use Modules\Moabom\Apps\Services\WebsiteLinkUrlGuard;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class WebsiteLinkResolveServiceTest extends ModuleTestCase
{
    private function makeService(): WebsiteLinkResolveService
    {
        $urlGuard = new WebsiteLinkUrlGuard;
        $extraction = new WebsiteLinkIconExtractionService($urlGuard, new WebsiteLinkIconBinaryValidator);

        return new WebsiteLinkResolveService($urlGuard, $extraction);
    }

    public function test_normalize_url_adds_https_scheme(): void
    {
        $service = $this->makeService();

        $this->assertSame('https://www.naver.com', $service->normalizeUrl('www.naver.com'));
    }

    public function test_normalize_url_rejects_invalid_value(): void
    {
        $service = $this->makeService();

        $this->expectException(\InvalidArgumentException::class);
        $service->normalizeUrl('not a url');
    }

    public function test_resolve_falls_back_to_well_known_favicon_when_document_is_missing(): void
    {
        Http::fake([
            'https://example.com' => Http::response('', 404),
        ]);

        $service = $this->makeService();

        $resolved = $service->resolve('https://example.com');

        $this->assertSame('https://example.com', $resolved['url']);
        $this->assertSame('https://example.com/favicon.ico', $resolved['icon_url']);
        $this->assertFalse($resolved['icon_from_title']);
    }

    public function test_resolve_prefers_smallest_apple_touch_icon_over_generic_icon(): void
    {
        Http::fake([
            'https://example.com' => Http::response(<<<'HTML'
<!DOCTYPE html><html><head>
<meta property="og:image" content="https://example.com/banner.jpg"/>
<link rel="apple-touch-icon" sizes="180x180" href="https://example.com/apple-180.png"/>
<link rel="apple-touch-icon" sizes="57x57" href="https://example.com/apple-57.png"/>
<link rel="icon" sizes="32x32" href="https://example.com/favicon-32.png"/>
</head><body></body></html>
HTML, 200),
        ]);

        $service = $this->makeService();

        $resolved = $service->resolve('https://example.com');

        $this->assertSame('https://example.com/apple-57.png', $resolved['icon_url']);
        $this->assertFalse($resolved['icon_from_title']);
    }

    public function test_resolve_uses_shortcut_icon_when_apple_touch_is_missing(): void
    {
        Http::fake([
            'https://example.com' => Http::response(<<<'HTML'
<!DOCTYPE html><html><head>
<link rel="shortcut icon" href="https://example.com/shortcut.ico"/>
<link rel="icon" sizes="16x16" href="https://example.com/icon-16.png"/>
</head><body></body></html>
HTML, 200),
        ]);

        $service = $this->makeService();

        $resolved = $service->resolve('https://example.com');

        $this->assertSame('https://example.com/shortcut.ico', $resolved['icon_url']);
        $this->assertFalse($resolved['icon_from_title']);
    }

    public function test_resolve_uses_origin_favicon_when_head_has_no_icon_links(): void
    {
        Http::fake([
            'https://example.com' => Http::response('<html><head><title>x</title></head></html>', 200),
        ]);

        $service = $this->makeService();

        $resolved = $service->resolve('https://example.com');

        $this->assertSame('https://example.com/favicon.ico', $resolved['icon_url']);
        $this->assertFalse($resolved['icon_from_title']);
    }

    public function test_resolve_extracts_theme_color_from_head(): void
    {
        Http::fake([
            'https://example.com' => Http::response(<<<'HTML'
<!DOCTYPE html><html><head>
<meta name="theme-color" content="#005eb8"/>
<link rel="shortcut icon" href="/favicon.ico"/>
</head><body></body></html>
HTML, 200),
        ]);

        $service = $this->makeService();

        $resolved = $service->resolve('https://example.com');

        $this->assertSame('#005eb8', $resolved['theme_color']);
    }

    public function test_resolve_picks_icon_when_head_has_many_non_icon_links(): void
    {
        Http::fake([
            'https://example.com' => Http::response(<<<'HTML'
<!DOCTYPE html><html><head>
<link rel="stylesheet" href="https://example.com/app.css"/>
<link rel="canonical" href="https://example.com/"/>
<link rel="manifest" href="/manifest.webmanifest"/>
<link rel="icon" sizes="16x16 32x32" href="https://example.com/favicon-16.png"/>
</head><body></body></html>
HTML, 200),
        ]);

        $service = $this->makeService();

        $resolved = $service->resolve('https://example.com');

        $this->assertSame('https://example.com/favicon-16.png', $resolved['icon_url']);
        $this->assertFalse($resolved['icon_from_title']);
    }

    public function test_resolve_ignores_placeholder_data_icon_and_uses_title_icon(): void
    {
        Http::fake([
            'https://example.com' => Http::response(<<<'HTML'
<!DOCTYPE html><html><head>
<link rel="icon" href="data:;base64,iVBORw0KGgo=">
</head><body></body></html>
HTML, 200),
        ]);

        $service = $this->makeService();

        $resolved = $service->resolve('https://example.com');

        $this->assertSame('https://example.com/favicon.ico', $resolved['icon_url']);
        $this->assertFalse($resolved['icon_from_title']);
    }
}
