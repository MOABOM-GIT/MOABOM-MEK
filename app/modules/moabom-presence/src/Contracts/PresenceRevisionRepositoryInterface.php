<?php

namespace Modules\Moabom\Presence\Contracts;

interface PresenceRevisionRepositoryInterface
{
    public function currentTenant(string $tenantSlug): int;

    public function bumpTenant(string $tenantSlug, string $reason): int;

    public function currentPlatform(): int;

    public function bumpPlatform(string $reason): int;
}
