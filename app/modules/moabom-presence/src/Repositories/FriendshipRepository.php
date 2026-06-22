<?php

namespace Modules\Moabom\Presence\Repositories;

use Illuminate\Support\Collection;
use Modules\Moabom\Presence\Contracts\FriendshipRepositoryInterface;
use Modules\Moabom\Presence\Enums\FriendshipStatus;
use Modules\Moabom\Presence\Models\Friendship;

class FriendshipRepository implements FriendshipRepositoryInterface
{
    public function findBetween(int $userIdA, int $userIdB): ?Friendship
    {
        return Friendship::query()
            ->where(function ($query) use ($userIdA, $userIdB): void {
                $query->where('requester_id', $userIdA)->where('addressee_id', $userIdB);
            })
            ->orWhere(function ($query) use ($userIdA, $userIdB): void {
                $query->where('requester_id', $userIdB)->where('addressee_id', $userIdA);
            })
            ->first();
    }

    public function createRequest(int $requesterId, int $addresseeId): Friendship
    {
        return Friendship::query()->create([
            'requester_id' => $requesterId,
            'addressee_id' => $addresseeId,
            'status' => FriendshipStatus::Pending,
        ]);
    }

    public function updateStatus(Friendship $friendship, string $status, ?\DateTimeInterface $acceptedAt = null): Friendship
    {
        $friendship->status = FriendshipStatus::from($status);
        $friendship->accepted_at = $acceptedAt;
        $friendship->save();

        return $friendship->refresh();
    }

    public function deletePair(int $userIdA, int $userIdB): int
    {
        return Friendship::query()
            ->where(function ($query) use ($userIdA, $userIdB): void {
                $query->where('requester_id', $userIdA)->where('addressee_id', $userIdB);
            })
            ->orWhere(function ($query) use ($userIdA, $userIdB): void {
                $query->where('requester_id', $userIdB)->where('addressee_id', $userIdA);
            })
            ->delete();
    }

    public function listAcceptedForUser(int $userId): Collection
    {
        return Friendship::query()
            ->with(['requester', 'addressee'])
            ->where('status', FriendshipStatus::Accepted)
            ->where(function ($query) use ($userId): void {
                $query->where('requester_id', $userId)->orWhere('addressee_id', $userId);
            })
            ->orderByDesc('accepted_at')
            ->get();
    }

    public function mapRelationStatusForViewer(int $viewerId, array $targetUserIds): array
    {
        if ($viewerId <= 0 || $targetUserIds === []) {
            return [];
        }

        $rows = Friendship::query()
            ->where(function ($query) use ($viewerId, $targetUserIds): void {
                $query->where('requester_id', $viewerId)->whereIn('addressee_id', $targetUserIds);
            })
            ->orWhere(function ($query) use ($viewerId, $targetUserIds): void {
                $query->where('addressee_id', $viewerId)->whereIn('requester_id', $targetUserIds);
            })
            ->get();

        $map = [];
        foreach ($rows as $row) {
            $otherId = (int) ($row->requester_id === $viewerId ? $row->addressee_id : $row->requester_id);
            if ($row->status === FriendshipStatus::Accepted) {
                $map[$otherId] = 'accepted';
            } elseif ($row->status === FriendshipStatus::Pending) {
                $map[$otherId] = $row->requester_id === $viewerId ? 'outgoing_pending' : 'incoming_pending';
            } elseif ($row->status === FriendshipStatus::Blocked) {
                $map[$otherId] = 'blocked';
            }
        }

        return $map;
    }
}
