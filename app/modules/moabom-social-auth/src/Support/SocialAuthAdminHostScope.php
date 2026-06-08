<?php

namespace Modules\Moabom\Social\Auth\Support;

/**
 * Admin SNS 설정 UI/API의 호스트 스코프 SSOT.
 *
 * host_scope × 권한(features) 조합으로 레이아웃 분기를 일관되게 유지한다.
 * (platform / tenant_subdomain / tenant_custom 은 점진 확장)
 *
 * @see docs/ADMIN-HOST-SCOPE.md 확장·운영 가이드 (AI 에이전트 필독)
 */
final class SocialAuthAdminHostScope
{
    public const SCOPE_PLATFORM = 'platform';

    public const SCOPE_TENANT_SUBDOMAIN = 'tenant_subdomain';

    /** @todo 커스텀 도메인 테넌트 감지 후 resolve()에서 분기 */
    public const SCOPE_TENANT_CUSTOM = 'tenant_custom';

    /**
     * @return array{
     *     host_scope: string,
     *     readonly_sub_tenant: bool,
     *     can_manage_credentials: bool,
     *     inherits_master_credentials: bool,
     *     features: array<string, bool>
     * }
     */
    public static function resolve(bool $isSubTenantHost): array
    {
        $hostScope = $isSubTenantHost
            ? self::SCOPE_TENANT_SUBDOMAIN
            : self::SCOPE_PLATFORM;

        $canManageCredentials = ! $isSubTenantHost;

        return [
            'host_scope' => $hostScope,
            'readonly_sub_tenant' => $isSubTenantHost,
            'can_manage_credentials' => $canManageCredentials,
            'inherits_master_credentials' => $isSubTenantHost,
            'features' => [
                'manage_credentials' => $canManageCredentials,
                'toggle_provider_enabled' => true,
                'toggle_use_master_defaults' => $canManageCredentials,
                'view_master_credentials' => $isSubTenantHost,
            ],
        ];
    }
}
