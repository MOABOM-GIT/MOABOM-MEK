<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas;

/**
 * 요청-비의존 테넌트 컨텍스트 전환 계약 (C1 — 큐 잡 전파/복원).
 *
 * 큐 부트스트래퍼(TenantQueueBootstrapper)는 "테넌트 전환" 능력만 필요하다.
 * 구현은 TenantRuntimeBootstrap(final)이며, 이 좁은 인터페이스로 의존을 노출해
 * final 유지 + 단위 테스트(모킹) 가능성을 동시에 만족한다.
 */
interface TenantContextSwitcher
{
    /**
     * slug 로 테넌트 런타임을 부트스트랩한다(성공 시 true). 직전 컨텍스트 보존은 호출자 책임.
     */
    public function bootstrapTenantBySlug(string $slug): bool;

    /**
     * 플랫폼(비-테넌트) 컨텍스트로 복원한다.
     */
    public function restorePlatformContext(): void;
}
