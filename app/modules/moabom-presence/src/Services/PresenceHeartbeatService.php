<?php

namespace Modules\Moabom\Presence\Services;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Modules\Moabom\Presence\Enums\PresenceSubtitleMode;
use Modules\Moabom\Presence\Contracts\PlatformPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Contracts\PresenceUserPreferencesRepositoryInterface;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Support\PresenceChannelNames;
use Modules\Moabom\Presence\Support\PresenceClientIpMasker;
use Modules\Moabom\Presence\Support\PresenceSessionKeyResolver;
use Modules\Moabom\Presence\Models\TenantPresenceSession;

final class PresenceHeartbeatService
{
    /** 브라우저 탭 스로틀·백그라운드 전환 grace */
    public const ACTIVE_TTL_SECONDS = 240;

    public const HEARTBEAT_INTERVAL_SECONDS = 120;

    public const WS_REACHABILITY_TTL_SECONDS = 180;

    public function __construct(
        private BotDetector $botDetector,
        private PresenceSessionKeyResolver $sessionKeyResolver,
        private TenantPresenceSessionRepositoryInterface $tenantSessions,
        private PlatformPresenceSessionRepositoryInterface $platformSessions,
        private PresenceChannelNames $channelNames,
        private PresenceUserPreferencesRepositoryInterface $preferences,
        private PresencePresentationService $presentation,
        private PresenceRevisionService $revisionService,
        private PresenceClientIpMasker $clientIpMasker,
        private PresencePlatformMirrorService $platformMirror,
        private PresencePromotionService $promotionService,
    ) {}

    /**
     * @return array{
     *   accepted: bool,
     *   reason?: string,
     *   session_key?: string,
     *   visitor_id?: string,
     *   mirror_ok?: bool,
     *   revision?: int,
     *   tenant_channel?: string,
     *   availability?: string,
     *   subtitle_mode?: string,
     *   presence_subtitle?: ?string,
     *   is_reachable?: bool
     * }
     */
    public function record(
        Request $request,
        ?User $user,
        ?string $clientStatusText = null,
        ?string $clientFormFactor = null,
        ?string $touch = null,
        ?string $wsState = null,
        ?string $visibilityState = null,
    ): array {
        if ($this->botDetector->isBot($request)) {
            return ['accepted' => false, 'reason' => 'bot'];
        }

        if (! $this->tenantSessions->isHeartbeatWritable()) {
            return ['accepted' => false, 'reason' => 'tenant_storage_unavailable'];
        }

        try {
            return $this->persistHeartbeat(
                $request,
                $user,
                $clientStatusText,
                $clientFormFactor,
                $touch,
                $wsState,
                $visibilityState,
            );
        } catch (\Throwable $exception) {
            Log::warning('moabom_presence_heartbeat_failed', [
                'tenant_slug' => $this->channelNames->tenantSlug(),
                'visitor_id' => $this->sessionKeyResolver->resolveVisitorId($request),
                'user_uuid' => $user?->uuid,
                'message' => $exception->getMessage(),
            ]);

            return ['accepted' => false, 'reason' => 'transient_failure'];
        }
    }

