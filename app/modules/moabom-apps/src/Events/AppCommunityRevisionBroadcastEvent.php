<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * 앱 이야기 revision bump — public 채널 (비로그인 읽기 창 구독 가능).
 */
final class AppCommunityRevisionBroadcastEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly string $channelName,
        public readonly int $generatedAppId,
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
        return 'app_community.revision';
    }

    /**
     * @return array{generated_app_id: int, revision: int, reason: string}
     */
    public function broadcastWith(): array
    {
        return [
            'generated_app_id' => $this->generatedAppId,
            'revision' => $this->revision,
            'reason' => $this->reason,
        ];
    }
}
