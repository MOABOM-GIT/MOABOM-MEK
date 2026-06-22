<?php

namespace Modules\Moabom\Presence\Support;

use Modules\Moabom\System\Saas\TenantContext;

/**
 * Presence WebSocket 채널명 SSOT.
 */
final class PresenceChannelNames
{
    public const TENANT_ONLINE_PATTERN = 'module.moabom-presence.tenant.%s.online';

    public function __construct(
        private TenantContext $tenantContext,
    ) {}

    public function tenantSlug(): string
    {
        return $this->tenantContext->tenantId() ?? 'default';
    }

    public function tenantOnlineChannel(): string
    {
        return sprintf(self::TENANT_ONLINE_PATTERN, $this->tenantSlug());
    }
}
