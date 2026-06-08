<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use App\Contracts\Repositories\ConfigRepositoryInterface;
use App\Repositories\JsonConfigRepository;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Models\ModuleSetting;
use Modules\Moabom\System\Saas\TenantContext;

/**
 * G7 core 의 ConfigRepositoryInterface DB-backed override.
 *
 * G7 core 의 `JsonConfigRepository` 가 multi-tenant + multi-instance Cloud Run
 * 환경에서 갖는 두 가지 결함을 우회:
 *
 *  1. `saveCategory` 가 `fopen + flock + ftruncate` 의 local file 가정 → GCS disk 에서
 *     `Storage::disk('settings')->path()` 가 무의미 / 실패.
 *  2. multi-instance 의 GCS object read-after-write race → split-brain.
 *
 * 우리 구현:
 *  - read/write 핵심 (`get/getCategory/all/set/setMany/saveCategory/has/delete`)
 *    = `moabom_module_settings` (module='_g7_core_') row. DB transaction = strong consistency.
 *  - 정적 schema/defaults (`getDefaults/getFrontendSchema/getCategories/categoryExists`)
 *    = `JsonConfigRepository` fallback 에 위임 (defaults.json 의 정적 데이터).
 *  - `initialize/backup/restore` = DB-backed 로 안전하게 구현.
 *
 * Multi-tenant 자동 격리:
 *  - `TenantDatabaseConfigurator::apply($tenant)` 가 default mysql connection 의
 *    database 를 `hospital_{slug}` 로 런타임 전환.
 *  - Eloquent `ModuleSetting` 은 default connection 사용 → request 별 자동 tenant scope.
 *  - platform 요청 = default `moabom-db` 그대로.
 *
 * @see deploy/AGENT-FAILURE-ANALYSIS.md §10
 * @see app/app/Repositories/JsonConfigRepository.php — fallback 위임용 원본
 */
final class MoabomDbConfigRepository implements ConfigRepositoryInterface
{
    /** moabom_module_settings.module 컬럼 값 — G7 core 카테고리 식별자 */
    private const MODULE_KEY = '_g7_core_';

    private const CACHE_KEY_PREFIX = 'g7_json_settings_category:';

    public function __construct(
        private readonly JsonConfigRepository $fallback,
        private readonly TenantContext $tenantContext,
    ) {}

    /**
     * Tenant-scoped cache key — file CACHE_STORE 의 multi-tenant 누수 방지.
     * platform 요청 = `_platform_`, tenant = slug.
     */
    private function cacheKey(string $category): string
    {
        $slug = $this->tenantContext->tenantId();
        $scope = $slug !== null && $slug !== '' ? $slug : '_platform_';

        return self::CACHE_KEY_PREFIX.$scope.':'.$category;
    }

    public function all(): array
    {
        $out = [];
        foreach ($this->getCategories() as $category) {
            $out[$category] = $this->getCategory($category);
        }

        return $out;
    }

    public function getCategory(string $category): array
    {
        if (! $this->categoryExists($category)) {
            return $this->getDefaultsForCategory($category);
        }

        $ttl = (int) config('cache.g7_json_settings_ttl', 300);
        if ($ttl <= 0) {
            return $this->readCategoryFromDb($category);
        }

        $revision = $this->categoryRevisionStamp($category);

        return Cache::remember(
            $this->cacheKey($category).':'.$revision,
            $ttl,
            fn (): array => $this->readCategoryFromDb($category),
        );
    }

    /**
     * Cloud Run 다중 인스턴스 + file 캐시 — Cache::forget 만으로는 다른 인스턴스가 구 데이터를 읽을 수 있음.
     * DB row updated_at 을 캐시 키에 포함해 저장 직후 모든 인스턴스가 자동 miss.
     */
    private function categoryRevisionStamp(string $category): string
    {
        $updatedAt = ModuleSetting::query()
            ->where('module', self::MODULE_KEY)
            ->where('category', $category)
            ->value('updated_at');

        if ($updatedAt === null) {
            return '0';
        }

        $stamp = is_object($updatedAt) && method_exists($updatedAt, 'getTimestamp')
            ? $updatedAt->getTimestamp()
            : (strtotime((string) $updatedAt) ?: 0);

        return (string) $stamp;
    }

    /**
     * @return array<string, mixed>
     */
    private function readCategoryFromDb(string $category): array
    {
        $row = ModuleSetting::query()
            ->where('module', self::MODULE_KEY)
            ->where('category', $category)
            ->first();

        $defaults = $this->getDefaultsForCategory($category);

        if ($row === null) {
            // DB miss — GCS 의 기존 데이터를 1회 lazy hydrate 후 사용.
            // 이유: v113 첫 배포 시 DB row 가 없는데, defaults 만 반환하면
            // 운영자가 admin UI 에서 settings 변경할 때 defaults 가 DB 에 저장돼
            // 실제 운영 데이터(예: site_name='스마트케어 freshent')가 손실됨.
            // GCS unique key (module, category) → 다중 워커 동시 hydrate race 안전.
            $hydrated = $this->hydrateFromGcs($category);
            if ($hydrated !== null) {
                return array_merge($defaults, $hydrated);
            }

            return $defaults;
        }

        $payload = is_array($row->payload) ? $row->payload : [];
        unset($payload['_meta']);

        return array_merge($defaults, $payload);
    }

