<?php

namespace Modules\Moabom\Chat\Contracts;

use Illuminate\Support\Collection;
use Modules\Moabom\Chat\Models\ChatConversation;
use Modules\Moabom\Chat\Models\ChatConversationMember;
use Modules\Moabom\Chat\Models\ChatMessage;
use Modules\Moabom\Chat\Models\ChatUserBlock;

interface ChatRepositoryInterface
{
    /**
     * @return Collection<int, ChatConversation>
     */
    public function listConversationsForUser(int $userId, ?string $search, int $limit): Collection;

    public function findConversationByUuid(string $uuid): ?ChatConversation;

    public function findMember(int $conversationId, int $userId): ?ChatConversationMember;

    /**
     * @param  list<int>  $userIds
     */
    public function findDirectConversation(array $userIds): ?ChatConversation;

    /**
     * @param  list<int>  $memberIds
     */
    public function createConversation(int $creatorId, string $type, ?string $title, array $memberIds): ChatConversation;

    /**
     * @return Collection<int, ChatMessage>
     */
    public function listMessages(int $conversationId, ?int $beforeId, int $limit): Collection;

    public function findMessageByClientId(int $conversationId, int $senderId, string $clientMessageId): ?ChatMessage;

    public function messageBelongsToConversation(int $conversationId, int $messageId): bool;

    public function createMessage(int $conversationId, int $senderId, string $body, ?string $clientMessageId): ChatMessage;

    public function markRead(int $conversationId, int $userId, ?int $messageId): ?ChatConversationMember;

    public function countUnread(int $conversationId, int $userId, ?int $lastReadMessageId): int;

    public function setMemberMutedUntil(int $conversationId, int $userId, ?\DateTimeInterface $mutedUntil): ?ChatConversationMember;

    public function removeMember(int $conversationId, int $userId): bool;

    public function restoreMemberIfTrashed(int $conversationId, int $userId): bool;

    public function findMessageByUuid(string $messageUuid): ?ChatMessage;

    public function softDeleteMessage(int $messageId, int $senderId): bool;

    public function findBlock(int $blockerId, int $blockedId): ?ChatUserBlock;

    public function upsertBlock(int $blockerId, int $blockedId, ?string $reason = null): ChatUserBlock;

    public function deleteBlock(int $blockerId, int $blockedId): int;

    /**
     * @return Collection<int, ChatUserBlock>
     */
    public function listBlocks(int $blockerId): Collection;
}
