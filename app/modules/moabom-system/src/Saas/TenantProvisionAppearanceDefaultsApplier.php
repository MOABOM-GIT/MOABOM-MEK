<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Modules\Moabom\System\Models\ModuleSetting;

/**
 * 신규 tenant provision 시 고정 appearance 기본값(포인트 색상 + 업로드 배경)을 주입한다.
 *
 * 원칙:
 * - 마스터(mek360)의 현재 appearance를 실시간 참조하지 않는다.
 * - 사전에 캡처된 스냅샷(JSON + blob seed)만 사용한다.
 */
final class TenantProvisionAppearanceDefaultsApplier
{
    private const DEFAULT_SNAPSHOT_PATH = 'saas/provision-defaults/appearance.json';

    private const DEFAULT_BLOB_SEED_PREFIX = 'saas/provision-defaults/home-backgrounds';

    /** 신규 테넌트 baseline — config/settings/defaults.json 과 동일하게 유지 (admin 디폴트). */
    private const DEFAULT_FONT_SIZE_LEVEL = 2;

    public function __construct(
        private readonly TenantDatabaseConfigurator $databaseConfigurator,
        private readonly TenantFilesystemConfigurator $filesystemConfigurator,
        private readonly PlatformRuntimeConfigurator $platformRuntimeConfigurator,
    ) {}

    public function apply(TenantRecord $tenant): void
    {
        $config = (array) config('moabom-system.saas.provision.appearance_defaults', []);
        if (! (bool) ($config['enabled'] ?? true)) {
            return;
        }

        $strict = (bool) ($config['strict'] ?? true);
        $snapshotPath = trim((string) ($config['snapshot_path'] ?? self::DEFAULT_SNAPSHOT_PATH));
        $blobSeedPrefix = trim((string) ($config['blob_seed_prefix'] ?? self::DEFAULT_BLOB_SEED_PREFIX));
        if ($snapshotPath === '' || $blobSeedPrefix === '') {
            if ($strict) {
                throw new \RuntimeException('appearance defaults 설정이 비어 있습니다.');
            }

            return;
        }

        $snapshot = $this->loadSnapshot($snapshotPath, $strict);
        if ($snapshot === null) {
            return;
        }

        $pointColorPresets = $this->normalizePointColorPresets($snapshot['point_color_presets'] ?? []);
        $backgroundItems = $this->normalizeBackgroundItems($snapshot['home_background_items'] ?? []);

        try {
            $this->filesystemConfigurator->apply($tenant);
            $this->seedBackgroundBlobs($backgroundItems, $blobSeedPrefix, $strict);

            $this->databaseConfigurator->apply($tenant);
            $this->upsertAppearancePayload([
                'point_color_presets' => $pointColorPresets,
                'home_background_items' => $backgroundItems,
            ]);
        } finally {
            $this->platformRuntimeConfigurator->applyPlatform();
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    private function loadSnapshot(string $snapshotPath, bool $strict): ?array
    {
        $disk = Storage::disk('gcs');
        if (! $disk->exists($snapshotPath)) {
            if ($strict) {
                throw new \RuntimeException("appearance defaults snapshot 없음: {$snapshotPath}");
            }

            return null;
        }

        $raw = $disk->get($snapshotPath);
        if (! is_string($raw) || trim($raw) === '') {
            if ($strict) {
                throw new \RuntimeException("appearance defaults snapshot 비어 있음: {$snapshotPath}");
            }

            return null;
        }

        $decoded = json_decode(ltrim($raw, "\xEF\xBB\xBF"), true);
        if (! is_array($decoded)) {
            if ($strict) {
                throw new \RuntimeException("appearance defaults snapshot JSON 파싱 실패: {$snapshotPath}");
            }

            return null;
        }

        return $decoded;
    }

    /**
     * @param  mixed  $presets
     * @return list<string>
     */
    private function normalizePointColorPresets(mixed $presets): array
    {
        if (! is_array($presets)) {
            return [];
        }

        $normalized = [];
        foreach ($presets as $hex) {
            if (! is_string($hex) || preg_match('/^#[0-9a-fA-F]{6}$/', $hex) !== 1) {
                continue;
            }
            $normalized[] = strtolower($hex);
        }

        return array_values(array_unique($normalized));
    }

    /**
     * @param  mixed  $items
     * @return list<array{id: string, mode: string, point_color?: string|null}>
     */
    private function normalizeBackgroundItems(mixed $items): array
    {
        if (! is_array($items)) {
            return [];
        }

        $seen = [];
        $normalized = [];
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $id = (string) ($item['id'] ?? '');
            if (! Str::isUuid($id) || isset($seen[$id])) {
                continue;
            }

            $mode = in_array(($item['mode'] ?? null), ['light', 'dark'], true)
                ? (string) $item['mode']
                : 'light';

            $row = [
                'id' => $id,
                'mode' => $mode,
            ];

            $pointColor = $item['point_color'] ?? null;
            if (is_string($pointColor) && preg_match('/^#[0-9a-fA-F]{6}$/', $pointColor) === 1) {
                $row['point_color'] = strtolower($pointColor);
            } else {
                $row['point_color'] = null;
            }

            $seen[$id] = true;
            $normalized[] = $row;
        }

        return $normalized;
    }

    /**
     * @param  list<array{id: string, mode: string, point_color?: string|null}>  $items
     */
    private function seedBackgroundBlobs(array $items, string $blobSeedPrefix, bool $strict): void
    {
        $blobSeedPrefix = rtrim($blobSeedPrefix, '/');
        if ($items === []) {
            return;
        }

        $gcs = Storage::disk('gcs');
        $modules = Storage::disk('modules');

        foreach ($items as $item) {
            $id = $item['id'];
            foreach (['full.jpg', 'thumb.jpg'] as $file) {
                $source = "{$blobSeedPrefix}/{$id}/{$file}";
                if (! $gcs->exists($source)) {
                    if ($strict) {
                        throw new \RuntimeException("appearance defaults blob 없음: {$source}");
                    }
                    continue;
                }

                $content = $gcs->get($source);
                if (! is_string($content) || $content === '') {
                    if ($strict) {
                        throw new \RuntimeException("appearance defaults blob 비어 있음: {$source}");
                    }
                    continue;
                }

                $target = "moabom-system/images/home-backgrounds/{$id}/{$file}";
                if (! $modules->put($target, $content) && $strict) {
                    throw new \RuntimeException("tenant 배경 blob 저장 실패: {$target}");
                }
            }
        }
    }

    /**
     * @param  array{point_color_presets: list<string>, home_background_items: list<array{id: string, mode: string, point_color?: string|null}>}  $payload
     */
    private function upsertAppearancePayload(array $payload): void
    {
        ModuleSetting::query()->updateOrCreate(
            [
                'module' => 'moabom-system',
                'category' => 'appearance',
            ],
            [
                'payload' => array_merge(
                    ['font_size_default' => self::DEFAULT_FONT_SIZE_LEVEL],
                    $payload,
                ),
            ],
        );
    }
}
