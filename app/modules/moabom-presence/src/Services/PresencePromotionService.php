<?php

namespace Modules\Moabom\Presence\Services;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Modules\Moabom\Presence\Contracts\PlatformPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Support\PresenceClientIpMasker;
use Modules\Moabom\Presence\Support\PresenceSessionKeyResolver;

/**
 * heartbeat 직후 승격·레거시 guest 정리 SSOT.
 *
 * 인증 heartbeat 마다( login 한정 아님 ):
 * - 동일 visitor_id guest shadow
 * - 동일 마스크 IP guest shadow (다른 visitor_id 잔여·재생성 대비)
 * - 레거시 session_key
 *
 * IP purge 는 공유망에서 타 guest 를 잠깐 지울 수 있으나, 해당 guest 의
 * 다음 heartbeat(≤120s) 로 복귀한다. 클라 폴링/채널을 늘리지 않는다.
 *
 * @return int 정리한 tenant session_key 수 (0 이면 revision bump 불필요)
 */
final class PresencePromotionService
{
    public function __construct(
        private PresenceSessionKeyResolver $sessionKeyResolver,
        private TenantPresenceSessionRepositoryInterface $tenantSessions,
        private PlatformPresenceSessionRepositoryInterface $platformSessions,
        private PresenceClientIpMasker $clientIpMasker,
    ) {}

    public function reconcileAfterHeartbeat(
        Request $request,
        ?User $user,
        string $visitorId,
        string $sessionKey,
        string $tenantSlug,
        ?string $touch = null,
    ): int {
    unset($touch); // login 한정 purge 제거 — 인증이면 항상 IP shadow 정리

        $cleanedKeys = [];
        $legacyKeys = $this->sessionKeyResolver->legacySessionKeysForVisitor(
            $request,
            $visitorId,
            $sessionKey,
        );

        if ($legacyKeys !== []) {
            $this->tenantSessions->deleteBySessionKeys($legacyKeys);
            $this->purgePlatformSessionKeys($legacyKeys, $tenantSlug, $visitorId, 'legacy_keys');
            $cleanedKeys = array_merge($cleanedKeys, $legacyKeys);
        }

        if (! $user) {
            return count(array_unique($cleanedKeys));
        }

        $this->tenantSessions->deleteOtherSessionsForUser($user->id, $visitorId);
        $visitorShadows = $this->tenantSessions->purgeGuestShadowsForVisitor($visitorId, $legacyKeys);
        if ($visitorShadows > 0) {
            $cleanedKeys[] = 'visitor:'.$visitorId;
        }

        $ipShadowKeys = [];
        $maskedIp = $this->clientIpMasker->maskFromRequest($request);
        if ($maskedIp !== null) {
            $purged = $this->tenantSessions->purgeGuestShadowsForMaskedIp($maskedIp, $visitorId);
            $ipShadowKeys = $purged['session_keys'];
            $cleanedKeys = array_merge($cleanedKeys, $ipShadowKeys);
        }

        try {
            $this->platformSessions->deleteOtherSessionsForTenantUser($tenantSlug, $user->uuid, $visitorId);
            $this->platformSessions->purgeGuestShadowsForVisitor($tenantSlug, $visitorId, $legacyKeys);
            if ($legacyKeys !== []) {
                $this->platformSessions->deleteBySessionKeys($legacyKeys);
            }
            if ($ipShadowKeys !== []) {
                $this->platformSessions->deleteBySessionKeys($ipShadowKeys);
            }
        } catch (\Throwable $exception) {
            Log::warning('moabom_presence_platform_reconcile_failed', [
                'tenant_slug' => $tenantSlug,
                'user_uuid' => $user->uuid,
                'visitor_id' => $visitorId,
                'message' => $exception->getMessage(),
            ]);
        }

        return count(array_unique($cleanedKeys));
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
