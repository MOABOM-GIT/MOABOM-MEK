<?php

namespace Modules\Moabom\Social\Auth\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Modules\Moabom\Social\Auth\DataTransferObjects\SocialProviderUser;
use Modules\Moabom\Social\Auth\Exceptions\SocialAuthException;
use Modules\Moabom\Social\Auth\Support\SocialAuthCallback;

class SocialProviderService
{
    /**
     * 지원하는 SNS 제공자 목록입니다.
     */
    private const SUPPORTED_PROVIDERS = ['google', 'kakao', 'naver'];

    public function __construct(
        private readonly SocialAuthSettingsService $settingsService,
        private readonly ?SocialAuthBrokerStateService $brokerStateService = null,
    ) {}

    /**
     * 제공자가 지원되는지 확인합니다.
     */
    public function supports(string $provider): bool
    {
        return in_array($provider, self::SUPPORTED_PROVIDERS, true);
    }

    /**
     * 활성화된 SNS 제공자 목록을 반환합니다.
     *
     * @return array<int, string>
     */
    public function enabledProviders(): array
    {
        return array_values(array_filter(
            self::SUPPORTED_PROVIDERS,
            fn (string $provider) => $this->isEnabled($provider)
        ));
    }

    /**
     * OAuth 인증 URL을 생성합니다.
     */
    public function getAuthorizationUrl(string $provider, string $state): string
    {
        $this->assertSupported($provider);
        $config = $this->getProviderConfig($provider);

        $query = match ($provider) {
            'google' => [
                'client_id' => $config['client_id'],
                'redirect_uri' => $config['redirect_uri'],
                'response_type' => 'code',
                'scope' => 'openid email profile',
                'state' => $state,
                'access_type' => 'online',
                'prompt' => 'select_account',
            ] + ($config['request_auth_time'] ? [
                'claims' => json_encode([
                    'id_token' => [
                        'auth_time' => [
                            'essential' => true,
                        ],
                    ],
                ]),
            ] : []),
            'kakao' => [
                'client_id' => $config['client_id'],
                'redirect_uri' => $config['redirect_uri'],
                'response_type' => 'code',
                'scope' => 'profile_nickname profile_image',
                'state' => $state,
            ],
            'naver' => [
                'client_id' => $config['client_id'],
                'redirect_uri' => $config['redirect_uri'],
                'response_type' => 'code',
                'state' => $state,
            ],
        };

        return $config['authorize_url'].'?'.http_build_query($query);
    }

    /**
     * 인가 코드로 SNS 사용자 정보를 조회합니다.
     */
    public function fetchUser(string $provider, string $code, string $state): SocialProviderUser
    {
        $this->assertSupported($provider);
        $config = $this->getProviderConfig($provider);
        $token = $this->fetchToken($provider, $config, $code, $state);

        return match ($provider) {
            'google' => $this->fetchGoogleUser($token),
            'kakao' => $this->fetchKakaoUser($token),
            'naver' => $this->fetchNaverUser($token),
        };
    }

