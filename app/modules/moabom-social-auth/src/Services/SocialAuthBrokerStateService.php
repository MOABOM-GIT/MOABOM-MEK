<?php

namespace Modules\Moabom\Social\Auth\Services;

use Modules\Moabom\Social\Auth\Exceptions\SocialAuthException;

/**
 * 중앙 OAuth 브로커용 state 토큰(HMAC) 발급/검증.
 *
 * 분산 캐시 의존 없이 서명+만료 기반으로 검증해 Cloud Run 다중 인스턴스에서도 동작한다.
 */
class SocialAuthBrokerStateService
{
    public function __construct(
        private readonly SocialAuthSettingsService $settingsService,
    ) {}

    /**
     * 중앙 브로커 모드 활성 여부.
     */
    public function isEnabled(): bool
    {
        $settings = $this->settingsService->getSettings('providers');
        $enabled = array_key_exists('broker_enabled', $settings)
            ? (bool) $settings['broker_enabled']
            : $this->envBool('MOABOM_SOCIAL_AUTH_BROKER_ENABLED', $this->saasEnabledDefault());

        // SaaS tenant·platform 요청은 wildcard callback 제약 때문에 브로커를 강제 사용한다.
        if (! $enabled && $this->saasEnabledDefault() && $this->isBrokerOriginHostRequest()) {
            $enabled = true;
        }
        if (! $enabled && $this->saasEnabledDefault() && $this->isBrokerHostRequestContext()) {
            $enabled = true;
        }

        return $enabled && $this->brokerHost() !== '';
    }

    /**
     * 브로커 시작 URL.
     */
    public function brokerStartUrl(string $provider, string $state): string
    {
        return $this->brokerBaseUrl()."/api/modules/moabom-social-auth/oauth/{$provider}/start?"
            .http_build_query(['state' => $state]);
    }

    /**
     * SNS 콘솔에 등록할 브로커 콜백 절대 URL.
     */
    public function brokerCallbackAbsoluteUrl(string $provider): string
    {
        return $this->brokerBaseUrl()."/api/modules/moabom-social-auth/oauth/{$provider}/callback";
    }

    /**
     * state 토큰 발급.
     */
    public function issueTenantState(string $tenantHost, string $provider, bool $popup): string
    {
        $tenantHost = strtolower(trim($tenantHost));
        if (! $this->isValidHost($tenantHost)) {
            throw new SocialAuthException(__('moabom-social-auth::messages.invalid_tenant_host'));
        }

        $now = time();
        $payload = [
            'v' => 1,
            'provider' => $provider,
            'tenant_host' => $tenantHost,
            'popup' => $popup,
            'nonce' => bin2hex(random_bytes(16)),
            'iat' => $now,
            'exp' => $now + $this->stateTtlSeconds(),
        ];

        $json = json_encode($payload, JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            throw new SocialAuthException(__('moabom-social-auth::messages.invalid_broker_state'));
        }

        $payloadPart = $this->base64UrlEncode($json);
        $signature = hash_hmac('sha256', $payloadPart, $this->stateSecret());

        return $payloadPart.'.'.$signature;
    }

    /**
     * state 토큰 검증 후 payload 반환.
     *
     * @return array{tenant_host: string, provider: string, popup: bool}
     */
    public function parseTenantState(string $token, string $expectedProvider): array
    {
        $parts = explode('.', $token, 2);
        if (count($parts) !== 2 || $parts[0] === '' || $parts[1] === '') {
            throw new SocialAuthException(__('moabom-social-auth::messages.invalid_broker_state'));
        }

        [$payloadPart, $signature] = $parts;
        $expectedSignature = hash_hmac('sha256', $payloadPart, $this->stateSecret());
        if (! hash_equals($expectedSignature, $signature)) {
            throw new SocialAuthException(__('moabom-social-auth::messages.invalid_broker_state'));
        }

        $payloadJson = $this->base64UrlDecode($payloadPart);
        $payload = json_decode($payloadJson, true);
        if (! is_array($payload)) {
            throw new SocialAuthException(__('moabom-social-auth::messages.invalid_broker_state'));
        }

        $provider = (string) ($payload['provider'] ?? '');
        $tenantHost = strtolower(trim((string) ($payload['tenant_host'] ?? '')));
        $exp = (int) ($payload['exp'] ?? 0);
        $iat = (int) ($payload['iat'] ?? 0);
        $popup = (bool) ($payload['popup'] ?? false);

        if ($provider === '' || ! hash_equals($expectedProvider, $provider)) {
            throw new SocialAuthException(__('moabom-social-auth::messages.invalid_broker_state'));
        }

        if (! $this->isValidHost($tenantHost)) {
            throw new SocialAuthException(__('moabom-social-auth::messages.invalid_tenant_host'));
        }

        $now = time();
        if ($exp <= 0 || $iat <= 0 || $exp < $now || $iat > ($now + 60)) {
            throw new SocialAuthException(__('moabom-social-auth::messages.expired_broker_state'));
        }

        return [
            'tenant_host' => $tenantHost,
            'provider' => $provider,
            'popup' => $popup,
        ];
    }

