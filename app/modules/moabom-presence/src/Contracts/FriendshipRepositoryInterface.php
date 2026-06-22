<?php

namespace Modules\Moabom\Presence\Contracts;

use App\Models\User;
use Illuminate\Support\Collection;
use Modules\Moabom\Presence\Models\Friendship;

interface FriendshipRepositoryInterface
{
    public function findBetween(int $userIdA, int $userIdB): ?Friendship;

    public function createRequest(int $requesterId, int $addresseeId): Friendship;

    public function updateStatus(Friendship $friendship, string $status, ?\DateTimeInterface $acceptedAt = null): Friendship;

    public function deletePair(int $userIdA, int $userIdB): int;

    /**
     * @return Collection<int, Friendship>
     */
    public function listAcceptedForUser(int $userId): Collection;

    /**
     * @return array<int, string> user_id => status key for friendship with viewer
     */
    public function mapRelationStatusForViewer(int $viewerId, array $targetUserIds): array;
}
