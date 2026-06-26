<?php

namespace Modules\Moabom\Presence\Services;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Moabom\Presence\Contracts\PlatformPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Support\PresenceSessionKeyResolver;

/**
 * heartbeat 직후 승격·레거시 guest 정리 SSOT.
 * 로그인 시 동일 visitor_id guest 잔여 행 제거, 레거시 session_key 정리.
 */
final class PresencePromotionService
{
    public function __construct(
        private PresenceSessionKeyResolver $sessionKeyResolver,
        private TenantPresenceSessionRepositoryInterface $tenantSessions,
        private PlatformPresenceSessionRepositoryInterface $platformSessions,
    ) {}

    public function reconcileAfterHeartbeat(
        Request $request,
        ?User $user,
        string $visitorId,
        string $sessionKey,
        string $tenantSlug,
    ): void {
        $legacyKeys = $this->sessionKeyResolver->legacySessionKeysForVisitor(
            $request,
            $visitorId,
            $sessionKey,
        );

        if ($legacyKeys !== []) {
            $this->tenantSessions->deleteBySessionKeys($legacyKeys);
            $this->purgePlatformSessionKeys($legacyKeys, $tenantSlug, $visitorId, 'legacy_keys');
        }

        if (! $user) {
            return;
        }

        $this->tenantSessions->deleteOtherSessionsForUser($user->id, $visitorId);
        $this->tenantSessions->purgeGuestShadowsForVisitor($visitorId, $legacyKeys);

        try {
            $this->platformSessions->deleteOtherSessionsForTenantUser($tenantSlug, $user->uuid, $visitorId);
            $this->platformSessions->purgeGuestShadowsForVisitor($tenantSlug, $visitorId, $legacyKeys);
            if ($legacyKeys !== []) {
                $this->platformSessions->deleteBySessionKeys($legacyKeys);
            }
        } catch (\Throwable $exception) {
            Log::warning('moabom_presence_platform_reconcile_failed', [
                'tenant_slug' => $tenantSlug,
                'user_uuid' => $user->uuid,
                'visitor_id' => $visitorId,
                'message' => $exception->getMessage(),
            ]);
        }
    }

    public function resolveRevisionReason(?string $touch): string
    {
        return match ($touch) {
            'login' => 'login',
            'logout' => 'logout',
            default => 'heartbeat',
        };
    }

    /**
     * @param  array<int, string>  $sessionKeys
     */
    private function purgePlatformSessionKeys(
        array $sessionKeys,
        string $tenantSlug,
        string $visitorId,
        string $context,
    ): void {
        try {
            $this->platformSessions->deleteBySessionKeys($sessionKeys);
        } catch (\Throwable $exception) {
            Log::warning('moabom_presence_platform_legacy_key_cleanup_failed', [
                'tenant_slug' => $tenantSlug,
                'visitor_id' => $visitorId,
                'context' => $context,
                'message' => $exception->getMessage(),
            ]);
        }
    }
}
