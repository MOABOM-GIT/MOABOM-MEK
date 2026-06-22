<?php

namespace Modules\Moabom\Presence\Repositories;

use Modules\Moabom\Presence\Contracts\PlatformPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Models\PlatformPresenceSession;

class PlatformPresenceSessionRepository implements PlatformPresenceSessionRepositoryInterface
{
    public function upsertHeartbeat(array $attributes): void
    {
        PlatformPresenceSession::query()->updateOrCreate(
            ['session_key' => $attributes['session_key']],
            $attributes,
        );
    }

    public function pruneStale(\DateTimeInterface $before): int
    {
        return PlatformPresenceSession::query()
            ->where('last_seen_at', '<', $before)
            ->delete();
    }

    public function countActive(\DateTimeInterface $since): int
    {
        return PlatformPresenceSession::query()
            ->where('last_seen_at', '>=', $since)
            ->count();
    }
}
