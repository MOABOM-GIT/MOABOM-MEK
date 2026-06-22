<?php

namespace Modules\Moabom\Presence\Services;

use App\Models\User;
use Modules\Moabom\Presence\Contracts\FriendshipRepositoryInterface;
use Modules\Moabom\Presence\Contracts\PresenceUserPreferencesRepositoryInterface;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Models\TenantPresenceSession;

final class TenantOnlineUsersService
{
    public function __construct(
        private TenantPresenceSessionRepositoryInterface $tenantSessions,
        private FriendshipRepositoryInterface $friendships,
        private PresenceUserPreferencesRepositoryInterface $preferences,
        private PresencePresentationService $presentation,
    ) {}

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listOnlineUsers(?User $viewer, int $limit = 50): array
    {
        $since = now()->subSeconds(PresenceHeartbeatService::ACTIVE_TTL_SECONDS);
        $sessions = $this->tenantSessions->listConnectVisible($since, $limit);

        $userIds = $sessions
            ->pluck('user_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $preferenceMap = $this->preferences->findForUsers($userIds);
        $relationMap = $viewer
            ? $this->friendships->mapRelationStatusForViewer($viewer->id, $userIds)
            : [];

        return $sessions
            ->map(fn (TenantPresenceSession $session) => $this->serializeSession(
                $session,
                $relationMap,
                $session->user_id ? $preferenceMap->get((int) $session->user_id) : null,
            ))
            ->values()
            ->all();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listFriendsOnline(?User $viewer, int $limit = 50): array
    {
        if (! $viewer) {
            return [];
        }

        $since = now()->subSeconds(PresenceHeartbeatService::ACTIVE_TTL_SECONDS);
        $sessions = $this->tenantSessions->listActive($since, $limit * 4);

        $friendRows = $this->friendships->listAcceptedForUser($viewer->id);
        $friendUserIds = $friendRows
            ->map(fn ($row) => (int) ($row->requester_id === $viewer->id ? $row->addressee_id : $row->requester_id))
            ->unique()
            ->values()
            ->all();

        if ($friendUserIds === []) {
            return [];
        }

        $preferenceMap = $this->preferences->findForUsers($friendUserIds);
        $relationMap = array_fill_keys($friendUserIds, 'accepted');

        return $sessions
            ->filter(fn (TenantPresenceSession $session) => $session->user_id && in_array((int) $session->user_id, $friendUserIds, true))
            ->map(fn (TenantPresenceSession $session) => $this->serializeSession(
                $session,
                $relationMap,
                $preferenceMap->get((int) $session->user_id),
            ))
            ->take($limit)
            ->values()
            ->all();
    }

    /**
     * @param  array<int, string>  $relationMap
     * @return array<string, mixed>
     */
    private function serializeSession(
        TenantPresenceSession $session,
        array $relationMap,
        ?\Modules\Moabom\Presence\Models\PresenceUserPreference $preferences,
    ): array {
        $userId = $session->user_id ? (int) $session->user_id : null;
        $user = $session->relationLoaded('user') ? $session->user : null;
        $availability = $this->presentation->availabilityFor($preferences);
        $isReachable = $this->presentation->isReachable(true, $preferences);
        $subtitle = $session->status_text ?: $this->presentation->resolveSubtitle($user, $preferences);

        return [
            'session_key' => $session->session_key,
            'user_uuid' => $user?->uuid,
            'display_name' => $session->display_name,
            'status_text' => $subtitle,
            'presence_subtitle' => $subtitle,
            'avatar' => $session->avatar,
            'is_authenticated' => $session->is_authenticated,
            'availability' => $availability->value,
            'is_online' => $isReachable,
            'client_form_factor' => $session->client_form_factor,
            'friendship' => $userId ? ($relationMap[$userId] ?? 'none') : 'none',
            'last_seen_at' => $session->last_seen_at?->toIso8601String(),
        ];
    }
}
