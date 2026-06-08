<?php

namespace Modules\Moabom\System\Tests\Unit\Storage;

use App\Contracts\Extension\StorageInterface;
use App\Contracts\Repositories\AttachmentRepositoryInterface;
use App\Models\Attachment;
use App\Services\AttachmentService;
use Mockery;
use Modules\Moabom\System\Services\Storage\MoabomGcsAttachmentService;
use Tests\TestCase;

class MoabomGcsAttachmentServiceTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_delete_continues_when_storage_delete_throws(): void
    {
        $attachment = new Attachment([
            'id' => 9,
            'hash' => 'abc123def456',
            'disk' => 'attachments',
            'path' => '2026/05/21/test.jpg',
            'attachmentable_type' => 'App\\Models\\User',
            'attachmentable_id' => 1,
            'collection' => 'avatar',
        ]);
        $attachment->id = 9;

        $repository = Mockery::mock(AttachmentRepositoryInterface::class);
        $repository->shouldReceive('findById')->with(9)->andReturn($attachment);
        $repository->shouldReceive('forceDelete')->with(9)->once()->andReturn(true);
        $repository->shouldReceive('reorderAfterDelete')
            ->with('App\\Models\\User', 1, 'avatar')
            ->once();

        $diskStorage = Mockery::mock(StorageInterface::class);
        $diskStorage->shouldReceive('exists')->with('', '2026/05/21/test.jpg')->andReturn(true);
        $diskStorage->shouldReceive('delete')->with('', '2026/05/21/test.jpg')
            ->andThrow(new \RuntimeException('GCS object not found'));

        $storage = Mockery::mock(StorageInterface::class);
        $storage->shouldReceive('withDisk')->with('attachments')->andReturn($diskStorage);

        $service = new MoabomGcsAttachmentService($repository, $storage);

        $this->assertTrue($service->delete(9));
    }

    public function test_get_file_info_returns_null_on_gcs_adapter(): void
    {
        $repository = Mockery::mock(AttachmentRepositoryInterface::class);
        $storage = Mockery::mock(StorageInterface::class);

        $service = new MoabomGcsAttachmentService($repository, $storage);

        $this->assertNull($service->getFileInfo('abc123def456', null));
    }

    public function test_service_extends_core_attachment_service(): void
    {
        $this->assertTrue(is_subclass_of(MoabomGcsAttachmentService::class, AttachmentService::class));
    }
}
