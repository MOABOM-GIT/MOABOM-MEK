<?php

namespace Modules\Moabom\Presence\Contracts;

use Illuminate\Support\Collection;
use Modules\Moabom\Presence\Models\TenantPresenceSession;

interface TenantPresenceSessionRepositoryInterface
{
    public function isHeartbeatWritable(): bool;

    public function upsertHeartbeat(array $attributes): TenantPresenceSession;

    /**
     * @param  array<int, string>  $sessionKeys
     */
    public function deleteBySessionKeys(array $sessionKeys): int;

    public function pruneStale(\DateTimeInterface $before): int;

    public function countActive(\DateTimeInterface $since): int;

    public function countConnectVisible(\DateTimeInterface $since): int;

    public function hasActiveSessionForUser(int $userId, \DateTimeInterface $since): bool;

    public function findActiveSessionForUser(int $userId, \DateTimeInterface $since): ?TenantPresenceSession;

    /**
     * @return Collection<int, TenantPresenceSession>
     */
    public function listConnectVisible(\DateTimeInterface $since, int $limit = 100): Collection;

    /**
     * @return Collection<int, TenantPresenceSession>
     */
    public function listActive(\DateTimeInterface $since, int $limit = 100): Collection;
}
