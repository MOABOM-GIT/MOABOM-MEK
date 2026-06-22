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
            'subtitle_mode' => ($preferences?->subtitle_mode ?? PresenceSubtitleMode::ProfileBio)->value,
            'activity_message' => $preferences?->activity_message,
            'presence_subtitle' => $this->resolveSubtitle($user, $preferences, $liveStatusText),
            'is_reachable' => $isReachable,
        ];
    }

    /**
     * @return array{
     *   availability: string,
     *   subtitle_mode: string,
     *   activity_message: ?string
     * }
     */
    public function serializeSettings(PresenceUserPreference $preferences): array
    {
        return [
            'availability' => $preferences->availability->value,
            'subtitle_mode' => $preferences->subtitle_mode->value,
            'activity_message' => $preferences->activity_message,
        ];
    }

    private function trimOrNull(?string $value): ?string
    {
        $trimmed = trim((string) $value);

        return $trimmed !== '' ? $trimmed : null;
    }
}
