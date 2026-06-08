<?php

namespace Modules\Moabom\Social\Auth\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class StoreSocialAuthSettingsRequest extends FormRequest
{
    /**
     * 요청 권한을 확인합니다.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * 검증 규칙을 반환합니다.
     *
     * @return array<string, string>
     */
    public function rules(): array
    {
        return [
            'providers' => 'required|array',
            'providers.google_enabled' => 'boolean',
            'providers.google_use_master_defaults' => 'boolean',
            'providers.google_client_id' => 'nullable|string|max:255',
            'providers.google_client_secret' => 'nullable|string|max:255',
            'providers.google_redirect_uri' => 'nullable|url|max:500',
            'providers.google_request_auth_time' => 'boolean',
            'providers.broker_enabled' => 'boolean',
            'providers.broker_host' => 'nullable|string|max:255',
            'providers.broker_scheme' => 'nullable|string|in:http,https',
            'providers.broker_state_ttl_seconds' => 'nullable|integer|min:60|max:900',
            'providers.kakao_enabled' => 'boolean',
            'providers.kakao_use_master_defaults' => 'boolean',
            'providers.kakao_client_id' => 'nullable|string|max:255',
            'providers.kakao_client_secret' => 'nullable|string|max:255',
            'providers.kakao_use_client_secret' => 'boolean',
            'providers.kakao_redirect_uri' => 'nullable|url|max:500',
            'providers.naver_enabled' => 'boolean',
            'providers.naver_use_master_defaults' => 'boolean',
            'providers.naver_client_id' => 'nullable|string|max:255',
            'providers.naver_client_secret' => 'nullable|string|max:255',
            'providers.naver_redirect_uri' => 'nullable|url|max:500',
        ];
    }

    /**
     * 저장할 설정 배열을 반환합니다.
     *
     * @return array<string, mixed>
     */
    public function validatedSettings(): array
    {
        return $this->validated();
    }

    /**
     * 검증 후 provider별 필수 설정을 확인합니다.
     */
    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $providers = $this->input('providers', []);
            $isSubTenantHost = $this->isSubTenantHost();
            $defaultUseMasterDefaults = $isSubTenantHost;

            if ($isSubTenantHost) {
                foreach (['google', 'kakao', 'naver'] as $provider) {
                    if (! (bool) ($providers["{$provider}_use_master_defaults"] ?? true)) {
                        $validator->errors()->add(
                            "providers.{$provider}_use_master_defaults",
                            __('moabom-social-auth::messages.settings.readonly_sub_tenant')
                        );
                    }
                }
            }

            foreach (['google', 'kakao', 'naver'] as $provider) {
                if (! (bool) ($providers["{$provider}_enabled"] ?? false)) {
                    continue;
                }

                $useMasterDefaults = (bool) ($providers["{$provider}_use_master_defaults"] ?? $defaultUseMasterDefaults);

                if (! $useMasterDefaults && empty($providers["{$provider}_client_id"])) {
                    $validator->errors()->add(
                        "providers.{$provider}_client_id",
                        __('moabom-social-auth::messages.settings.required_when_enabled')
                    );
                }
            }

            if ((bool) ($providers['broker_enabled'] ?? false) && empty($providers['broker_host'])) {
                $validator->errors()->add(
                    'providers.broker_host',
                    __('moabom-social-auth::messages.settings.required_when_broker_enabled')
                );
            }

            if (
                (bool) ($providers['naver_enabled'] ?? false)
                && ! (bool) ($providers['naver_use_master_defaults'] ?? $defaultUseMasterDefaults)
                && empty($providers['naver_client_secret'])
            ) {
                $validator->errors()->add(
                    'providers.naver_client_secret',
                    __('moabom-social-auth::messages.settings.required_when_enabled')
                );
            }

            if (
                (bool) ($providers['google_enabled'] ?? false)
                && ! (bool) ($providers['google_use_master_defaults'] ?? $defaultUseMasterDefaults)
                && empty($providers['google_client_secret'])
            ) {
                $validator->errors()->add(
                    'providers.google_client_secret',
                    __('moabom-social-auth::messages.settings.required_when_enabled')
                );
            }

            if (
                (bool) ($providers['kakao_enabled'] ?? false)
                && ! (bool) ($providers['kakao_use_master_defaults'] ?? $defaultUseMasterDefaults)
                && (bool) ($providers['kakao_use_client_secret'] ?? true)
                && empty($providers['kakao_client_secret'])
            ) {
                $validator->errors()->add(
                    'providers.kakao_client_secret',
                    __('moabom-social-auth::messages.settings.required_when_client_secret_enabled')
                );
            }
        });
    }

    private function isSubTenantHost(): bool
    {
        if (! (bool) (config('moabom-saas.enabled') ?? config('moabom-system.saas.enabled', false))) {
            return false;
        }

        $host = strtolower((string) $this->getHost());
        if ($host === '') {
            return false;
        }

        $platformHosts = config('moabom-saas.platform_hosts');
        if (! is_array($platformHosts)) {
            $platformHosts = (array) config('moabom-system.saas.platform_hosts', []);
        }
        $platformHosts = array_map(
            static fn ($value): string => strtolower((string) $value),
            $platformHosts
        );
        if (in_array($host, $platformHosts, true)) {
            return false;
        }

        $baseDomain = (string) (config('moabom-saas.base_domain') ?? config('moabom-system.saas.base_domain', ''));
        $baseDomain = strtolower($baseDomain);
        if ($baseDomain === '') {
            return false;
        }

        return str_ends_with($host, '.'.$baseDomain);
    }
}
