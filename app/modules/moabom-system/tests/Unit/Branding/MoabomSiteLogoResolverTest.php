<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Branding;

use App\Contracts\Repositories\AttachmentRepositoryInterface;
use App\Models\Attachment;
use Illuminate\Support\Collection;
use Modules\Moabom\System\Branding\MoabomSiteLogoResolver;
use Modules\Moabom\System\Branding\SiteLogoIdentifiers;
use Modules\Moabom\System\Tests\ModuleTestCase;

final class MoabomSiteLogoResolverTest extends ModuleTestCase
{
    public function test_resolve_uses_fallback_when_no_logos(): void
    {
        $repo = $this->createMock(AttachmentRepositoryInterface::class);
        $repo->method('findByIds')->willReturn(collect());

        $resolver = new MoabomSiteLogoResolver($repo);
        $result = $resolver->resolve([]);

        $this->assertSame(SiteLogoIdentifiers::FALLBACK_LIGHT_URL, $result['light_url']);
        $this->assertSame(SiteLogoIdentifiers::FALLBACK_DARK_URL, $result['dark_url']);
        $this->assertFalse($result['has_custom_light']);
        $this->assertFalse($result['has_custom_dark']);
    }

    public function test_resolve_maps_light_and_dark_by_source_identifier(): void
    {
        $light = $this->makeAttachment(1, SiteLogoIdentifiers::SOURCE_LIGHT, 1);
        $dark = $this->makeAttachment(2, SiteLogoIdentifiers::SOURCE_DARK, 2);

        $repo = $this->createMock(AttachmentRepositoryInterface::class);
        $repo->method('findByIds')->willReturn(new Collection([$light, $dark]));

        $resolver = new MoabomSiteLogoResolver($repo);
        $result = $resolver->resolve([1, 2]);

        $this->assertSame('/api/attachment/light-hash', $result['light_url']);
        $this->assertSame('/api/attachment/dark-hash', $result['dark_url']);
        $this->assertTrue($result['has_custom_light']);
        $this->assertTrue($result['has_custom_dark']);
    }

    private function makeAttachment(int $id, string $sourceIdentifier, int $order): Attachment
    {
        $attachment = new Attachment([
            'id' => $id,
            'collection' => SiteLogoIdentifiers::COLLECTION,
            'source_identifier' => $sourceIdentifier,
            'order' => $order,
            'mime_type' => 'image/svg+xml',
            'hash' => $sourceIdentifier === SiteLogoIdentifiers::SOURCE_LIGHT ? 'light-hash' : 'dark-hash',
        ]);

        return $attachment;
    }
}
