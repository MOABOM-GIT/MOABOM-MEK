<?php

namespace Modules\Moabom\Presence\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Modules\Moabom\Presence\Contracts\PlatformPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Support\PresenceChannelNames;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;

/**
 * 테넌트 heartbeat → 플랫폼 DB mirror SSOT.
 */
final class PresencePlatformMirrorService
{
    private const PLATFORM_REVISION_DEBOUNCE_SECONDS = 2;

    public function __construct(
        private PlatformPresenceSessionRepositoryInterface $platformSessions,
        private PresenceChannelNames $channelNames,
        private PresenceRevisionService $revisionService,
        private PlatformConnectionFactory $platformConnections,
    ) {}

    /**
     * @param  array<string, mixed>  $attributes
     */
    public function mirrorHeartbeat(array $attributes): bool
    {
        try {
            $this->platformConnections->registerConnection();
            $this->platformSessions->upsertHeartbeat($attributes);
            $this->maybeBumpPlatformRevision();

            return true;
        } catch (\Throwable $exception) {
            Log::warning('moabom_presence_platform_mirror_failed', [
                'tenant_slug' => $attributes['tenant_slug'] ?? $this->channelNames->tenantSlug(),
                'visitor_id' => $attributes['visitor_id'] ?? null,
                'message' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    private function maybeBumpPlatformRevision(): void
    {
        if (! Cache::add('moabom-presence:platform-revision-debounce', 1, self::PLATFORM_REVISION_DEBOUNCE_SECONDS)) {
            return;
        }

        $this->revisionService->bumpPlatform('mirror');
    }
}
