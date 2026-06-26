<?php

namespace Modules\Moabom\Presence\Repositories;

use Illuminate\Support\Facades\Schema;
use Modules\Moabom\Presence\Contracts\PlatformPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Models\PlatformPresenceSession;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;

class PlatformPresenceSessionRepository implements PlatformPresenceSessionRepositoryInterface
{
    private ?bool $visitorIdColumnReady = null;

    public function __construct(
        private PlatformConnectionFactory $platformConnections,
    ) {}

    public function upsertHeartbeat(array $attributes): void
    {
        $this->ensurePlatformConnection();

        $payload = $this->normalizeHeartbeatAttributes($attributes);

        $this->reconcileSessionKeyCollisions($payload);

        $uniqueKey = isset($payload['visitor_id']) && $this->hasVisitorIdColumn()
            ? [
                'tenant_slug' => $payload['tenant_slug'],
                'visitor_id' => $payload['visitor_id'],
            ]
            : ['session_key' => $payload['session_key']];

        $existing = PlatformPresenceSession::query()->where($uniqueKey)->first();

        if ($existing && $existing->is_authenticated && ! ($payload['is_authenticated'] ?? false)) {
            $existing->update([
                'session_key' => $payload['session_key'],
                'last_seen_at' => $payload['last_seen_at'],
            ]);

            return;
        }

        PlatformPresenceSession::query()->updateOrCreate(
            $uniqueKey,
            $payload,
        );
    }

    public function purgeGuestShadowsForVisitor(string $tenantSlug, string $visitorId, array $legacySessionKeys): int
    {
        if (! $this->hasVisitorIdColumn()) {
            return 0;
        }

        $this->ensurePlatformConnection();

        $trimmedVisitorId = trim($visitorId);
        $legacyKeys = array_values(array_unique(array_filter($legacySessionKeys)));

        if ($trimmedVisitorId === '' && $legacyKeys === []) {
            return 0;
        }

        return PlatformPresenceSession::query()
            ->where('tenant_slug', $tenantSlug)
            ->where('is_authenticated', false)
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

    public function deleteOtherSessionsForTenantUser(string $tenantSlug, ?string $userUuid, string $visitorId): int
    {
        if (! $userUuid || ! $this->hasVisitorIdColumn()) {
            return 0;
        }

        $this->ensurePlatformConnection();

        return PlatformPresenceSession::query()
            ->where('tenant_slug', $tenantSlug)
            ->where('user_uuid', $userUuid)
            ->where('visitor_id', '!=', $visitorId)
            ->delete();
    }

    public function deleteBySessionKeys(array $sessionKeys): int
    {
        $this->ensurePlatformConnection();

        $keys = array_values(array_unique(array_filter($sessionKeys)));
        if ($keys === []) {
            return 0;
        }

        return PlatformPresenceSession::query()
            ->whereIn('session_key', $keys)
            ->delete();
    }

    public function pruneStale(\DateTimeInterface $before): int
    {
        $this->ensurePlatformConnection();

        return PlatformPresenceSession::query()
            ->where('last_seen_at', '<', $before)
            ->delete();
    }

    public function countActive(\DateTimeInterface $since): int
    {
        $this->ensurePlatformConnection();

        return PlatformPresenceSession::query()
            ->where('last_seen_at', '>=', $since)
            ->count();
    }

    public function countActiveForTenant(string $tenantSlug, \DateTimeInterface $since): int
    {
        $this->ensurePlatformConnection();

        return PlatformPresenceSession::query()
            ->where('tenant_slug', $tenantSlug)
            ->where('last_seen_at', '>=', $since)
            ->count();
    }

    /**
     * visitor_id upsert 시 session_key unique 충돌(레거시 행)을 제거한다.
     *
     * @param  array<string, mixed>  $payload
     */
    private function reconcileSessionKeyCollisions(array $payload): void
    {
        $sessionKey = (string) ($payload['session_key'] ?? '');
        if ($sessionKey === '') {
            return;
        }

        $query = PlatformPresenceSession::query()->where('session_key', $sessionKey);

        if (isset($payload['visitor_id']) && $this->hasVisitorIdColumn()) {
            $query->where(function ($inner) use ($payload): void {
                $inner->whereNull('visitor_id')
                    ->orWhere('visitor_id', '!=', (string) $payload['visitor_id']);
            });
        }

        $query->delete();
    }

    private function ensurePlatformConnection(): void
    {
        $this->platformConnections->registerConnection();
    }

    /**
     * @return array{
     *   session_key: string,
     *   tenant_slug: string,
     *   user_uuid: ?string,
     *   display_name: string,
     *   is_authenticated: bool,
     *   last_seen_at: mixed
     * }
     */
    private function normalizeHeartbeatAttributes(array $attributes): array
    {
        $payload = [
            'session_key' => (string) $attributes['session_key'],
            'tenant_slug' => (string) $attributes['tenant_slug'],
            'user_uuid' => isset($attributes['user_uuid']) ? (string) $attributes['user_uuid'] : null,
            'display_name' => (string) $attributes['display_name'],
            'is_authenticated' => (bool) ($attributes['is_authenticated'] ?? false),
            'last_seen_at' => $attributes['last_seen_at'],
        ];

        if (isset($attributes['visitor_id']) && $this->hasVisitorIdColumn()) {
            $payload['visitor_id'] = (string) $attributes['visitor_id'];
        }

        return $payload;
    }

    private function hasVisitorIdColumn(): bool
    {
        if ($this->visitorIdColumnReady !== null) {
            return $this->visitorIdColumnReady;
        }

        $this->ensurePlatformConnection();

        return $this->visitorIdColumnReady = Schema::connection('moabom_platform')->hasColumn(
            'moabom_presence_platform_sessions',
            'visitor_id',
        );
    }
}
