<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Models\ModuleSetting;

/**
 * 임의 moabom/확장 모듈의 카테고리 설정 — DB SSOT + modules 디스크 GCS mirror.
 *
 * platform·tenant 모두 default mysql connection (TenantDatabaseConfigurator 적용 후) 사용.
 */
final class MoabomModuleCategoryDbStore
{
    public function __construct(
        private readonly string $moduleIdentifier,
    ) {}

    public function exists(string $category): bool
    {
        if (! $this->tableReady()) {
            return false;
        }

        return ModuleSetting::query()
            ->where('module', $this->moduleIdentifier)
            ->where('category', $category)
            ->exists();
    }

    /**
     * @return array<string, mixed>
     */
    public function read(string $category): array
    {
        if (! $this->tableReady()) {
            return [];
        }

        $row = ModuleSetting::query()
            ->where('module', $this->moduleIdentifier)
            ->where('category', $category)
            ->first();

        if ($row === null) {
            $hydrated = $this->hydrateFromModulesDisk($category);
            if ($hydrated !== null) {
                return $hydrated;
            }

            return [];
        }

        $payload = $row->payload;
        if (! is_array($payload)) {
            return [];
        }

        unset($payload['_meta']);

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    public function replace(string $category, array $settings): bool
    {
        if (! $this->tableReady()) {
            return false;
        }

        $clean = array_diff_key($settings, ['_meta' => true]);

        $payload = [
            '_meta' => [
                'version' => '1.0.0',
                'updated_at' => now()->toIso8601String(),
            ],
            ...$clean,
        ];

        try {
            ModuleSetting::query()->updateOrCreate(
                ['module' => $this->moduleIdentifier, 'category' => $category],
                ['payload' => $payload],
            );

            if (! GcsModuleSettingsJsonSync::write($this->moduleIdentifier, $category, $payload)) {
                Log::warning('MoabomModuleCategoryDbStore: GCS module JSON sync failed (DB saved)', [
                    'module' => $this->moduleIdentifier,
                    'category' => $category,
                ]);
            }

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    public static function shouldUseInProduction(): bool
    {
        return (bool) config('moabom-system.saas.enabled', false);
    }

    private function tableReady(): bool
    {
        try {
            return Schema::hasTable('moabom_module_settings');
        } catch (\Throwable) {
            return false;
        }
    }

    /**
     * @return array<string, mixed>|null
     */
    private function hydrateFromModulesDisk(string $category): ?array
    {
        try {
            SaasCachedConfigBridge::applyIfNeeded();
            Storage::forgetDisk('modules');

            if (app()->bound(TenantModuleStorageScope::class)) {
                app(TenantModuleStorageScope::class)->ensureApplied();
            }

            $path = $this->moduleIdentifier.'/settings/'.$category.'.json';
            $disk = Storage::disk('modules');

            if (! $disk->exists($path)) {
                return null;
            }

            $raw = $disk->get($path);
            if (! is_string($raw) || trim($raw) === '') {
                return null;
            }

            $decoded = json_decode(ltrim($raw, "\xEF\xBB\xBF"), true);
            if (! is_array($decoded)) {
                return null;
            }

            $payload = [
                '_meta' => [
                    'version' => '1.0.0',
                    'updated_at' => now()->toIso8601String(),
                    'hydrated_from' => 'modules_disk',
                ],
                ...array_diff_key($decoded, ['_meta' => true]),
            ];

            ModuleSetting::query()->updateOrCreate(
                ['module' => $this->moduleIdentifier, 'category' => $category],
                ['payload' => $payload],
            );

            unset($payload['_meta']);

            return $payload;
        } catch (\Throwable $e) {
            Log::warning('MoabomModuleCategoryDbStore hydrateFromModulesDisk 실패', [
                'module' => $this->moduleIdentifier,
                'category' => $category,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
}
