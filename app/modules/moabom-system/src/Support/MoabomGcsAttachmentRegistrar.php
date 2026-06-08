<?php

namespace Modules\Moabom\System\Support;

use App\Contracts\Extension\StorageInterface;
use App\Contracts\Repositories\AttachmentRepositoryInterface;
use App\Extension\Storage\CoreStorageDriver;
use App\Services\AttachmentService;
use Illuminate\Contracts\Foundation\Application;
use Modules\Moabom\System\Services\Storage\MoabomGcsAttachmentService;

/**
 * Cloud Run(GCS) 첨부파일 어댑터 등록.
 *
 * 코어 AttachmentService 는 when(AttachmentService)->needs(StorageInterface) 만 등록한다.
 * 서브클래스로 교체할 때 contextual binding 이 누락되면 전 API 500(v12~v13 사례)이므로
 * 팩토리로 StorageInterface 를 명시 주입한다.
 */
final class MoabomGcsAttachmentRegistrar
{
    public static function register(Application $app): void
    {
        if (! self::usesGcsAttachmentsDisk()) {
            return;
        }

        $app->bind(AttachmentService::class, static function (Application $app): MoabomGcsAttachmentService {
            $disk = (string) config('attachment.disk', 'attachments');

            return new MoabomGcsAttachmentService(
                $app->make(AttachmentRepositoryInterface::class),
                new CoreStorageDriver($disk),
            );
        });
    }

    public static function usesGcsAttachmentsDisk(): bool
    {
        $disk = (string) config('attachment.disk', 'attachments');

        return config('filesystems.disks.'.$disk.'.driver') === 'gcs';
    }
}
