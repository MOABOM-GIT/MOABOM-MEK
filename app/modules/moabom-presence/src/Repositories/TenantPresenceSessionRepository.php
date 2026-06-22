<?php

namespace Modules\Moabom\Presence\Repositories;

use Illuminate\Support\Collection;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Enums\PresenceAvailability;
use Modules\Moabom\Presence\Models\TenantPresenceSession;

class TenantPresenceSessionRepository implements TenantPresenceSessionRepositoryInterface
{
    public function upsertHeartbeat(array $attributes): TenantPresenceSession
    {
        return TenantPresenceSession::query()->updateOrCreate(
            ['session_key' => $attributes['session_key']],
            $attributes,
        );
    }

    public function pruneStale(\DateTimeInterface $before): int
    {
        return TenantPresenceSession::query()
            ->where('last_seen_at', '<', $before)
            ->delete();
    }

    public function countActive(\DateTimeInterface $since): int
    {
        return TenantPresenceSession::query()
            ->where('last_seen_at', '>=', $since)
            ->count();
    }

    public function countConnectVisible(\DateTimeInterface $since): int
    {
        return $this->connectVisibleQuery($since)->count();
    }

    public function hasActiveSessionForUser(int $userId, \DateTimeInterface $since): bool
    {
        return TenantPresenceSession::query()
            ->where('user_id', $userId)
            ->where('last_seen_at', '>=', $since)
            ->exists();
    }

    public function findActiveSessionForUser(int $userId, \DateTimeInterface $since): ?TenantPresenceSession
    {
        return TenantPresenceSession::query()
            ->where('user_id', $userId)
            ->where('last_seen_at', '>=', $since)
            ->orderByDesc('last_seen_at')
            ->first();
    }

    public function listConnectVisible(\DateTimeInterface $since, int $limit = 100): Collection
    {
        return $this->connectVisibleQuery($since)
            ->with('user')
            ->orderByDesc('last_seen_at')
            ->limit($limit)
            ->get();
    }

    public function listActive(\DateTimeInterface $since, int $limit = 100): Collection
    {
        return TenantPresenceSession::query()
            ->with('user')
            ->where('last_seen_at', '>=', $since)
            ->orderByDesc('last_seen_at')
            ->limit($limit)
            ->get();
    }

    private function connectVisibleQuery(\DateTimeInterface $since)
    {
        return TenantPresenceSession::query()
            ->from('moabom_presence_tenant_sessions as s')
            ->leftJoin('moabom_presence_user_preferences as p', 'p.user_id', '=', 's.user_id')
            ->where('s.last_seen_at', '>=', $since)
            ->where(function ($query): void {
                $query->whereNull('s.user_id')
                    ->orWhere(function ($inner): void {
                        $inner->whereNull('p.availability')
                            ->orWhere('p.availability', '!=', PresenceAvailability::Offline->value);
                    });
            })
            ->select('s.*');
    }
}
