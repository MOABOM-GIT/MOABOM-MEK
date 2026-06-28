<?php

namespace Modules\Moabom\Presence\Services;

use Illuminate\Support\Facades\Log;
use Modules\Moabom\Presence\Contracts\PresenceRevisionRepositoryInterface;
use Modules\Moabom\Presence\Events\PresenceRevisionBroadcastEvent;
use Modules\Moabom\Presence\Support\PresenceChannelNames;

final class PresenceRevisionService
{
    public function __construct(
        private PresenceChannelNames $channelNames,
        private PresenceRevisionRepositoryInterface $revisions,
    ) {}

    public function current(): int
    {
        return $this->revisions->currentTenant($this->channelNames->tenantSlug());
    }

    public function bump(string $reason = 'heartbeat'): int
    {
        $tenantSlug = $this->channelNames->tenantSlug();
        $revision = $this->revisions->bumpTenant($tenantSlug, $reason);

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
        $revision = $this->revisions->bumpPlatform($reason);

        $this->broadcastRevision(
            $this->channelNames->platformRevisionChannel(),
            'platform',
            $revision,
            $reason,
        );

        return $revision;
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
