<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use App\Contracts\Extension\StorageInterface;
use Illuminate\Support\Facades\Http;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Modules\Moabom\Apps\Services\WebsiteLinkIconStorageService;
use Modules\Moabom\Apps\Services\WebsiteLinkResolveService;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class WebsiteLinkIconStorageServiceTest extends ModuleTestCase
{
    public function test_persist_for_app_stores_icon_and_rewrites_metadata_url(): void
    {
        Http::fake([
            'https://example.com/favicon.png' => Http::response(
                'png-bytes',
                200,
                ['Content-Type' => 'image/png'],
            ),
        ]);

        $storage = $this->createMock(StorageInterface::class);
        $storage->method('files')->willReturn([]);
        $storage->expects($this->once())
            ->method('put')
            ->with(
                'generated-apps',
                $this->callback(static fn (string $path): bool => str_ends_with($path, '/website-icon.png')),
                'png-bytes',
            )
            ->willReturn(true);

        $service = new WebsiteLinkIconStorageService($storage, new WebsiteLinkResolveService);
        $app = new GeneratedApp([
            'id' => 12,
            'app_type' => 'website_link',
        ]);

        $metadata = $service->persistForApp($app, [
            'website_url' => 'https://example.com',
            'icon_url' => 'https://example.com/favicon.png',
            'icon_from_title' => false,
        ]);

        $this->assertSame('https://example.com/favicon.png', $metadata['icon_source_url']);
        $this->assertStringContainsString('/apps/generated/12/website-icon', $metadata['icon_url']);
        $this->assertSame('12/website-icon.png', $metadata['stored_icon_path']);
    }

    public function test_persist_for_app_skips_title_icon_fallback(): void
    {
        $storage = $this->createMock(StorageInterface::class);
        $storage->expects($this->never())->method('put');

        $service = new WebsiteLinkIconStorageService($storage, new WebsiteLinkResolveService);
        $app = new GeneratedApp([
            'id' => 3,
            'app_type' => 'website_link',
        ]);

        $metadata = $service->persistForApp($app, [
            'website_url' => 'https://example.com',
            'icon_from_title' => true,
        ]);

        $this->assertTrue($metadata['icon_from_title']);
        $this->assertArrayNotHasKey('stored_icon_path', $metadata);
    }

    public function test_normalize_metadata_for_response_uses_internal_url_when_file_exists(): void
    {
        $storage = $this->createMock(StorageInterface::class);
        $storage->method('files')
            ->with('generated-apps', '9')
            ->willReturn(['9/website-icon.png']);

        $service = new WebsiteLinkIconStorageService($storage, new WebsiteLinkResolveService);
        $app = new GeneratedApp([
            'id' => 9,
            'app_type' => 'website_link',
            'metadata' => [
                'icon_url' => 'https://example.com/old.png',
            ],
        ]);

        $metadata = $service->normalizeMetadataForResponse($app, $app->metadata ?? []);

        $this->assertStringContainsString('/apps/generated/9/website-icon', $metadata['icon_url']);
    }

    public function test_purge_for_app_deletes_stored_icon_for_standard_tier(): void
    {
        $storage = $this->createMock(StorageInterface::class);
        $storage->method('files')
            ->with('generated-apps', '5')
            ->willReturn(['5/website-icon.png']);
        $storage->expects($this->once())
            ->method('delete')
            ->with('generated-apps', '5/website-icon.png')
            ->willReturn(true);

        $service = new WebsiteLinkIconStorageService($storage, new WebsiteLinkResolveService);
        $app = new GeneratedApp([
            'id' => 5,
            'app_type' => 'website_link',
            'tier' => 'standard',
        ]);

        $service->purgeForApp($app);
    }
}
