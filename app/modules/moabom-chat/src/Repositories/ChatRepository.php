<?php

namespace Modules\Moabom\Chat\Repositories;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Moabom\Chat\Contracts\ChatRepositoryInterface;
use Modules\Moabom\Chat\Enums\ChatMemberRole;
use Modules\Moabom\Chat\Models\ChatConversation;
use Modules\Moabom\Chat\Models\ChatConversationMember;
use Modules\Moabom\Chat\Models\ChatMessage;
use Modules\Moabom\Chat\Models\ChatUserBlock;

class ChatRepository implements ChatRepositoryInterface
{
    public function listConversationsForUser(int $userId, ?string $search, int $limit): Collection
    {
        $query = ChatConversation::query()
            ->with(['members.user', 'latestMessage.sender'])
            ->whereHas('members', fn ($memberQuery) => $memberQuery->where('user_id', $userId))
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->limit($limit);

        $term = trim((string) $search);
        if ($term !== '') {
            $query->where(function ($nested) use ($term): void {
                $nested->where('title', 'like', '%'.$term.'%')
                    ->orWhereHas('members.user', function ($userQuery) use ($term): void {
                        $userQuery->where('name', 'like', '%'.$term.'%')
                            ->orWhere('nickname', 'like', '%'.$term.'%');
                    });
            });
        }

        return $query->get();
    }

    public function findConversationByUuid(string $uuid): ?ChatConversation
    {
        return ChatConversation::query()
            ->with(['members.user', 'latestMessage.sender'])
            ->where('uuid', $uuid)
            ->first();
    }

    public function findMember(int $conversationId, int $userId): ?ChatConversationMember
    {
        return ChatConversationMember::query()
            ->where('conversation_id', $conversationId)
            ->where('user_id', $userId)
            ->first();
    }

    public function findDirectConversation(array $userIds): ?ChatConversation
    {
        $ids = collect($userIds)->map(fn ($id) => (int) $id)->unique()->sort()->values();
        if ($ids->count() !== 2) {
            return null;
        }

        return ChatConversation::query()
            ->with(['members.user', 'latestMessage.sender'])
            ->where('type', 'direct')
            ->where('direct_key', $this->directKey($ids->all()))
            ->first();
    }

    public function createConversation(int $creatorId, string $type, ?string $title, array $memberIds): ChatConversation
    {
        return DB::transaction(function () use ($creatorId, $memberIds, $title, $type): ChatConversation {
            $conversation = ChatConversation::query()->create([
                'uuid' => (string) Str::uuid(),
                'type' => $type,
                'title' => $title,
                'direct_key' => $type === 'direct' ? $this->directKey($memberIds) : null,
                'created_by' => $creatorId,
            ]);

            foreach (collect($memberIds)->map(fn ($id) => (int) $id)->unique()->values() as $memberId) {
                ChatConversationMember::query()->create([
                    'conversation_id' => $conversation->id,
                    'user_id' => $memberId,
                    'role' => $memberId === $creatorId ? ChatMemberRole::Owner : ChatMemberRole::Member,
                    'last_read_at' => $memberId === $creatorId ? now() : null,
                ]);
            }

            return $conversation->refresh()->load(['members.user', 'latestMessage.sender']);
        });
    }

    public function listMessages(int $conversationId, ?int $beforeId, int $limit): Collection
    {
        $query = ChatMessage::query()
            ->with(['sender', 'conversation'])
            ->where('conversation_id', $conversationId)
            ->orderByDesc('id')
            ->limit($limit);

        if ($beforeId !== null && $beforeId > 0) {
            $query->where('id', '<', $beforeId);
        }

        return $query->get()->sortBy('id')->values();
    }

    public function findMessageByClientId(int $conversationId, int $senderId, string $clientMessageId): ?ChatMessage
    {
        return ChatMessage::query()
            ->with(['sender', 'conversation'])
            ->where('conversation_id', $conversationId)
            ->where('sender_id', $senderId)
            ->where('client_message_id', $clientMessageId)
            ->first();
    }

    public function messageBelongsToConversation(int $conversationId, int $messageId): bool
    {
        return ChatMessage::query()
            ->where('conversation_id', $conversationId)
            ->where('id', $messageId)
            ->exists();
    }

    public function createMessage(int $conversationId, int $senderId, string $body, ?string $clientMessageId): ChatMessage
    {
        return DB::transaction(function () use ($body, $clientMessageId, $conversationId, $senderId): ChatMessage {
            $message = ChatMessage::query()->create([
                'uuid' => (string) Str::uuid(),
                'conversation_id' => $conversationId,
                'sender_id' => $senderId,
                'client_message_id' => $clientMessageId,
                'type' => 'text',
                'body' => $body,
            ]);

            ChatConversation::query()
                ->where('id', $conversationId)
                ->update(['last_message_at' => $message->created_at]);

            return $message->refresh()->load(['sender', 'conversation']);
        });
    }

    public function markRead(int $conversationId, int $userId, ?int $messageId): ?ChatConversationMember
    {
        $member = $this->findMember($conversationId, $userId);
        if (! $member) {
            return null;
        }

        $resolvedMessageId = $messageId ?: ChatMessage::query()
            ->where('conversation_id', $conversationId)
            ->max('id');

        $member->last_read_at = now();
        $member->last_read_message_id = $resolvedMessageId ?: null;
        $member->save();

        return $member->refresh();
    }

    public function countUnread(int $conversationId, int $userId, ?int $lastReadMessageId): int
    {
        return ChatMessage::query()
            ->where('conversation_id', $conversationId)
            ->where('sender_id', '!=', $userId)
            ->when($lastReadMessageId, fn ($query) => $query->where('id', '>', $lastReadMessageId))
            ->count();
    }

    public function findBlock(int $blockerId, int $blockedId): ?ChatUserBlock
    {
        return ChatUserBlock::query()
            ->where('blocker_id', $blockerId)
            ->where('blocked_id', $blockedId)
            ->first();
    }

    public function upsertBlock(int $blockerId, int $blockedId, ?string $reason = null): ChatUserBlock
    {
        return ChatUserBlock::query()->updateOrCreate(
            ['blocker_id' => $blockerId, 'blocked_id' => $blockedId],
            ['reason' => $reason],
        );
    }

    public function deleteBlock(int $blockerId, int $blockedId): int
    {
        return ChatUserBlock::query()
            ->where('blocker_id', $blockerId)
            ->where('blocked_id', $blockedId)
            ->delete();
    }

    public function listBlocks(int $blockerId): Collection
    {
        return ChatUserBlock::query()
            ->with('blocked')
            ->where('blocker_id', $blockerId)
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * @param  array<int, int>  $memberIds
     */
    private function directKey(array $memberIds): string
    {
        return collect($memberIds)
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->sort()
            ->values()
            ->join(':');
    }
}
