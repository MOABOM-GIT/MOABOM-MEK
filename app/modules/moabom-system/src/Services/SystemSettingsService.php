<?php

namespace Modules\Moabom\System\Services;

use App\Contracts\Extension\StorageInterface;
use App\Extension\Storage\ModuleStorageDriver;
use App\Traits\NormalizesSettingsData;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;
use Modules\Moabom\System\Contracts\SystemSettingsServiceInterface;
use Modules\Moabom\System\Saas\TenantModuleCategoryJsonStore;
use Modules\Moabom\System\Saas\TenantModuleStorageScope;

class SystemSettingsService implements SystemSettingsServiceInterface
{
    use NormalizesSettingsData;

    private const MODULE_IDENTIFIER = 'moabom-system';

    /** ModuleStorageDriver category — GCS/local modules 디스크 + SaaS tenant prefix */
    private const STORAGE_CATEGORY = 'settings';

    private const FRONTEND_DEFAULTS_REVISION_FILENAME = '_frontend_defaults_revision';

    private ?array $defaults = null;

    private ?array $settings = null;

    public function __construct(
        private readonly ?StorageInterface $storage = null,
        private readonly ?TenantModuleCategoryJsonStore $tenantCategoryJsonStore = null,
    ) {}

    /**
     * 모듈 설정 기본값 파일 경로를 반환합니다.
     */
    public function getSettingsDefaultsPath(): ?string
    {
        $path = $this->getModuleRootPath().'/config/settings/defaults.json';

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
        if ($this->hasTenantModuleWritesThisRequest()) {
            $this->settings = null;
        }

        if ($this->settings !== null) {
            return $this->settings;
        }

        $this->ensureModuleDiskTenantScope();

        $defaults = $this->getDefaults();
        $categories = $defaults['_meta']['categories'] ?? [];
        $defaultValues = $defaults['defaults'] ?? [];

        $settings = [];
        foreach ($categories as $category) {
            $settings[$category] = $this->mergeCategoryDefaults(
                $category,
                $defaultValues[$category] ?? [],
                $this->loadCategorySettings($category),
            );
        }

        $settings = $this->normalizeSettingsData($settings, $defaultValues);
        if (isset($settings['mypage']) && is_array($settings['mypage'])) {
            $settings['mypage'] = $this->applyMypageMenuCatalogFromDefaults(
                $settings['mypage'],
                is_array($defaultValues['mypage'] ?? null) ? $defaultValues['mypage'] : [],
            );
        }
        if (isset($settings['appearance']) && is_array($settings['appearance'])) {
            $settings['appearance'] = $this->stripLegacyAppearanceDefaultKeys($settings['appearance']);
            $settings['appearance'] = $this->enrichAppearanceForResponse($settings['appearance']);
        }
        if (isset($settings['preferences']) && is_array($settings['preferences'])) {
            $settings['preferences'] = $this->normalizePreferencesSystemOptionsLegacy($settings['preferences']);
        }

        $this->settings = $settings;

        return $this->settings;
    }

    /**
     * 설정을 저장합니다.
     *
     * @param  array<string, mixed>  $settings
     */
    public function saveSettings(array $settings): bool
    {
        $this->ensureModuleDiskTenantScope();

        $success = true;
        $defaultValues = $this->getDefaults()['defaults'] ?? [];
        $wroteAny = false;

        foreach ($settings as $category => $categorySettings) {
            if (str_starts_with($category, '_') || ! is_array($categorySettings)) {
                continue;
            }

            if ($this->shouldUseTenantCategoryJsonStore() && $category === 'appearance') {
                continue;
            }

            $categoryDefaults = $defaultValues[$category] ?? [];
            $processedSettings = $this->normalizeCategoryData($categorySettings, $categoryDefaults);
            if ($category === 'mypage') {
                $processedSettings = $this->stripMypageMenuCatalogForStorage($processedSettings);
            }
            if ($category === 'preferences') {
                $processedSettings = $this->stripLegacySystemOptionDefaultKey($processedSettings);
            }
            if ($this->saveCategorySettings($category, $processedSettings)) {
                $wroteAny = true;
            } else {
                $success = false;
            }
        }

        if ($success && $wroteAny) {
            $this->bumpFrontendDefaultsRevision();
        }

        $this->settings = null;

        return $success;
    }

