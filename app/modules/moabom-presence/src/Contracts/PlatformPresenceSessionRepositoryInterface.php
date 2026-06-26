<?php

namespace Modules\Moabom\Presence\Contracts;

interface PlatformPresenceSessionRepositoryInterface
{
    public function upsertHeartbeat(array $attributes): void;

    /**
     * @param  array<int, string>  $sessionKeys
     */
    public function deleteBySessionKeys(array $sessionKeys): int;

    /**
     * @param  array<int, string>  $legacySessionKeys
     */
    public function purgeGuestShadowsForVisitor(string $tenantSlug, string $visitorId, array $legacySessionKeys): int;

    public function deleteOtherSessionsForTenantUser(string $tenantSlug, ?string $userUuid, string $visitorId): int;

    public function pruneStale(\DateTimeInterface $before): int;

    public function countActive(\DateTimeInterface $since): int;

    public function countActiveForTenant(string $tenantSlug, \DateTimeInterface $since): int;
}
