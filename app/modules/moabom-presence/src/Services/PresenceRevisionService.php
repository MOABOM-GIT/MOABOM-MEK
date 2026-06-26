<?php

namespace Modules\Moabom\Presence\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Modules\Moabom\Presence\Events\PresenceRevisionBroadcastEvent;
use Modules\Moabom\Presence\Support\PresenceChannelNames;

final class PresenceRevisionService
{
    public function __construct(
        private PresenceChannelNames $channelNames,
    ) {}

    public function current(): int
    {
        return (int) Cache::get($this->cacheKey(), 0);
    }

    public function bump(string $reason = 'heartbeat'): int
    {
        $revision = (int) Cache::increment($this->cacheKey());
        $tenantSlug = $this->channelNames->tenantSlug();

        $this->broadcastRevision(
            $this->channelNames->tenantRevisionChannel(),
            $tenantSlug,
            $revision,
            $reason,
        );

        return $revision;
    }

    public function bumpPlatform(string $reason = 'mirror'): int
    {
        $revision = (int) Cache::increment($this->platformCacheKey());

        $this->broadcastRevision(
            $this->channelNames->platformRevisionChannel(),
            'platform',
            $revision,
            $reason,
        );

        return $revision;
    }

    private function cacheKey(): string
    {
        return 'moabom-presence:revision:'.$this->channelNames->tenantSlug();
    }

    private function platformCacheKey(): string
    {
        return 'moabom-presence:revision:platform';
    }

    private function broadcastRevision(string $channelName, string $scopeSlug, int $revision, string $reason): void
    {
        $driver = config('broadcasting.default');

        if (in_array($driver, ['null', 'log', null], true)) {
            return;
        }

        $connection = config("broadcasting.connections.{$driver}");
        if (empty($connection['options']['host'] ?? null)) {
            return;
        }

        try {
            broadcast(new PresenceRevisionBroadcastEvent(
                $channelName,
                $scopeSlug,
                $revision,
                $reason,
            ));
        } catch (\Throwable $exception) {
            Log::warning('moabom_presence_revision_broadcast_failed', [
                'channel' => $channelName,
                'scope' => $scopeSlug,
                'revision' => $revision,
                'message' => $exception->getMessage(),
            ]);
        }
    }
}
