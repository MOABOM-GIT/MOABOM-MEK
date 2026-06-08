<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;

/**
 * 마스터의 현재 appearance를 "고정 프로비저닝 기본값" 스냅샷으로 캡처한다.
 *
 * 결과:
 * - GCS snapshot JSON: saas/provision-defaults/appearance.json
 * - GCS blob seed:     saas/provision-defaults/home-backgrounds/{uuid}/{full|thumb}.jpg
 */
final class SaasCaptureProvisionAppearanceDefaultsCommand extends Command
{
    protected $signature = 'moabom:saas:capture-provision-appearance-defaults
        {--apply : 실제 반영 (기본 dry-run)}
        {--source-db= : platform source DB (기본 schema_source_db)}
        {--snapshot-path= : snapshot JSON 경로}
        {--blob-seed-prefix= : 배경 blob seed prefix}';

    protected $description = '마스터 appearance를 신규 tenant용 고정 defaults 스냅샷으로 캡처';

    public function handle(PlatformConnectionFactory $platformConnections): int
    {
        $platformConnections->registerConnection();

        $apply = (bool) $this->option('apply');
        $sourceDb = trim((string) ($this->option('source-db')
            ?: config('moabom-system.saas.provision.schema_source_db', 'moabom-db')));
        $snapshotPath = trim((string) ($this->option('snapshot-path')
            ?: config('moabom-system.saas.provision.appearance_defaults.snapshot_path', 'saas/provision-defaults/appearance.json')));
        $blobSeedPrefix = trim((string) ($this->option('blob-seed-prefix')
            ?: config('moabom-system.saas.provision.appearance_defaults.blob_seed_prefix', 'saas/provision-defaults/home-backgrounds')));

        if ($sourceDb === '' || $snapshotPath === '' || $blobSeedPrefix === '') {
            $this->error('source-db/snapshot-path/blob-seed-prefix 는 비어 있을 수 없습니다.');

            return self::FAILURE;
        }

        $payload = $this->readPlatformAppearance($sourceDb);
        if ($payload === null) {
            $this->error("platform appearance payload 없음: {$sourceDb}.moabom_module_settings");

            return self::FAILURE;
        }

        $pointColorPresets = $this->normalizePointColorPresets($payload['point_color_presets'] ?? []);
        $homeBackgroundItems = $this->normalizeBackgroundItems($payload['home_background_items'] ?? []);

        $this->line(sprintf('point_color_presets=%d', count($pointColorPresets)));
        $this->line(sprintf('home_background_items=%d', count($homeBackgroundItems)));
        $this->line(sprintf('snapshot_path=%s', $snapshotPath));
        $this->line(sprintf('blob_seed_prefix=%s', rtrim($blobSeedPrefix, '/')));

        if (! $apply) {
            $this->warn('dry-run: --apply 옵션으로 실제 캡처를 반영하세요.');

            return self::SUCCESS;
        }

        $gcs = Storage::disk('gcs');
        $blobSeedPrefix = rtrim($blobSeedPrefix, '/');

        foreach ($homeBackgroundItems as $item) {
            $id = $item['id'];
            foreach (['full.jpg', 'thumb.jpg'] as $file) {
                $source = "modules/moabom-system/images/home-backgrounds/{$id}/{$file}";
                $target = "{$blobSeedPrefix}/{$id}/{$file}";

                if (! $gcs->exists($source)) {
                    $this->error("source blob 없음: {$source}");

                    return self::FAILURE;
                }

                $content = $gcs->get($source);
                if (! is_string($content) || $content === '') {
                    $this->error("source blob 읽기 실패: {$source}");

                    return self::FAILURE;
                }

                if (! $gcs->put($target, $content)) {
                    $this->error("seed blob 저장 실패: {$target}");

                    return self::FAILURE;
                }
            }
        }

        $snapshot = [
            '_meta' => [
                'version' => '1.0.0',
                'captured_at' => now()->toIso8601String(),
                'source_db' => $sourceDb,
            ],
            'point_color_presets' => $pointColorPresets,
            'home_background_items' => $homeBackgroundItems,
        ];

        $json = json_encode($snapshot, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (! is_string($json) || $json === '') {
            $this->error('snapshot JSON encode 실패');

            return self::FAILURE;
        }

        if (! $gcs->put($snapshotPath, $json)) {
            $this->error("snapshot 저장 실패: {$snapshotPath}");

            return self::FAILURE;
        }

        $this->info('고정 provision appearance defaults 캡처 완료');

        return self::SUCCESS;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function readPlatformAppearance(string $sourceDb): ?array
    {
        $prefix = (string) DB::connection()->getTablePrefix();
        $table = $prefix.'moabom_module_settings';

        $pdo = DB::connection()->getPdo();
        $stmt = $pdo->prepare("SELECT payload FROM `{$sourceDb}`.`{$table}` WHERE module = ? AND category = ? LIMIT 1");
        $stmt->execute(['moabom-system', 'appearance']);
        $raw = $stmt->fetchColumn();
        if (! is_string($raw) || trim($raw) === '') {
            return null;
        }

        $decoded = json_decode($raw, true);

        return is_array($decoded) ? $decoded : null;
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

            $normalized[] = $row;
            $seen[$id] = true;
        }

        return $normalized;
    }
}
