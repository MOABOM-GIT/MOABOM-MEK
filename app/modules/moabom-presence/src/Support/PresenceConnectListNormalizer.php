<?php

namespace Modules\Moabom\Presence\Support;

use Illuminate\Support\Collection;
use Modules\Moabom\Presence\Models\TenantPresenceSession;

/**
 * 접속자 목록 — 인증 사용자는 user_id, guest 는 visitor_id(없으면 session_key) 기준 1행.
 * 승격된 visitor_id 는 guest 목록에서 제외.
 * viewerMaskedIp 가 있으면 동일 마스크 IP guest 도 제외(조회자 본인 잔여 shadow — 공유망 전역 삭제 아님).
 */
final class PresenceConnectListNormalizer
{
    /**
     * @param  Collection<int, TenantPresenceSession>  $sessions
     * @return Collection<int, TenantPresenceSession>
     */
    public static function dedupe(
        Collection $sessions,
        int $limit,
        ?string $viewerMaskedIp = null,
    ): Collection {
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

        $authenticatedSessionKeys = $authenticated
            ->pluck('session_key')
            ->map(fn ($sessionKey) => is_string($sessionKey) ? trim($sessionKey) : '')
            ->filter(fn (string $sessionKey): bool => $sessionKey !== '')
            ->unique()
            ->values();

        $hideIp = is_string($viewerMaskedIp) ? trim($viewerMaskedIp) : '';

        $guests = $sessions
            ->filter(fn (TenantPresenceSession $session): bool => $session->user_id === null)
            ->filter(function (TenantPresenceSession $session) use (
                $authenticatedSessionKeys,
                $authenticatedVisitorIds,
                $hideIp,
            ): bool {
                $visitorId = is_string($session->visitor_id) ? trim($session->visitor_id) : '';
                if ($visitorId !== '' && $authenticatedVisitorIds->contains($visitorId)) {
                    return false;
                }

                $sessionKey = is_string($session->session_key) ? trim($session->session_key) : '';
                if ($sessionKey !== '' && $authenticatedSessionKeys->contains($sessionKey)) {
                    return false;
                }

                if ($hideIp !== '') {
                    $guestIp = is_string($session->client_ip_masked) ? trim($session->client_ip_masked) : '';
                    if ($guestIp !== '' && $guestIp === $hideIp) {
                        return false;
                    }
                }

                return true;
            })
            ->sortByDesc(fn (TenantPresenceSession $session) => $session->last_seen_at)
            ->unique(fn (TenantPresenceSession $session): string => self::guestIdentityKey($session));

        return $authenticated
            ->concat($guests)
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
