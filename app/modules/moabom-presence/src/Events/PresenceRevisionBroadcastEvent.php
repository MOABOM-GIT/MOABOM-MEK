<?php

namespace Modules\Moabom\Presence\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Str;

/**
 * 테넌트 접속자 목록 revision bump — public 채널 (비로그인 구독 가능).
 */
final class PresenceRevisionBroadcastEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public readonly string $eventId;

    public readonly string $occurredAt;

    public function __construct(
        public readonly string $channelName,
        public readonly string $tenantSlug,
        public readonly int $revision,
        public readonly string $reason,
    ) {
        $this->eventId = (string) Str::uuid();
        $this->occurredAt = now()->toIso8601String();
    }

    /**
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [new Channel($this->channelName)];
    }

    public function broadcastAs(): string
    {
        return 'presence.revision';
    }

    /**
     * @return array{event_id: string, domain: string, occurred_at: string, tenant_slug: string, revision: int, reason: string}
     */
    public function broadcastWith(): array
    {
        return [
            'event_id' => $this->eventId,
            'domain' => 'presence.revision',
            'occurred_at' => $this->occurredAt,
            'tenant_slug' => $this->tenantSlug,
            'revision' => $this->revision,
            'reason' => $this->reason,
        ];
    }
}
