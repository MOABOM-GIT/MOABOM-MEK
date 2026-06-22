<?php

namespace Modules\Moabom\Apps\Support;

final class AiStreamGateResult
{
    public const STATUS_READY = 'ready';

    public const STATUS_QUEUED = 'queued';

    public const STATUS_DENIED = 'denied';

    /**
     * @param  array<string, mixed>  $meta
     */
    public function __construct(
        public readonly string $status,
        public readonly ?string $leaseToken = null,
        public readonly ?string $ticketId = null,
        public readonly int $queuePosition = 0,
        public readonly int $estimatedWaitSeconds = 0,
        public readonly int $retryAfterSeconds = 5,
        public readonly int $activeCount = 0,
        public readonly int $maxActive = 0,
        public readonly ?string $reason = null,
        public readonly array $meta = [],
    ) {
    }

    /**
     * @return array<string, mixed>
     */
    public function toQueuePayload(): array
    {
        return [
            'code' => 'ai_generation_queued',
            'status' => self::STATUS_QUEUED,
            'ticket_id' => $this->ticketId,
            'queue_position' => $this->queuePosition,
            'estimated_wait_seconds' => $this->estimatedWaitSeconds,
            'retry_after_seconds' => $this->retryAfterSeconds,
            'active_count' => $this->activeCount,
            'max_active' => $this->maxActive,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function toStatusPayload(): array
    {
        return [
            'status' => $this->status,
            'ticket_id' => $this->ticketId,
            'queue_position' => $this->queuePosition,
            'estimated_wait_seconds' => $this->estimatedWaitSeconds,
            'retry_after_seconds' => $this->retryAfterSeconds,
            'active_count' => $this->activeCount,
            'max_active' => $this->maxActive,
            'lease_token' => $this->leaseToken,
            'reason' => $this->reason,
        ];
    }
}
