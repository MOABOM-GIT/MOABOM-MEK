<?php

namespace Modules\Moabom\Presence\Services;

use App\Models\User;
use Modules\Moabom\Presence\Contracts\FriendshipRepositoryInterface;
use Modules\Moabom\Presence\Contracts\PresenceUserPreferencesRepositoryInterface;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Models\TenantPresenceSession;
use Modules\Moabom\Presence\Support\PresenceConnectListNormalizer;

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
    public function listOnlineUsers(
        ?User $viewer,
        int $limit = 50,
        ?string $viewerMaskedIp = null,
    ): array {
        $since = now()->subSeconds(PresenceHeartbeatService::ACTIVE_TTL_SECONDS);
        $hideGuestIp = $viewer && $viewerMaskedIp ? $viewerMaskedIp : null;
        $sessions = PresenceConnectListNormalizer::dedupe(
            $this->tenantSessions->listConnectVisible($since, $limit * 3),
            $limit,
            $hideGuestIp,
        );

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

        $rows = $sessions
            ->filter(fn (TenantPresenceSession $session) => $session->user_id === null || $session->user?->uuid)
            ->map(fn (TenantPresenceSession $session) => $this->serializeSession(
                $session,
                $relationMap,
                $session->user_id ? $preferenceMap->get((int) $session->user_id) : null,
            ))
            ->values();

        if ($viewer?->uuid) {
            $viewerUuid = $viewer->uuid;
            $selfIndex = $rows->search(fn (array $row): bool => ($row['user_uuid'] ?? '') === $viewerUuid);
            if (is_int($selfIndex) && $selfIndex > 0) {
                $self = $rows->get($selfIndex);
                $rows->forget($selfIndex);
                $rows->prepend($self);
            }
        }

        return $rows->values()->all();
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
        $friendRows = $this->friendships->listAcceptedForUser($viewer->id);
        $friendUserIds = $friendRows
            ->map(fn ($row) => (int) ($row->requester_id === $viewer->id ? $row->addressee_id : $row->requester_id))
            ->unique()
            ->values()
            ->all();

        if ($friendUserIds === []) {
            return [];
        }

        // 전체 활성 세션을 가져와 PHP에서 거르지 않고 친구 ID를 SQL whereIn으로 제한한다.
        $sessions = $this->tenantSessions->listActiveForUserIds(
            $since,
            $friendUserIds,
            $limit * 2,
        );
        $preferenceMap = $this->preferences->findForUsers($friendUserIds);
        $relationMap = array_fill_keys($friendUserIds, 'accepted');

        return $sessions
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
        $subtitle = $session->user_id
            ? ($session->status_text ?: $this->presentation->resolveSubtitle($user, $preferences))
            : null;

        return [
            'session_key' => $session->session_key,
            'visitor_id' => $session->visitor_id,
            'client_ip_masked' => $session->client_ip_masked,
            'user_uuid' => $user?->uuid,
            'display_name' => $this->presentation->resolveConnectListDisplayName($session, $user),
            'status_text' => $subtitle,
            'presence_subtitle' => $subtitle,
            'avatar' => $this->presentation->resolveConnectListAvatar($user, $preferences),
            'is_authenticated' => $session->is_authenticated,
            'availability' => $availability->value,
            'is_online' => $isReachable,
            'client_form_factor' => $session->client_form_factor,
            'friendship' => $userId ? ($relationMap[$userId] ?? 'none') : 'none',
            'last_seen_at' => $session->last_seen_at?->toIso8601String(),
        ];
    }
}
