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

    private const MIRROR_DEGRADED_TTL_SECONDS = 120;

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
        $tenantSlug = (string) ($attributes['tenant_slug'] ?? $this->channelNames->tenantSlug());

        try {
            $this->platformConnections->registerConnection();
            $this->platformSessions->upsertHeartbeat($attributes);
            $this->maybeBumpPlatformRevision();
            Cache::forget($this->mirrorDegradedCacheKey($tenantSlug));

            return true;
        } catch (\Throwable $exception) {
            Cache::put(
                $this->mirrorDegradedCacheKey($tenantSlug),
                true,
                self::MIRROR_DEGRADED_TTL_SECONDS,
            );
            Log::warning('moabom_presence_platform_mirror_failed', [
                'tenant_slug' => $tenantSlug,
                'visitor_id' => $attributes['visitor_id'] ?? null,
                'message' => $exception->getMessage(),
            ]);

            return false;
        }
    }

    public function isMirrorDegraded(?string $tenantSlug = null): bool
    {
        $slug = $tenantSlug ?? $this->channelNames->tenantSlug();

        return (bool) Cache::get($this->mirrorDegradedCacheKey($slug), false);
    }

    private function mirrorDegradedCacheKey(string $tenantSlug): string
    {
        return 'moabom-presence:mirror-degraded:'.$tenantSlug;
    }

    private function maybeBumpPlatformRevision(): void
    {
        if (! Cache::add('moabom-presence:platform-revision-debounce', 1, self::PLATFORM_REVISION_DEBOUNCE_SECONDS)) {
            return;
        }

        $this->revisionService->bumpPlatform('mirror');
    }
}
