<?php

namespace Modules\Moabom\Social\Auth\Services;

use App\Contracts\Extension\ModuleSettingsInterface;
use App\Traits\NormalizesSettingsData;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Social\Auth\Contracts\SocialSettingsServiceInterface;
use Modules\Moabom\Social\Auth\Models\SocialAuthSetting;
use Modules\Moabom\Social\Auth\Support\SocialAuthProviders;
use Modules\Moabom\System\Saas\SaasMysqlPdoFactory;

class SocialAuthSettingsService implements ModuleSettingsInterface, SocialSettingsServiceInterface
{
    use NormalizesSettingsData;

    private const MODULE_IDENTIFIER = 'moabom-social-auth';

    private const BROKER_PROVIDER_KEY = '__broker';

    private ?array $defaults = null;

    private ?array $settings = null;

    private ?string $lastError = null;

    public function getSettingsDefaultsPath(): ?string
    {
        $path = $this->getModulePath().'/config/settings/defaults.json';

        return file_exists($path) ? $path : null;
    }

    public function getSetting(string $key, mixed $default = null): mixed
    {
        return Arr::get($this->getAllSettings(), $key, $default);
    }

    public function setSetting(string $key, mixed $value): bool
    {
        $settings = $this->getAllSettings();
        Arr::set($settings, $key, $value);

        $category = explode('.', $key)[0];

        return $this->saveCategorySettings($category, $settings[$category] ?? []);
    }

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

    public function getSettings(string $category): array
    {
        return $this->getAllSettings()[$category] ?? [];
    }

    public function saveSettings(array $settings): bool
    {
        $this->lastError = null;
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

            if ($category === 'providers') {
                $processedSettings = $this->stripBlankProviderRedirectUris($processedSettings);
                $processedSettings = $this->stripProviderCredentialsWhenUsingMasterDefaults($processedSettings);
            }

            if (! $this->saveCategorySettings($category, $processedSettings)) {
                $success = false;
            }
        }

        $this->settings = null;

