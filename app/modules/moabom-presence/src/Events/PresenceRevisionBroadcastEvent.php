<?php

namespace Modules\Moabom\Presence\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * 테넌트 접속자 목록 revision bump — public 채널 (비로그인 구독 가능).
 */
final class PresenceRevisionBroadcastEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $channelName,
        public readonly string $tenantSlug,
        public readonly int $revision,
        public readonly string $reason,
    ) {}

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
     * @return array{tenant_slug: string, revision: int, reason: string}
     */
    public function broadcastWith(): array
    {
        return [
            'tenant_slug' => $this->tenantSlug,
            'revision' => $this->revision,
            'reason' => $this->reason,
        ];
    }
}
