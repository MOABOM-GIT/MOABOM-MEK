<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Services;

use App\Contracts\Extension\StorageInterface;
use Illuminate\Support\Facades\Log;
use Modules\Moabom\Apps\Models\GeneratedApp;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * 웹사이트 연결 앱 파비콘을 모듈 스토리지에 저장·서빙·삭제합니다.
 *
 * 경로: generated-apps/{appId}/website-icon.{ext}
 *
 * persist 정책:
 * - website_url 미변경 + 저장 파일 존재 → 네트워크 재다운로드 생략
 * - 다운로드 실패 + 기존 파일 존재 → 기존 아이콘 유지
 * - 클라이언트 icon_from_title 힌트는 무시, 서버가 website_url 기준으로 판정
 */
class WebsiteLinkIconStorageService
{
    private const STORAGE_CATEGORY = 'generated-apps';

    private const ICON_FILENAME_PREFIX = 'website-icon';

    public function __construct(
        private readonly StorageInterface $storage,
        private readonly WebsiteLinkIconExtractionService $iconExtractionService,
        private readonly WebsiteLinkIconAccessService $iconAccessService,
    ) {
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    public function persistForApp(GeneratedApp $app, array $metadata): array
    {
        if ($app->app_type !== 'website_link') {
            return $metadata;
        }

        $websiteUrl = trim((string) ($metadata['website_url'] ?? ''));
        if ($websiteUrl === '') {
            return $this->finalizeMetadata($app, $metadata);
        }

        $appId = (int) $app->id;
        $previousMetadata = is_array($app->metadata) ? $app->metadata : [];
        $storedPath = $this->resolveStoredPath($app, $metadata);

        if ($storedPath !== null && $this->shouldReuseStoredIcon($websiteUrl, $previousMetadata, $metadata, $appId)) {
            return $this->applyStoredIconMetadata($metadata, $appId, $storedPath, $websiteUrl, $previousMetadata);
        }

        $preferredSource = $this->resolvePreferredSourceUrl($metadata, $appId);
        $fetched = $this->iconExtractionService->fetchIconForWebsite($websiteUrl, $preferredSource);

        if ($fetched === null) {
            if ($storedPath !== null && strcasecmp(trim((string) ($previousMetadata['website_url'] ?? '')), $websiteUrl) === 0) {
                Log::info('moabom-apps.website_link.icon_persist_reuse_existing', [
                    'app_id' => $appId,
                    'website_url' => $websiteUrl,
                ]);

                return $this->applyStoredIconMetadata($metadata, $appId, $storedPath, $websiteUrl, $previousMetadata);
            }

            return $this->finalizeMetadata($app, $this->applyTitleIconFallback($metadata));
        }

        $this->deleteStoredIcon($appId);

        $path = $appId.'/'.self::ICON_FILENAME_PREFIX.'.'.$fetched->binary['ext'];
        if (! $this->storage->put(self::STORAGE_CATEGORY, $path, $fetched->binary['content'])) {
            if ($storedPath !== null) {
                return $this->applyStoredIconMetadata($metadata, $appId, $storedPath, $websiteUrl, $previousMetadata);
            }

            return $this->finalizeMetadata($app, $this->applyTitleIconFallback($metadata));
        }

        $metadata['website_url'] = $websiteUrl;
        $metadata['icon_source_url'] = $fetched->sourceUrl;
        $metadata['stored_icon_path'] = $path;
        $metadata['icon_mime'] = $fetched->binary['mime'];
        $metadata['icon_url'] = $this->iconRoutePath($appId);
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

        // website_link 는 standard 고정 — 레거시 hosted 조합도 아이콘 정리
        $this->deleteStoredIcon((int) $app->id);
    }

    public function response(GeneratedApp $app): ?StreamedResponse
    {
        $path = $this->resolveStoredPathForServe($app);
        if ($path === null) {
            return null;
        }

        // storage->response 는 exists+stream 이중 GCS. get 한 번으로 스트리밍.
        $content = $this->storage->get(self::STORAGE_CATEGORY, $path);
        if ($content === null) {
            $discovered = $this->discoverStoredIconPath((int) $app->id);
            if ($discovered === null || $discovered === $path) {
                return null;
            }
            $path = $discovered;
            $content = $this->storage->get(self::STORAGE_CATEGORY, $path);
            if ($content === null) {
                return null;
            }
        }

        $metadata = is_array($app->metadata) ? $app->metadata : [];
        $mime = trim((string) ($metadata['icon_mime'] ?? ''));
        if ($mime === '') {
            $mime = $this->guessMimeFromPath($path);
        }

        return new StreamedResponse(static function () use ($content): void {
            echo $content;
        }, 200, [
            'Content-Type' => $mime,
            'Content-Disposition' => 'inline; filename="'.basename($path).'"',
            'Cache-Control' => 'public, max-age=86400, immutable',
        ]);
    }

    public function iconRoutePath(int $appId): string
    {
        $path = route('api.modules.moabom-apps.apps.generated.website_icon', ['id' => $appId], false);

        return $this->iconAccessService->appendTokenToIconPath($path, $appId);
    }

    public function storedIconPath(int $appId, ?GeneratedApp $app = null): ?string
    {
        if ($app !== null) {
            return $this->resolveStoredPath($app);
        }

        return $this->discoverStoredIconPath($appId);
    }

    /**
     * persist·존재 확인용 — GCS exists / discover.
     *
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
     * 아이콘 GET — metadata path 우선(exists 생략), 없으면 discover.
     * 실제 바이트 확인은 storage->get 에 맡긴다.
     */
    private function resolveStoredPathForServe(GeneratedApp $app): ?string
    {
        $metadata = is_array($app->metadata) ? $app->metadata : [];
        $metadataPath = $this->metadataStoredIconPath((int) $app->id, $metadata);
        if ($metadataPath !== null) {
            return $metadataPath;
        }

        return $this->discoverStoredIconPath((int) $app->id);
    }

    /**
     * library/API 직렬화 — DB stored_icon_path 만 신뢰(GCS 호출 없음).
     * 파일이 없으면 GET 에서 404·repair.
     *
     * @param  array<string, mixed>  $metadata
     */
    private function resolveStoredPathFromMetadata(GeneratedApp $app, array $metadata): ?string
    {
        return $this->metadataStoredIconPath((int) $app->id, $metadata);
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
     * @param  array<string, mixed>  $previousMetadata
     */
    private function shouldReuseStoredIcon(
        string $websiteUrl,
        array $previousMetadata,
        array $metadata,
        int $appId,
    ): bool {
        $previousWebsiteUrl = trim((string) ($previousMetadata['website_url'] ?? ''));
        if ($previousWebsiteUrl === '' || strcasecmp($previousWebsiteUrl, $websiteUrl) !== 0) {
            return false;
        }

        $incoming = $this->resolvePreferredSourceUrl($metadata, $appId);
        $previous = trim((string) ($previousMetadata['icon_source_url'] ?? ''));

        return ! ($incoming !== null && $previous !== '' && strcasecmp($incoming, $previous) !== 0);
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @param  array<string, mixed>  $previousMetadata
     * @return array<string, mixed>
     */
    private function applyStoredIconMetadata(
        array $metadata,
        int $appId,
        string $storedPath,
        string $websiteUrl,
        array $previousMetadata,
    ): array {
        $metadata['website_url'] = $websiteUrl;
        $metadata['stored_icon_path'] = $storedPath;
        $metadata['icon_url'] = $this->iconRoutePath($appId);
        $metadata['icon_from_title'] = false;

        $iconSource = trim((string) ($metadata['icon_source_url'] ?? ''));
        if ($iconSource === '' || $this->isInternalIconUrl($iconSource, $appId)) {
            $previousSource = trim((string) ($previousMetadata['icon_source_url'] ?? ''));
            if ($previousSource !== '' && ! $this->isInternalIconUrl($previousSource, $appId)) {
                $metadata['icon_source_url'] = $previousSource;
            }
        }

        $iconMime = trim((string) ($metadata['icon_mime'] ?? ''));
        if ($iconMime === '') {
            $previousMime = trim((string) ($previousMetadata['icon_mime'] ?? ''));
            if ($previousMime !== '') {
                $metadata['icon_mime'] = $previousMime;
            }
        }

        unset($metadata['iconImageUrl']);

        return $metadata;
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function finalizeMetadata(GeneratedApp $app, array $metadata): array
    {
        if ($app->app_type !== 'website_link') {
            return $metadata;
        }

        $storedPath = $this->resolveStoredPathFromMetadata($app, $metadata);
        if ($storedPath === null) {
            return $this->applyTitleIconFallback($metadata);
        }

        return $this->applyStoredIconMetadata(
            $metadata,
            (int) $app->id,
            $storedPath,
            trim((string) ($metadata['website_url'] ?? '')),
            is_array($app->metadata) ? $app->metadata : [],
        );
    }

    /**
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     */
    private function applyTitleIconFallback(array $metadata): array
    {
        unset($metadata['icon_url'], $metadata['stored_icon_path'], $metadata['icon_mime'], $metadata['iconImageUrl'], $metadata['icon_source_url']);
        $metadata['icon_from_title'] = true;

        return $metadata;
    }

    /**
     * @param  array<string, mixed>  $metadata
     */
    private function resolvePreferredSourceUrl(array $metadata, int $appId): ?string
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