    /**
     * @return array{
     *   accepted: bool,
     *   reason?: string,
     *   session_key?: string,
     *   visitor_id?: string,
     *   mirror_ok?: bool,
     *   revision?: int,
     *   tenant_channel?: string,
     *   availability?: string,
     *   subtitle_mode?: string,
     *   presence_subtitle?: ?string,
     *   is_reachable?: bool
     * }
     */
    private function persistHeartbeat(
        Request $request,
        ?User $user,
        ?string $clientStatusText,
        ?string $clientFormFactor,
        ?string $touch,
        ?string $wsState,
        ?string $visibilityState,
    ): array {
        $visitorId = $this->sessionKeyResolver->resolveVisitorId($request);
        $sessionKey = $this->sessionKeyResolver->resolveSessionKeyFromVisitorId($visitorId);
        $now = now();
        $tenantSlug = $this->channelNames->tenantSlug();
        $releasedAuthenticatedSession = false;

        if ($touch === 'logout') {
            $user = null;
            $releasedAuthenticatedSession = $this->tenantSessions->releaseAuthenticatedSessionForVisitor($visitorId, [
                'session_key' => $sessionKey,
                // guest 표시명은 저장하지 않는다 — 목록 직렬화 시 요청 로케일로 해석(SSOT).
                'display_name' => '',
                'status_text' => null,
                'client_form_factor' => $clientFormFactor,
                'client_ip_masked' => $this->clientIpMasker->maskFromRequest($request),
                'ws_state' => 'disconnected',
                'ws_reachable_until' => $now,
                'presence_online_until' => $now,
                'visibility_state' => $visibilityState,
                'last_seen_at' => $now,
            ]);
        }

        // Identity 계약: touch=login 은 Sanctum 사용자 필수 — 미인증이면 guest upsert 금지
        if ($touch === 'login' && $user === null) {
            return [
                'accepted' => false,
                'reason' => 'login_requires_auth',
                'visitor_id' => $visitorId,
                'session_key' => $sessionKey,
            ];
        }

        // 회원: 닉네임 스냅샷. guest: 빈 문자열(로케일 문자열을 DB에 고정하지 않음).
        $displayName = $user
            ? (string) ($user->nickname ?: $user->name)
            : '';

        $preferences = $user
            ? $this->preferences->getOrCreateForUser($user->id)
            : null;

        $liveStatusText = $preferences?->subtitle_mode === PresenceSubtitleMode::Activity
            ? $clientStatusText
            : null;
        $statusText = $this->presentation->resolveSubtitle($user, $preferences, $liveStatusText);
        $clientIpMasked = $user === null ? $this->clientIpMasker->maskFromRequest($request) : null;

        $heartbeatAttributes = [
            'visitor_id' => $visitorId,
            'session_key' => $sessionKey,
            'user_id' => $user?->id,
            'display_name' => $displayName,
            'status_text' => $statusText,
            'avatar' => $user?->getAvatarUrl(),
            'is_authenticated' => $user !== null,
            'client_form_factor' => $clientFormFactor,
            'client_ip_masked' => $clientIpMasked,
            'presence_online_until' => $now->copy()->addSeconds(self::ACTIVE_TTL_SECONDS),
            'last_seen_at' => $now,
        ];
        if ($wsState !== null) {
            $heartbeatAttributes['ws_state'] = $wsState;
            // transport connected만으로 FCM을 생략하지 않습니다. private 채널 challenge ACK가
            // ws_reachable_until을 갱신하며, disconnect는 기존 lease를 즉시 만료시킵니다.
            if ($wsState === 'disconnected') {
                $heartbeatAttributes['ws_reachable_until'] = $now;
            }
        }
        if ($visibilityState !== null) {
            $heartbeatAttributes['visibility_state'] = $visibilityState;
        }

        $session = $this->tenantSessions->upsertHeartbeat($heartbeatAttributes);

        $session->loadMissing('user');

        $mirrorOk = $this->platformMirror->mirrorHeartbeat([
            'visitor_id' => $visitorId,
            'session_key' => $sessionKey,
            'tenant_slug' => $tenantSlug,
            'user_uuid' => $session->user?->uuid,
            'display_name' => (string) $session->display_name,
            'is_authenticated' => (bool) $session->is_authenticated,
            'last_seen_at' => $now,
        ]);

        $shadowsCleaned = $this->promotionService->reconcileAfterHeartbeat(
            $request,
            $user,
            $visitorId,
            $sessionKey,
            $tenantSlug,
            $touch,
        );

        $tenantPruned = $this->maybePruneStaleSessions($now);

        $revisionReason = $tenantPruned
            ? 'prune'
            : ($shadowsCleaned > 0
                ? 'shadow_purge'
                : $this->promotionService->resolveRevisionReason($touch));
        $revision = $this->shouldBumpTenantRevision(
            $session,
            $touch,
            $releasedAuthenticatedSession,
            $tenantPruned,
            $shadowsCleaned > 0,
        )
            ? $this->revisionService->bump($revisionReason)
            : $this->revisionService->current();

        $response = [
            'accepted' => true,
            'session_key' => $sessionKey,
            'visitor_id' => $visitorId,
            'mirror_ok' => $mirrorOk,
            'revision' => $revision,
            'tenant_channel' => $this->channelNames->tenantOnlineChannel(),
            'ws_reachable_until' => $session->ws_reachable_until?->toIso8601String(),
            'presence_online_until' => $session->presence_online_until?->toIso8601String(),
        ];

        if ($user && $preferences) {
            $response = array_merge(
                $response,
                $this->presentation->serializePublicState($user, $preferences, true, $liveStatusText),
            );
        }

        return $response;
    }

    private function shouldBumpTenantRevision(
        TenantPresenceSession $session,
        ?string $touch,
        bool $releasedAuthenticatedSession,
        bool $tenantPruned,
        bool $shadowsCleaned = false,
    ): bool {
        if ($touch === 'login' || $touch === 'logout' || $releasedAuthenticatedSession || $tenantPruned || $shadowsCleaned) {
            return true;
        }

        if ($session->wasRecentlyCreated) {
            return true;
        }

        return $session->wasChanged([
            'user_id',
            'display_name',
            'status_text',
            'avatar',
            'is_authenticated',
            'client_form_factor',
        ]);
    }

    private function maybePruneStaleSessions(\DateTimeInterface $now): bool
    {
        if (! Cache::add('moabom-presence:session-prune', 1, 300)) {
            return false;
        }

        $before = now()->subSeconds(self::ACTIVE_TTL_SECONDS * 2);
        $tenantDeleted = $this->tenantSessions->pruneStale($before);

        try {
            $deleted = $this->platformSessions->pruneStale($before);
            if ($deleted > 0) {
                $this->revisionService->bumpPlatform('prune');
            }
        } catch (\Throwable) {
        }

        return $tenantDeleted > 0;
    }
}
