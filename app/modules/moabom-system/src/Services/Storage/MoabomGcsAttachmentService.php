<?php

namespace Modules\Moabom\System\Services\Storage;

use App\Contracts\Extension\StorageInterface;
use App\Contracts\Repositories\AttachmentRepositoryInterface;
use App\Enums\AttachmentSourceType;
use App\Extension\HookManager;
use App\Models\Attachment;
use App\Services\AttachmentService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;

/**
 * GCS 첨부파일: 안전 삭제 + 다운로드 시 로컬 경로 미노출.
 *
 * 업로드·DB 저장 흐름은 코어 AttachmentService 와 동일하며,
 * 파일 본문은 GCS 버킷 attachments/ 경로에 저장된다(config/filesystems.php path_prefix).
 */
class MoabomGcsAttachmentService extends AttachmentService
{
    public function __construct(
        private readonly AttachmentRepositoryInterface $attachmentRepository,
        private readonly StorageInterface $attachmentStorage,
    ) {
        parent::__construct($attachmentRepository, $attachmentStorage);
    }

    /**
     * GCS 업로드 실패 시 Cloud Run 로그에 원인을 남긴다 (LOG_LEVEL=debug/error).
     */
    public function upload(
        UploadedFile $file,
        ?string $attachmentableType = null,
        ?int $attachmentableId = null,
        string $collection = 'default',
        AttachmentSourceType $sourceType = AttachmentSourceType::Core,
        ?string $sourceIdentifier = null,
    ): Attachment {
        try {
            return parent::upload(
                $file,
                $attachmentableType,
                $attachmentableId,
                $collection,
                $sourceType,
                $sourceIdentifier,
            );
        } catch (\Throwable $e) {
            Log::error('GCS 첨부파일 업로드 실패', [
                'disk' => config('attachment.disk', 'attachments'),
                'collection' => $collection,
                'attachmentable_type' => $attachmentableType,
                'attachmentable_id' => $attachmentableId,
                'mime' => $file->getMimeType(),
                'size' => $file->getSize(),
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * 스토리지 객체가 없거나 삭제 API가 실패해도 DB 레코드는 정리한다.
     */
    public function delete(int $id): bool
    {
        $attachment = $this->attachmentRepository->findById($id);

        if (! $attachment) {
            return false;
        }

        $attachmentableType = $attachment->attachmentable_type;
        $attachmentableId = $attachment->attachmentable_id;
        $collection = $attachment->collection;

        HookManager::doAction('core.attachment.before_delete', $attachment);

        try {
            $diskStorage = $this->attachmentStorage->withDisk($attachment->disk);
            if ($diskStorage->exists('', $attachment->path)) {
                $diskStorage->delete('', $attachment->path);
            }
        } catch (\Throwable $e) {
            Log::warning('GCS 첨부파일 스토리지 삭제 실패(무시 후 DB 삭제 진행)', [
                'attachment_id' => $id,
                'disk' => $attachment->disk,
                'path' => $attachment->path,
                'error' => $e->getMessage(),
            ]);
        }

        $result = $this->attachmentRepository->forceDelete($id);

        Log::info('첨부파일 삭제 완료', [
            'attachment_id' => $id,
            'hash' => $attachment->hash,
        ]);

        if ($result && $attachmentableType && $attachmentableId) {
            $this->attachmentRepository->reorderAfterDelete($attachmentableType, $attachmentableId, $collection);
        }

        HookManager::doAction('core.attachment.after_delete', $attachment);

        return $result;
    }

    /**
     * 코어 getFileInfo() 는 GCS 에서 로컬 path 를 만들어 filemtime() 500 을 유발한다.
     * 다운로드는 MoabomGcsAttachmentDownloadMiddleware 가 스트리밍 처리한다.
     *
     * @return array{path: string, mime_type: string, filename: string}|null
     */
    public function getFileInfo(string $hash, mixed $user = null): ?array
    {
        return null;
    }
}
