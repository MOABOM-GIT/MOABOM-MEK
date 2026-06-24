<?php

namespace Modules\Moabom\Presence\Services;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Modules\Moabom\Presence\Enums\PresenceSubtitleMode;
use Modules\Moabom\Presence\Contracts\PlatformPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Contracts\PresenceUserPreferencesRepositoryInterface;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Support\PresenceChannelNames;
use Modules\Moabom\Presence\Support\PresenceSessionKeyResolver;

final class PresenceHeartbeatService
{
  /** 브라우저 탭 스로틀·연속 heartbeat 누락 여유 (interval × 4) */
    public const ACTIVE_TTL_SECONDS = 240;

    public const HEARTBEAT_INTERVAL_SECONDS = 60;

    public function __construct(
        private BotDetector $botDetector,
        private PresenceSessionKeyResolver $sessionKeyResolver,
        private TenantPresenceSessionRepositoryInterface $tenantSessions,
        private PlatformPresenceSessionRepositoryInterface $platformSessions,
        private PresenceChannelNames $channelNames,
        private PresenceUserPreferencesRepositoryInterface $preferences,
        private PresencePresentationService $presentation,
    ) {}

    /**
     * @return array{
     *   accepted: bool,
     *   reason?: string,
     *   session_key?: string,
     *   tenant_channel?: string,
     *   availability?: string,
     *   subtitle_mode?: string,
     *   presence_subtitle?: ?string,
     *   is_reachable?: bool
     * }
     */
    public function record(Request $request, ?User $user, ?string $clientStatusText = null, ?string $clientFormFactor = null): array
    {
        if ($this->botDetector->isBot($request)) {
            return ['accepted' => false, 'reason' => 'bot'];
        }

        if (! $this->tenantSessions->isHeartbeatWritable()) {
            return ['accepted' => false, 'reason' => 'tenant_storage_unavailable'];
        }

        try {
            return $this->persistHeartbeat($request, $user, $clientStatusText, $clientFormFactor);
        } catch (\Throwable) {
            return ['accepted' => false, 'reason' => 'transient_failure'];
        }
    }

    /**
     * @return array{
     *   accepted: bool,
     *   reason?: string,
     *   session_key?: string,
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
    ): array {
        $sessionKey = $this->sessionKeyResolver->resolve($request);
        $now = now();
        $tenantSlug = $this->channelNames->tenantSlug();

        $displayName = $user
            ? (string) ($user->nickname ?: $user->name)
            : (string) __('moabom-presence::messages.guest_display_name');

        $preferences = $user
            ? $this->preferences->getOrCreateForUser($user->id)
            : null;

        $liveStatusText = $preferences?->subtitle_mode === PresenceSubtitleMode::Activity
            ? $clientStatusText
            : null;
        $statusText = $this->presentation->resolveSubtitle($user, $preferences, $liveStatusText);

        $this->tenantSessions->upsertHeartbeat([
            'session_key' => $sessionKey,
            'user_id' => $user?->id,
            'display_name' => $displayName,
            'status_text' => $statusText,
            'avatar' => $user?->getAvatarUrl(),
            'is_authenticated' => $user !== null,
            'client_form_factor' => $clientFormFactor,
            'last_seen_at' => $now,
        ]);

        if ($user) {
            $this->reconcileAuthenticatedSessions($request, $sessionKey);
        }

        try {
            $this->platformSessions->upsertHeartbeat([
                'session_key' => $sessionKey,
                'tenant_slug' => $tenantSlug,
                'user_uuid' => $user?->uuid,
                'display_name' => $displayName,
                'is_authenticated' => $user !== null,
                'last_seen_at' => $now,
            ]);
        } catch (\Throwable) {
        }

        $this->maybePruneStaleSessions($now);

        $response = [
            'accepted' => true,
            'session_key' => $sessionKey,
            'tenant_channel' => $this->channelNames->tenantOnlineChannel(),
        ];

        if ($user && $preferences) {
            $response = array_merge(
                $response,
                $this->presentation->serializePublicState($user, $preferences, true, $liveStatusText),
            );
        }

        return $response;
    }

    /**
     * 로그인 heartbeat 시 동일 브라우저의 guest 잔여 세션(session_id 키)을 제거합니다.
     */
    private function reconcileAuthenticatedSessions(Request $request, string $sessionKey): void
    {
        $sessionIdKey = $this->sessionKeyResolver->resolveFromLaravelSession($request);
        if ($sessionIdKey === $sessionKey) {
            return;
        }

        $keysToDelete = [$sessionIdKey];
        $this->tenantSessions->deleteBySessionKeys($keysToDelete);

        try {
            $this->platformSessions->deleteBySessionKeys($keysToDelete);
        } catch (\Throwable) {
        }
    }

    private function maybePruneStaleSessions(\DateTimeInterface $now): void
    {
        if (! Cache::add('moabom-presence:session-prune', 1, 300)) {
            return;
        }

        $before = now()->subSeconds(self::ACTIVE_TTL_SECONDS * 2);
        $this->tenantSessions->pruneStale($before);

        try {
            $this->platformSessions->pruneStale($before);
        } catch (\Throwable) {
        }
    }
}
