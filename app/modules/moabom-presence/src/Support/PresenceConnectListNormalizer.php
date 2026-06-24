<?php

namespace Modules\Moabom\Presence\Support;

use Illuminate\Support\Collection;
use Modules\Moabom\Presence\Models\TenantPresenceSession;

/**
 * 접속자 목록 — 인증 사용자는 user_id 기준 1행, guest 는 session_key 유지.
 */
final class PresenceConnectListNormalizer
{
    /**
     * @param  Collection<int, TenantPresenceSession>  $sessions
     * @return Collection<int, TenantPresenceSession>
     */
    public static function dedupe(Collection $sessions, int $limit): Collection
    {
        $guests = $sessions->filter(
            fn (TenantPresenceSession $session): bool => $session->user_id === null,
        );

        $authenticated = $sessions
            ->filter(fn (TenantPresenceSession $session): bool => $session->user_id !== null)
            ->sortByDesc(fn (TenantPresenceSession $session) => $session->last_seen_at)
            ->unique(fn (TenantPresenceSession $session): int => (int) $session->user_id);

        return $guests
            ->concat($authenticated)
            ->sortByDesc(fn (TenantPresenceSession $session) => $session->last_seen_at)
            ->take($limit)
            ->values();
    }
}