        return $success;
    }

    public function getLastError(): ?string
    {
        return $this->lastError;
    }

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

    public function clearCache(): void
    {
        $this->defaults = null;
        $this->settings = null;
    }

    public function isSubTenantHostRequest(): bool
    {
        return $this->isSubTenantHost();
    }

    public function getPlatformMasterCredential(string $provider, string $key): ?string
    {
        if (! in_array($provider, SocialAuthProviders::all(), true)) {
            return null;
        }

        if (! in_array($key, ['client_id', 'client_secret'], true)) {
            return null;
        }

        $master = $this->loadPlatformMasterProviders(true);
        $value = $master["{$provider}_{$key}"] ?? null;

        return is_string($value) && trim($value) !== '' ? trim($value) : null;
    }

    /**
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
     * @return array<string, mixed>
     */
    private function loadCategorySettings(string $category): array
    {
        if ($category !== 'providers') {
            return [];
        }

        if (! Schema::hasTable('social_auth_settings')) {
            return [];
        }

        $this->migrateLegacyProvidersIfNeeded();
        $this->ensureDatabaseDefaultsIfMissing();

        $isSubTenantHost = $this->isSubTenantHost();

        $rows = SocialAuthSetting::query()
            ->whereIn('provider', array_merge(SocialAuthProviders::all(), [self::BROKER_PROVIDER_KEY]))
            ->get()
            ->keyBy('provider');

        $platformMaster = $isSubTenantHost ? $this->loadPlatformMasterProviders(true) : [];

        $settings = [];
        foreach (SocialAuthProviders::all() as $provider) {
            /** @var SocialAuthSetting|null $row */
            $row = $rows->get($provider);
            $settings["{$provider}_enabled"] = (bool) ($row?->enabled ?? false);
            $settings["{$provider}_use_master_defaults"] = $isSubTenantHost ? true : (bool) ($row?->use_master_defaults ?? false);
            $settings["{$provider}_client_id"] = (string) ($row?->client_id ?? '');
            $settings["{$provider}_client_secret"] = (string) ($row?->client_secret ?? '');
            $settings["{$provider}_redirect_uri"] = (string) ($row?->redirect_uri ?? '');
        }

        $settings['google_request_auth_time'] = (bool) ($rows->get('google')?->google_request_auth_time ?? false);
        $settings['kakao_use_client_secret'] = (bool) ($rows->get('kakao')?->kakao_use_client_secret ?? true);

        /** @var SocialAuthSetting|null $brokerRow */
        $brokerRow = $rows->get(self::BROKER_PROVIDER_KEY);
        $broker = is_array($brokerRow?->extra_json) ? $brokerRow->extra_json : [];
        $settings['broker_enabled'] = (bool) ($broker['broker_enabled'] ?? ($this->isSaasEnabled() && ! $isSubTenantHost));
        $settings['broker_host'] = (string) ($broker['broker_host'] ?? '');
        $settings['broker_scheme'] = (string) ($broker['broker_scheme'] ?? 'https');
        $settings['broker_state_ttl_seconds'] = (int) ($broker['broker_state_ttl_seconds'] ?? 300);

        if ($isSubTenantHost && $platformMaster !== []) {
            foreach (SocialAuthProviders::all() as $provider) {
                $settings["{$provider}_use_master_defaults"] = true;
                $settings["{$provider}_client_id"] = (string) ($platformMaster["{$provider}_client_id"] ?? '');
                $settings["{$provider}_client_secret"] = (string) ($platformMaster["{$provider}_client_secret"] ?? '');
            }

            $settings['google_request_auth_time'] = (bool) ($platformMaster['google_request_auth_time'] ?? $settings['google_request_auth_time']);
            $settings['kakao_use_client_secret'] = (bool) ($platformMaster['kakao_use_client_secret'] ?? $settings['kakao_use_client_secret']);

            foreach (['broker_enabled', 'broker_host', 'broker_scheme', 'broker_state_ttl_seconds'] as $brokerKey) {
                if (array_key_exists($brokerKey, $platformMaster)) {
                    $settings[$brokerKey] = $platformMaster[$brokerKey];
                }
            }
        }

        return $settings;
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function saveCategorySettings(string $category, array $settings): bool
    {
        if ($category !== 'providers') {
            return true;
        }

        if (! Schema::hasTable('social_auth_settings')) {
            $this->lastError = 'social_auth_settings table is missing';
            return false;
        }

        return $this->persistProvidersToDatabase($settings);
    }

    /**
     * @param  array<string, mixed>  $settings
     * @return array<string, mixed>
     */
    private function stripBlankProviderRedirectUris(array $settings): array
    {
        foreach (SocialAuthProviders::all() as $provider) {
            $key = "{$provider}_redirect_uri";
            if (! array_key_exists($key, $settings)) {
                continue;
            }

            $value = $settings[$key];
            if ($value === null) {
                unset($settings[$key]);

                continue;
            }

            if (is_string($value) && trim($value) === '') {
                unset($settings[$key]);
            }
        }

        return $settings;
    }

    /**
     * @param  array<string, mixed>  $settings
     * @return array<string, mixed>
     */
    private function stripProviderCredentialsWhenUsingMasterDefaults(array $settings): array
    {
        // 마스터(플랫폼)에서는 입력한 키/시크릿을 저장해야 하므로 값 제거를 적용하지 않는다.
        if (! $this->isSubTenantHost()) {
            return $settings;
        }

        foreach (SocialAuthProviders::all() as $provider) {
            $useMasterKey = "{$provider}_use_master_defaults";
            if (! (bool) ($settings[$useMasterKey] ?? true)) {
                continue;
            }

            unset($settings["{$provider}_client_id"], $settings["{$provider}_client_secret"]);
        }

        return $settings;
    }

    private function getModulePath(): string
    {
        return base_path('modules/'.self::MODULE_IDENTIFIER);
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function persistProvidersToDatabase(array $settings): bool
    {
        try {
            $isSubTenantHost = $this->isSubTenantHost();

            DB::transaction(function () use ($settings, $isSubTenantHost): void {
                foreach (SocialAuthProviders::all() as $provider) {
                    if ($isSubTenantHost) {
                        /** @var SocialAuthSetting $row */
                        $row = SocialAuthSetting::query()->firstOrCreate(
                            ['provider' => $provider],
                            [
                                'enabled' => false,
                                'use_master_defaults' => true,
                                'client_id' => null,
                                'client_secret' => null,
                                'redirect_uri' => null,
                                'google_request_auth_time' => false,
                                'kakao_use_client_secret' => true,
                                'extra_json' => null,
                            ]
                        );

                        $row->enabled = (bool) ($settings["{$provider}_enabled"] ?? false);
                        $row->use_master_defaults = true;
                        $row->client_id = null;
                        $row->client_secret = null;
                        $row->save();

                        continue;
                    }

                    SocialAuthSetting::query()->updateOrCreate(
                        ['provider' => $provider],
                        [
                            'enabled' => (bool) ($settings["{$provider}_enabled"] ?? false),
                            'use_master_defaults' => false,
                            'client_id' => $this->sanitizeNullableText($settings["{$provider}_client_id"] ?? null),
                            'client_secret' => $this->sanitizeNullableText($settings["{$provider}_client_secret"] ?? null),
                            'redirect_uri' => $this->sanitizeNullableText($settings["{$provider}_redirect_uri"] ?? null),
                            'google_request_auth_time' => $provider === 'google'
                                ? (bool) ($settings['google_request_auth_time'] ?? false)
                                : false,
                            'kakao_use_client_secret' => $provider === 'kakao'
                                ? (bool) ($settings['kakao_use_client_secret'] ?? true)
                                : true,
                            'extra_json' => null,
                        ]
                    );
                }

                if ($isSubTenantHost) {
                    return;
                }

                SocialAuthSetting::query()->updateOrCreate(
                    ['provider' => self::BROKER_PROVIDER_KEY],
                    [
                        'enabled' => false,
                        'use_master_defaults' => true,
                        'client_id' => null,
                        'client_secret' => null,
                        'redirect_uri' => null,
                        'google_request_auth_time' => false,
                        'kakao_use_client_secret' => true,
                        'extra_json' => [
                            'broker_enabled' => (bool) ($settings['broker_enabled'] ?? false),
                            'broker_host' => trim((string) ($settings['broker_host'] ?? '')),
                            'broker_scheme' => in_array(($settings['broker_scheme'] ?? 'https'), ['http', 'https'], true)
                                ? (string) $settings['broker_scheme']
                                : 'https',
                            'broker_state_ttl_seconds' => min(900, max(60, (int) ($settings['broker_state_ttl_seconds'] ?? 300))),
                        ],
                    ]
                );
            });
        } catch (\Throwable $e) {
            $this->lastError = $e->getMessage();
            return false;
        }

        return true;
    }

    private function migrateLegacyProvidersIfNeeded(): void
    {
        if (SocialAuthSetting::query()->exists()) {
            return;
        }

        $legacyPath = storage_path('app/modules/'.self::MODULE_IDENTIFIER.'/settings/providers.json');
        if (! File::exists($legacyPath)) {
            return;
        }

        $legacy = json_decode((string) File::get($legacyPath), true);
        if (! is_array($legacy) || $legacy === []) {
            return;
        }

        $defaults = $this->getDefaults()['defaults']['providers'] ?? [];
        if (! is_array($defaults)) {
            return;
        }

        $normalized = $this->normalizeCategoryData($legacy, $defaults);
        $normalized = $this->stripBlankProviderRedirectUris($normalized);
        $normalized = $this->stripProviderCredentialsWhenUsingMasterDefaults($normalized);
        $this->persistProvidersToDatabase($normalized);
    }

    private function ensureDatabaseDefaultsIfMissing(): void
    {
        if (SocialAuthSetting::query()->exists()) {
            return;
        }

        $defaults = $this->getDefaults()['defaults']['providers'] ?? [];
        if (! is_array($defaults) || $defaults === []) {
            return;
        }

        $normalized = $this->normalizeCategoryData($defaults, $defaults);
        $normalized = $this->stripBlankProviderRedirectUris($normalized);
        $normalized = $this->stripProviderCredentialsWhenUsingMasterDefaults($normalized);
        $this->persistProvidersToDatabase($normalized);
    }

    private function sanitizeNullableText(mixed $value): ?string
    {
        if (! is_string($value)) {
            return null;
        }

        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }

    /**
     * 플랫폼 DB에서 마스터 provider 설정을 로드합니다.
     *
     * @return array<string, mixed>
     */
    private function loadPlatformMasterProviders(bool $includeCredentials = false): array
    {
        // 플랫폼 host(mek360.com) SNS SSOT = write DB(moabom-db).
        // moabom-platform 은 SaaS 레지스트리(moabom_saas_tenants) 전용.
        $database = trim(SaasMysqlPdoFactory::platformWriteDatabase());
        if ($database === '' || ! preg_match('/^[A-Za-z0-9_-]+$/', $database)) {
            return [];
        }

        $physicalTable = $this->physicalSocialAuthSettingsTableName();
        $qualifiedTable = $this->qualifiedPlatformSocialAuthSettingsTable($database, $physicalTable);

        try {
            $exists = DB::selectOne(
                'SELECT 1 AS ok FROM information_schema.tables WHERE table_schema = ? AND table_name = ? LIMIT 1',
                [$database, $physicalTable],
            );
            if ($exists === null) {
                return [];
            }
        } catch (\Throwable) {
            return [];
        }

        $providers = array_merge(SocialAuthProviders::all(), [self::BROKER_PROVIDER_KEY]);
        $placeholders = implode(',', array_fill(0, count($providers), '?'));

        try {
            /** @var array<int, object> $rawRows */
            $rawRows = DB::select(
                "SELECT provider, enabled, client_id, client_secret, google_request_auth_time, kakao_use_client_secret, extra_json
                 FROM {$qualifiedTable}
                 WHERE provider IN ({$placeholders})",
                $providers,
            );
            $rows = collect($rawRows)->keyBy('provider');
        } catch (\Throwable) {
            return [];
        }

        if ($rows->isEmpty()) {
            return [];
        }

        $settings = [];
        foreach (SocialAuthProviders::all() as $provider) {
            $row = $rows->get($provider);
            $settings["{$provider}_enabled"] = (bool) ($row?->enabled ?? false);
            $settings["{$provider}_use_master_defaults"] = true;
            if ($includeCredentials) {
                $settings["{$provider}_client_id"] = $this->decryptSettingValue($row?->client_id ?? null);
                $settings["{$provider}_client_secret"] = $this->decryptSettingValue($row?->client_secret ?? null);
            }
        }

        $settings['google_request_auth_time'] = (bool) ($rows->get('google')?->google_request_auth_time ?? false);
        $settings['kakao_use_client_secret'] = (bool) ($rows->get('kakao')?->kakao_use_client_secret ?? true);

        $brokerRow = $rows->get(self::BROKER_PROVIDER_KEY);
        $brokerRaw = $brokerRow?->extra_json ?? null;
        $broker = is_array($brokerRaw) ? $brokerRaw : (json_decode((string) $brokerRaw, true) ?: []);

        $settings['broker_enabled'] = (bool) ($broker['broker_enabled'] ?? $this->isSaasEnabled());
        $settings['broker_host'] = (string) ($broker['broker_host'] ?? '');
        $settings['broker_scheme'] = (string) ($broker['broker_scheme'] ?? 'https');
        $settings['broker_state_ttl_seconds'] = (int) ($broker['broker_state_ttl_seconds'] ?? 300);

        return $settings;
    }

    private function physicalSocialAuthSettingsTableName(): string
    {
        return DB::connection()->getTablePrefix().(new SocialAuthSetting)->getTable();
    }

    private function qualifiedPlatformSocialAuthSettingsTable(string $database, string $physicalTable): string
    {
        if (! preg_match('/^[A-Za-z0-9_]+$/', $physicalTable)) {
            throw new \InvalidArgumentException('Invalid social auth settings table name.');
        }

        return "`{$database}`.`{$physicalTable}`";
    }

    private function decryptSettingValue(mixed $value): string
    {
        if (! is_string($value) || trim($value) === '') {
            return '';
        }

        try {
            return trim((string) decrypt($value, false));
        } catch (\Throwable) {
            return trim($value);
        }
    }

    private function isSubTenantHost(): bool
    {
        if (! $this->isSaasEnabled()) {
            return false;
        }

        if (app()->runningInConsole()) {
            return false;
        }

        $host = strtolower((string) request()->getHost());
        if ($host === '') {
            return false;
        }

        $platformHosts = array_map(
            static fn ($value): string => strtolower((string) $value),
            $this->platformHosts()
        );

        if (in_array($host, $platformHosts, true)) {
            return false;
        }

        $baseDomain = strtolower((string) ($this->saasConfig('base_domain') ?? ''));
        if ($baseDomain === '') {
            return false;
        }

        return str_ends_with($host, '.'.$baseDomain);
    }

    private function isSaasEnabled(): bool
    {
        return (bool) ($this->saasConfig('enabled') ?? false);
    }

    /**
     * @return array<int, string>
     */
    private function platformHosts(): array
    {
        $hosts = $this->saasConfig('platform_hosts');

        return is_array($hosts) ? $hosts : [];
    }

    private function saasConfig(string $key): mixed
    {
        $modern = config("moabom-saas.{$key}");
        if ($modern !== null) {
            return $modern;
        }

        return config("moabom-system.saas.{$key}");
    }
}