    /**
     * TenantSettingsPlane — Writer가 merge 완료한 스냅샷을 카테고리 파일로 atomic replace.
     *
     * @param  array<string, mixed>  $settings
     */
    public function replaceSettings(array $settings): bool
    {
        $this->ensureModuleDiskTenantScope();

        $success = true;
        $defaultValues = $this->getDefaults()['defaults'] ?? [];
        $wroteAny = false;
        $useTenantStore = $this->shouldUseTenantCategoryJsonStore();

        foreach ($settings as $category => $categorySettings) {
            if (str_starts_with($category, '_') || ! is_array($categorySettings)) {
                continue;
            }

            $categoryDefaults = $defaultValues[$category] ?? [];
            $processedSettings = $this->normalizeCategoryData($categorySettings, $categoryDefaults);
            if ($category === 'mypage') {
                $processedSettings = $this->stripMypageMenuCatalogForStorage($processedSettings);
            }
            if ($category === 'preferences') {
                $processedSettings = $this->stripLegacySystemOptionDefaultKey($processedSettings);
            }
            if ($category === 'appearance') {
                $processedSettings = $this->stripAppearanceForStorage($processedSettings);
            }

            $written = $useTenantStore
                ? $this->tenantCategoryJsonStore()->replace($category, $processedSettings)
                : $this->writeCategorySettings($category, $processedSettings);

            if ($written) {
                $wroteAny = true;
            } else {
                $success = false;
            }
        }

        if ($success && $wroteAny) {
            $this->bumpFrontendDefaultsRevision();
        }

        $this->settings = null;

        return $success;
    }

    /**
     * 프론트엔드 노출 설정을 조회합니다.
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

    public function getFrontendDefaultsRevision(): int
    {
        $this->ensureModuleDiskTenantScope();

        $content = $this->moduleStorage()->get(
            self::STORAGE_CATEGORY,
            self::FRONTEND_DEFAULTS_REVISION_FILENAME,
        );

        if ($content === null || trim($content) === '') {
            return 0;
        }

        return max(0, (int) trim($content));
    }

    /**
     * 설정 캐시를 초기화합니다.
     */
    public function clearCache(): void
    {
        $this->defaults = null;
        $this->settings = null;
    }

    private function hasTenantModuleWritesThisRequest(): bool
    {
        foreach (['mypage', 'appearance', 'preferences'] as $category) {
            if (TenantModuleCategoryJsonStore::wasWrittenThisRequest($category)) {
                return true;
            }
        }

        return false;
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

        $this->defaults = json_decode((string) file_get_contents($path), true) ?? [];

        return $this->defaults;
    }

    /**
     * defaults + stored merge. appearance 의 list 필드는 stored 가 전체 스냅샷(replace) — recursive index merge 금지.
     *
     * @param  array<string, mixed>  $defaults
     * @param  array<string, mixed>  $stored
     * @return array<string, mixed>
     */
    private function mergeCategoryDefaults(string $category, array $defaults, array $stored): array
    {
        if ($stored === []) {
            return $defaults;
        }

        $merged = array_replace_recursive($defaults, $stored);

        if ($category !== 'appearance') {
            return $merged;
        }

        if (array_key_exists('point_color_presets', $stored)) {
            $merged['point_color_presets'] = $stored['point_color_presets'];
        }

        if (array_key_exists('home_background_items', $stored)) {
            $merged['home_background_items'] = $stored['home_background_items'];
        }

        return $merged;
    }

    private function loadCategorySettings(string $category): array
    {
        $this->ensureModuleDiskTenantScope();

        if ($this->shouldUseTenantCategoryJsonStore()
            || TenantModuleCategoryJsonStore::wasWrittenThisRequest($category)) {
            return $this->tenantCategoryJsonStore()->read($category);
        }

        $content = $this->moduleStorage()->get(self::STORAGE_CATEGORY, "{$category}.json");

        if ($content === null || $content === '') {
            return [];
        }

        if (! $this->isValidCategoryJson($content)) {
            $this->moduleStorage()->delete(self::STORAGE_CATEGORY, "{$category}.json");

            return [];
        }

        $decoded = json_decode(trim($content), true);

        return is_array($decoded) ? $decoded : [];
    }

