<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Experience;

use Illuminate\Support\Str;
use Modules\Moabom\System\Contracts\SystemSettingsServiceInterface;
use Modules\Moabom\System\Services\HomeBackgroundService;

/**
 * 홈 배경 blob(③) ↔ appearance.home_background_items(②) 단일 계약.
 *
 * @see deploy/TENANT-EXPERIENCE-ARCHITECTURE.md §4.2 — DELETE 즉시 blob만 제거 + PUT으로 meta strip 금지
 */
final class HomeBackgroundCatalogSync
{
    public function __construct(
        private readonly HomeBackgroundService $backgrounds,
        private readonly SystemSettingsServiceInterface $systemSettings,
    ) {}

    /**
     * Admin DELETE — meta 제거 후 blob 삭제 (한 API로 DoD-4 충족).
     */
    public function removeCompletely(string $id): bool
    {
        if (! Str::isUuid($id)) {
            return false;
        }

        if (! $this->detachIdFromAppearanceMeta($id)) {
            return false;
        }

        return $this->backgrounds->delete($id);
    }

    /**
     * appearance 저장 직후 — meta에 없는 home-backgrounds/ 디렉터리 정리.
     *
     * @param  array<string, true>|null  $authorizedMetaIds  Writer가 방금 replace 한 스냅샷 id.
     *                                                    null 이면 getAllSettings() 재조회( GCS read-after-write 지연 시 방금 blob 삭제 위험).
     */
    public function pruneOrphanBlobs(?array $authorizedMetaIds = null): void
    {
        $metaIds = $authorizedMetaIds ?? $this->metaBackgroundIds();
        foreach ($this->backgrounds->listStoredBackgroundIds() as $storedId) {
            if (! isset($metaIds[$storedId])) {
                $this->backgrounds->delete($storedId);
            }
        }
    }

    /**
     * @param  array<string, mixed>  $appearance
     * @return array<string, true>
     */
    public static function metaIdsFromAppearance(array $appearance): array
    {
        $items = $appearance['home_background_items'] ?? [];
        if (! is_array($items)) {
            return [];
        }

        $ids = [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $uuid = (string) ($item['id'] ?? '');
            if (Str::isUuid($uuid)) {
                $ids[$uuid] = true;
            }
        }

        return $ids;
    }

    private function detachIdFromAppearanceMeta(string $id): bool
    {
        $appearance = $this->systemSettings->getAllSettings()['appearance'] ?? [];
        if (! is_array($appearance)) {
            return true;
        }

        $items = $appearance['home_background_items'] ?? [];
        if (! is_array($items)) {
            return true;
        }

        $filtered = array_values(array_filter(
            $items,
            static fn ($item): bool => is_array($item) && (string) ($item['id'] ?? '') !== $id,
        ));

        if ($filtered === $items) {
            return true;
        }

        return $this->tenantSettingsWriter()->write([
            'appearance' => [
                'home_background_items' => $filtered,
            ],
        ]);
    }

    private function tenantSettingsWriter(): TenantSettingsWriter
    {
        return app(TenantSettingsWriter::class);
    }

    /**
     * @return array<string, true>
     */
    private function metaBackgroundIds(): array
    {
        $appearance = $this->systemSettings->getAllSettings()['appearance'] ?? [];
        if (! is_array($appearance)) {
            return [];
        }

        $items = $appearance['home_background_items'] ?? [];
        if (! is_array($items)) {
            return [];
        }

        $ids = [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $uuid = (string) ($item['id'] ?? '');
            if (Str::isUuid($uuid)) {
                $ids[$uuid] = true;
            }
        }

        return $ids;
    }
}
