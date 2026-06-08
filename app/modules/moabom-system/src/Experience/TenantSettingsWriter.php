<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Experience;

use App\Services\SettingsService;
use Modules\Moabom\System\Contracts\SystemSettingsServiceInterface;
use Modules\Moabom\System\Saas\TenantRuntimeBootstrap;
use Modules\Moabom\System\Saas\TenantContext;

/**
 * TenantSettingsPlane PUT — G7 general + moabom-system module JSON 저장.
 *
 * Module 카테고리는 Writer에서 완전 스냅샷을 만든 뒤 replaceSettings 1회로 atomic replace.
 * appearance 의 point_color_presets·home_background_items 는 list replace (stored recursive merge 금지).
 *
 * @see deploy/TENANT-EXPERIENCE-ARCHITECTURE.md §4.2
 */
final class TenantSettingsWriter
{
    /** @var list<string> */
    private const MODULE_CATEGORIES = ['mypage', 'appearance', 'preferences'];

    /** @var list<string> */
    private const APPEARANCE_LIST_REPLACE_KEYS = ['point_color_presets', 'home_background_items'];

    /** @var array<string, mixed>|null replace 성공 직후 PUT 응답 SSOT (GCS 재조회·인메모리 캐시 회피) */
    private ?array $lastCommittedModulePayload = null;

    public function __construct(
        private readonly SettingsService $g7Settings,
        private readonly SystemSettingsServiceInterface $systemSettings,
        private readonly TenantRuntimeBootstrap $runtimeBootstrap,
        private readonly TenantContext $tenantContext,
        private readonly HomeBackgroundCatalogSync $backgroundCatalogSync,
    ) {}

    /**
     * @param  array<string, mixed>  $payload
     */
    public function write(array $payload): bool
    {
        $this->lastCommittedModulePayload = null;
        $ok = true;
        $wroteModule = false;

        $this->systemSettings->clearCache();
        $modulePayload = $this->mergeModulePayload($payload);
        if ($modulePayload !== []) {
            $ok = $this->systemSettings->replaceSettings($modulePayload) && $ok;
            $this->systemSettings->clearCache();
            if ($ok) {
                $this->lastCommittedModulePayload = $modulePayload;
            }
            if ($ok && isset($modulePayload['appearance'])) {
                $this->backgroundCatalogSync->pruneOrphanBlobs(
                    HomeBackgroundCatalogSync::metaIdsFromAppearance($modulePayload['appearance']),
                );
            }
            $wroteModule = true;
        }

        if (isset($payload['general']) && is_array($payload['general'])) {
            $ok = $this->g7Settings->saveSettings([
                '_tab' => 'general',
                'general' => $payload['general'],
            ]) && $ok;
        }

        if ($wroteModule || isset($payload['general'])) {
            if (config('moabom-system.saas.enabled', false)) {
                $this->runtimeBootstrap->rehydrateAfterSettingsSave($this->tenantContext);
            }
            $this->systemSettings->clearCache();
        }

        return $ok;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function lastCommittedModulePayload(): ?array
    {
        return $this->lastCommittedModulePayload;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function mergeModulePayload(array $payload): array
    {
        $incoming = [];
        foreach (self::MODULE_CATEGORIES as $category) {
            if (isset($payload[$category]) && is_array($payload[$category])) {
                $incoming[$category] = $payload[$category];
            }
        }

        if ($incoming === []) {
            return [];
        }

        $stored = $this->systemSettings->getAllSettings();
        $merged = [];

        foreach ($incoming as $category => $categoryPayload) {
            $base = $stored[$category] ?? [];
            if (! is_array($base)) {
                $base = [];
            }

            if ($category === 'appearance') {
                $merged[$category] = $this->buildAppearanceSnapshot(
                    $categoryPayload,
                    $base,
                );

                continue;
            }

            $merged[$category] = array_replace_recursive($base, $categoryPayload);
        }

        return $merged;
    }

    /**
     * appearance 저장 스냅샷 — getAllSettings() 재합치기 금지 (list·preset 제거 버그 방지).
     *
     * @param  array<string, mixed>  $incoming
     * @param  array<string, mixed>  $stored
     * @return array<string, mixed>
     */
    private function buildAppearanceSnapshot(array $incoming, array $stored): array
    {
        $incoming = $this->stripAppearanceResponseFields($incoming);
        $snapshot = $this->stripAppearanceResponseFields($stored);

        foreach (self::APPEARANCE_LIST_REPLACE_KEYS as $key) {
            if (array_key_exists($key, $incoming)) {
                $snapshot[$key] = array_values($incoming[$key]);
            }
        }

        foreach ($incoming as $key => $value) {
            if (in_array($key, self::APPEARANCE_LIST_REPLACE_KEYS, true)) {
                continue;
            }

            if (is_array($value) && isset($snapshot[$key]) && is_array($snapshot[$key]) && ! array_is_list($value)) {
                $snapshot[$key] = array_replace_recursive($snapshot[$key], $value);
            } else {
                $snapshot[$key] = $value;
            }
        }

        $schema = $this->appearanceSchemaDefaults();
        if (! isset($snapshot['themes']) && isset($schema['themes']) && is_array($schema['themes'])) {
            $snapshot['themes'] = $schema['themes'];
        }

        return $snapshot;
    }

    /**
     * @return array<string, mixed>
     */
    private function appearanceSchemaDefaults(): array
    {
        $path = $this->systemSettings->getSettingsDefaultsPath();
        if ($path === null || ! is_readable($path)) {
            return [];
        }

        $decoded = json_decode((string) file_get_contents($path), true);

        if (! is_array($decoded)) {
            return [];
        }

        $appearance = $decoded['defaults']['appearance'] ?? [];

        return is_array($appearance) ? $appearance : [];
    }

    /**
     * GET 응답 전용 필드(url/thumb_url)는 저장 대상에서 제외한다.
     *
     * @param  array<string, mixed>  $appearance
     * @return array<string, mixed>
     */
    private function stripAppearanceResponseFields(array $appearance): array
    {
        $items = $appearance['home_background_items'] ?? null;
        if (! is_array($items)) {
            return $appearance;
        }

        $appearance['home_background_items'] = array_values(array_filter(array_map(
            static function ($item) {
                if (! is_array($item)) {
                    return null;
                }

                return array_filter(
                    $item,
                    static fn (string $key): bool => in_array($key, ['id', 'mode', 'point_color'], true),
                    ARRAY_FILTER_USE_KEY,
                );
            },
            $items,
        )));

        return $appearance;
    }
}
