<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas\Queue;

use Modules\Moabom\System\Saas\TenantContext;

/**
 * 테넌트 인지 잡/리스너 편의 트레이트.
 *
 * 테넌트 컨텍스트 전파/복원 자체는 TenantQueueBootstrapper(글로벌)가 자동 처리한다.
 * 이 트레이트는 잡 핸들러 안에서 현재 테넌트 slug 가 필요할 때 쓰는 헬퍼만 제공한다.
 */
trait InteractsWithTenant
{
    /**
     * 잡 실행 중(워커) 현재 부트스트랩된 테넌트 slug. platform 컨텍스트면 null.
     */
    public function currentTenantSlug(): ?string
    {
        return app(TenantContext::class)->tenantId();
    }

    /**
     * 현재 컨텍스트가 platform(테넌트 아님)인지.
     */
    public function isPlatformContext(): bool
    {
        return app(TenantContext::class)->isPlatformRequest();
    }
}
