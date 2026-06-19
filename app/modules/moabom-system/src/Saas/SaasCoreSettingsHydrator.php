<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

use App\Contracts\Repositories\ConfigRepositoryInterface;
use Illuminate\Support\Facades\Config;
use Modules\Moabom\System\Broadcasting\WebsocketDriverConfigApplier;

/**
 * SaaS 런타임 G7 코어 설정 hydration (단일 진입점).
 *
 * G7 SettingsServiceProvider::boot() 는 워커 기동 1회·tenant prefix 적용 전에 실행된다.
 * Cloud Run 다중 인스턴스에서는 config('app.name'), g7_settings.core.* 가 GCS SSOT 와 어긋난다.
 *
 * ResolveMoabomTenant 직후 1회 hydrate() 로 G7 부트스트랩과 동일한 config 주입을 재현한다.
 * cache/upload/debug·스토리지/세션/큐 드라이버는 Run 인프라(env)를 덮어쓰지 않는다.
 * drivers.websocket_* 만 hydrate 시 Laravel broadcasting·g7.websocket.client 에 반영한다.
 */
final class SaasCoreSettingsHydrator
{
    /** @var list<string> SettingsServiceProvider::CORE_CATEGORIES 와 동일 */
    private const CORE_CATEGORIES = [
        'mail',
        'general',
        'security',
        'debug',
        'drivers',
        'cache',
        'upload',
        'core_update',
        'geoip',
        'seo',
    ];

    /** @var array<string, array<string, mixed>>|null */
    private ?array $snapshot = null;

    public function __construct(
        private readonly ConfigRepositoryInterface $configRepository,
    ) {}

    public function resetSnapshot(): void
    {
        $this->snapshot = null;
    }

    public function hydrate(): void
    {
        if (! config('moabom-system.saas.enabled', false)) {
            return;
        }

        $this->snapshot = $this->configRepository->all();

        $this->loadCoreSettingsToConfig($this->snapshot);
        $this->applyGeneralRuntime($this->snapshot['general'] ?? []);
        $this->applyMailRuntime($this->snapshot['mail'] ?? []);
        $this->applyGeoIpRuntime($this->snapshot['geoip'] ?? []);
        $this->applyCoreUpdateRuntime($this->snapshot['core_update'] ?? []);
        $this->applyDriversWebsocketRuntime($this->snapshot['drivers'] ?? []);
    }

    /** 공개 HTML·부트 API 캐시 키 — general·seo 변경 시 자동 miss */
    public function settingsRevisionToken(): string
    {
        if (! config('moabom-system.saas.enabled', false)) {
            return '0';
        }

        $source = $this->snapshot ?? $this->configRepository->all();
        $relevant = [];
        foreach (['general', 'seo'] as $category) {
            if (! empty($source[$category]) && is_array($source[$category])) {
                $relevant[$category] = $source[$category];
            }
        }

        if ($relevant === []) {
            return '0';
        }

        ksort($relevant);

        return md5(json_encode($relevant, JSON_UNESCAPED_UNICODE) ?: '');
    }

    /**
     * @param  array<string, array<string, mixed>>  $all
     */
    private function loadCoreSettingsToConfig(array $all): void
    {
        $coreSettings = [];

        foreach (self::CORE_CATEGORIES as $category) {
            if (! empty($all[$category])) {
                $coreSettings[$category] = $all[$category];
            }
        }

        Config::set('g7_settings.core', $coreSettings);
    }

    /**
     * @param  array<string, mixed>  $general
     */
    private function applyGeneralRuntime(array $general): void
    {
        if ($general === []) {
            return;
        }

        if (! empty($general['site_name'])) {
            Config::set('app.name', $this->resolveScalarSetting($general['site_name']));
        }

        // app.url 은 ResolveMoabomTenant 가 Host 기준으로 설정 — general.site_url 로 덮어쓰지 않음

        if (! empty($general['timezone'])) {
            Config::set('app.default_user_timezone', $general['timezone']);
        }

        if (! empty($general['language'])) {
            Config::set('app.locale', $general['language']);
        }
    }

    /**
     * @param  array<string, mixed>  $mailSettings
     */
    private function applyMailRuntime(array $mailSettings): void
    {
        if ($mailSettings === []) {
            return;
        }

        if (! empty($mailSettings['mailer'])) {
            Config::set('mail.default', $mailSettings['mailer']);
        }

        if (! empty($mailSettings['host'])) {
            Config::set('mail.mailers.smtp.host', $mailSettings['host']);
        }

        if (! empty($mailSettings['port'])) {
            Config::set('mail.mailers.smtp.port', (int) $mailSettings['port']);
        }

        if (! empty($mailSettings['username'])) {
            Config::set('mail.mailers.smtp.username', $mailSettings['username']);
        }

        if (! empty($mailSettings['password'])) {
            Config::set('mail.mailers.smtp.password', $mailSettings['password']);
        }

        if (isset($mailSettings['encryption'])) {
            Config::set('mail.mailers.smtp.encryption', $mailSettings['encryption'] ?: null);
        }

        if (! empty($mailSettings['from_address'])) {
            Config::set('mail.from.address', $mailSettings['from_address']);
        }

        if (! empty($mailSettings['from_name'])) {
            Config::set('mail.from.name', $mailSettings['from_name']);
        }
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function applyGeoIpRuntime(array $settings): void
    {
        if ($settings === []) {
            return;
        }

        if (isset($settings['feature_enabled'])) {
            Config::set('geoip.enabled', (bool) $settings['feature_enabled']);
        }

        if (! empty($settings['license_key'])) {
            Config::set('geoip.license_key', $settings['license_key']);
        }

        if (isset($settings['auto_update_enabled'])) {
            Config::set('geoip.auto_update_enabled', (bool) $settings['auto_update_enabled']);
        }

        if (! empty($settings['last_updated_at'])) {
            Config::set('geoip.last_updated_at', $settings['last_updated_at']);
        }
    }

    /**
     * @param  array<string, mixed>  $settings
     */
    private function applyCoreUpdateRuntime(array $settings): void
    {
        if ($settings === []) {
            return;
        }

        if (! empty($settings['github_url'])) {
            Config::set('app.update.github_url', $settings['github_url']);
        }

        if (! empty($settings['github_token'])) {
            Config::set('app.update.github_token', $settings['github_token']);
        }
    }

    /**
     * @param  array<string, mixed>  $drivers
     */
    private function applyDriversWebsocketRuntime(array $drivers): void
    {
        if ($drivers === []) {
            return;
        }

        WebsocketDriverConfigApplier::apply($drivers);
    }

    private function resolveScalarSetting(mixed $value): string
    {
        if (is_string($value)) {
            return $value;
        }

        if (is_array($value)) {
            $locale = app()->getLocale();
            if (isset($value[$locale]) && is_string($value[$locale]) && $value[$locale] !== '') {
                return $value[$locale];
            }

            foreach ($value as $item) {
                if (is_string($item) && $item !== '') {
                    return $item;
                }
            }
        }

        return is_scalar($value) ? (string) $value : '';
    }
}
