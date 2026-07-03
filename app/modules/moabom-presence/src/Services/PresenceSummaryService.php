<?php

namespace Modules\Moabom\Presence\Services;

use Modules\Moabom\Presence\Contracts\PlatformPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Support\PresenceChannelNames;

final class PresenceSummaryService
{
    public function __construct(
        private TenantPresenceSessionRepositoryInterface $tenantSessions,
        private PlatformPresenceSessionRepositoryInterface $platformSessions,
        private PresenceChannelNames $channelNames,
        private PresenceRevisionService $revisionService,
        private PresencePlatformMirrorService $platformMirror,
    ) {}

    /**
     * @return array{
     *   platform_total: int,
     *   tenant_active: int,
     *   mirror_ok: bool,
     *   mirror_degraded: bool,
     *   revision: int,
     *   revision_channel: string,
     *   platform_revision_channel: string,
     *   presence_channel: string,
     *   heartbeat_interval_sec: int
     * }
     */
    public function getSummary(): array
    {
        $since = now()->subSeconds(PresenceHeartbeatService::ACTIVE_TTL_SECONDS);
        $tenantActive = $this->tenantSessions->countConnectVisible($since);

        $platformTotal = 0;
        $connectionOk = true;

        try {
            $platformTotal = $this->platformSessions->countActive($since);
        } catch (\Throwable) {
            $connectionOk = false;
        }

        return [
            'platform_total' => $platformTotal,
            'tenant_active' => $tenantActive,
            'mirror_ok' => $connectionOk,
            'mirror_degraded' => ! $connectionOk || $this->platformMirror->isMirrorDegraded(),
            'revision' => $this->revisionService->current(),
            'revision_channel' => $this->channelNames->tenantRevisionChannel(),
            'platform_revision_channel' => $this->channelNames->platformRevisionChannel(),
            'presence_channel' => $this->channelNames->tenantOnlineChannel(),
            'heartbeat_interval_sec' => PresenceHeartbeatService::HEARTBEAT_INTERVAL_SECONDS,
        ];
    }
}
