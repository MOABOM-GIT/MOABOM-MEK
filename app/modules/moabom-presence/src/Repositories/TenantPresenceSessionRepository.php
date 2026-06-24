<?php

namespace Modules\Moabom\Presence\Repositories;

use Illuminate\Support\Collection;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Enums\PresenceAvailability;
use Modules\Moabom\Presence\Models\TenantPresenceSession;
use Modules\Moabom\Presence\Support\PresenceTenantSchema;

class TenantPresenceSessionRepository implements TenantPresenceSessionRepositoryInterface
{
    /** @var list<string> */
    private const HEARTBEAT_COLUMNS = [
        'session_key',
        'user_id',
        'display_name',
        'status_text',
        'avatar',
        'is_authenticated',
        'client_form_factor',
        'last_seen_at',
    ];

    public function __construct(
        private PresenceTenantSchema $tenantSchema,
    ) {}

    public function isHeartbeatWritable(): bool
    {
        return $this->tenantSchema->isTenantSessionsReady();
    }

    public function upsertHeartbeat(array $attributes): TenantPresenceSession
    {
        if (! $this->isHeartbeatWritable()) {
            throw new \RuntimeException('moabom_presence_tenant_sessions schema is not ready');
        }

        $payload = $this->tenantSchema->pickWritableColumns(
            PresenceTenantSchema::TABLE_TENANT_SESSIONS,
            $attributes,
            self::HEARTBEAT_COLUMNS,
        );

        if (! isset($payload['session_key'])) {
            throw new \InvalidArgumentException('heartbeat payload is missing session_key');
        }

        return TenantPresenceSession::query()->updateOrCreate(
            ['session_key' => $payload['session_key']],
            $payload,
        );
    }

    public function deleteBySessionKeys(array $sessionKeys): int
    {
        if (! $this->tenantSchema->isTenantSessionsReady()) {
            return 0;
        }

        $keys = array_values(array_unique(array_filter($sessionKeys)));
        if ($keys === []) {
            return 0;
        }

        return TenantPresenceSession::query()
            ->whereIn('session_key', $keys)
            ->delete();
    }

    public function pruneStale(\DateTimeInterface $before): int
    {
        if (! $this->tenantSchema->isTenantSessionsReady()) {
            return 0;
        }

        return TenantPresenceSession::query()
            ->where('last_seen_at', '<', $before)
            ->delete();
    }

    public function countActive(\DateTimeInterface $since): int
    {
        if (! $this->tenantSchema->isTenantSessionsReady()) {
            return 0;
        }

        return TenantPresenceSession::query()
            ->where('last_seen_at', '>=', $since)
            ->count();
    }

    public function countConnectVisible(\DateTimeInterface $since): int
    {
        if (! $this->tenantSchema->isTenantSessionsReady()) {
            return 0;
        }

        return $this->connectVisibleQuery($since)->count();
    }

    public function hasActiveSessionForUser(int $userId, \DateTimeInterface $since): bool
    {
        if (! $this->tenantSchema->isTenantSessionsReady()) {
            return false;
        }

        return TenantPresenceSession::query()
            ->where('user_id', $userId)
            ->where('last_seen_at', '>=', $since)
            ->exists();
    }

    public function findActiveSessionForUser(int $userId, \DateTimeInterface $since): ?TenantPresenceSession
    {
        if (! $this->tenantSchema->isTenantSessionsReady()) {
            return null;
        }

        return TenantPresenceSession::query()
            ->where('user_id', $userId)
            ->where('last_seen_at', '>=', $since)
            ->orderByDesc('last_seen_at')
            ->first();
    }

    public function listConnectVisible(\DateTimeInterface $since, int $limit = 100): Collection
    {
        if (! $this->tenantSchema->isTenantSessionsReady()) {
            return collect();
        }

        return $this->connectVisibleQuery($since)
            ->with('user')
            ->orderByDesc('last_seen_at')
            ->limit($limit)
            ->get();
    }

    public function listActive(\DateTimeInterface $since, int $limit = 100): Collection
    {
        if (! $this->tenantSchema->isTenantSessionsReady()) {
            return collect();
        }

        return TenantPresenceSession::query()
            ->with('user')
            ->where('last_seen_at', '>=', $since)
            ->orderByDesc('last_seen_at')
            ->limit($limit)
            ->get();
    }

    private function connectVisibleQuery(\DateTimeInterface $since)
    {
        $query = TenantPresenceSession::query()
            ->from('moabom_presence_tenant_sessions as s')
            ->where('s.last_seen_at', '>=', $since);

        if ($this->tenantSchema->hasTable(PresenceTenantSchema::TABLE_USER_PREFERENCES)) {
            $query->leftJoin('moabom_presence_user_preferences as p', 'p.user_id', '=', 's.user_id')
                ->where(function ($inner): void {
                    $inner->whereNull('s.user_id')
                        ->orWhere(function ($authQuery): void {
                            $authQuery->whereNull('p.availability')
                                ->orWhere('p.availability', '!=', PresenceAvailability::Offline->value);
                        });
                });
        }

        return $query->select('s.*');
    }
}
