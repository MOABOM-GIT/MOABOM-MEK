<?php

namespace Modules\Moabom\Chat\Listeners;

use App\Contracts\Extension\HookListenerInterface;
use App\Models\User;
use Modules\Moabom\Chat\Services\ChatService;

/**
 * 수신자가 해당 메시지방에 포커스(열람) 중이거나 mute면 database·fcm 알림 채널을 생략합니다.
 */
final class ChatNotificationChannelListener implements HookListenerInterface
{
    public function __construct(
        private ChatService $chat,
    ) {}

    public static function getSubscribedHooks(): array
    {
        return [
            'moabom-chat.notification.channels' => [
                'method' => 'filterChannels',
                'priority' => 10,
                'type' => 'filter',
            ],
        ];
    }

    public function handle(...$args): void {}

    /**
     * @param  array<int, string>  $channels
     * @return array<int, string>
     */
    public function filterChannels(array $channels, string $type = '', ?object $notifiable = null): array
    {
        if ($type !== 'chat_message' || ! $notifiable instanceof User) {
            return $channels;
        }

        $conversationUuid = $this->chat->getPendingNotificationConversationUuid();
        if ($conversationUuid && $this->chat->isConversationMutedForUser($notifiable, $conversationUuid)) {
            return array_values(array_filter(
                $channels,
                static fn (string $channel) => ! in_array($channel, ['database', 'fcm'], true),
            ));
        }

        if (! $conversationUuid || ! $this->chat->isFocusedOnConversation($notifiable, $conversationUuid)) {
            return $channels;
        }

        return array_values(array_filter(
            $channels,
            static fn (string $channel) => ! in_array($channel, ['database', 'fcm'], true),
        ));
    }
}
