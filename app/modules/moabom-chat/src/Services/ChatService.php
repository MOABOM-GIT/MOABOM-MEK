<?php

namespace Modules\Moabom\Chat\Services;

use App\Contracts\Extension\CacheInterface;
use App\Extension\HookManager;
use App\Models\User;
use Illuminate\Database\QueryException;
use Modules\Moabom\Chat\Contracts\ChatRepositoryInterface;
use Modules\Moabom\Chat\Enums\ChatConversationType;
use Modules\Moabom\Chat\Models\ChatConversation;
use Modules\Moabom\Chat\Models\ChatMessage;
use Modules\Moabom\Chat\Models\ChatUserBlock;
use Modules\Moabom\Presence\Contracts\PresenceUserPreferencesRepositoryInterface;
use Modules\Moabom\Presence\Services\PresencePresentationService;
use Modules\Moabom\System\Saas\TenantContext;

final class ChatService
{
    private const FOCUS_CACHE_TTL_SECONDS = 1800;

    private ?string $pendingNotificationConversationUuid = null;

    public function __construct(
        private ChatRepositoryInterface $chat,
        private PresenceUserPreferencesRepositoryInterface $preferences,
        private PresencePresentationService $presencePresentation,
        private TenantContext $tenantContext,
        private CacheInterface $cache,
    ) {}

    public function setPendingNotificationConversationUuid(?string $conversationUuid): void
    {
        $this->pendingNotificationConversationUuid = $conversationUuid;
    }

    public function getPendingNotificationConversationUuid(): ?string
    {
        return $this->pendingNotificationConversationUuid;
    }

    public function focusConversation(User $viewer, string $conversationUuid): void
    {
        $conversation = $this->requireConversationForMember($viewer, $conversationUuid);
        $this->cache->put(
            $this->focusCacheKey($viewer->id),
            $conversation->uuid,
            self::FOCUS_CACHE_TTL_SECONDS,
        );
    }

    public function clearConversationFocus(User $viewer, ?string $conversationUuid = null): void
    {
        $key = $this->focusCacheKey($viewer->id);
        if ($conversationUuid === null) {
            $this->cache->forget($key);

            return;
        }

        if ($this->cache->get($key) === $conversationUuid) {
            $this->cache->forget($key);
        }
    }

    public function isFocusedOnConversation(User $viewer, string $conversationUuid): bool
    {
        return $this->cache->get($this->focusCacheKey($viewer->id)) === $conversationUuid;
    }

