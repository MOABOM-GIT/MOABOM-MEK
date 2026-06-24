<?php

declare(strict_types=1);

namespace Modules\Moabom\Social\Auth\Services;

use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Social\Auth\Models\SocialAuthSetting;
use Modules\Moabom\Social\Auth\Support\SocialAuthProviders;
use Modules\Moabom\System\Saas\PlatformRuntimeConfigurator;

/**
 * mek360.com(플랫폼 host) SNS credential SSOT — write DB(moabom-db)에 시드.
 *
 * moabom-platform 은 SaaS 레지스트리 전용이며 social_auth_settings 를 두지 않는다.
 */
final class PlatformSocialAuthMasterSeeder
{
    private const BROKER_PROVIDER_KEY = '__broker';

    public function __construct(
        private readonly PlatformRuntimeConfigurator $platformRuntimeConfigurator,
    ) {}

    /**
     * @return array{seeded: list<string>, skipped: list<string>, errors: list<string>}
     */
    public function seed(bool $force = false): array
    {
        $this->platformRuntimeConfigurator->applyPlatform();

        if (! Schema::hasTable('social_auth_settings')) {
            return [
                'seeded' => [],
                'skipped' => [],
                'errors' => ['social_auth_settings table is missing — run module migrations first'],
            ];
        }

        $seeded = [];
        $skipped = [];
        $errors = [];

        foreach (SocialAuthProviders::all() as $provider) {
            $clientId = $this->resolveCredential($provider, 'CLIENT_ID');
            $clientSecret = $this->resolveCredential($provider, 'CLIENT_SECRET');

            if ($clientId === '' && $clientSecret === '') {
                $skipped[] = $provider.':no-env-credentials';

                continue;
            }

            /** @var SocialAuthSetting|null $existing */
            $existing = SocialAuthSetting::query()->where('provider', $provider)->first();
            if ($existing !== null && ! $force && trim((string) $existing->client_id) !== '') {
                $skipped[] = $provider.':already-seeded';

                continue;
            }

            SocialAuthSetting::query()->updateOrCreate(
                ['provider' => $provider],
                [
                    'enabled' => (bool) ($existing?->enabled ?? false),
                    'use_master_defaults' => false,
                    'client_id' => $clientId !== '' ? $clientId : null,
                    'client_secret' => $clientSecret !== '' ? $clientSecret : null,
                    'redirect_uri' => null,
                    'google_request_auth_time' => $provider === 'google'
                        ? (bool) ($existing?->google_request_auth_time ?? false)
                        : false,
                    'kakao_use_client_secret' => $provider === 'kakao'
                        ? (bool) ($existing?->kakao_use_client_secret ?? true)
                        : true,
                    'extra_json' => null,
                ]
            );

            $seeded[] = $provider;
        }

        $brokerResult = $this->seedBrokerRow($force);
        if ($brokerResult === 'seeded') {
            $seeded[] = self::BROKER_PROVIDER_KEY;
        } elseif ($brokerResult !== '') {
            $skipped[] = $brokerResult;
        }

        return compact('seeded', 'skipped', 'errors');
    }

    private function seedBrokerRow(bool $force): string
    {
        /** @var SocialAuthSetting|null $existing */
        $existing = SocialAuthSetting::query()->where('provider', self::BROKER_PROVIDER_KEY)->first();
        $brokerExtra = is_array($existing?->extra_json) ? $existing->extra_json : [];
        $hasBrokerHost = trim((string) ($brokerExtra['broker_host'] ?? '')) !== '';

        if ($existing !== null && ! $force && $hasBrokerHost) {
            return self::BROKER_PROVIDER_KEY.':already-seeded';
        }

        $brokerEnabled = filter_var(
            env('MOABOM_SOCIAL_AUTH_BROKER_ENABLED', env('MOABOM_SAAS_ENABLED', false)),
            FILTER_VALIDATE_BOOLEAN
        );
        $brokerHost = trim((string) env('MOABOM_SOCIAL_AUTH_BROKER_HOST', ''));
        if ($brokerHost === '') {
            $baseDomain = trim((string) config('moabom-saas.base_domain', config('moabom-system.saas.base_domain', '')));
            $brokerHost = $baseDomain !== '' ? 'auth.'.$baseDomain : '';
        }
        $brokerScheme = strtolower(trim((string) env('MOABOM_SOCIAL_AUTH_BROKER_SCHEME', 'https')));
        if (! in_array($brokerScheme, ['http', 'https'], true)) {
            $brokerScheme = 'https';
        }
        $brokerTtl = (int) env('MOABOM_SOCIAL_AUTH_BROKER_STATE_TTL', 300);

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
                    'broker_enabled' => $brokerEnabled,
                    'broker_host' => $brokerHost,
                    'broker_scheme' => $brokerScheme,
                    'broker_state_ttl_seconds' => min(900, max(60, $brokerTtl)),
                ],
            ]
        );

        return 'seeded';
    }

    private function resolveCredential(string $provider, string $key): string
    {
        $upper = strtoupper($provider);
        $masterKey = "SOCIAL_AUTH_MASTER_{$upper}_{$key}";
        $fallbackKey = "SOCIAL_AUTH_{$upper}_{$key}";

        return trim((string) env($masterKey, env($fallbackKey, '')));
    }
}
