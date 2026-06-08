<?php

namespace Modules\Moabom\System\Saas;

/**
 * 요청 단위 테넌트 컨텍스트(플랫폼 요청이면 tenant null).
 */
final class TenantContext
{
    private ?TenantRecord $tenant = null;

    private bool $platformRequest = true;

    private string $requestHost = '';

    public function setPlatform(string $host): void
    {
        $this->tenant = null;
        $this->platformRequest = true;
        $this->requestHost = $host;
    }

    public function setTenant(TenantRecord $tenant, string $host): void
    {
        $this->tenant = $tenant;
        $this->platformRequest = false;
        $this->requestHost = $host;
    }

    public function isPlatformRequest(): bool
    {
        return $this->platformRequest;
    }

    public function tenant(): ?TenantRecord
    {
        return $this->tenant;
    }

    public function requestHost(): string
    {
        return $this->requestHost;
    }

    public function tenantId(): ?string
    {
        return $this->tenant?->slug;
    }
}
