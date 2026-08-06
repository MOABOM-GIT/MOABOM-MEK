<?php

namespace Modules\Moabom\Social\Auth\Services;

use Illuminate\Http\Request;
use Modules\Moabom\Social\Auth\Exceptions\SocialAuthException;
use Modules\Moabom\System\Saas\TenantHostParser;
use Modules\Moabom\System\Saas\TenantRuntimeBootstrap;

/**
 * 브로커 콜백에서 origin host(tenant·platform) 런타임(DB/GCS/config)을 강제 전환한다.
 */
class SocialAuthTenantRuntimeSwitcher
{
    public function __construct(
        private readonly TenantRuntimeBootstrap $runtimeBootstrap,
    ) {}

    /**
     * OAuth 복귀 대상 host — tenant(freshent.mek360.com) 또는 platform(mek360.com).
     */
    public function bootstrapOriginByHost(Request $request, string $originHost): void
    {
        $originHost = strtolower(trim($originHost));
        $parser = $this->hostParser();
        $parsed = $parser->parse($originHost);

        if ($parsed['type'] === 'platform') {
            $this->runtimeBootstrap->bootstrapPlatform($request, $parsed);

            return;
        }

        if ($parsed['type'] === 'tenant') {
            $tenant = $this->runtimeBootstrap->resolveTenant($parsed['host']);
            if ($tenant === null || ! $tenant->isActive()) {
                throw new SocialAuthException(__('moabom-social-auth::messages.tenant_not_found'));
            }

            $this->runtimeBootstrap->bootstrapTenant($request, $parsed, $tenant);

            return;
        }

        throw new SocialAuthException(__('moabom-social-auth::messages.invalid_tenant_host'));
    }

    private function hostParser(): TenantHostParser
    {
        return new TenantHostParser(
            (string) config('moabom-system.saas.base_domain', 'mek360.com'),
            (array) config('moabom-system.saas.platform_hosts', []),
        );
    }
}