    /**
     * @return array<string, mixed>
     */
    public function listConversations(User $viewer, ?string $search = null, int $limit = 30): array
    {
        $rows = $this->chat->listConversationsForUser($viewer->id, $search, min(max($limit, 1), 100));

        return [
            'conversations' => $rows
                ->map(fn (ChatConversation $conversation) => $this->serializeConversation($conversation, $viewer))
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  list<User>  $members
     * @return array<string, mixed>
     */
    public function startConversation(User $creator, array $members, ?string $title = null): array
    {
        $memberIds = collect($members)
            ->push($creator)
            ->map(fn (User $user) => (int) $user->id)
            ->unique()
            ->values();

        if ($memberIds->count() < 2) {
            throw new \InvalidArgumentException('cannot_chat_self');
        }

        foreach ($members as $member) {
            $eligibility = $this->resolveEligibility($creator, $member);
            if (! $eligibility['can_chat']) {
                throw new \InvalidArgumentException((string) $eligibility['reason']);
            }
        }

        $type = $memberIds->count() === 2 ? ChatConversationType::Direct : ChatConversationType::Group;
        $conversation = $type === ChatConversationType::Direct
            ? $this->chat->findDirectConversation($memberIds->all())
            : null;

        if (! $conversation) {
            try {
                $conversation = $this->chat->createConversation(
                    $creator->id,
                    $type->value,
                    $type === ChatConversationType::Group ? $this->normalizeTitle($title) : null,
                    $memberIds->all(),
                );
            } catch (QueryException $e) {
                if ($type !== ChatConversationType::Direct) {
                    throw $e;
                }
                $conversation = $this->chat->findDirectConversation($memberIds->all());
                if (! $conversation) {
                    throw $e;
                }
            }
        }

        return [
            'conversation' => $this->serializeConversation($conversation, $creator),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function listMessages(User $viewer, string $conversationUuid, ?int $beforeId = null, int $limit = 30): array
    {
        $conversation = $this->requireConversationForMember($viewer, $conversationUuid);
        $messages = $this->chat->listMessages($conversation->id, $beforeId, min(max($limit, 1), 100));

        return [
            'messages' => $messages->map(fn (ChatMessage $message) => $this->serializeMessage($message))->values()->all(),
            'has_more' => $messages->count() >= min(max($limit, 1), 100),
            'next_before_id' => $messages->first()?->id,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function sendMessage(User $sender, string $conversationUuid, string $body, ?string $clientMessageId = null): array
    {
        $conversation = $this->requireConversationForMember($sender, $conversationUuid);
        $this->assertConversationWritable($sender, $conversation);

        if ($clientMessageId) {
            $existing = $this->chat->findMessageByClientId($conversation->id, $sender->id, $clientMessageId);
            if ($existing) {
                return [
                    'message' => $this->serializeMessage($existing),
                    'conversation' => $this->serializeConversation($conversation->refresh()->load(['members.user', 'latestMessage.sender']), $sender),
                    'deduplicated' => true,
                ];
            }
        }

        $message = $this->chat->createMessage($conversation->id, $sender->id, $this->normalizeBody($body), $clientMessageId);
        $conversation = $conversation->refresh()->load(['members.user', 'latestMessage.sender']);
        $responsePayload = [
            'message' => $this->serializeMessage($message),
            'conversation' => $this->serializeConversation($conversation, $sender),
        ];

        HookManager::doAction('moabom-chat.message.after_create', $message, $conversation, $sender);
        HookManager::broadcast(
            $this->conversationChannelName($conversation),
            'message.created',
            [
                'message' => $this->serializeMessage($message),
                'conversation_uuid' => $conversation->uuid,
                'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            ],
        );

        return $responsePayload + ['deduplicated' => false];
    }

    /**
     * @return array<string, mixed>
     */
    public function markRead(User $viewer, string $conversationUuid, ?int $messageId = null): array
    {
        $conversation = $this->requireConversationForMember($viewer, $conversationUuid);
        if ($messageId !== null && ! $this->chat->messageBelongsToConversation($conversation->id, $messageId)) {
            throw new \InvalidArgumentException('message_not_found');
        }

        $member = $this->chat->markRead($conversation->id, $viewer->id, $messageId);

        $payload = [
            'conversation_uuid' => $conversation->uuid,
            'user_uuid' => $viewer->uuid,
            'last_read_message_id' => $member?->last_read_message_id,
            'last_read_at' => $member?->last_read_at?->toIso8601String(),
        ];

        HookManager::broadcast(
            $this->conversationChannelName($conversation),
            'conversation.read',
            $payload,
        );

        return $payload;
    }

    /**
     * @return array<string, mixed>
     */
    public function eligibility(User $viewer, User $target): array
    {
        return $this->resolveEligibility($viewer, $target);
    }

    /**
     * @return array<string, mixed>
     */
    public function listBlocks(User $viewer): array
    {
        return [
            'blocks' => $this->chat->listBlocks($viewer->id)
                ->map(fn (ChatUserBlock $block) => $this->serializeBlock($block))
                ->values()
                ->all(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function blockUser(User $viewer, User $target, ?string $reason = null): array
    {
        if ($viewer->id === $target->id) {
            throw new \InvalidArgumentException('cannot_block_self');
        }

        $block = $this->chat->upsertBlock($viewer->id, $target->id, $reason);

        return ['block' => $this->serializeBlock($block->load('blocked'))];
    }

    public function unblockUser(User $viewer, User $target): array
    {
        return ['deleted' => $this->chat->deleteBlock($viewer->id, $target->id) > 0];
    }

    public function canAccessConversation(User $viewer, string $conversationUuid): bool
    {
        $conversation = $this->chat->findConversationByUuid($conversationUuid);
        if (! $conversation) {
            return false;
        }

        return $this->chat->findMember($conversation->id, $viewer->id) !== null;
    }

    public function conversationChannelName(ChatConversation $conversation): string
    {
        return 'module.moabom-chat.tenant.'.$this->tenantId().'.conversation.'.$conversation->uuid;
    }

    private function requireConversationForMember(User $viewer, string $conversationUuid): ChatConversation
    {
        $conversation = $this->chat->findConversationByUuid($conversationUuid);
        if (! $conversation || ! $this->chat->findMember($conversation->id, $viewer->id)) {
            throw new \InvalidArgumentException('conversation_not_found');
        }

        return $conversation;
    }

    private function assertConversationWritable(User $sender, ChatConversation $conversation): void
    {
        foreach ($conversation->members as $member) {
            if ((int) $member->user_id === (int) $sender->id || ! $member->user) {
                continue;
            }

            $eligibility = $this->resolveEligibility($sender, $member->user);
            if (! $eligibility['can_chat']) {
                throw new \InvalidArgumentException((string) $eligibility['reason']);
            }
        }
    }

    /**
     * @return array{can_chat: bool, reason: ?string}
     */
    private function resolveEligibility(User $viewer, User $target): array
    {
        if ($viewer->id === $target->id) {
            return ['can_chat' => false, 'reason' => 'cannot_chat_self'];
        }

        if ($this->chat->findBlock($viewer->id, $target->id)) {
            return ['can_chat' => false, 'reason' => 'blocked_by_self'];
        }

        if ($this->chat->findBlock($target->id, $viewer->id)) {
            return ['can_chat' => false, 'reason' => 'blocked_by_peer'];
        }

        $targetPreferences = $this->preferences->getOrCreateForUser($target->id);
        if (! $this->presencePresentation->acceptsChatRequests($targetPreferences)) {
            return ['can_chat' => false, 'reason' => 'chat_request_rejected'];
        }

        return ['can_chat' => true, 'reason' => null];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeConversation(ChatConversation $conversation, User $viewer): array
    {
        $member = $conversation->members->first(fn ($row) => (int) $row->user_id === (int) $viewer->id);
        $lastReadMessageId = $member?->last_read_message_id ? (int) $member->last_read_message_id : null;

        return [
            'uuid' => $conversation->uuid,
            'type' => $conversation->type->value,
            'title' => $conversation->title,
            'display_title' => $this->resolveConversationTitle($conversation, $viewer),
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'unread_count' => $this->chat->countUnread($conversation->id, $viewer->id, $lastReadMessageId),
            'channel' => $this->conversationChannelName($conversation),
            'members' => $conversation->members
                ->map(fn ($member) => $this->serializeMember($member->user))
                ->filter()
                ->values()
                ->all(),
            'latest_message' => $conversation->latestMessage ? $this->serializeMessage($conversation->latestMessage) : null,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function serializeMember(?User $user): ?array
    {
        if (! $user) {
            return null;
        }

        return [
            'user_uuid' => $user->uuid,
            'display_name' => (string) ($user->nickname ?: $user->name),
            'avatar' => $user->getAvatarUrl(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeMessage(ChatMessage $message): array
    {
        return [
            'id' => $message->id,
            'uuid' => $message->uuid,
            'conversation_uuid' => $message->conversation?->uuid,
            'sender' => $this->serializeMember($message->sender),
            'body' => $message->body,
            'type' => $message->type,
            'client_message_id' => $message->client_message_id,
            'created_at' => $message->created_at?->toIso8601String(),
            'edited_at' => $message->edited_at?->toIso8601String(),
        ];
    }

    private function serializeBlock(ChatUserBlock $block): array
    {
        return [
            'user_uuid' => $block->blocked?->uuid,
            'display_name' => (string) ($block->blocked?->nickname ?: $block->blocked?->name),
            'avatar' => $block->blocked?->getAvatarUrl(),
            'reason' => $block->reason,
            'created_at' => $block->created_at?->toIso8601String(),
        ];
    }

    private function resolveConversationTitle(ChatConversation $conversation, User $viewer): string
    {
        if ($conversation->type === ChatConversationType::Group && trim((string) $conversation->title) !== '') {
            return (string) $conversation->title;
        }

        $names = $conversation->members
            ->filter(fn ($member) => (int) $member->user_id !== (int) $viewer->id)
            ->map(fn ($member) => (string) ($member->user?->nickname ?: $member->user?->name))
            ->filter()
            ->values();

        return $names->isNotEmpty() ? $names->join(', ') : '대화';
    }

    private function normalizeTitle(?string $title): ?string
    {
        $trimmed = trim((string) $title);

        return $trimmed !== '' ? mb_substr($trimmed, 0, 120) : null;
    }

    private function normalizeBody(string $body): string
    {
        $trimmed = trim($body);
        if ($trimmed === '') {
            throw new \InvalidArgumentException('message_body_required');
        }

        return mb_substr($trimmed, 0, 4000);
    }

    private function focusCacheKey(int $userId): string
    {
        return 'moabom_chat:focus:'.$this->tenantId().':'.$userId;
    }

    private function tenantId(): string
    {
        return (string) ($this->tenantContext->tenantId() ?: 'default');
    }
}
