<?php

namespace Modules\Moabom\System\Repositories;

use App\Repositories\JsonConfigRepository;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Modules\Moabom\System\Saas\TenantContext;

/**
 * G7 settings — Cloud Run GCS + SaaS tenant prefix.
 *
 * G7 SSOT: settings 디스크 JSON (admin-settings-access.md). SaaS는 middleware가 prefix 만 교체.
 * Laravel Cache 키는 tenant slug 를 포함 — G7_JSON_SETTINGS_CACHE_TTL 재사용 가능.
 * ConfigRepository scoped + categoryMemo: 동일 요청 GCS 중복 read 방지.
 */
class MoabomJsonConfigRepository extends JsonConfigRepository
{
    private const STORAGE_DISK = 'settings';

    /** @var array<string, array<string, mixed>> */
    private array $categoryMemo = [];

    /** 요청·테넌트 전환 시 categoryMemo 초기화 (scoped 바인딩 보조) */
    public function resetRequestState(): void
    {
        $this->categoryMemo = [];
    }

    /**
     * @return array<string, mixed>
     */
    public function getCategory(string $category): array
    {
        if (array_key_exists($category, $this->categoryMemo)) {
            return $this->categoryMemo[$category];
        }

        $ttl = (int) config('cache.g7_json_settings_ttl', 300);
        $scoped = config('moabom-system.saas.enabled', false) && $ttl > 0;

        if (! $scoped) {
            $this->categoryMemo[$category] = parent::getCategory($category);

            return $this->categoryMemo[$category];
        }

        if (! $this->categoryExists($category)) {
            $this->categoryMemo[$category] = parent::getCategory($category);

            return $this->categoryMemo[$category];
        }

        $this->categoryMemo[$category] = Cache::remember(
            $this->scopedSettingsCacheKey($category),
            $ttl,
            fn (): array => $this->readCategoryBypassingCache($category),
        );

        return $this->categoryMemo[$category];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    public function all(): array
    {
        $settings = [];
        foreach ($this->getCategories() as $category) {
            $settings[$category] = $this->getCategory($category);
        }

        return $settings;
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    public function saveCategory(string $category, array $settings): bool
    {
        if (! $this->categoryExists($category)) {
            return false;
        }

        if ($category === 'general' && $this->isPlatformRequest()) {
            $settings['site_url'] = rtrim((string) config('app.url'), '/');
        }

        $data = [
            '_meta' => [
                'version' => '1.0.0',
                'updated_at' => now()->toIso8601String(),
            ],
            ...$settings,
        ];

        $path = "{$category}.json";
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        if ($json === false) {
            Log::error("설정 JSON 인코딩 실패: {$category}");

            return false;
        }

        Cache::forget('g7_json_settings_category:'.$category);
        Cache::forget($this->scopedSettingsCacheKey($category));
        unset($this->categoryMemo[$category]);

        try {
            return Storage::disk(self::STORAGE_DISK)->put($path, $json);
        } catch (\Throwable $e) {
            Log::error("설정 파일 저장 실패: {$category}", [
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    private function scopedSettingsCacheKey(string $category): string
    {
        $scope = 'platform';
        if (config('moabom-system.saas.enabled', false)) {
            $slug = app(TenantContext::class)->tenantId();
            if ($slug !== null && $slug !== '') {
                $scope = $slug;
            }
        }

        return 'g7_json_settings:'.$scope.':'.$category;
    }

    /** 코어 readCategoryFromStorage — scoped Cache::remember 콜백용 (env/putenv 우회) */
    private function readCategoryBypassingCache(string $category): array
    {
        return $this->readCategoryFromStorage($category);
    }

    private function isPlatformRequest(): bool
    {
        if (! config('moabom-system.saas.enabled', false)) {
            return true;
        }

        return app(TenantContext::class)->isPlatformRequest();
    }
}
