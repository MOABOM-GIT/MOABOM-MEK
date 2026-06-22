<?php

namespace Modules\Moabom\Presence\Services;

use App\Models\User;
use Illuminate\Http\Request;
use Modules\Moabom\Presence\Enums\PresenceSubtitleMode;
use Modules\Moabom\Presence\Contracts\PlatformPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Contracts\PresenceUserPreferencesRepositoryInterface;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Support\PresenceChannelNames;
use Modules\Moabom\Presence\Support\PresenceSessionKeyResolver;

final class PresenceHeartbeatService
{
    public const ACTIVE_TTL_SECONDS = 120;

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
            return ['accepted' => false];
        }

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
            'avatar' => $user?->avatar,
            'is_authenticated' => $user !== null,
            'client_form_factor' => $clientFormFactor,
            'last_seen_at' => $now,
        ]);

        try {
            $this->platformSessions->upsertHeartbeat([
                'session_key' => $sessionKey,
                'tenant_slug' => $tenantSlug,
                'user_id' => $user?->id,
                'display_name' => $displayName,
                'is_authenticated' => $user !== null,
                'last_seen_at' => $now,
            ]);
        } catch (\Throwable) {
        }

        $response = [
            'accepted' => true,
            'session_key' => $sessionKey,
            'tenant_channel' => $this->channelNames->tenantOnlineChannel(),
        ];

        if ($user && $preferences) {
            $response = array_merge(
                $response,
                $this->presentation->serializePublicState($user, $preferences, true, $statusText),
            );
        }

        return $response;
    }
}
