<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Tenant module settings — 카테고리 JSON 단일 writer (TenantSettingsPlane 전용).
 *
 * **storage backend** (`moabom-system.saas.module_settings_backend` config):
 *   - `db` (기본) — `TenantModuleSettingsRepository` (DB row) read/write
 *   - `gcs` — Flysystem `Storage::disk('modules')` read/write (진단/레거시)
 *
 * write 경로는 backend 단일 경로를 따른다.
 *  - backend=db: DB 단일 write (설정 SSOT)
 *  - backend=gcs: modules disk write (레거시/진단)
 * 운영 SaaS(production)는 split-brain 재발 방지를 위해 read/write backend 를 강제로 `db` 로 고정한다.
 *
 * @see deploy/TENANT-EXPERIENCE-ARCHITECTURE.md §4.2
 * @see deploy/AGENT-FAILURE-ANALYSIS.md §9 — GCS staleness 실패 결산 후 DB 전환
 */
final class TenantModuleCategoryJsonStore
{
    /** @var array<string, true> */
    private static array $writtenCategoriesThisRequest = [];

    public function __construct(
        private readonly TenantModuleStorageScope $storageScope,
        private readonly TenantModuleSettingsRepository $repository,
    ) {}

    /**
     * Tenant module category 읽기 — config flag (`module_settings_backend`) 가 결정.
     *
     * @return array<string, mixed>
     */
    public function read(string $category): array
    {
        if ($this->backend() === 'db') {
            $payload = $this->repository->read($category);
            if ($payload !== [] || $this->repository->exists($category)) {
                return $payload;
            }

            $fallbackPayload = $this->readFromFilesystem($category);
            if ($fallbackPayload === []) {
                return [];
            }

            // DB row miss 시 GCS snapshot 을 1회 hydrate 하여 platform/tenant read path 를 단일화한다.
            if ($this->repository->replace($category, $fallbackPayload)) {
                return $fallbackPayload;
            }

            return [];
        }

        return $this->readFromFilesystem($category);
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    public function replace(string $category, array $settings): bool
    {
        $ok = $this->backend() === 'db'
            ? $this->repository->replace($category, $settings)
            : $this->replaceOnFilesystem($category, $settings);

        if ($ok) {
            self::$writtenCategoriesThisRequest[$category] = true;
        }

        return $ok;
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function replaceOnFilesystem(string $category, array $settings): bool
    {
        SaasCachedConfigBridge::applyIfNeeded();
        Storage::forgetDisk('modules');
        Storage::forgetDisk('gcs');
        $this->storageScope->ensureApplied();
        $this->reassertTenantModulesPrefixIfBound();

        $json = json_encode($settings, JSON_UNESCAPED_UNICODE);
        if ($json === false || ! $this->isValidJson($json)) {
            return false;
        }

        $path = $this->relativePath($category);
        $disk = Storage::disk('modules');

        $existing = $disk->get($path);
        if ($existing !== null && ! $this->isValidJson($existing)) {
            $disk->delete($path);
            $existing = null;
        }

        if ($existing !== null && $this->payloadMatches($json, $existing)) {
            return true;
        }

        if ($this->modulesDiskUsesGcs()) {
            return $this->replaceOnGcs($disk, $path, $json, $category);
        }

        $snapshotPath = $this->snapshotPath($category);

        try {
            if (! $this->writeSnapshot($disk, $snapshotPath, $json)) {
                return false;
            }

            if ($this->promoteSnapshotToLive($disk, $snapshotPath, $path, $json)) {
                return true;
            }
        } finally {
            $disk->delete($snapshotPath);
        }

        return false;
    }

    private function backend(): string
    {
        $value = (string) config('moabom-system.saas.module_settings_backend', 'db');

        // 운영 SaaS에서는 module settings read path를 DB로 강제한다.
        // 과거 gcs 분기 재진입 시 read/write split-brain이 재발했다.
        if ((bool) config('moabom-system.saas.enabled', false) && app()->environment('production') && $value !== 'db') {
            Log::warning('moabom-system.saas.module_settings_backend non-db configured in production; forcing db backend', [
                'configured_backend' => $value,
            ]);

            return 'db';
        }

        return in_array($value, ['db', 'gcs'], true) ? $value : 'db';
    }

    /** GCS: snapshot copy 대신 delete+put (copy/readBack 불일치 방지) */
    private function replaceOnGcs(Filesystem $disk, string $path, string $json, string $category): bool
    {
        if ($disk->exists($path)) {
            $disk->delete($path);
        }

        return (bool) $disk->put($path, $json);
    }

    private function modulesDiskUsesGcs(): bool
    {
        return (string) config('filesystems.disks.modules.driver', '') === 'gcs';
    }

    private function writeSnapshot(Filesystem $disk, string $snapshotPath, string $json): bool
    {
        if (! $disk->put($snapshotPath, $json)) {
            return false;
        }

        $readBack = $disk->get($snapshotPath);

        return $readBack !== null && $this->payloadMatches($json, $readBack);
    }

    private function promoteSnapshotToLive(Filesystem $disk, string $snapshotPath, string $livePath, string $json): bool
    {
        if ($disk->exists($livePath)) {
            $disk->delete($livePath);
        }

        if ($disk->copy($snapshotPath, $livePath) && $this->readBackMatches($disk, $livePath, $json)) {
            return true;
        }

        $disk->delete($livePath);

        return $disk->put($livePath, $json) && $this->readBackMatches($disk, $livePath, $json);
    }

    private function readBackMatches(Filesystem $disk, string $path, string $json): bool
    {
        $readBack = $disk->get($path);

        return $readBack !== null && $this->payloadMatches($json, $readBack);
    }

    private function snapshotPath(string $category): string
    {
        return 'moabom-system/settings/_snapshots/'.$category.'/'.bin2hex(random_bytes(16)).'.json';
    }

    private function payloadMatches(string $expectedJson, string $readBack): bool
    {
        $readBack = ltrim($readBack, "\xEF\xBB\xBF");

        if (! $this->isValidJson($readBack)) {
            return false;
        }

        $expected = json_decode(trim($expectedJson), true);
        $actual = json_decode(trim($readBack), true);

        return is_array($expected) && is_array($actual) && $expected == $actual;
    }

    public static function wasWrittenThisRequest(string $category): bool
    {
        return isset(self::$writtenCategoriesThisRequest[$category]);
    }

    public static function resetWrittenCategoriesForTesting(): void
    {
        self::$writtenCategoriesThisRequest = [];
    }

    private function relativePath(string $category): string
    {
        return 'moabom-system/settings/'.$category.'.json';
    }

    /**
     * @return array<string, mixed>
     */
    private function readFromFilesystem(string $category): array
    {
        SaasCachedConfigBridge::applyIfNeeded();
        Storage::forgetDisk('modules');
        $this->storageScope->ensureApplied();
        $this->reassertTenantModulesPrefixIfBound();

        $disk = Storage::disk('modules');
        $path = $this->relativePath($category);

        $content = $disk->exists($path) ? $disk->get($path) : null;

        return $this->decodeCategoryContent($content);
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeCategoryContent(?string $content): array
    {
        if ($content === null || trim($content) === '') {
            return [];
        }

        $content = ltrim($content, "\xEF\xBB\xBF");
        if (! $this->isValidJson($content)) {
            return [];
        }

        $decoded = json_decode(trim($content), true);

        return is_array($decoded) ? $decoded : [];
    }

    /** TenantContext·config:clear 후 platform prefix 잔류 시 GCS tenant SSOT 와 어긋남 방지 */
    private function reassertTenantModulesPrefixIfBound(): void
    {
        if (! app()->bound(TenantContext::class)) {
            return;
        }

        $tenant = app(TenantContext::class)->tenant();
        if ($tenant === null) {
            return;
        }

        $expected = rtrim($tenant->gcsPrefix, '/').'/modules';
        if ($expected === '/modules') {
            $expected = 'tenants/'.$tenant->slug.'/modules';
        }

        if ((string) config('filesystems.disks.modules.driver', '') !== 'gcs') {
            return;
        }

        if ((string) config('filesystems.disks.modules.path_prefix', '') === $expected) {
            return;
        }

        app(TenantFilesystemConfigurator::class)->apply($tenant);
        Storage::forgetDisk('modules');
    }

    private function isValidJson(string $content): bool
    {
        $trimmed = trim($content);
        if ($trimmed === '') {
            return false;
        }

        if (function_exists('json_validate')) {
            return json_validate($trimmed);
        }

        json_decode($trimmed, true);

        return json_last_error() === JSON_ERROR_NONE;
    }
}