    /**
     * 제공자 설정을 조회합니다.
     *
     * @return array<string, mixed>
     */
    private function getProviderConfig(string $provider): array
    {
        $prefix = 'SOCIAL_AUTH_'.Str::upper($provider);
        $masterPrefix = 'SOCIAL_AUTH_MASTER_'.Str::upper($provider);
        $settings = $this->settingsService->getSettings('providers');
        $useMasterDefaults = (bool) ($settings["{$provider}_use_master_defaults"] ?? true);

        if (! $this->isEnabled($provider)) {
            throw SocialAuthException::missingConfig($provider);
        }

        $clientId = $this->resolveProviderCredential(
            provider: $provider,
            key: 'CLIENT_ID',
            useMasterDefaults: $useMasterDefaults,
            settingValue: $settings["{$provider}_client_id"] ?? null,
            providerEnvPrefix: $prefix,
            masterEnvPrefix: $masterPrefix,
        );
        $clientSecret = $this->resolveProviderCredential(
            provider: $provider,
            key: 'CLIENT_SECRET',
            useMasterDefaults: $useMasterDefaults,
            settingValue: $settings["{$provider}_client_secret"] ?? null,
            providerEnvPrefix: $prefix,
            masterEnvPrefix: $masterPrefix,
        );
        $redirectUri = $settings["{$provider}_redirect_uri"] ?: env(
            "{$prefix}_REDIRECT_URI",
            SocialAuthCallback::absoluteUrl($provider)
        );
        $redirectUri = $this->normalizeLegacyRedirectUri((string) $redirectUri, $provider);
        if (
            $this->brokerState()->isEnabled()
            && ($this->settingsService->isSubTenantHostRequest() || $this->brokerState()->isBrokerHostRequestContext())
        ) {
            $redirectUri = $this->brokerState()->brokerCallbackAbsoluteUrl($provider);
        }
        $kakaoUseClientSecret = (bool) ($settings['kakao_use_client_secret'] ?? true);

        if (
            ! $clientId
            || ! $redirectUri
            || (in_array($provider, ['google', 'naver'], true) && ! $clientSecret)
            || ($provider === 'kakao' && $kakaoUseClientSecret && ! $clientSecret)
        ) {
            throw SocialAuthException::missingConfig($provider);
        }

        return [
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'redirect_uri' => $redirectUri,
            'request_auth_time' => (bool) ($settings['google_request_auth_time'] ?? false),
            'authorize_url' => match ($provider) {
                'google' => 'https://accounts.google.com/o/oauth2/v2/auth',
                'kakao' => 'https://kauth.kakao.com/oauth/authorize',
                'naver' => 'https://nid.naver.com/oauth2.0/authorize',
            },
            'token_url' => match ($provider) {
                'google' => 'https://oauth2.googleapis.com/token',
                'kakao' => 'https://kauth.kakao.com/oauth/token',
                'naver' => 'https://nid.naver.com/oauth2.0/token',
            },
        ];
    }

    /**
     * OAuth 토큰을 조회합니다.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    private function fetchToken(string $provider, array $config, string $code, string $state): array
    {
        $payload = [
            'grant_type' => 'authorization_code',
            'client_id' => $config['client_id'],
            'redirect_uri' => $config['redirect_uri'],
            'code' => $code,
        ];

        if ($config['client_secret'] !== '') {
            $payload['client_secret'] = $config['client_secret'];
        }

        if ($provider === 'naver') {
            $payload['state'] = $state;
        }

        $response = Http::asForm()->post($config['token_url'], $payload);

        if ($response->failed()) {
            throw new SocialAuthException(__('moabom-social-auth::messages.token_failed', ['provider' => $provider]));
        }

        return $response->json();
    }

    /**
     * Google 사용자 정보를 조회합니다.
     *
     * @param  array<string, mixed>  $token
     */
    private function fetchGoogleUser(array $token): SocialProviderUser
    {
        $profile = Http::withToken((string) $token['access_token'])
            ->get('https://www.googleapis.com/oauth2/v3/userinfo')
            ->throw()
            ->json();

        return new SocialProviderUser(
            provider: 'google',
            providerUserId: (string) $profile['sub'],
            email: $profile['email'] ?? null,
            name: $profile['name'] ?? null,
            nickname: $profile['name'] ?? null,
            avatar: $profile['picture'] ?? null,
            accessToken: $token['access_token'] ?? null,
            refreshToken: $token['refresh_token'] ?? null,
            tokenExpiresAt: $this->resolveTokenExpiresAt($token),
        );
    }

    /**
     * Kakao 사용자 정보를 조회합니다.
     *
     * @param  array<string, mixed>  $token
     */
    private function fetchKakaoUser(array $token): SocialProviderUser
    {
        $profile = Http::withToken((string) $token['access_token'])
            ->get('https://kapi.kakao.com/v2/user/me')
            ->throw()
            ->json();

        $account = $profile['kakao_account'] ?? [];
        $kakaoProfile = $account['profile'] ?? [];

        return new SocialProviderUser(
            provider: 'kakao',
            providerUserId: (string) $profile['id'],
            email: $account['email'] ?? null,
            name: $kakaoProfile['nickname'] ?? null,
            nickname: $kakaoProfile['nickname'] ?? null,
            avatar: $kakaoProfile['profile_image_url'] ?? null,
            accessToken: $token['access_token'] ?? null,
            refreshToken: $token['refresh_token'] ?? null,
            tokenExpiresAt: $this->resolveTokenExpiresAt($token),
        );
    }

