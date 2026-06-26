<?php

namespace Modules\Moabom\Presence\Support;

use Illuminate\Support\Collection;
use Modules\Moabom\Presence\Models\TenantPresenceSession;

/**
 * 접속자 목록 — 인증 사용자는 user_id, guest 는 visitor_id(없으면 session_key) 기준 1행.
 * 승격된 visitor_id 는 guest 목록에서 제외.
 */
final class PresenceConnectListNormalizer
{
    /**
     * @param  Collection<int, TenantPresenceSession>  $sessions
     * @return Collection<int, TenantPresenceSession>
     */
    public static function dedupe(Collection $sessions, int $limit): Collection
    {
        $authenticated = $sessions
            ->filter(fn (TenantPresenceSession $session): bool => $session->user_id !== null)
            ->sortByDesc(fn (TenantPresenceSession $session) => $session->last_seen_at)
            ->unique(fn (TenantPresenceSession $session): int => (int) $session->user_id);

        $authenticatedVisitorIds = $authenticated
            ->pluck('visitor_id')
            ->map(fn ($visitorId) => is_string($visitorId) ? trim($visitorId) : '')
            ->filter(fn (string $visitorId): bool => $visitorId !== '')
            ->unique()
            ->values();

        $guests = $sessions
            ->filter(fn (TenantPresenceSession $session): bool => $session->user_id === null)
            ->filter(function (TenantPresenceSession $session) use ($authenticatedVisitorIds): bool {
                $visitorId = is_string($session->visitor_id) ? trim($session->visitor_id) : '';
                if ($visitorId === '') {
                    return true;
                }

                return ! $authenticatedVisitorIds->contains($visitorId);
            })
            ->sortByDesc(fn (TenantPresenceSession $session) => $session->last_seen_at)
            ->unique(fn (TenantPresenceSession $session): string => self::guestIdentityKey($session));

        return $guests
            ->concat($authenticated)
            ->sortByDesc(fn (TenantPresenceSession $session) => $session->last_seen_at)
            ->take($limit)
            ->values();
    }

    private static function guestIdentityKey(TenantPresenceSession $session): string
    {
        $visitorId = is_string($session->visitor_id) ? trim($session->visitor_id) : '';
        if ($visitorId !== '') {
            return 'visitor:'.$visitorId;
        }

        return 'session:'.$session->session_key;
    }
}
