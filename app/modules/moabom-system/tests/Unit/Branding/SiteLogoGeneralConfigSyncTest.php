<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Branding;

use App\Contracts\Repositories\AttachmentRepositoryInterface;
use App\Contracts\Repositories\ConfigRepositoryInterface;
use App\Models\Attachment;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Branding\SiteLogoGeneralConfigSync;
use Modules\Moabom\System\Branding\SiteLogoIdentifiers;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Tests\ModuleTestCase;

final class SiteLogoGeneralConfigSyncTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->app->register(SystemServiceProvider::class);
        Storage::fake('settings');
    }

    public function test_sync_writes_site_logo_ids_to_general_json(): void
    {
        $light = $this->makeAttachment(10, SiteLogoIdentifiers::SOURCE_LIGHT, 1);
        $dark = $this->makeAttachment(20, SiteLogoIdentifiers::SOURCE_DARK, 2);

        $attachmentRepo = $this->createMock(AttachmentRepositoryInterface::class);
        $attachmentRepo->method('getByCollection')
            ->with(SiteLogoIdentifiers::COLLECTION)
            ->willReturn(new Collection([$dark, $light]));

        $configRepo = $this->app->make(ConfigRepositoryInterface::class);
        $configRepo->saveCategory('general', ['site_name' => 'Test']);

        $sync = new SiteLogoGeneralConfigSync($attachmentRepo, $configRepo);

        $this->assertTrue($sync->syncFromCollection());

        $general = $configRepo->getCategory('general');
        $this->assertSame([10, 20], $general['site_logo']);
    }

    public function test_sync_is_noop_when_ids_unchanged(): void
    {
        $attachment = $this->makeAttachment(5, SiteLogoIdentifiers::SOURCE_LIGHT, 1);

        $attachmentRepo = $this->createMock(AttachmentRepositoryInterface::class);
        $attachmentRepo->method('getByCollection')->willReturn(new Collection([$attachment]));

        $configRepo = $this->app->make(ConfigRepositoryInterface::class);
        $configRepo->saveCategory('general', ['site_logo' => [5]]);

        $sync = new SiteLogoGeneralConfigSync($attachmentRepo, $configRepo);

        $this->assertTrue($sync->syncFromCollection());
        $this->assertSame([5], $configRepo->getCategory('general')['site_logo']);
    }

    private function makeAttachment(int $id, string $sourceIdentifier, int $order): Attachment
    {
        return new Attachment([
            'id' => $id,
            'hash' => 'hash-'.$id,
            'collection' => SiteLogoIdentifiers::COLLECTION,
            'source_identifier' => $sourceIdentifier,
            'order' => $order,
            'mime_type' => 'image/png',
        ]);
    }
}