    /**
     * Naver 사용자 정보를 조회합니다.
     *
     * @param  array<string, mixed>  $token
     */
    private function fetchNaverUser(array $token): SocialProviderUser
    {
        $payload = Http::withToken((string) $token['access_token'])
            ->get('https://openapi.naver.com/v1/nid/me')
            ->throw()
            ->json();

        $profile = $payload['response'] ?? [];

        return new SocialProviderUser(
            provider: 'naver',
            providerUserId: (string) $profile['id'],
            email: $profile['email'] ?? null,
            name: $profile['name'] ?? null,
            nickname: $profile['nickname'] ?? null,
            avatar: $profile['profile_image'] ?? null,
            accessToken: $token['access_token'] ?? null,
            refreshToken: $token['refresh_token'] ?? null,
            tokenExpiresAt: $this->resolveTokenExpiresAt($token),
        );
    }

    /**
     * 토큰 만료 일시를 계산합니다.
     *
     * @param  array<string, mixed>  $token
     */
    private function resolveTokenExpiresAt(array $token): ?\DateTimeInterface
    {
        $expiresIn = (int) ($token['expires_in'] ?? 0);

        return $expiresIn > 0 ? now()->addSeconds($expiresIn) : null;
    }

    /**
     * 지원 provider 여부를 검증합니다.
     */
    private function assertSupported(string $provider): void
    {
        if (! $this->supports($provider)) {
            throw SocialAuthException::unsupportedProvider($provider);
        }
    }

    /**
     * 제공자 활성화 여부를 확인합니다.
     */
    private function isEnabled(string $provider): bool
    {
        $settings = $this->settingsService->getSettings('providers');

        return (bool) ($settings["{$provider}_enabled"] ?? false);
    }

    /**
     * 과거 provider callback 저장값을 `/api/modules/...` 경로로 보정한다.
     */
    private function normalizeLegacyRedirectUri(string $redirectUri, string $provider): string
    {
        if ($redirectUri === '') {
            return $redirectUri;
        }

        $legacyPath = "/modules/moabom-social-auth/{$provider}/callback";
        $newPath = SocialAuthCallback::relativePath($provider);

        $normalized = $redirectUri;
        if (str_contains($normalized, $legacyPath)) {
            $normalized = str_replace($legacyPath, $newPath, $normalized);
        }

        // 잘못 저장된 /api/api 경로를 보정한다.
        $normalized = str_replace('/api/api/modules/moabom-social-auth/', '/api/modules/moabom-social-auth/', $normalized);

        return $normalized;
    }

    private function resolveProviderCredential(
        string $provider,
        string $key,
        bool $useMasterDefaults,
        mixed $settingValue,
        string $providerEnvPrefix,
        string $masterEnvPrefix,
    ): string {
        $value = is_string($settingValue) ? trim($settingValue) : '';

        if ($useMasterDefaults) {
            $masterDbKey = strtolower($key);
            $masterDbValue = $this->settingsService->getPlatformMasterCredential($provider, $masterDbKey);
            if (is_string($masterDbValue) && $masterDbValue !== '') {
                return $masterDbValue;
            }

            $masterValue = (string) env("{$masterEnvPrefix}_{$key}", '');
            if ($masterValue !== '') {
                return $masterValue;
            }

            $providerValue = (string) env("{$providerEnvPrefix}_{$key}", '');
            if ($providerValue !== '') {
                return $providerValue;
            }

            return $value;
        }

        if ($value !== '') {
            return $value;
        }

        $providerValue = (string) env("{$providerEnvPrefix}_{$key}", '');
        if ($providerValue !== '') {
            return $providerValue;
        }

        return $value;
    }

    private function brokerState(): SocialAuthBrokerStateService
    {
        return $this->brokerStateService ?? app(SocialAuthBrokerStateService::class);
    }
}
