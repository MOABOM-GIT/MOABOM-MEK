<?php

namespace Modules\Moabom\Presence\Repositories;

use Modules\Moabom\Presence\Contracts\PlatformPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Models\PlatformPresenceSession;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;

class PlatformPresenceSessionRepository implements PlatformPresenceSessionRepositoryInterface
{
    public function __construct(
        private PlatformConnectionFactory $platformConnections,
    ) {}

    public function upsertHeartbeat(array $attributes): void
    {
        $this->ensurePlatformConnection();

        $payload = $this->normalizeHeartbeatAttributes($attributes);

        PlatformPresenceSession::query()->updateOrCreate(
            ['session_key' => $payload['session_key']],
            $payload,
        );
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
        return [
            'session_key' => (string) $attributes['session_key'],
            'tenant_slug' => (string) $attributes['tenant_slug'],
            'user_uuid' => isset($attributes['user_uuid']) ? (string) $attributes['user_uuid'] : null,
            'display_name' => (string) $attributes['display_name'],
            'is_authenticated' => (bool) ($attributes['is_authenticated'] ?? false),
            'last_seen_at' => $attributes['last_seen_at'],
        ];
    }
}
