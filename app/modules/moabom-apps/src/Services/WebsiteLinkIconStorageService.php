<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use App\Contracts\Extension\StorageInterface;
use Illuminate\Support\Facades\Log;
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

    private const ICON_FILENAME_PREFIX = 'website-icon';

    public function __construct(
        private readonly StorageInterface $storage,
        private readonly WebsiteLinkIconExtractionService $iconExtractionService,
    ) {
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    public function persistForApp(GeneratedApp $app, array $metadata): array
    {
        if ($app->app_type !== 'website_link' || ($metadata['icon_from_title'] ?? false) === true) {
            return $this->finalizeMetadata($app, $metadata);
        }

        $sourceUrl = $this->resolveSourceUrl($metadata, (int) $app->id);
        if ($sourceUrl === null) {
            $sourceUrl = $this->reextractSourceUrl($metadata);
        }

        if ($sourceUrl === null) {
            return $this->finalizeMetadata($app, $this->stripBrokenInternalIcon($metadata, (int) $app->id));
        }

        $downloaded = $this->iconExtractionService->fetchIconBinary($sourceUrl);
        if ($downloaded === null) {
            Log::info('moabom-apps.website_link.icon_persist_skipped', [
                'app_id' => $app->id,
                'source_url' => $sourceUrl,
            ]);

            return $this->finalizeMetadata($app, $this->stripBrokenInternalIcon($metadata, (int) $app->id));
        }

        $this->deleteStoredIcon((int) $app->id);

        $path = $app->id.'/'.self::ICON_FILENAME_PREFIX.'.'.$downloaded['ext'];
        if (! $this->storage->put(self::STORAGE_CATEGORY, $path, $downloaded['content'])) {
            return $this->finalizeMetadata($app, $this->stripBrokenInternalIcon($metadata, (int) $app->id));
        }

        $metadata['icon_source_url'] = $sourceUrl;
        $metadata['stored_icon_path'] = $path;
        $metadata['icon_mime'] = $downloaded['mime'];
        $metadata['icon_url'] = $this->iconRoutePath((int) $app->id);
        $metadata['icon_from_title'] = false;
        unset($metadata['iconImageUrl']);

        return $metadata;
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    public function normalizeMetadataForResponse(GeneratedApp $app, array $metadata): array
    {
        return $this->finalizeMetadata($app, $metadata);
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
        $path = $this->resolveStoredPath($app);
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
        $metadataPath = $this->metadataStoredIconPath($appId, []);
        if ($metadataPath !== null && $this->storage->exists(self::STORAGE_CATEGORY, $metadataPath)) {
            return $metadataPath;
        }

        return $this->discoverStoredIconPath($appId);
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    private function resolveStoredPath(GeneratedApp $app, array $metadata = []): ?string
    {
        if ($metadata === []) {
            $metadata = is_array($app->metadata) ? $app->metadata : [];
        }

        $metadataPath = $this->metadataStoredIconPath((int) $app->id, $metadata);
        if ($metadataPath !== null && $this->storage->exists(self::STORAGE_CATEGORY, $metadataPath)) {
            return $metadataPath;
        }

        return $this->discoverStoredIconPath((int) $app->id);
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    private function metadataStoredIconPath(int $appId, array $metadata): ?string
    {
        $stored = trim((string) ($metadata['stored_icon_path'] ?? ''));
        if ($stored === '') {
            return null;
        }

        $normalized = $this->normalizeCategoryRelativePath($stored, (string) $appId);
        if ($normalized === null) {
            return null;
        }

        if (! str_starts_with(basename($normalized), self::ICON_FILENAME_PREFIX.'.')) {
            return null;
        }

        return $normalized;
    }

    private function discoverStoredIconPath(int $appId): ?string
    {
        $directory = (string) $appId;
        if ($directory === '' || $directory === '0') {
            return null;
        }

        foreach ($this->storage->files(self::STORAGE_CATEGORY, $directory) as $file) {
            $normalized = $this->normalizeCategoryRelativePath($file, $directory);
            if ($normalized === null) {
                continue;
            }

            if (str_starts_with(basename($normalized), self::ICON_FILENAME_PREFIX.'.')
                && $this->storage->exists(self::STORAGE_CATEGORY, $normalized)) {
                return $normalized;
            }
        }

        return null;
    }

    private function normalizeCategoryRelativePath(string $filePath, string $directory): ?string
    {
        $trimmed = ltrim(str_replace('\\', '/', trim($filePath)), '/');
        if ($trimmed === '') {
            return null;
        }

        $expectedPrefix = $directory.'/';
        if (str_starts_with($trimmed, $expectedPrefix)) {
            return $trimmed;
        }

        $needle = '/'.$expectedPrefix;
        if (str_contains($trimmed, $needle)) {
            return substr($trimmed, (int) strrpos($trimmed, $needle) + 1);
        }

        if (basename($trimmed) !== $trimmed && str_ends_with($trimmed, $expectedPrefix.basename($trimmed))) {
            return $expectedPrefix.basename($trimmed);
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function finalizeMetadata(GeneratedApp $app, array $metadata): array
    {
        if ($app->app_type !== 'website_link' || ($metadata['icon_from_title'] ?? false) === true) {
            return $metadata;
        }

        if ($this->resolveStoredPath($app, $metadata) === null) {
            return $this->stripBrokenInternalIcon($metadata, (int) $app->id);
        }

        $metadata['icon_url'] = $this->iconRoutePath((int) $app->id);

        return $metadata;
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

    /**
     * @param  array<string, mixed>  $metadata
     */
    private function reextractSourceUrl(array $metadata): ?string
    {
        $websiteUrl = trim((string) ($metadata['website_url'] ?? ''));
        if ($websiteUrl === '') {
            return null;
        }

        $icon = $this->iconExtractionService->resolveIconFromWebsite($websiteUrl);

        return $icon['icon_from_title'] ? null : $icon['icon_url'];
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function stripBrokenInternalIcon(array $metadata, int $appId): array
    {
        $iconUrl = $metadata['icon_url'] ?? null;
        if (is_string($iconUrl) && $this->isInternalIconUrl(trim($iconUrl), $appId)) {
            unset($metadata['icon_url'], $metadata['stored_icon_path'], $metadata['icon_mime'], $metadata['iconImageUrl']);
        }

        return $metadata;
    }

    private function isInternalIconUrl(string $url, int $appId): bool
    {
        return str_contains($url, '/apps/generated/'.$appId.'/website-icon');
    }

    private function deleteStoredIcon(int $appId): void
    {
        $path = $this->discoverStoredIconPath($appId);
        if ($path === null) {
            return;
        }

        $this->storage->delete(self::STORAGE_CATEGORY, $path);
    }

    private function guessMimeFromPath(string $path): string
    {
        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'ico' => 'image/x-icon',
            'svg' => 'image/svg+xml',
            default => 'application/octet-stream',
        };
    }
}
