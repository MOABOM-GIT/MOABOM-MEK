<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use App\Contracts\Extension\StorageInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;
use Modules\Moabom\Apps\Enums\AppTier;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * 웹사이트 연결 앱 파비콘을 모듈 스토리지에 저장·서빙·삭제합니다.
 *
 * 경로: generated-apps/{appId}/website-icon.{ext}
 */
class WebsiteLinkIconStorageService
{
    private const STORAGE_CATEGORY = 'generated-apps';

    private const FETCH_TIMEOUT_SECONDS = 5;

    private const MAX_ICON_BYTES = 524288;

    private const ICON_FILENAME_PREFIX = 'website-icon';

    public function __construct(
        private readonly StorageInterface $storage,
        private readonly WebsiteLinkResolveService $websiteLinkResolveService,
    ) {
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    public function persistForApp(GeneratedApp $app, array $metadata): array
    {
        if ($app->app_type !== 'website_link' || ($metadata['icon_from_title'] ?? false) === true) {
            return $metadata;
        }

        $sourceUrl = $this->resolveSourceUrl($metadata, (int) $app->id);
        if ($sourceUrl === null) {
            return $this->normalizeMetadataForResponse($app, $metadata);
        }

        $downloaded = $this->downloadIcon($sourceUrl);
        if ($downloaded === null) {
            return $metadata;
        }

        $this->deleteStoredIcon((int) $app->id);

        $path = $app->id.'/'.self::ICON_FILENAME_PREFIX.'.'.$downloaded['ext'];
        if (! $this->storage->put(self::STORAGE_CATEGORY, $path, $downloaded['content'])) {
            return $metadata;
        }

        $metadata['icon_source_url'] = $sourceUrl;
        $metadata['stored_icon_path'] = $path;
        $metadata['icon_mime'] = $downloaded['mime'];
        $metadata['icon_url'] = $this->iconRoutePath((int) $app->id);
        $metadata['icon_from_title'] = false;

        return $metadata;
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    public function normalizeMetadataForResponse(GeneratedApp $app, array $metadata): array
    {
        if ($app->app_type !== 'website_link' || ($metadata['icon_from_title'] ?? false) === true) {
            return $metadata;
        }

        if ($this->storedIconPath((int) $app->id) === null) {
            return $metadata;
        }

        $metadata['icon_url'] = $this->iconRoutePath((int) $app->id);

        return $metadata;
    }

    public function purgeForApp(GeneratedApp $app): void
    {
        if ($app->app_type !== 'website_link') {
            return;
        }

        if (AppTier::tryFrom((string) ($app->tier ?? AppTier::Standard->value)) === AppTier::Hosted) {
            return;
        }

        $this->deleteStoredIcon((int) $app->id);
    }

    public function response(GeneratedApp $app): ?StreamedResponse
    {
        $path = $this->storedIconPath((int) $app->id);
        if ($path === null) {
            return null;
        }

        $metadata = is_array($app->metadata) ? $app->metadata : [];
        $mime = trim((string) ($metadata['icon_mime'] ?? ''));
        if ($mime === '') {
            $mime = $this->guessMimeFromPath($path);
        }

        return $this->storage->response(
            self::STORAGE_CATEGORY,
            $path,
            basename($path),
            [
                'Content-Type' => $mime,
                'Content-Disposition' => 'inline',
                'Cache-Control' => 'public, max-age=86400, immutable',
            ],
        );
    }

    public function iconRoutePath(int $appId): string
    {
        return route('api.modules.moabom-apps.apps.generated.website_icon', ['id' => $appId], false);
    }

    public function storedIconPath(int $appId): ?string
    {
        $directory = (string) $appId;
        if ($directory === '' || $directory === '0') {
            return null;
        }

        foreach ($this->storage->files(self::STORAGE_CATEGORY, $directory) as $file) {
            if (str_starts_with(basename($file), self::ICON_FILENAME_PREFIX.'.')) {
                return $file;
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    private function resolveSourceUrl(array $metadata, int $appId): ?string
    {
        $iconSource = $metadata['icon_source_url'] ?? null;
        if (is_string($iconSource) && trim($iconSource) !== '' && ! $this->isInternalIconUrl(trim($iconSource), $appId)) {
            return trim($iconSource);
        }

        $iconUrl = $metadata['icon_url'] ?? null;
        if (! is_string($iconUrl) || trim($iconUrl) === '') {
            return null;
        }

        $iconUrl = trim($iconUrl);
        if ($this->isInternalIconUrl($iconUrl, $appId)) {
            return null;
        }

        return $iconUrl;
    }

    private function isInternalIconUrl(string $url, int $appId): bool
    {
        return str_contains($url, '/apps/generated/'.$appId.'/website-icon');
    }

    /**
     * @return array{content: string, mime: string, ext: string}|null
     */
    private function downloadIcon(string $rawUrl): ?array
    {
        try {
            $url = $this->websiteLinkResolveService->assertFetchableUrl($rawUrl);
        } catch (InvalidArgumentException) {
            return null;
        }

        try {
            $response = Http::timeout(self::FETCH_TIMEOUT_SECONDS)
                ->withHeaders([
                    'User-Agent' => 'MoabomWebsiteLinkBot/1.0',
                    'Accept' => 'image/*,*/*;q=0.8',
                ])
                ->get($url);
        } catch (\Throwable $exception) {
            Log::warning('moabom-apps.website_link.icon_fetch_failed', [
                'url' => $url,
                'message' => $exception->getMessage(),
            ]);

            return null;
        }

        if (! $response->successful()) {
            return null;
        }

        $content = (string) $response->body();
        if ($content === '' || strlen($content) > self::MAX_ICON_BYTES) {
            return null;
        }

        $mime = trim((string) $response->header('Content-Type', ''));
        if (str_contains($mime, ';')) {
            $mime = trim(explode(';', $mime, 2)[0]);
        }

        $ext = $this->resolveExtension($url, $mime);
        if ($ext === null) {
            return null;
        }

        if ($mime === '') {
            $mime = $this->guessMimeFromExtension($ext);
        }

        return [
            'content' => $content,
            'mime' => $mime,
            'ext' => $ext,
        ];
    }

    private function deleteStoredIcon(int $appId): void
    {
        $directory = (string) $appId;
        if ($directory === '' || $directory === '0') {
            return;
        }

        foreach ($this->storage->files(self::STORAGE_CATEGORY, $directory) as $file) {
            if (str_starts_with(basename($file), self::ICON_FILENAME_PREFIX.'.')) {
                $this->storage->delete(self::STORAGE_CATEGORY, $file);
            }
        }
    }

    private function resolveExtension(string $url, string $mime): ?string
    {
        $path = parse_url($url, PHP_URL_PATH);
        if (is_string($path)) {
            $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            if (in_array($ext, ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'svg'], true)) {
                return $ext === 'jpeg' ? 'jpg' : $ext;
            }
        }

        return match ($mime) {
            'image/png' => 'png',
            'image/jpeg' => 'jpg',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'image/x-icon', 'image/vnd.microsoft.icon' => 'ico',
            'image/svg+xml' => 'svg',
            default => null,
        };
    }

    private function guessMimeFromPath(string $path): string
    {
        return $this->guessMimeFromExtension(strtolower(pathinfo($path, PATHINFO_EXTENSION)));
    }

    private function guessMimeFromExtension(string $ext): string
    {
        return match ($ext) {
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'ico' => 'image/x-icon',
            'svg' => 'image/svg+xml',
            default => 'application/octet-stream',
        };
    }
}
