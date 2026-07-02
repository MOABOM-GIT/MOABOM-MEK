<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use Illuminate\Support\Facades\Http;
use Modules\Moabom\Apps\Services\WebsiteLinkIconExtractionService;
use Modules\Moabom\Apps\Services\WebsiteLinkUrlGuard;
use Modules\Moabom\Apps\Support\WebsiteLinkIconBinaryValidator;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class WebsiteLinkIconExtractionServiceTest extends ModuleTestCase
{
    private function makeService(): WebsiteLinkIconExtractionService
    {
        $urlGuard = new WebsiteLinkUrlGuard;

        return new WebsiteLinkIconExtractionService($urlGuard, new WebsiteLinkIconBinaryValidator);
    }

    public function test_probe_returns_first_candidate_without_downloading_binary(): void
    {
        Http::fake([
            'https://example.com' => Http::response(<<<'HTML'
<!DOCTYPE html><html><head>
<link rel="apple-touch-icon" sizes="57x57" href="https://example.com/apple-57.png"/>
<link rel="icon" href="https://example.com/favicon.png"/>
</head><body></body></html>
HTML, 200),
        ]);

        $service = $this->makeService();

        $probed = $service->probeIconCandidate('https://example.com');

        $this->assertSame('https://example.com/apple-57.png', $probed['icon_url']);
        $this->assertFalse($probed['icon_from_title']);
        Http::assertSentCount(1);
    }

    public function test_fetch_tries_well_known_paths_when_head_has_no_icon_links(): void
    {
        Http::fake([
            'https://example.com' => Http::response('<html><head><title>x</title></head></html>', 200),
            'https://example.com/favicon.ico' => Http::response(
                "\0\0\1\0\x01\0",
                200,
                ['Content-Type' => 'image/x-icon'],
            ),
        ]);

        $service = $this->makeService();

        $fetched = $service->fetchIconForWebsite('https://example.com');

        $this->assertNotNull($fetched);
        $this->assertSame('https://example.com/favicon.ico', $fetched->sourceUrl);
        $this->assertSame('ico', $fetched->binary['ext']);
    }

    public function test_fetch_prioritizes_preferred_source_before_other_candidates(): void
    {
        Http::fake([
            'https://example.com' => Http::response(<<<'HTML'
<!DOCTYPE html><html><head>
<link rel="icon" href="https://example.com/head-icon.png"/>
</head><body></body></html>
HTML, 200),
            'https://example.com/preferred.png' => Http::response(
                "\x89PNG\r\n\x1a\n",
                200,
                ['Content-Type' => 'image/png'],
            ),
        ]);

        $service = $this->makeService();

        $fetched = $service->fetchIconForWebsite(
            'https://example.com',
            'https://example.com/preferred.png',
        );

        $this->assertNotNull($fetched);
        $this->assertSame('https://example.com/preferred.png', $fetched->sourceUrl);
        Http::assertNotSent(static fn ($request) => str_contains($request->url(), 'head-icon.png'));
    }

    public function test_fetch_rejects_html_payload_masquerading_as_icon(): void
    {
        Http::fake([
            'https://example.com' => Http::response('<html><head></head></html>', 200),
            'https://example.com/favicon.ico' => Http::response('<html><body>nope</body></html>', 200),
            'https://example.com/favicon.png' => Http::response(
                "\x89PNG\r\n\x1a\n",
                200,
                ['Content-Type' => 'image/png'],
            ),
        ]);

        $service = $this->makeService();

        $fetched = $service->fetchIconForWebsite('https://example.com');

        $this->assertNotNull($fetched);
        $this->assertSame('https://example.com/favicon.png', $fetched->sourceUrl);
    }

    public function test_collect_candidate_urls_skips_data_uri_icons(): void
    {
        $service = $this->makeService();

        $candidates = $service->collectCandidateUrls(<<<'HTML'
<!DOCTYPE html><html><head>
<link rel="icon" href="data:;base64,iVBORw0KGgo=">
</head><body></body></html>
HTML, 'https://example.com');

        $this->assertSame([
            'https://example.com/favicon.ico',
            'https://example.com/favicon.png',
            'https://example.com/apple-touch-icon.png',
            'https://example.com/apple-touch-icon-precomposed.png',
        ], $candidates);
    }
}
