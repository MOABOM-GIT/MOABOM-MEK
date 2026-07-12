<?php

namespace Modules\Moabom\Presence\Repositories;

use Illuminate\Support\Collection;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Enums\PresenceAvailability;
use Modules\Moabom\Presence\Models\TenantPresenceSession;
use Modules\Moabom\Presence\Support\PresenceConnectListNormalizer;
use Modules\Moabom\Presence\Support\PresenceTenantSchema;

class TenantPresenceSessionRepository implements TenantPresenceSessionRepositoryInterface
{
    /** @var list<string> */
    private const HEARTBEAT_COLUMNS = [
        'session_key',
        'visitor_id',
        'user_id',
        'display_name',
        'status_text',
        'avatar',
        'is_authenticated',
        'client_form_factor',
        'client_ip_masked',
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

        $uniqueKey = isset($payload['visitor_id'])
            && $this->tenantSchema->hasColumn(PresenceTenantSchema::TABLE_TENANT_SESSIONS, 'visitor_id')
            ? ['visitor_id' => $payload['visitor_id']]
            : ['session_key' => $payload['session_key']];

        $existing = TenantPresenceSession::query()->where($uniqueKey)->first();

        if ($existing && $existing->user_id && empty($payload['user_id'])) {
            return $existing;
        }

        return TenantPresenceSession::query()->updateOrCreate(
            $uniqueKey,
            $payload,
        );
    }

    public function releaseAuthenticatedSessionForVisitor(string $visitorId, array $attributes): bool
    {
        if (! $this->isHeartbeatWritable()
            || ! $this->tenantSchema->hasColumn(PresenceTenantSchema::TABLE_TENANT_SESSIONS, 'visitor_id')) {
            return false;
        }

        $trimmedVisitorId = trim($visitorId);
        if ($trimmedVisitorId === '') {
            return false;
        }

        $existing = TenantPresenceSession::query()->where('visitor_id', $trimmedVisitorId)->first();
        if (! $existing || ! $existing->user_id) {
            return false;
        }

        $payload = $this->tenantSchema->pickWritableColumns(
            PresenceTenantSchema::TABLE_TENANT_SESSIONS,
            array_merge($attributes, [
                'user_id' => null,
                'is_authenticated' => false,
                'avatar' => null,
            ]),
            self::HEARTBEAT_COLUMNS,
        );

        $existing->update($payload);

        return true;
    }

    public function deleteOtherSessionsForUser(int $userId, string $visitorId): int
    {
        if (! $this->tenantSchema->isTenantSessionsReady()
            || ! $this->tenantSchema->hasColumn(PresenceTenantSchema::TABLE_TENANT_SESSIONS, 'visitor_id')) {
            return 0;
        }

        return TenantPresenceSession::query()
            ->where('user_id', $userId)
            ->where('visitor_id', '!=', $visitorId)
            ->delete();
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

    public function purgeGuestShadowsForVisitor(string $visitorId, array $legacySessionKeys): int
    {
        if (! $this->tenantSchema->isTenantSessionsReady()
            || ! $this->tenantSchema->hasColumn(PresenceTenantSchema::TABLE_TENANT_SESSIONS, 'visitor_id')) {
            return 0;
        }

        $trimmedVisitorId = trim($visitorId);
        if ($trimmedVisitorId === '' && $legacySessionKeys === []) {
            return 0;
        }

        $legacyKeys = array_values(array_unique(array_filter($legacySessionKeys)));

        return TenantPresenceSession::query()
            ->whereNull('user_id')
            ->where(function ($query) use ($trimmedVisitorId, $legacyKeys): void {
                if ($trimmedVisitorId !== '') {
                    $query->where('visitor_id', $trimmedVisitorId);
                }

                if ($legacyKeys !== []) {
                    $method = $trimmedVisitorId !== '' ? 'orWhereIn' : 'whereIn';
                    $query->{$method}('session_key', $legacyKeys);
                }
            })
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

        // 목록(TenantOnlineUsersService)과 동일 dedupe — raw row count 이중 집계 방지
        $sessions = $this->connectVisibleQuery($since)
            ->orderByDesc('last_seen_at')
            ->get();

        return PresenceConnectListNormalizer::dedupe($sessions, PHP_INT_MAX)->count();
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