    /**
     * GCS 의 `settings/{category}.json` (또는 tenant-prefix 적용 후) 를 1회 읽어 DB row 로 적재.
     *
     * Tenant 격리: 현재 request 의 'settings' disk 가 이미 tenant-prefix 가 적용된 상태
     * (TenantFilesystemConfigurator) 이므로 path_prefix 를 따로 신경쓸 필요 없음.
     *
     * @return array<string, mixed>|null
     */
    private function hydrateFromGcs(string $category): ?array
    {
        try {
            $disk = Storage::disk('settings');
            $path = $category.'.json';

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
                    'hydrated_from' => 'gcs',
                ],
                ...array_diff_key($decoded, ['_meta' => true]),
            ];

            ModuleSetting::query()->updateOrCreate(
                ['module' => self::MODULE_KEY, 'category' => $category],
                ['payload' => $payload],
            );

            unset($payload['_meta']);

            return $payload;
        } catch (\Throwable $e) {
            Log::warning('MoabomDbConfigRepository hydrateFromGcs 실패', [
                'category' => $category,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    public function get(string $key, mixed $default = null): mixed
    {
        $parts = explode('.', $key, 2);

        if (count($parts) === 1) {
            return $this->getCategory($key);
        }

        [$category, $settingKey] = $parts;
        $categoryData = $this->getCategory($category);

        return Arr::get($categoryData, $settingKey, $default);
    }

    public function set(string $key, mixed $value): bool
    {
        $parts = explode('.', $key, 2);

        if (count($parts) !== 2) {
            return false;
        }

        [$category, $settingKey] = $parts;
        $categoryData = $this->getCategory($category);
        Arr::set($categoryData, $settingKey, $value);

        return $this->saveCategory($category, $categoryData);
    }

    public function setMany(array $settings): bool
    {
        $grouped = [];
        foreach ($settings as $key => $value) {
            $parts = explode('.', $key, 2);
            if (count($parts) === 2) {
                [$category, $settingKey] = $parts;
                $grouped[$category][$settingKey] = $value;
            }
        }

        foreach ($grouped as $category => $categorySettings) {
            $existing = $this->getCategory($category);
            $merged = array_merge($existing, $categorySettings);

            if (! $this->saveCategory($category, $merged)) {
                return false;
            }
        }

        return true;
    }

    public function saveCategory(string $category, array $settings): bool
    {
        if (! $this->categoryExists($category)) {
            return false;
        }

        $payload = [
            '_meta' => [
                'version' => '1.0.0',
                'updated_at' => now()->toIso8601String(),
            ],
            ...$settings,
        ];

        try {
            ModuleSetting::query()->updateOrCreate(
                ['module' => self::MODULE_KEY, 'category' => $category],
                ['payload' => $payload],
            );

            Cache::forget($this->cacheKey($category));
            Cache::forget(self::CACHE_KEY_PREFIX.$category);

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    public function has(string $key): bool
    {
        return $this->get($key) !== null;
    }

    public function delete(string $key): bool
    {
        $parts = explode('.', $key, 2);

        if (count($parts) !== 2) {
            return false;
        }

        [$category, $settingKey] = $parts;
        $categoryData = $this->getCategory($category);
        Arr::forget($categoryData, $settingKey);

        return $this->saveCategory($category, $categoryData);
    }

    public function getCategories(): array
    {
        return $this->fallback->getCategories();
    }

    public function categoryExists(string $category): bool
    {
        return $this->fallback->categoryExists($category);
    }

    public function initialize(array $settings = []): bool
    {
        $defaults = $this->getDefaults();
        $merged = array_replace_recursive($defaults, $settings);

        foreach ($merged as $category => $categorySettings) {
            if (! is_array($categorySettings)) {
                continue;
            }
            if (! $this->saveCategory($category, $categorySettings)) {
                return false;
            }
        }

        return true;
    }

    public function backup(): string
    {
        $payload = [
            'version' => '1.0.0',
            'taken_at' => now()->toIso8601String(),
            'source' => 'MoabomDbConfigRepository',
            'categories' => [],
        ];

        foreach ($this->getCategories() as $category) {
            $row = ModuleSetting::query()
                ->where('module', self::MODULE_KEY)
                ->where('category', $category)
                ->first();
            if ($row !== null) {
                $payload['categories'][$category] = $row->payload;
            }
        }

        $name = 'g7_settings_db_backup_'.now()->format('Y-m-d_His').'.json';
        $path = storage_path('app/'.$name);
        file_put_contents($path, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

        return $path;
    }

    public function restore(string $backupPath): bool
    {
        if (! is_file($backupPath)) {
            return false;
        }

        $raw = file_get_contents($backupPath);
        $decoded = json_decode($raw ?: '', true);
        if (! is_array($decoded) || ! isset($decoded['categories']) || ! is_array($decoded['categories'])) {
            return false;
        }

        foreach ($decoded['categories'] as $category => $categorySettings) {
            if (! is_string($category) || ! is_array($categorySettings)) {
                continue;
            }
            if (! $this->categoryExists($category)) {
                continue;
            }
            unset($categorySettings['_meta']);
            if (! $this->saveCategory($category, $categorySettings)) {
                return false;
            }
        }

        return true;
    }

    public function getDefaults(): array
    {
        return $this->fallback->getDefaults();
    }

    public function getFrontendSchema(): array
    {
        return $this->fallback->getFrontendSchema();
    }

    /**
     * @return array<string, mixed>
     */
    private function getDefaultsForCategory(string $category): array
    {
        $defaults = $this->getDefaults();

        return is_array($defaults[$category] ?? null) ? $defaults[$category] : [];
    }
}
