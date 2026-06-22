<?php

namespace Modules\Moabom\Presence\Contracts;

interface PlatformPresenceSessionRepositoryInterface
{
    public function upsertHeartbeat(array $attributes): void;

    public function pruneStale(\DateTimeInterface $before): int;

    public function countActive(\DateTimeInterface $since): int;
}
