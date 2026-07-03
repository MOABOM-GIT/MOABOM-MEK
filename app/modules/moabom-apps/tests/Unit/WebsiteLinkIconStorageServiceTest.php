<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use App\Contracts\Extension\StorageInterface;
use Illuminate\Support\Facades\Http;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Support\WebsiteLinkIconBinaryValidator;
use Modules\Moabom\Apps\Services\WebsiteLinkIconAccessService;
use Modules\Moabom\Apps\Services\WebsiteLinkIconExtractionService;
use Modules\Moabom\Apps\Services\WebsiteLinkIconStorageService;
use Modules\Moabom\Apps\Services\WebsiteLinkUrlGuard;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class WebsiteLinkIconStorageServiceTest extends ModuleTestCase
{
    private function makeService(StorageInterface $storage): WebsiteLinkIconStorageService
    {
        $urlGuard = new WebsiteLinkUrlGuard;
        $extraction = new WebsiteLinkIconExtractionService($urlGuard, new WebsiteLinkIconBinaryValidator);

        return new WebsiteLinkIconStorageService(
            $storage,
            $extraction,
            new WebsiteLinkIconAccessService,
        );
    }

    public function test_persist_for_app_stores_icon_and_rewrites_metadata_url(): void
    {
        Http::fake([
            'https://example.com/favicon.png' => Http::response(
                "\x89PNG\r\n\x1a\n",
                200,
                ['Content-Type' => 'image/png'],
            ),
        ]);

        $storage = $this->createMock(StorageInterface::class);
        $storage->method('files')->willReturn([]);
        $storage->method('exists')->willReturn(false);
        $storage->expects($this->once())
            ->method('put')
            ->with(
                'generated-apps',
                $this->callback(static fn (string $path): bool => str_ends_with($path, '/website-icon.png')),
                $this->anything(),
            )
            ->willReturn(true);

        $service = $this->makeService($storage);
        $app = new GeneratedApp([
            'id' => 12,
            'app_type' => 'website_link',
        ]);

        $metadata = $service->persistForApp($app, [
            'website_url' => 'https://example.com',
            'icon_source_url' => 'https://example.com/favicon.png',
            'icon_from_title' => false,
        ]);

        $this->assertSame('https://example.com/favicon.png', $metadata['icon_source_url']);
        $this->assertStringContainsString('/apps/generated/12/website-icon', $metadata['icon_url']);
        $this->assertStringContainsString('icon_token=', $metadata['icon_url']);
        $this->assertSame('12/website-icon.png', $metadata['stored_icon_path']);
    }

    public function test_persist_for_app_fetches_even_when_client_sent_icon_from_title(): void
    {
        Http::fake([
            'https://example.com' => Http::response('<html><head><link rel="icon" href="https://example.com/favicon.png"/></head></html>', 200),
            'https://example.com/favicon.png' => Http::response(
                "\x89PNG\r\n\x1a\n",
                200,
                ['Content-Type' => 'image/png'],
            ),
        ]);

        $storage = $this->createMock(StorageInterface::class);
        $storage->method('files')->willReturn([]);
        $storage->method('exists')->willReturn(false);
        $storage->expects($this->once())->method('put')->willReturn(true);

        $service = $this->makeService($storage);
        $app = new GeneratedApp([
            'id' => 4,
            'app_type' => 'website_link',
        ]);

        $metadata = $service->persistForApp($app, [
            'website_url' => 'https://example.com',
            'icon_from_title' => true,
        ]);

        $this->assertFalse($metadata['icon_from_title']);
        $this->assertStringContainsString('/apps/generated/4/website-icon', $metadata['icon_url']);
    }

    public function test_persist_reuses_stored_icon_when_website_url_is_unchanged(): void
    {
        Http::fake();

        $storage = $this->createMock(StorageInterface::class);
        $storage->method('exists')
            ->with('generated-apps', '9/website-icon.png')
            ->willReturn(true);
        $storage->expects($this->never())->method('put');

        $service = $this->makeService($storage);
        $app = new GeneratedApp([
            'id' => 9,
            'app_type' => 'website_link',
            'metadata' => [
                'website_url' => 'https://example.com',
                'icon_source_url' => 'https://example.com/favicon.png',
                'stored_icon_path' => '9/website-icon.png',
                'icon_mime' => 'image/png',
            ],
        ]);

        $metadata = $service->persistForApp($app, [
            'website_url' => 'https://example.com',
            'icon_source_url' => 'https://example.com/favicon.png',
            'icon_from_title' => false,
        ]);

        $this->assertSame('9/website-icon.png', $metadata['stored_icon_path']);
        $this->assertStringContainsString('/apps/generated/9/website-icon', $metadata['icon_url']);
    }

    public function test_persist_keeps_existing_icon_when_refetch_fails_for_same_website(): void
    {
        Http::fake([
            'https://example.com' => Http::response('', 500),
            'https://example.com/favicon.ico' => Http::response('', 500),
        ]);

        $storage = $this->createMock(StorageInterface::class);
        $storage->method('exists')
            ->with('generated-apps', '11/website-icon.png')
            ->willReturn(true);
        $storage->expects($this->never())->method('put');

        $service = $this->makeService($storage);
        $app = new GeneratedApp([
            'id' => 11,
            'app_type' => 'website_link',
            'metadata' => [
                'website_url' => 'https://example.com',
                'stored_icon_path' => '11/website-icon.png',
                'icon_source_url' => 'https://example.com/favicon.png',
            ],
        ]);

        $metadata = $service->persistForApp($app, [
            'website_url' => 'https://example.com',
        ]);

        $this->assertSame('11/website-icon.png', $metadata['stored_icon_path']);
        $this->assertFalse($metadata['icon_from_title']);
    }

    public function test_normalize_metadata_for_response_uses_internal_url_when_file_exists(): void
    {
        $storage = $this->createMock(StorageInterface::class);
        $storage->method('exists')
            ->with('generated-apps', '9/website-icon.png')
            ->willReturn(true);

        $service = $this->makeService($storage);
        $app = new GeneratedApp([
            'id' => 9,
            'app_type' => 'website_link',
            'metadata' => [
                'stored_icon_path' => '9/website-icon.png',
                'icon_url' => 'https://example.com/old.png',
            ],
        ]);

        $metadata = $service->normalizeMetadataForResponse($app, $app->metadata ?? []);

        $this->assertStringContainsString('/apps/generated/9/website-icon', $metadata['icon_url']);
    }

    public function test_normalize_metadata_applies_title_fallback_when_file_missing(): void
    {
        $storage = $this->createMock(StorageInterface::class);
        $storage->method('exists')->willReturn(false);
        $storage->method('files')->willReturn([]);

        $service = $this->makeService($storage);
        $app = new GeneratedApp([
            'id' => 11,
            'app_type' => 'website_link',
            'metadata' => [
                'website_url' => 'https://example.com',
                'icon_url' => '/api/modules/moabom-apps/apps/generated/11/website-icon',
                'stored_icon_path' => '11/website-icon.png',
            ],
        ]);

        $metadata = $service->normalizeMetadataForResponse($app, $app->metadata ?? []);

        $this->assertTrue($metadata['icon_from_title']);
        $this->assertArrayNotHasKey('icon_url', $metadata);
    }

    public function test_response_uses_metadata_stored_path_with_disk_absolute_listing(): void
    {
        $storage = $this->createMock(StorageInterface::class);
        $storage->method('exists')
            ->with('generated-apps', '7/website-icon.png')
            ->willReturn(true);
        $storage->expects($this->once())
            ->method('response')
            ->with(
                'generated-apps',
                '7/website-icon.png',
                'website-icon.png',
                $this->anything(),
            )
            ->willReturn(new \Symfony\Component\HttpFoundation\StreamedResponse());

        $service = $this->makeService($storage);
        $app = new GeneratedApp([
            'id' => 7,
            'app_type' => 'website_link',
            'metadata' => [
                'stored_icon_path' => '7/website-icon.png',
                'icon_mime' => 'image/png',
            ],
        ]);

        $this->assertNotNull($service->response($app));
    }

    public function test_purge_for_app_deletes_stored_icon_for_standard_tier(): void
    {
        $storage = $this->createMock(StorageInterface::class);
        $storage->method('files')
            ->with('generated-apps', '5')
            ->willReturn(['moabom-apps/generated-apps/5/website-icon.png']);
        $storage->method('exists')
            ->with('generated-apps', '5/website-icon.png')
            ->willReturn(true);
        $storage->expects($this->once())
            ->method('delete')
            ->with('generated-apps', '5/website-icon.png')
            ->willReturn(true);

        $service = $this->makeService($storage);
        $app = new GeneratedApp([
            'id' => 5,
            'app_type' => 'website_link',
            'tier' => 'standard',
        ]);

        $service->purgeForApp($app);
    }
}