    /**
     * 카테고리 설정을 저장합니다 (legacy admin/settings partial PATCH — stored merge).
     *
     * @param  array<string, mixed>  $settings
     */
    private function saveCategorySettings(string $category, array $settings): bool
    {
        $this->ensureModuleDiskTenantScope();

        if ($this->shouldUseTenantCategoryJsonStore()) {
            if (TenantModuleCategoryJsonStore::wasWrittenThisRequest($category)) {
                return true;
            }

            if ($category === 'appearance') {
                return false;
            }

            // SaaS에서는 module category 저장을 TenantModuleCategoryJsonStore 단일 경로로 고정한다.
            // legacy saveSettings() 경로에서도 mypage/preferences가 파일 경로로 빠지지 않게 한다.
            if ($this->shouldMergeWithStoredCategory($category, $settings)) {
                $existing = $this->tenantCategoryJsonStore()->read($category);
                $settings = $this->mergeCategorySettings($category, $existing, $settings);
            }

            return $this->tenantCategoryJsonStore()->replace($category, $settings);
        }

        if ($this->shouldMergeWithStoredCategory($category, $settings)) {
            $existing = $this->loadCategorySettings($category);
            $settings = $this->mergeCategorySettings($category, $existing, $settings);
        }

        return $this->writeCategorySettings($category, $settings);
    }

