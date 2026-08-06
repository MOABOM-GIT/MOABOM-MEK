<?php

namespace Modules\Moabom\Presence\Services;

use App\Extension\HookManager;
use App\Models\User;
use Illuminate\Support\Str;
use Modules\Moabom\Presence\Contracts\FriendshipRepositoryInterface;
use Modules\Moabom\Presence\Contracts\PresenceUserPreferencesRepositoryInterface;
use Modules\Moabom\Presence\Enums\FriendshipStatus;
use Modules\Moabom\Presence\Models\Friendship;

final class FriendshipService
{
    public function __construct(
        private FriendshipRepositoryInterface $friendships,
        private TenantOnlineUsersService $onlineUsers,
        private PresenceUserPreferencesRepositoryInterface $preferences,
        private PresencePresentationService $presentation,
        private PresenceRevisionService $revisionService,
    ) {}

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listFriends(User $viewer): array
    {
        $rows = $this->friendships->listAcceptedForUser($viewer->id);
        $onlineByUuid = collect($this->onlineUsers->listFriendsOnline($viewer, 200))
            ->filter(fn (array $row) => ! empty($row['user_uuid']))
            ->keyBy('user_uuid');

        $friendUserIds = $rows
            ->map(fn (Friendship $friendship) => (int) ($friendship->requester_id === $viewer->id
                ? $friendship->addressee_id
                : $friendship->requester_id))
            ->unique()
            ->values()
            ->all();

        $preferenceMap = $this->preferences->findForUsers($friendUserIds);

        return $rows
            ->map(function (Friendship $friendship) use ($viewer, $onlineByUuid, $preferenceMap): array {
                $friend = (int) $friendship->requester_id === $viewer->id
                    ? $friendship->addressee
                    : $friendship->requester;

                $online = $friend ? $onlineByUuid->get($friend->uuid) : null;
                $prefs = $friend ? $preferenceMap->get($friend->id) : null;
                $availability = $this->presentation->availabilityFor($prefs);
                $hasSession = $online !== null;
                $isReachable = $this->presentation->isReachable($hasSession, $prefs);
                $subtitle = $online['presence_subtitle']
                    ?? $this->presentation->resolveSubtitle($friend, $prefs);

                return [
                    'user_uuid' => $friend?->uuid,
                    'display_name' => (string) ($friend?->nickname ?: $friend?->name),
                    'avatar' => $this->presentation->resolveConnectListAvatar($friend, $prefs),
                    'status_text' => $subtitle,
                    'presence_subtitle' => $subtitle,
                    'availability' => $availability->value,
                    'is_online' => $isReachable,
                    'friendship' => 'accepted',
                    'accepted_at' => $friendship->accepted_at?->toIso8601String(),
                ];
            })
            ->filter(fn (array $row) => $row['user_uuid'] !== null)
            ->values()
            ->all();
    }

    public function sendRequest(User $requester, User $addressee): Friendship
    {
        if ($requester->id === $addressee->id) {
            throw new \InvalidArgumentException('cannot_friend_self');
        }

        $existing = $this->friendships->findBetween($requester->id, $addressee->id);
        if ($existing) {
            if ($existing->status === FriendshipStatus::Accepted) {
                return $existing;
            }
            if ($existing->status === FriendshipStatus::Pending && $existing->addressee_id === $requester->id) {
                $friendship = $this->friendships->updateStatus($existing, FriendshipStatus::Accepted->value, now());

                return $this->finalizeAcceptedFriendship($friendship, $existing->requester, $existing->addressee);
            }

            throw new \InvalidArgumentException('friendship_already_exists');
        }

        $friendship = $this->friendships->createRequest($requester->id, $addressee->id);
        $this->revisionService->bump('friendship_requested');
        HookManager::doAction('moabom-presence.friendship.after_request', $friendship, $requester, $addressee);
        $this->broadcastFriendshipState([$requester, $addressee], 'friendship_requested');

        return $friendship;
    }

    public function acceptRequest(User $viewer, User $requester): Friendship
    {
        $existing = $this->friendships->findBetween($viewer->id, $requester->id);
        if (! $existing || $existing->status !== FriendshipStatus::Pending || $existing->requester_id !== $requester->id) {
            throw new \InvalidArgumentException('friendship_request_not_found');
        }

        $friendship = $this->friendships->updateStatus($existing, FriendshipStatus::Accepted->value, now());

        return $this->finalizeAcceptedFriendship($friendship, $requester, $viewer);
    }

    public function removeFriendship(User $viewer, User $other): int
    {
        $deleted = $this->friendships->deletePair($viewer->id, $other->id);
        if ($deleted > 0) {
            $this->revisionService->bump('friendship_removed');
            HookManager::doAction('moabom-presence.friendship.after_remove', $viewer, $other);
            $this->broadcastFriendshipState([$viewer, $other], 'friendship_removed');
        }

        return $deleted;
    }

    private function finalizeAcceptedFriendship(Friendship $friendship, User $requester, User $addressee): Friendship
    {
        $this->revisionService->bump('friendship_accepted');
        HookManager::doAction('moabom-presence.friendship.after_accept', $friendship, $requester, $addressee);
        $this->broadcastFriendshipState([$requester, $addressee], 'friendship_accepted');

        return $friendship;
    }

    /**
     * @param  list<User>  $users
     */
    private function broadcastFriendshipState(array $users, string $reason): void
    {
        $revision = $this->revisionService->current();
        foreach (collect($users)->unique('id') as $user) {
            $occurredAt = now();
            HookManager::broadcast(
                "core.user.notifications.{$user->uuid}",
                'presence.friends.updated',
                [
                    'event_id' => (string) Str::uuid(),
                    'domain' => 'presence.friends',
                    'revision' => $revision,
                    'occurred_at' => $occurredAt->toIso8601String(),
                    'reason' => $reason,
                    'friends' => $this->listFriends($user),
                ],
            );
        }
    }
}
