<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas\Queue;

use Illuminate\Queue\Events\JobProcessing;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantContextSwitcher;

/**
 * 큐 잡의 테넌트 컨텍스트 전파/복원 (C1 — deploy/PROJECT-ARCHITECTURE-HARDENING.md).
 *
 * 문제: SaaS 격리는 ResolveMoabomTenant 미들웨어의 DB connection 전환에만 의존한다.
 *       큐 워커·스케줄러는 미들웨어를 거치지 않으므로, 잡이 platform(또는 직전 잡의
 *       tenant) DB 에 붙어 cross-tenant 기록이 발생할 수 있다.
 *
 * 해결(생성자 의존 없는 글로벌 메커니즘 — spatie/laravel-multitenancy 패턴):
 *  1. Queue::createPayloadUsing → 디스패치 시점의 tenant slug 를 모든 잡 페이로드에 주입.
 *  2. JobProcessing → 페이로드의 slug 로 워커에서 테넌트 런타임 부트스트랩(직전 컨텍스트는 스택에 보존).
 *  3. JobProcessed/JobFailed/JobExceptionOccurred → 스택에서 직전 컨텍스트 복원.
 *
 * 스택 기반 save/restore 이므로 워커(잡 사이) 와 in-request sync 디스패치(중첩 포함)
 * 모두에서 안전하다. 페이로드 키가 없는 잡(우리 시스템 밖 디스패치)은 건드리지 않는다.
 *
 * singleton 으로 바인딩해 워커 프로세스 동안 스택이 유지된다. TenantContext 는 scoped 라
 * 생성자 주입하지 않고 app() 으로 호출 시점 해석한다(v8-4b stale 방지).
 */
final class TenantQueueBootstrapper
{
    public const PAYLOAD_KEY = 'moabom_tenant_slug';

    /**
     * @var list<array{platform: bool, slug: ?string, switched: bool}>
     */
    private array $stack = [];

    public function __construct(
        private readonly TenantContextSwitcher $runtimeBootstrap,
    ) {}

    /**
     * createPayloadUsing 콜백 — 디스패치 시점 tenant slug(platform 이면 null)를 페이로드에 심는다.
     *
     * @return array{moabom_tenant_slug: ?string}
     */
    public function payload(): array
    {
        $context = app(TenantContext::class);

        return [
            self::PAYLOAD_KEY => $context->isPlatformRequest() ? null : $context->tenantId(),
        ];
    }

    /**
     * 잡 처리 직전 — 직전 컨텍스트를 스택에 저장하고 페이로드의 테넌트로 전환한다.
     */
    public function onJobProcessing(JobProcessing $event): void
    {
        $payload = $event->job->payload();
        $context = app(TenantContext::class);

        $snapshot = [
            'platform' => $context->isPlatformRequest(),
            'slug' => $context->tenantId(),
            'switched' => false,
        ];

        if (array_key_exists(self::PAYLOAD_KEY, $payload)) {
            $slug = $payload[self::PAYLOAD_KEY];

            if (is_string($slug) && $slug !== '') {
                if ($this->runtimeBootstrap->bootstrapTenantBySlug($slug)) {
                    $snapshot['switched'] = true;
                }
            } else {
                // 명시적 platform 잡 — 워커가 직전 tenant 에 남아 있을 수 있으므로 복원.
                $this->runtimeBootstrap->restorePlatformContext();
                $snapshot['switched'] = true;
            }
        }

        $this->stack[] = $snapshot;
    }

    /**
     * 잡 처리 종료(성공/실패/예외) — 스택에서 직전 컨텍스트를 복원한다.
     */
    public function onJobSettled(object $event): void
    {
        if ($this->stack === []) {
            return;
        }

        $snapshot = array_pop($this->stack);

        if (($snapshot['switched'] ?? false) !== true) {
            return;
        }

        if (($snapshot['platform'] ?? true) === true) {
            $this->runtimeBootstrap->restorePlatformContext();

            return;
        }

        $slug = $snapshot['slug'] ?? null;
        if (is_string($slug) && $slug !== '') {
            $this->runtimeBootstrap->bootstrapTenantBySlug($slug);
        }
    }
}