    /**
     * 카테고리 JSON atomic replace — delete 후 put (GCS partial overwrite·concat 방지).
     *
     * @param  array<string, mixed>  $settings
     */
    private function writeCategorySettings(string $category, array $settings): bool
    {
        $this->ensureModuleDiskTenantScope();

        if ($category === 'appearance') {
            $settings = $this->stripAppearanceForStorage($settings);
        }

        $json = json_encode($settings, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        if ($json === false || ! $this->isValidCategoryJson($json)) {
            return false;
        }

        $path = "{$category}.json";
        $this->moduleStorage()->delete(self::STORAGE_CATEGORY, $path);

        return $this->moduleStorage()->put(self::STORAGE_CATEGORY, $path, $json);
    }

    private function isValidCategoryJson(string $content): bool
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

    private function getModuleRootPath(): string
    {
        $identifier = self::MODULE_IDENTIFIER;
        $active = base_path('modules/'.$identifier);
        if (is_file($active.'/module.php')) {
            return $active;
        }

        return $active;
    }

    /**
     * Tenant GCS appearance.json raw → admin/tenant-settings GET shape (defaults merge + url enrich).
     *
     * @param  array<string, mixed>  $storedAppearance
     * @return array<string, mixed>
     */
    public function buildAppearanceApiResponse(array $storedAppearance): array
    {
        $this->ensureModuleDiskTenantScope();

        $defaults = $this->getDefaults()['defaults']['appearance'] ?? [];
        if (! is_array($defaults)) {
            $defaults = [];
        }

        $merged = $this->mergeCategoryDefaults('appearance', $defaults, $storedAppearance);

        return $this->enrichAppearanceForResponse($merged);
    }

    /**
     * Tenant GCS module JSON raw → admin API shape (mypage·preferences).
     *
     * @param  array<string, mixed>  $stored
     * @return array<string, mixed>
     */
    public function buildModuleCategoryApiResponse(string $category, array $stored): array
    {
        $this->ensureModuleDiskTenantScope();

        $defaults = $this->getDefaults()['defaults'][$category] ?? [];
        if (! is_array($defaults)) {
            $defaults = [];
        }

        $merged = $this->mergeCategoryDefaults($category, $defaults, $stored);
        $merged = $this->normalizeCategoryData($merged, $defaults);

        if ($category === 'mypage') {
            $merged = $this->applyMypageMenuCatalogFromDefaults($merged, $defaults);
        }

        if ($category === 'preferences') {
            $merged = $this->stripLegacySystemOptionDefaultKey($merged);
        }

        return $merged;
    }

    /**
     * 조회 응답용: 업로드 배경 항목에 공개 URL을 붙입니다.
     *
     * @param  array<string, mixed>  $appearance
     * @return array<string, mixed>
     */
    private function enrichAppearanceForResponse(array $appearance): array
    {
        $items = $appearance['home_background_items'] ?? null;
        if (! is_array($items) || $items === []) {
            return $appearance;
        }

        $appearance['home_background_items'] = array_map(function ($item) {
            if (! is_array($item)) {
                return $item;
            }
            $id = $item['id'] ?? '';
            if (! Str::isUuid((string) $id)) {
                return $item;
            }

            // 구 저장본(mode/point_color 누락) 호환 — 응답에는 항상 완전한 형태로 반환
            if (! in_array($item['mode'] ?? null, ['light', 'dark'], true)) {
                $item['mode'] = 'light';
            }
            $hex = $item['point_color'] ?? null;
            if (! is_string($hex) || preg_match('/^#[0-9a-fA-F]{6}$/', $hex) !== 1) {
                $item['point_color'] = null;
            }

            $item['url'] = '/api/modules/moabom-system/home-backgrounds/'.$id.'/full';
            $item['thumb_url'] = '/api/modules/moabom-system/home-backgrounds/'.$id.'/thumb';

            return $item;
        }, $items);

        return $appearance;
    }

    /**
     * 과거 `default` 키로 저장된 system_options 행을 `on_by_default` 로 승격합니다.
     *
     * @param  array<string, mixed>  $preferences
     * @return array<string, mixed>
     */
    private function normalizePreferencesSystemOptionsLegacy(array $preferences): array
    {
        $options = $preferences['system_options'] ?? null;
        if (! is_array($options)) {
            return $preferences;
        }

        foreach ($options as $i => $row) {
            if (! is_array($row)) {
                continue;
            }
            if (! array_key_exists('on_by_default', $row) && array_key_exists('default', $row)) {
                $row['on_by_default'] = (bool) $row['default'];
            }
            unset($row['default']);
            $options[$i] = $row;
        }

        $preferences['system_options'] = $options;

        return $preferences;
    }

    /**
     * 저장 시 `default` 키는 제거합니다(JS 예약어·폼 바인딩 이슈).
     *
     * @param  array<string, mixed>  $preferences
     * @return array<string, mixed>
     */
    private function stripLegacySystemOptionDefaultKey(array $preferences): array
    {
        $options = $preferences['system_options'] ?? null;
        if (! is_array($options)) {
            return $preferences;
        }

        foreach ($options as $i => $row) {
            if (is_array($row)) {
                unset($row['default']);
                $options[$i] = $row;
            }
        }

        $preferences['system_options'] = $options;

        return $preferences;
    }

    private function bumpFrontendDefaultsRevision(): void
    {
        $next = $this->getFrontendDefaultsRevision() + 1;
        $this->moduleStorage()->put(
            self::STORAGE_CATEGORY,
            self::FRONTEND_DEFAULTS_REVISION_FILENAME,
            (string) $next,
        );
    }

    private function moduleStorage(): StorageInterface
    {
        return $this->storage ?? new ModuleStorageDriver(self::MODULE_IDENTIFIER, 'modules');
    }

    private function tenantCategoryJsonStore(): TenantModuleCategoryJsonStore
    {
        return $this->tenantCategoryJsonStore ?? app(TenantModuleCategoryJsonStore::class);
    }

    private function shouldUseTenantCategoryJsonStore(): bool
    {
        return (bool) config('moabom-system.saas.enabled', false);
    }

    private function ensureModuleDiskTenantScope(): void
    {
        if (! app()->bound(TenantModuleStorageScope::class)) {
            return;
        }

        app(TenantModuleStorageScope::class)->ensureApplied();
    }

    /**
     * 카테고리 저장 merge — scalar indexed 배열(point_color_presets)은 replace, 나머지는 deep merge.
     *
     * @param  array<string, mixed>  $existing
     * @param  array<string, mixed>  $incoming
     * @return array<string, mixed>
     */
    private function mergeCategorySettings(string $category, array $existing, array $incoming): array
    {
        $merged = array_replace_recursive($existing, $incoming);

        if ($category === 'appearance' && array_key_exists('point_color_presets', $incoming)) {
            $merged['point_color_presets'] = array_values($incoming['point_color_presets']);
        }

        if ($category === 'appearance' && array_key_exists('home_background_items', $incoming)) {
            $merged['home_background_items'] = array_values($incoming['home_background_items']);
        }

        return $merged;
    }

    /**
     * TenantSettingsWriter 가 defaults+stored 를 merge 한 complete payload 는 replace 저장.
     * legacy admin/settings partial PATCH 만 stored 와 merge.
     *
     * @param  array<string, mixed>  $settings
     */
    private function shouldMergeWithStoredCategory(string $category, array $settings): bool
    {
        if ($category !== 'appearance') {
            return true;
        }

        return ! $this->isCompleteAppearancePayload($settings);
    }

    /**
     * @param  array<string, mixed>  $appearance
     */
    private function isCompleteAppearancePayload(array $appearance): bool
    {
        return array_key_exists('themes', $appearance)
            || array_key_exists('home_background_items', $appearance);
    }

    /**
     * 저장용: 업로드 배경 항목을 정규화한다.
     *
     * 필드:
     *  - `id` (UUID 필수) — 업로드 식별자
     *  - `mode` (`light` | `dark`) — 항목이 노출될 테마 모드. 미지정 시 `light` 로 저장.
     *  - `point_color` (`#rrggbb` 또는 null) — 이 배경에 바인딩되는 포인트 컬러 hex.
     *    **유일성 보장**: 같은 hex 가 여러 배경에 지정되면 첫 번째 항목만 유지하고 나머지는 null 로 치환한다.
     *
     * @param  array<string, mixed>  $appearance
     * @return array<string, mixed>
     */
    private function stripAppearanceForStorage(array $appearance): array
    {
        $items = $appearance['home_background_items'] ?? null;
        if (! is_array($items)) {
            return $this->stripLegacyAppearanceDefaultKeys($appearance);
        }

        $normalized = array_values(array_filter(array_map(function ($item) {
            if (! is_array($item)) {
                return null;
            }
            $id = $item['id'] ?? '';
            if (! Str::isUuid((string) $id)) {
                return null;
            }

            $mode = $item['mode'] ?? null;
            if (! in_array($mode, ['light', 'dark'], true)) {
                $mode = 'light';
            }

            $pointColor = $item['point_color'] ?? null;
            if (is_string($pointColor) && preg_match('/^#[0-9a-fA-F]{6}$/', $pointColor)) {
                $pointColor = strtolower($pointColor);
            } else {
                $pointColor = null;
            }

            $row = [
                'id' => $id,
                'mode' => $mode,
            ];
            if ($pointColor !== null) {
                $row['point_color'] = $pointColor;
            }

            return $row;
        }, $items), fn ($row) => $row !== null));

        // 포인트 컬러 유일성: 같은 hex 가 여러 배경에 있으면 첫 번째만 유지
        $seenColors = [];
        foreach ($normalized as $idx => $row) {
            $hex = $row['point_color'] ?? null;
            if ($hex === null) {
                continue;
            }
            if (isset($seenColors[$hex])) {
                $normalized[$idx]['point_color'] = null;

                continue;
            }
            $seenColors[$hex] = true;
        }

        $appearance['home_background_items'] = $normalized;

        return $this->stripLegacyAppearanceDefaultKeys($appearance);
    }

    /**
     * @param  array<string, mixed>  $appearance
     * @return array<string, mixed>
     */
    private function stripLegacyAppearanceDefaultKeys(array $appearance): array
    {
        foreach (['default_theme', 'default_point_color', 'default_background_image_id', 'background_image_ids', 'include_template_backgrounds'] as $key) {
            unset($appearance[$key]);
        }

        return $appearance;
    }

    /**
     * 마이페이지 메뉴 label·description·icon 은 defaults.json 카탈로그 SSOT.
     * 테넌트 저장본의 구 명칭(앱 보관함·내 활동 등)이 조회·관리자 UI에 남지 않도록 id 기준으로 덮어씁니다.
     *
     * @param  array<string, mixed>  $mypage
     * @param  array<string, mixed>  $defaultsMypage
     * @return array<string, mixed>
     */
    private function applyMypageMenuCatalogFromDefaults(array $mypage, array $defaultsMypage): array
    {
        $defaultMenus = $defaultsMypage['menus'] ?? null;
        if (! is_array($defaultMenus) || $defaultMenus === []) {
            return $mypage;
        }

        $catalogById = [];
        foreach ($defaultMenus as $row) {
            if (is_array($row) && isset($row['id'])) {
                $catalogById[(string) $row['id']] = $row;
            }
        }

        $menus = $mypage['menus'] ?? null;
        if (! is_array($menus)) {
            return $mypage;
        }

        $mypage['menus'] = array_values(array_map(function ($row) use ($catalogById) {
            if (! is_array($row)) {
                return $row;
            }

            $id = (string) ($row['id'] ?? '');
            $catalog = $catalogById[$id] ?? null;
            if (! is_array($catalog)) {
                return $row;
            }

            return array_merge($row, [
                'label' => $catalog['label'] ?? $row['label'] ?? '',
                'description' => $catalog['description'] ?? $row['description'] ?? null,
                'icon' => $catalog['icon'] ?? $row['icon'] ?? null,
            ]);
        }, $menus));

        return $mypage;
    }

    /**
     * 마이페이지 메뉴 저장 시 카탈로그 필드는 제외 — enabled·guest_enabled·order 만 유지.
     *
     * @param  array<string, mixed>  $mypage
     * @return array<string, mixed>
     */
    private function stripMypageMenuCatalogForStorage(array $mypage): array
    {
        $menus = $mypage['menus'] ?? null;
        if (! is_array($menus)) {
            return $mypage;
        }

        $mypage['menus'] = array_values(array_map(function ($row) {
            if (! is_array($row)) {
                return $row;
            }

            return array_intersect_key($row, array_flip(['id', 'enabled', 'guest_enabled', 'order']));
        }, $menus));

        return $mypage;
    }
}
