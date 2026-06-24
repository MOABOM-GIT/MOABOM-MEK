<?php

namespace Modules\Moabom\Credit\Services;

use App\Traits\NormalizesSettingsData;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\File;
use Modules\Moabom\Credit\Contracts\CreditSettingsServiceInterface;
use Modules\Moabom\System\Support\MoabomSaasPersistentModuleSettings;

class CreditSettingsService implements CreditSettingsServiceInterface
{
    use MoabomSaasPersistentModuleSettings;
    use NormalizesSettingsData;

    private const MODULE_IDENTIFIER = 'moabom-credit';

    private ?array $defaults = null;

    private ?array $settings = null;

    /**
     * 모듈 설정 기본값 파일 경로를 반환합니다.
     */
    public function getSettingsDefaultsPath(): ?string
    {
        $path = $this->getModulePath().'/config/settings/defaults.json';

        return file_exists($path) ? $path : null;
    }

    /**
     * 설정값을 조회합니다.
     */
    public function getSetting(string $key, mixed $default = null): mixed
    {
        return Arr::get($this->getAllSettings(), $key, $default);
    }

    /**
     * 설정값을 저장합니다.
     */
    public function setSetting(string $key, mixed $value): bool
    {
        $settings = $this->getAllSettings();
        Arr::set($settings, $key, $value);

        $category = explode('.', $key)[0];

        return $this->saveCategorySettings($category, $settings[$category] ?? []);
    }

    /**
     * 전체 설정을 조회합니다.
     *
     * @return array<string, mixed>
     */
    public function getAllSettings(): array
    {
        if ($this->settings !== null) {
            return $this->settings;
        }

        $defaults = $this->getDefaults();
        $categories = $defaults['_meta']['categories'] ?? [];
        $defaultValues = $defaults['defaults'] ?? [];

        $settings = [];
        foreach ($categories as $category) {
            $settings[$category] = array_merge(
                $defaultValues[$category] ?? [],
                $this->loadCategorySettings($category)
            );
        }

        $this->settings = $this->normalizeSettingsData($settings, $defaultValues);

        return $this->settings;
    }

    /**
     * 카테고리별 설정을 조회합니다.
     *
     * @return array<string, mixed>
     */
    public function getSettings(string $category): array
    {
        return $this->getAllSettings()[$category] ?? [];
    }

    /**
     * 설정을 저장합니다.
     *
     * @param  array<string, mixed>  $settings
     */
    public function saveSettings(array $settings): bool
    {
        $success = true;
        $defaultValues = $this->getDefaults()['defaults'] ?? [];

        foreach ($settings as $category => $categorySettings) {
            if (str_starts_with($category, '_') || ! is_array($categorySettings)) {
                continue;
            }

            $categoryDefaults = $defaultValues[$category] ?? [];
            foreach ($categoryDefaults as $key => $defaultValue) {
                if (is_bool($defaultValue) && ! array_key_exists($key, $categorySettings)) {
                    $categorySettings[$key] = false;
                }
            }

            $processedSettings = $this->normalizeCategoryData($categorySettings, $categoryDefaults);
            if (! $this->saveCategorySettings($category, $processedSettings)) {
                $success = false;
            }
        }

        $this->settings = null;

        return $success;
    }

    /**
     * 프론트엔드 노출 가능 설정을 조회합니다.
     *
     * @return array<string, mixed>
     */
    public function getFrontendSettings(): array
    {
        $frontendSchema = $this->getDefaults()['frontend_schema'] ?? [];
        $allSettings = $this->getAllSettings();
        $frontendSettings = [];

        foreach ($frontendSchema as $category => $schema) {
            if (! ($schema['expose'] ?? false)) {
                continue;
            }

            $fields = $schema['fields'] ?? [];
            $categorySettings = $allSettings[$category] ?? [];
            foreach ($fields as $field => $fieldSchema) {
                if ($fieldSchema['expose'] ?? false) {
                    $frontendSettings[$category][$field] = $categorySettings[$field] ?? null;
                }
            }
        }

        return $frontendSettings;
    }

    /**
     * 설정 캐시를 초기화합니다.
     */
    public function clearCache(): void
    {
        $this->defaults = null;
        $this->settings = null;
    }

    /**
     * 기본값을 조회합니다.
     *
     * @return array<string, mixed>
     */
    private function getDefaults(): array
    {
        if ($this->defaults !== null) {
            return $this->defaults;
        }

        $path = $this->getSettingsDefaultsPath();
        if ($path === null) {
            return [];
        }

        $this->defaults = json_decode(File::get($path), true) ?? [];

        return $this->defaults;
    }

    /**
     * 설정 파일을 로드합니다.
     *
     * @return array<string, mixed>
     */
    private function loadCategorySettings(string $category): array
    {
        return $this->resolveCategorySettings(
            $category,
            fn (): array => $this->loadLegacyLocalCategorySettings($category),
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function loadLegacyLocalCategorySettings(string $category): array
    {
        $path = $this->getCategoryFilePath($category);

        if (! File::exists($path)) {
            return [];
        }

        $decoded = json_decode(File::get($path), true);

        return is_array($decoded) ? array_diff_key($decoded, ['_meta' => true]) : [];
    }

    /**
     * 카테고리 설정을 저장합니다.
     *
     * @param  array<string, mixed>  $settings
     */
    private function saveCategorySettings(string $category, array $settings): bool
    {
        return $this->persistCategorySettings(
            $category,
            $settings,
            function () use ($category, $settings): bool {
                $storagePath = $this->getStoragePath();

                if (! File::isDirectory($storagePath)) {
                    File::makeDirectory($storagePath, 0755, true);
                }

                return File::put(
                    $this->getCategoryFilePath($category),
                    json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
                ) !== false;
            },
        );
    }

    /**
     * 카테고리 설정 파일 경로를 반환합니다.
     */
    private function getCategoryFilePath(string $category): string
    {
        return $this->getStoragePath().'/'.$category.'.json';
    }

    /**
     * 모듈 경로를 반환합니다.
     */
    private function getModulePath(): string
    {
        return base_path('modules/'.self::MODULE_IDENTIFIER);
    }

    /**
     * 설정 저장 경로를 반환합니다.
     */
    private function getStoragePath(): string
    {
        return storage_path('app/modules/'.self::MODULE_IDENTIFIER.'/settings');
    }

    protected function getPersistentModuleIdentifier(): string
    {
        return self::MODULE_IDENTIFIER;
    }
}
