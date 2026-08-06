<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Saas\Queue;

/**
 * Cloud Tasks → queue service 처리 경로를 검증하는 무상태 probe.
 */
final class RealtimeQueueProbeJob extends TenantAwareJob
{
    public int $tries = 1;

    public int $timeout = 15;

    public function __construct(public readonly string $probeToken) {}

    public function handle(): void
    {
        // 성공적으로 dequeue되면 Laravel worker가 DB jobs 행을 제거합니다.
    }
}