    public function brokerHost(): string
    {
        $settings = $this->settingsService->getSettings('providers');
        $host = trim((string) ($settings['broker_host'] ?? ''));
        if ($host !== '') {
            return strtolower($host);
        }

        $envHost = strtolower(trim((string) env('MOABOM_SOCIAL_AUTH_BROKER_HOST', '')));
        if ($envHost !== '') {
            return $envHost;
        }

        $baseDomain = (string) (config('moabom-saas.base_domain') ?? config('moabom-system.saas.base_domain', ''));
        $baseDomain = strtolower(trim($baseDomain));
        if ($baseDomain === '') {
            return '';
        }

        return "auth.{$baseDomain}";
    }

    private function brokerScheme(): string
    {
        $settings = $this->settingsService->getSettings('providers');
        $scheme = strtolower(trim((string) ($settings['broker_scheme'] ?? '')));
        if ($scheme === 'https' || $scheme === 'http') {
            return $scheme;
        }

        $fromEnv = strtolower(trim((string) env('MOABOM_SOCIAL_AUTH_BROKER_SCHEME', 'https')));

        return $fromEnv === 'http' ? 'http' : 'https';
    }

    private function brokerBaseUrl(): string
    {
        $host = $this->brokerHost();
        if ($host === '') {
            throw new SocialAuthException(__('moabom-social-auth::messages.broker_host_missing'));
        }

        return $this->brokerScheme().'://'.$host;
    }

    private function stateTtlSeconds(): int
    {
        $settings = $this->settingsService->getSettings('providers');
        $ttl = array_key_exists('broker_state_ttl_seconds', $settings)
            ? (int) $settings['broker_state_ttl_seconds']
            : (int) env('MOABOM_SOCIAL_AUTH_BROKER_STATE_TTL', 300);

        return min(900, max(60, $ttl));
    }

    private function stateSecret(): string
    {
        $secret = trim((string) env('MOABOM_SOCIAL_AUTH_BROKER_STATE_SECRET', ''));
        if ($secret === '') {
            $secret = (string) config('app.key', '');
        }
        if (str_starts_with($secret, 'base64:')) {
            $decoded = base64_decode(substr($secret, 7), true);
            if ($decoded !== false && $decoded !== '') {
                return $decoded;
            }
        }

        return $secret !== '' ? $secret : 'moabom-social-auth-broker-state';
    }

    private function envBool(string $key, bool $default): bool
    {
        $raw = env($key);
        if ($raw === null) {
            return $default;
        }

        return filter_var($raw, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? $default;
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $value): string
    {
        $padding = strlen($value) % 4;
        if ($padding > 0) {
            $value .= str_repeat('=', 4 - $padding);
        }

        $decoded = base64_decode(strtr($value, '-_', '+/'), true);

        return $decoded === false ? '' : $decoded;
    }

    private function isValidHost(string $host): bool
    {
        if ($host === '' || str_contains($host, '://') || str_contains($host, '/')) {
            return false;
        }

        return preg_match('/^(?=.{1,253}$)(?!-)[a-z0-9.-]+(?<!-)$/', $host) === 1;
    }

    private function saasEnabledDefault(): bool
    {
        $modern = config('moabom-saas.enabled');
        if ($modern !== null) {
            return (bool) $modern;
        }

        return (bool) config('moabom-system.saas.enabled', false);
    }

    private function isBrokerOriginHostRequest(): bool
    {
        if (app()->runningInConsole()) {
            return false;
        }

        $host = strtolower((string) request()->getHost());
        if ($host === '') {
            return false;
        }

        if ($host === $this->brokerHost()) {
            return false;
        }

        $platformHosts = config('moabom-saas.platform_hosts');
        if (! is_array($platformHosts)) {
            $platformHosts = (array) config('moabom-system.saas.platform_hosts', []);
        }

        $parser = new \Modules\Moabom\System\Saas\TenantHostParser(
            (string) (config('moabom-saas.base_domain') ?? config('moabom-system.saas.base_domain', '')),
            array_map(static fn ($value): string => strtolower((string) $value), $platformHosts),
        );

        $parsed = $parser->parse($host);

        return in_array($parsed['type'], ['tenant', 'platform'], true);
    }

    public function isBrokerHostRequestContext(): bool
    {
        if (app()->runningInConsole()) {
            return false;
        }

        $host = strtolower((string) request()->getHost());
        if ($host === '') {
            return false;
        }

        return $host === $this->brokerHost();
    }
}

