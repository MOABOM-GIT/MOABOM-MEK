<?php

namespace Modules\Moabom\Apps\Tests\Unit;

use Illuminate\Support\Facades\Cache;
use Modules\Moabom\Apps\Services\AiStreamConcurrencyService;
use Modules\Moabom\Apps\Support\AiStreamGateResult;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class AiStreamConcurrencyServiceTest extends ModuleTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'moabom-apps.ai.stream_concurrency.max_active' => 1,
            'moabom-apps.ai.stream_concurrency.max_queue' => 5,
            'moabom-apps.ai.stream_concurrency.retry_after_seconds' => 3,
        ]);

        Cache::flush();
    }

    public function test_grants_immediate_slot_when_capacity_available(): void
    {
        $service = $this->app->make(AiStreamConcurrencyService::class);

        $gate = $service->requestAccess(10);

        $this->assertSame(AiStreamGateResult::STATUS_READY, $gate->status);
        $this->assertNotEmpty($gate->leaseToken);
    }

    public function test_queues_second_user_when_capacity_full(): void
    {
        $service = $this->app->make(AiStreamConcurrencyService::class);

        $first = $service->requestAccess(10);
        $second = $service->requestAccess(20);

        $this->assertSame(AiStreamGateResult::STATUS_READY, $first->status);
        $this->assertSame(AiStreamGateResult::STATUS_QUEUED, $second->status);
        $this->assertSame(1, $second->queuePosition);
        $this->assertNotEmpty($second->ticketId);
    }

    public function test_promotes_next_ticket_after_release(): void
    {
        $service = $this->app->make(AiStreamConcurrencyService::class);

        $first = $service->requestAccess(10);
        $second = $service->requestAccess(20);

        $service->releaseLease((string) $first->leaseToken);

        $status = $service->getQueueStatus(20, (string) $second->ticketId);
        $this->assertNotNull($status);
        $this->assertSame(AiStreamGateResult::STATUS_READY, $status->status);
        $this->assertNotEmpty($status->leaseToken);

        $ready = $service->requestAccess(20, null, (string) $second->ticketId);
        $this->assertSame(AiStreamGateResult::STATUS_READY, $ready->status);
    }

    public function test_cancel_ticket_removes_user_from_queue(): void
    {
        $service = $this->app->make(AiStreamConcurrencyService::class);

        $service->requestAccess(10);
        $queued = $service->requestAccess(20);

        $this->assertTrue($service->cancelTicket(20, (string) $queued->ticketId));
        $this->assertNull($service->getQueueStatus(20, (string) $queued->ticketId));
    }
}
