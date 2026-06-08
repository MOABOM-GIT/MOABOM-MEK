<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Listeners;

use App\Contracts\Repositories\AttachmentRepositoryInterface;
use App\Contracts\Repositories\ConfigRepositoryInterface;
use App\Models\Attachment;
use App\Services\AttachmentService;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Branding\SiteLogoGeneralConfigSync;
use Modules\Moabom\System\Branding\SiteLogoIdentifiers;
use Modules\Moabom\System\Branding\SiteLogoPublicCacheInvalidator;
use Modules\Moabom\System\Listeners\SiteLogoAttachmentListener;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Tests\ModuleTestCase;

/**
 * site_logo after_upload 정규화가 Repository 위임으로 수행되고
 * (Model 직접 save 금지), request() 에 의존하지 않음을 회귀 검증.
 */
final class SiteLogoAttachmentListenerTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->app->register(SystemServiceProvider::class);
        Storage::fake('settings');
    }

    public function test_after_upload_persists_variant_via_repository_without_request(): void
    {
        $attachment = $this->makeAttachment(101, SiteLogoIdentifiers::SOURCE_LIGHT);

        $repository = $this->createMock(AttachmentRepositoryInterface::class);
        $repository->method('getByCollection')->willReturn(new Collection([$attachment]));
        $repository->expects($this->once())
            ->method('update')
            ->with(
                101,
                $this->callback(static function (array $data): bool {
                    return ($data['source_identifier'] ?? null) === SiteLogoIdentifiers::SOURCE_LIGHT
                        && ($data['order'] ?? null) === 1
                        && ($data['meta']['variant'] ?? null) === SiteLogoIdentifiers::VARIANT_LIGHT;
                })
            )
            ->willReturn($attachment);

        $service = $this->createMock(AttachmentService::class);
        $service->expects($this->never())->method('delete');

        $listener = $this->makeListener($repository, $service);

        // request() 미바인딩 상태에서도 정상 동작해야 한다 (Listener 가 request 를 직접 보지 않음).
        $listener->onAfterUpload($attachment);
    }

    public function test_after_upload_ignores_non_site_logo_collection(): void
    {
        $attachment = $this->makeAttachment(7, SiteLogoIdentifiers::SOURCE_LIGHT);
        $attachment->collection = 'editor';

        $repository = $this->createMock(AttachmentRepositoryInterface::class);
        $repository->expects($this->never())->method('update');

        $listener = $this->makeListener($repository, $this->createMock(AttachmentService::class));

        $listener->onAfterUpload($attachment);
    }

    private function makeListener(
        AttachmentRepositoryInterface $repository,
        AttachmentService $service,
    ): SiteLogoAttachmentListener {
        return new SiteLogoAttachmentListener(
            $repository,
            $service,
            new SiteLogoGeneralConfigSync($repository, $this->app->make(ConfigRepositoryInterface::class)),
            $this->app->make(SiteLogoPublicCacheInvalidator::class),
        );
    }

    private function makeAttachment(int $id, string $sourceIdentifier): Attachment
    {
        $attachment = new Attachment([
            'collection' => SiteLogoIdentifiers::COLLECTION,
            'source_identifier' => $sourceIdentifier,
            'order' => 1,
            'mime_type' => 'image/png',
        ]);
        // 'id' 는 fillable 이 아니므로 직접 대입.
        $attachment->id = $id;

        return $attachment;
    }
}
