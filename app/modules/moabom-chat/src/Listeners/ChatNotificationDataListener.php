<?php

namespace Modules\Moabom\Chat\Listeners;

use App\Contracts\Extension\HookListenerInterface;
use App\Extension\ModuleManager;
use App\Models\User;
use Modules\Moabom\Chat\Models\ChatConversation;
use Modules\Moabom\Chat\Models\ChatMessage;
use Modules\Moabom\Chat\Services\ChatService;

final class ChatNotificationDataListener implements HookListenerInterface
{
    public function __construct(
        private ChatService $chat,
    ) {}
    public static function getSubscribedHooks(): array
    {
        return [
            'moabom-chat.notification.extract_data' => [
                'method' => 'extractData',
                'priority' => 20,
                'type' => 'filter',
            ],
            'core.notification.filter_default_definitions' => [
                'method' => 'contributeDefaultDefinitions',
                'priority' => 20,
                'type' => 'filter',
            ],
        ];
    }

    public function handle(...$args): void {}

    /**
     * @param  array<int, array<string, mixed>>  $definitions
     * @return array<int, array<string, mixed>>
     */
    public function contributeDefaultDefinitions(array $definitions, array $context = []): array
    {
        /** @var \Modules\Moabom\Chat\Module|null $module */
        $module = app(ModuleManager::class)->getModule('moabom-chat');
        if (! $module) {
            return $definitions;
        }

        $contributed = [];
        foreach ($module->getNotificationDefinitions() as $data) {
            $contributed[] = array_merge($data, [
                'extension_type' => 'module',
                'extension_identifier' => $module->getIdentifier(),
            ]);
        }

        return array_merge($definitions, $contributed);
    }

    /**
     * @param  array{notifiable: mixed, notifiables: mixed, data: array<string, mixed>, context: array<string, mixed>}  $default
     * @param  array<int, mixed>  $args
     * @return array{notifiable: null, notifiables: mixed, data: array<string, mixed>, context: array<string, mixed>}
     */
    public function extractData(array $default, string $type, array $args): array
    {
        if ($type !== 'chat_message') {
            return $default;
        }

        $message = $args[0] ?? null;
        $conversation = $args[1] ?? null;
        $sender = $args[2] ?? null;

        if (! $message instanceof ChatMessage || ! $conversation instanceof ChatConversation || ! $sender instanceof User) {
            return $default;
        }

        $this->chat->setPendingNotificationConversationUuid($conversation->uuid);

        $senderName = trim((string) ($sender->nickname ?: $sender->name));
        $recipients = $conversation->members
            ->filter(fn ($member) => (int) $member->user_id !== (int) $sender->id)
            ->map(fn ($member) => $member->user)
            ->filter()
            ->filter(fn (User $user) => ! $this->chat->isFocusedOnConversation($user, $conversation->uuid))
            ->values();

        return [
            'notifiable' => null,
            'notifiables' => null,
            'data' => [
                'name' => '{recipient_name}',
                'sender_name' => $senderName !== '' ? $senderName : 'User #'.$sender->id,
                'sender_uuid' => $sender->uuid,
                'conversation_uuid' => $conversation->uuid,
                'message_preview' => mb_substr($message->body, 0, 80),
            ],
            'context' => [
                'trigger_user_id' => $sender->id,
                'trigger_user' => $sender,
                'related_users' => [
                    'member' => $recipients,
                ],
            ],
        ];
    }
}
