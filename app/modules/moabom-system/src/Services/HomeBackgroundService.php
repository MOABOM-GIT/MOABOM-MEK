<?php

namespace Modules\Moabom\System\Services;

use App\Contracts\Extension\StorageInterface;
use GdImage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use InvalidArgumentException;
use Modules\Moabom\System\Saas\TenantModuleStorageScope;
use RuntimeException;

/**
 * Moabom 홈 배경 이미지 저장(모듈 스토리지 + JPEG 썸네일)
 */
class HomeBackgroundService
{
    public function __construct(
        private readonly StorageInterface $storage,
        private readonly TenantModuleStorageScope $storageScope,
    ) {}

    /**
     * 업로드 파일을 full·thumb JPEG로 저장합니다.
     *
     * @return array{id: string, url: string, thumb_url: string}
     */
    public function store(UploadedFile $file): array
    {
        $this->storageScope->ensureApplied();

        if (! extension_loaded('gd')) {
            throw new RuntimeException(__('moabom-system::messages.home_background.gd_required'));
        }

        $mime = $file->getMimeType();
        $allowed = self::allowedMimeTypes();
        if (! in_array($mime, $allowed, true)) {
            throw new InvalidArgumentException(__('moabom-system::messages.home_background.invalid_type'));
        }

        if ($mime === 'image/webp' && ! function_exists('imagecreatefromwebp')) {
            throw new InvalidArgumentException(__('moabom-system::messages.home_background.webp_not_supported'));
        }

        $path = $file->getRealPath() ?: $file->getPathname();
        $bytes = file_get_contents($path);
        if ($bytes === false || $bytes === '') {
            throw new InvalidArgumentException(__('moabom-system::messages.home_background.empty_file'));
        }

        $src = @imagecreatefromstring($bytes);
        if ($src === false) {
            throw new InvalidArgumentException(__('moabom-system::messages.home_background.decode_failed'));
        }

        $uuid = (string) Str::uuid();

        $fullGd = $this->scaleToMaxWidth($src, 2560);
        $thumbGd = $this->scaleToMaxWidth($src, 320);
        imagedestroy($src);

        $fullJpg = $this->encodeJpeg($fullGd, 85);
        $thumbJpg = $this->encodeJpeg($thumbGd, 82);
        imagedestroy($fullGd);
        imagedestroy($thumbGd);

        $base = "home-backgrounds/{$uuid}";
        if (! $this->storage->put('images', "{$base}/full.jpg", $fullJpg)) {
            throw new RuntimeException(__('moabom-system::messages.home_background.storage_write_failed'));
        }
        if (! $this->storage->put('images', "{$base}/thumb.jpg", $thumbJpg)) {
            $this->storage->deleteDirectory('images', $base);
            throw new RuntimeException(__('moabom-system::messages.home_background.storage_write_failed'));
        }

        return [
            'id' => $uuid,
            'url' => $this->publicUrl($uuid, 'full'),
            'thumb_url' => $this->publicUrl($uuid, 'thumb'),
        ];
    }

    public function delete(string $id): bool
    {
        $this->storageScope->ensureApplied();

        if (! Str::isUuid($id)) {
            return false;
        }

        return $this->storage->deleteDirectory('images', "home-backgrounds/{$id}");
    }

    /**
     * @return list<string>
     */
    public function listStoredBackgroundIds(): array
    {
        $this->storageScope->ensureApplied();

        $ids = [];
        foreach ($this->storage->files('images', 'home-backgrounds') as $path) {
            if (preg_match(
                '#(?:^|/)home-backgrounds/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/#i',
                '/'.$path,
                $matches,
            ) !== 1) {
                continue;
            }

            $ids[$matches[1]] = true;
        }

        return array_keys($ids);
    }

    public function publicUrl(string $id, string $variant): string
    {
        return '/api/modules/moabom-system/home-backgrounds/'.$id.'/'.$variant;
    }

    /**
     * 바이너리 또는 파일 없을 때 404 처리용
     */
    public function getVariantBinary(string $id, string $variant): ?string
    {
        $this->storageScope->ensureApplied();

        if (! Str::isUuid($id) || ! in_array($variant, ['full', 'thumb'], true)) {
            return null;
        }

        $file = $variant === 'thumb' ? 'thumb.jpg' : 'full.jpg';

        return $this->storage->get('images', "home-backgrounds/{$id}/{$file}");
    }

    private function scaleToMaxWidth(GdImage $src, int $maxW): GdImage
    {
        $w = imagesx($src);
        $h = imagesy($src);
        if ($w <= 0 || $h <= 0) {
            throw new InvalidArgumentException(__('moabom-system::messages.home_background.invalid_dimensions'));
        }

        if ($w <= $maxW) {
            $nw = $w;
            $nh = $h;
        } else {
            $nw = $maxW;
            $nh = (int) round($h * ($maxW / $w));
        }

        $dst = imagecreatetruecolor($nw, $nh);
        imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);

        return $dst;
    }

    /**
     * @return list<string>
     */
    public static function allowedMimeTypes(): array
    {
        $types = ['image/jpeg', 'image/png'];
        if (function_exists('imagecreatefromwebp')) {
            $types[] = 'image/webp';
        }

        return $types;
    }

    private function encodeJpeg(GdImage $im, int $quality): string
    {
        ob_start();
        imagejpeg($im, null, $quality);
        $buf = ob_get_clean();

        if ($buf === false || $buf === '') {
            throw new RuntimeException(__('moabom-system::messages.home_background.encode_failed'));
        }

        return $buf;
    }
}
