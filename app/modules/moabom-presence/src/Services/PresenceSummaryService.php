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
    ) {}

    /**
     * @return array{
     *   platform_total: int,
     *   tenant_active: int,
     *   presence_channel: string,
     *   heartbeat_interval_sec: int
     * }
     */
    public function getSummary(): array
    {
        $since = now()->subSeconds(PresenceHeartbeatService::ACTIVE_TTL_SECONDS);

        $tenantActive = $this->tenantSessions->countConnectVisible($since);

        $platformTotal = $tenantActive;
        try {
            $platformTotal = $this->platformSessions->countActive($since);
        } catch (\Throwable) {
        }

        return [
            'platform_total' => $platformTotal,
            'tenant_active' => $tenantActive,
            'presence_channel' => $this->channelNames->tenantOnlineChannel(),
            'heartbeat_interval_sec' => PresenceHeartbeatService::HEARTBEAT_INTERVAL_SECONDS,
        ];
    }
}
