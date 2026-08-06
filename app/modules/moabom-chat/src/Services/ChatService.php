<?php

namespace Modules\Moabom\Chat\Services;

use App\Contracts\Extension\CacheInterface;
use App\Extension\HookManager;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Support\Str;
use Modules\Moabom\Chat\Contracts\ChatRepositoryInterface;
use Modules\Moabom\Chat\Enums\ChatConversationType;
use Modules\Moabom\Chat\Models\ChatConversation;
use Modules\Moabom\Chat\Models\ChatConversationMember;
use Modules\Moabom\Chat\Models\ChatMessage;
use Modules\Moabom\Chat\Models\ChatUserBlock;
use Modules\Moabom\Presence\Contracts\PresenceUserPreferencesRepositoryInterface;
use Modules\Moabom\Presence\Services\PresencePresentationService;
use Modules\Moabom\System\Saas\TenantContext;

final class ChatService
{
    private const FOCUS_CACHE_TTL_SECONDS = 1800;

    /** hours 미지정 mute 시 muted_until SSOT (사실상 무기한) */
    private const INDEFINITE_MUTE_YEARS = 10;

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
        $this->focusCache()->put(
            $this->focusCacheKey($viewer->id),
            $conversation->uuid,
            self::FOCUS_CACHE_TTL_SECONDS,
        );
    }

    public function clearConversationFocus(User $viewer, ?string $conversationUuid = null): void
    {
        $key = $this->focusCacheKey($viewer->id);
        $store = $this->focusCache();
        if ($conversationUuid === null) {
            $store->forget($key);

            return;
        }

        if ($store->get($key) === $conversationUuid) {
            $store->forget($key);
        }
    }

    public function isFocusedOnConversation(User $viewer, string $conversationUuid): bool
    {
        return $this->focusCache()->get($this->focusCacheKey($viewer->id)) === $conversationUuid;
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
        } else {
            $this->chat->restoreMemberIfTrashed($conversation->id, (int) $creator->id);
            $conversation = $conversation->refresh()->load(['members.user', 'membersIncludingTrashed.user', 'latestMessage.sender']);
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
            'peer_read' => $this->serializePeerReadStates($conversation, $viewer),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function sendMessage(User $sender, string $conversationUuid, string $body, ?string $clientMessageId = null): array
    {
        $conversation = $this->requireConversationForMember($sender, $conversationUuid);
        $this->assertSenderCanSend($sender, $conversation);

        if ($clientMessageId) {
            $existing = $this->chat->findMessageByClientId($conversation->id, $sender->id, $clientMessageId);
            if ($existing) {
                return [
                    'message' => $this->serializeMessage($existing),
                    'conversation' => $this->serializeConversation(
                        $conversation->refresh()->load(['members.user', 'membersIncludingTrashed.user', 'latestMessage.sender']),
                        $sender,
                    ),
                    'deduplicated' => true,
                ];
            }
        }

        $message = $this->chat->createMessage($conversation->id, $sender->id, $this->normalizeBody($body), $clientMessageId);
        $this->restoreTrashedDirectPeerMembers($conversation, $sender);
        $conversation = $conversation->refresh()->load(['members.user', 'membersIncludingTrashed.user', 'latestMessage.sender']);
        $responsePayload = [
            'message' => $this->serializeMessage($message),
            'conversation' => $this->serializeConversation($conversation, $sender),
        ];

        HookManager::doAction('moabom-chat.message.after_create', $message, $conversation, $sender);
        HookManager::broadcast(
            $this->conversationChannelName($conversation),
            'message.created',
            $this->eventEnvelope('chat.message', (int) $message->id, (string) $message->uuid) + [
                'message' => $this->serializeMessage($message),
                'conversation_uuid' => $conversation->uuid,
                'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            ],
        );
        $this->broadcastInboxUpdated($conversation, $message, $sender);

        return $responsePayload + ['deduplicated' => false];
    }

    /**
     * @return array<string, mixed>
     */
    public function signalTyping(User $viewer, string $conversationUuid): array
    {
        $conversation = $this->requireConversationForMember($viewer, $conversationUuid);
        $conversation->loadMissing(['membersIncludingTrashed.user']);

        if (! $this->senderIsActiveMember($conversation, $viewer)) {
            throw new \InvalidArgumentException('conversation_not_found');
        }

        $payload = [
            'conversation_uuid' => $conversation->uuid,
            'user_uuid' => $viewer->uuid,
        ];

        HookManager::broadcast(
            $this->conversationChannelName($conversation),
            'conversation.typing',
            $payload,
        );

        return $payload;
    }

    /**
     * @return array<string, mixed>
     */
    public function leaveConversation(User $viewer, string $conversationUuid): array
    {
        $conversation = $this->requireConversationForMember($viewer, $conversationUuid);

        if (! $this->chat->removeMember($conversation->id, $viewer->id)) {
            throw new \InvalidArgumentException('conversation_not_found');
        }

        $this->clearConversationFocus($viewer, $conversation->uuid);

        $conversation = $conversation->refresh()->load([
            'members.user',
            'membersIncludingTrashed.user',
            'latestMessage.sender',
        ]);

        HookManager::broadcast(
            "core.user.notifications.{$viewer->uuid}",
            'chat.inbox.updated',
            $this->eventEnvelope('chat.inbox', null, (string) Str::uuid()) + [
                'conversation_uuid' => $conversation->uuid,
                'reason' => 'member.left.self',
                'removed' => true,
            ],
        );
        $this->broadcastInboxStateToActiveMembers($conversation, 'member.left');
        $this->broadcastConversationMemberLeft($conversation, $viewer);

        return [
            'conversation_uuid' => $conversation->uuid,
            'deleted' => true,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function muteConversation(User $viewer, string $conversationUuid, ?int $hours = null): array
    {
        $conversation = $this->requireConversationForMember($viewer, $conversationUuid);
        $mutedUntil = match (true) {
            $hours !== null && $hours <= 0 => null,
            $hours === null => now()->addYears(self::INDEFINITE_MUTE_YEARS),
            default => now()->addHours(min($hours, 24 * 365)),
        };

        $member = $this->chat->setMemberMutedUntil($conversation->id, $viewer->id, $mutedUntil);

        if ($hours !== null && $hours <= 0) {
            $this->clearConversationFocus($viewer, $conversation->uuid);
        }

        return [
            'conversation_uuid' => $conversation->uuid,
            'muted_until' => $member?->muted_until?->toIso8601String(),
            'is_muted' => $this->isMemberMuted($member),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function deleteMessage(User $viewer, string $messageUuid): array
    {
        $message = $this->chat->findMessageByUuid($messageUuid);
        if (! $message || ! $message->conversation) {
            throw new \InvalidArgumentException('message_not_found');
        }

        $conversation = $message->conversation;
        if (! $this->chat->findMember($conversation->id, $viewer->id)) {
            throw new \InvalidArgumentException('conversation_not_found');
        }

        if ((int) $message->sender_id !== (int) $viewer->id) {
            throw new \InvalidArgumentException('message_delete_forbidden');
        }

        if (! $this->chat->softDeleteMessage($message->id, $viewer->id)) {
            throw new \InvalidArgumentException('message_not_found');
        }

        $payload = [
            'message_uuid' => $message->uuid,
            'conversation_uuid' => $conversation->uuid,
        ];

        HookManager::broadcast(
            $this->conversationChannelName($conversation),
            'message.deleted',
            $this->eventEnvelope('chat.message', (int) $message->id, (string) Str::uuid()) + $payload,
        );
        $conversation = $conversation->refresh()->load([
            'members.user',
            'membersIncludingTrashed.user',
            'latestMessage.sender',
        ]);
        $this->broadcastInboxStateToActiveMembers($conversation, 'message.deleted');

        return $payload;
    }

    public function isMemberMuted(?ChatConversationMember $member): bool
    {
        if (! $member || ! $member->muted_until) {
            return false;
        }

        return $member->muted_until->isFuture();
    }

    public function isConversationMutedForUser(User $viewer, string $conversationUuid): bool
    {
        $conversation = $this->chat->findConversationByUuid($conversationUuid);
        if (! $conversation) {
            return false;
        }

        $member = $this->chat->findMember($conversation->id, $viewer->id);

        return $this->isMemberMuted($member);
    }

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
            $this->eventEnvelope('chat.read', (int) ($member?->last_read_message_id ?? 0), (string) Str::uuid()) + $payload,
        );
        HookManager::broadcast(
            "core.user.notifications.{$viewer->uuid}",
            'chat.inbox.updated',
            $this->eventEnvelope('chat.inbox', (int) ($member?->last_read_message_id ?? 0), (string) Str::uuid()) + [
                'conversation_uuid' => $conversation->uuid,
                'conversation' => $this->serializeConversation(
                    $conversation->refresh()->load(['members.user', 'membersIncludingTrashed.user', 'latestMessage.sender']),
                    $viewer,
                ),
                'reason' => 'conversation.read',
            ],
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

    private function broadcastInboxUpdated(ChatConversation $conversation, ChatMessage $message, User $sender): void
    {
        $serializedMessage = $this->serializeMessage($message);
        $lastMessageAt = $conversation->last_message_at?->toIso8601String();

        foreach ($conversation->members as $member) {
            $recipient = $member->user;
            if (! $recipient || (int) $recipient->id === (int) $sender->id) {
                continue;
            }

            HookManager::broadcast(
                "core.user.notifications.{$recipient->uuid}",
                'chat.inbox.updated',
                $this->eventEnvelope(
                    'chat.inbox',
                    (int) $message->id,
                    "chat:message:{$message->uuid}:{$recipient->uuid}",
                ) + [
                    'conversation_uuid' => $conversation->uuid,
                    'message' => $serializedMessage,
                    'conversation' => $this->serializeConversation($conversation, $recipient),
                    'last_message_at' => $lastMessageAt,
                    'message_uuid' => $message->uuid,
                    'notification_expected' => ! $this->isMemberMuted($member)
                        && ! $this->isFocusedOnConversation($recipient, $conversation->uuid),
                ],
            );
        }
    }

    private function broadcastInboxStateToActiveMembers(ChatConversation $conversation, string $reason): void
    {
        foreach ($conversation->members as $member) {
            $recipient = $member->user;
            if (! $recipient) {
                continue;
            }

            HookManager::broadcast(
                "core.user.notifications.{$recipient->uuid}",
                'chat.inbox.updated',
                $this->eventEnvelope('chat.inbox', null, (string) Str::uuid()) + [
                    'conversation_uuid' => $conversation->uuid,
                    'conversation' => $this->serializeConversation($conversation, $recipient),
                    'reason' => $reason,
                ],
            );
        }
    }

    private function restoreTrashedDirectPeerMembers(ChatConversation $conversation, User $actor): void
    {
        if ($conversation->type !== ChatConversationType::Direct) {
            return;
        }

        $conversation->loadMissing('membersIncludingTrashed');
        foreach ($conversation->membersIncludingTrashed as $member) {
            if ((int) $member->user_id === (int) $actor->id || ! $member->trashed()) {
                continue;
            }

            $this->chat->restoreMemberIfTrashed($conversation->id, (int) $member->user_id);
        }
    }

    private function requireConversationForMember(User $viewer, string $conversationUuid): ChatConversation
    {
        $conversation = $this->chat->findConversationByUuid($conversationUuid);
        if (! $conversation || ! $this->chat->findMember($conversation->id, $viewer->id)) {
            throw new \InvalidArgumentException('conversation_not_found');
        }

        return $conversation;
    }

    private function assertSenderCanSend(User $sender, ChatConversation $conversation): void
    {
        $conversation->loadMissing(['membersIncludingTrashed.user', 'members.user']);

        if (! $this->senderIsActiveMember($conversation, $sender)) {
            throw new \InvalidArgumentException('conversation_not_found');
        }

        foreach ($conversation->membersIncludingTrashed as $member) {
            if ((int) $member->user_id === (int) $sender->id || ! $member->user || $member->trashed()) {
                continue;
            }

            $eligibility = $this->resolveEligibility($sender, $member->user);
            if (! $eligibility['can_chat']) {
                throw new \InvalidArgumentException((string) $eligibility['reason']);
            }
        }
    }

    private function senderIsActiveMember(ChatConversation $conversation, User $sender): bool
    {
        $conversation->loadMissing('membersIncludingTrashed');

        return $conversation->membersIncludingTrashed
            ->contains(fn (ChatConversationMember $row) => (int) $row->user_id === (int) $sender->id && ! $row->trashed());
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
        $memberRows = $conversation->relationLoaded('membersIncludingTrashed')
            ? $conversation->membersIncludingTrashed
            : $conversation->members;

        return [
            'uuid' => $conversation->uuid,
            'type' => $conversation->type->value,
            'title' => $conversation->title,
            'display_title' => $this->resolveConversationTitle($conversation, $viewer),
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'unread_count' => $this->chat->countUnread($conversation->id, $viewer->id, $lastReadMessageId),
            'channel' => $this->conversationChannelName($conversation),
            'members' => $memberRows
                ->map(fn (ChatConversationMember $memberRow) => $this->serializeMemberRow($memberRow))
                ->filter()
                ->values()
                ->all(),
            'latest_message' => $conversation->latestMessage ? $this->serializeMessage($conversation->latestMessage) : null,
            'peer_read' => $this->serializePeerReadStates($conversation, $viewer),
            'is_muted' => $this->isMemberMuted($member),
            'muted_until' => $member?->muted_until?->toIso8601String(),
            'is_writable' => $this->resolveConversationWritable($conversation, $viewer, $memberRows),
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function serializePeerReadStates(ChatConversation $conversation, User $viewer): array
    {
        return $conversation->members
            ->filter(fn (ChatConversationMember $member) => (int) $member->user_id !== (int) $viewer->id)
            ->map(function (ChatConversationMember $member) {
                $user = $member->user;
                if (! $user) {
                    return null;
                }

                return [
                    'user_uuid' => $user->uuid,
                    'last_read_message_id' => $member->last_read_message_id ? (int) $member->last_read_message_id : null,
                    'last_read_at' => $member->last_read_at?->toIso8601String(),
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    /**
     * @return array<string, mixed>|null
     */
    private function serializeMemberRow(ChatConversationMember $member): ?array
    {
        $serialized = $this->serializeMember($member->user);
        if (! $serialized) {
            return null;
        }

        if ($member->trashed()) {
            $serialized['has_left'] = true;
        }

        return $serialized;
    }

    /**
     * @param  \Illuminate\Support\Collection<int, ChatConversationMember>  $memberRows
     */
    private function resolveConversationWritable(
        ChatConversation $conversation,
        User $viewer,
        \Illuminate\Support\Collection $memberRows,
    ): bool {
        $viewerMember = $memberRows->first(fn (ChatConversationMember $row) => (int) $row->user_id === (int) $viewer->id);
        if (! $viewerMember || $viewerMember->trashed()) {
            return false;
        }

        return true;
    }

    private function broadcastConversationMemberLeft(ChatConversation $conversation, User $whoLeft): void
    {
        HookManager::broadcast(
            $this->conversationChannelName($conversation),
            'conversation.member_left',
            $this->eventEnvelope('chat.member', null, (string) Str::uuid()) + [
                'conversation_uuid' => $conversation->uuid,
                'user_uuid' => $whoLeft->uuid,
            ],
        );
    }

    /**
     * @return array<string, mixed>|null
     */
    private function serializeMember(?User $user): ?array
    {
        if (! $user) {
            return null;
        }

        $nickname = trim((string) $user->nickname);
        $realName = trim((string) $user->name);

        return [
            'user_uuid' => $user->uuid,
            'display_name' => $nickname !== '' ? $nickname : $realName,
            'nickname' => $nickname !== '' ? $nickname : $realName,
            'real_name' => $realName,
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

    /**
     * 활성 대화 포커스 — Cloud Run 멀티 인스턴스 간 공유 (file 캐시는 인스턴스 로컬).
     */
    private function focusCache(): CacheInterface
    {
        return $this->cache->withStore('database');
    }

    /**
     * @return array{event_id: string, domain: string, revision: int, occurred_at: string}
     */
    private function eventEnvelope(string $domain, ?int $revision = null, ?string $eventId = null): array
    {
        $occurredAt = now();

        return [
            'event_id' => $eventId ?: (string) Str::uuid(),
            'domain' => $domain,
            'revision' => $revision ?? (int) $occurredAt->format('Uv'),
            'occurred_at' => $occurredAt->toIso8601String(),
        ];
    }

    private function tenantId(): string
    {
        return (string) ($this->tenantContext->tenantId() ?: 'default');
    }
}
