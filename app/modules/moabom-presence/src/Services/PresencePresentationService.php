<?php

namespace Modules\Moabom\Presence\Services;

use App\Models\User;
use Modules\Moabom\Presence\Enums\PresenceAvailability;
use Modules\Moabom\Presence\Enums\PresenceSubtitleMode;
use Modules\Moabom\Presence\Models\PresenceUserPreference;

/**
 * 접속 상태·부가 문구·목록 노출 규칙 SSOT.
 */
final class PresencePresentationService
{
    public function availabilityFor(?PresenceUserPreference $preferences): PresenceAvailability
    {
        return $preferences?->availability ?? PresenceAvailability::Online;
    }

    public function isVisibleInConnectList(?PresenceUserPreference $preferences, bool $isAuthenticated): bool
    {
        if (! $isAuthenticated) {
            return true;
        }

        return $this->availabilityFor($preferences) !== PresenceAvailability::Offline;
    }

    public function isReachable(bool $hasActiveSession, ?PresenceUserPreference $preferences): bool
    {
        if (! $hasActiveSession) {
            return false;
        }

        return $this->availabilityFor($preferences) !== PresenceAvailability::Offline;
    }

    public function resolveSubtitle(
        ?User $user,
        ?PresenceUserPreference $preferences,
        ?string $liveStatusText = null,
    ): ?string {
        if (! $user || ! $preferences) {
            return null;
        }

        return match ($preferences->subtitle_mode) {
            PresenceSubtitleMode::Hidden => null,
            PresenceSubtitleMode::ProfileBio => $this->trimOrNull($user->bio),
            PresenceSubtitleMode::Activity => $this->trimOrNull($liveStatusText),
        };
    }

    public function showAvatarInConnectList(?PresenceUserPreference $preferences): bool
    {
        if (! $preferences) {
            return true;
        }

        return (bool) $preferences->show_avatar_in_connect_list;
    }

    public function acceptsChatRequests(?PresenceUserPreference $preferences): bool
    {
        if (! $preferences) {
            return true;
        }

        return $preferences->getAttribute('accept_chat_requests') !== false;
    }

    public function resolveConnectListAvatar(?User $user, ?PresenceUserPreference $preferences): ?string
    {
        if (! $user || ! $this->showAvatarInConnectList($preferences)) {
            return null;
        }

        return $this->trimOrNull($user->getAvatarUrl());
    }

    /**
     * @return array{
     *   availability: string,
     *   subtitle_mode: string,
     *   activity_message: ?string,
     *   presence_subtitle: ?string,
     *   is_reachable: bool
     * }
     */
    public function serializePublicState(
        ?User $user,
        ?PresenceUserPreference $preferences,
        bool $hasActiveSession,
        ?string $liveStatusText = null,
    ): array {
        $availability = $this->availabilityFor($preferences);
        $isReachable = $this->isReachable($hasActiveSession, $preferences);

        return [
            'availability' => $availability->value,
            'subtitle_mode' => ($preferences?->subtitle_mode ?? PresenceSubtitleMode::Activity)->value,
            'activity_message' => $preferences?->activity_message,
            'presence_subtitle' => $this->resolveSubtitle($user, $preferences, $liveStatusText),
            'is_reachable' => $isReachable,
        ];
    }

    /**
     * @return array{
     *   availability: string,
     *   subtitle_mode: string,
     *   activity_message: ?string,
     *   show_avatar_in_connect_list: bool,
     *   accept_chat_requests: bool
     * }
     */
    public function serializeSettings(PresenceUserPreference $preferences): array
    {
        return [
            'availability' => $preferences->availability->value,
            'subtitle_mode' => $preferences->subtitle_mode->value,
            'activity_message' => $preferences->activity_message,
            'show_avatar_in_connect_list' => $this->showAvatarInConnectList($preferences),
            'accept_chat_requests' => $this->acceptsChatRequests($preferences),
        ];
    }

    private function trimOrNull(?string $value): ?string
    {
        $trimmed = trim((string) $value);

        return $trimmed !== '' ? $trimmed : null;
    }
}
