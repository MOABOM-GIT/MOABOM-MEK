<?php

namespace Modules\Moabom\Presence\Support;

use Modules\Moabom\System\Saas\TenantContext;

/**
 * Presence WebSocket 채널명 SSOT.
 */
final class PresenceChannelNames
{
    public const TENANT_ONLINE_PATTERN = 'module.moabom-presence.tenant.%s.online';

    public const TENANT_REVISION_PATTERN = 'module.moabom-presence.tenant.%s.revision';

    public const PLATFORM_REVISION_CHANNEL = 'module.moabom-presence.platform.revision';

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

    public function tenantRevisionChannel(): string
    {
        return sprintf(self::TENANT_REVISION_PATTERN, $this->tenantSlug());
    }

    public function platformRevisionChannel(): string
    {
        return self::PLATFORM_REVISION_CHANNEL;
    }
}
