<?php

namespace Modules\Moabom\Presence\Contracts;

use Illuminate\Support\Collection;
use Modules\Moabom\Presence\Models\TenantPresenceSession;

interface TenantPresenceSessionRepositoryInterface
{
    public function isHeartbeatWritable(): bool;

    public function upsertHeartbeat(array $attributes): TenantPresenceSession;

    /**
     * 로그아웃 touch 시 visitor에 묶인 member 세션을 guest로 해제합니다.
     */
    public function releaseAuthenticatedSessionForVisitor(string $visitorId, array $attributes): bool;

    /**
     * @param  array<int, string>  $sessionKeys
     */
    public function deleteBySessionKeys(array $sessionKeys): int;

    /**
     * 로그인 승격 후 동일 visitor·레거시 session_key guest 잔여 행 제거.
     *
     * @param  array<int, string>  $legacySessionKeys
     */
    public function purgeGuestShadowsForVisitor(string $visitorId, array $legacySessionKeys): int;

    /**
     * 로그인 시 동일 마스크 IP guest 잔여 행 제거(현재 visitor 제외).
     *
     * @return array{visitor_ids: list<string>, session_keys: list<string>}
     */
    public function purgeGuestShadowsForMaskedIp(string $maskedIp, string $exceptVisitorId): array;

    public function deleteOtherSessionsForUser(int $userId, string $visitorId): int;

    public function pruneStale(\DateTimeInterface $before): int;

    public function countActive(\DateTimeInterface $since): int;

    public function countConnectVisible(\DateTimeInterface $since): int;

    public function hasActiveSessionForUser(int $userId, \DateTimeInterface $since): bool;

    public function supportsReachabilityLease(): bool;

    public function hasReachableSessionForUser(int $userId, \DateTimeInterface $at): bool;

    public function acknowledgeReachabilityForUser(
        int $userId,
        \DateTimeInterface $activeSince,
        \DateTimeInterface $reachableUntil,
    ): bool;

    public function findActiveSessionForUser(int $userId, \DateTimeInterface $since): ?TenantPresenceSession;

    /**
     * @return Collection<int, TenantPresenceSession>
     */
    public function listConnectVisible(\DateTimeInterface $since, int $limit = 100): Collection;

    /**
     * @return Collection<int, TenantPresenceSession>
     */
    public function listActive(\DateTimeInterface $since, int $limit = 100): Collection;

    /**
     * @param  array<int, int>  $userIds
     * @return Collection<int, TenantPresenceSession>
     */
    public function listActiveForUserIds(
        \DateTimeInterface $since,
        array $userIds,
        int $limit = 100,
    ): Collection;
}
