<?php

namespace Modules\Moabom\Presence\Contracts;

interface PlatformPresenceSessionRepositoryInterface
{
    public function upsertHeartbeat(array $attributes): void;

    /**
     * @param  array<int, string>  $sessionKeys
     */
    public function deleteBySessionKeys(array $sessionKeys): int;

    public function pruneStale(\DateTimeInterface $before): int;

    public function countActive(\DateTimeInterface $since): int;
}
