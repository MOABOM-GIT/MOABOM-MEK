<?php

namespace Modules\Moabom\Presence\Services;

use App\Models\User;
use Modules\Moabom\Presence\Contracts\PresenceUserPreferencesRepositoryInterface;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Models\PresenceUserPreference;

final class PresenceUserPreferencesService
{
    public function __construct(
        private PresenceUserPreferencesRepositoryInterface $preferences,
        private TenantPresenceSessionRepositoryInterface $tenantSessions,
        private PresencePresentationService $presentation,
    ) {}

    public function getForUser(int $userId): PresenceUserPreference
    {
        return $this->preferences->getOrCreateForUser($userId);
    }

    /**
     * @param  array{availability?: string, subtitle_mode?: string, activity_message?: string|null, show_avatar_in_connect_list?: bool, accept_chat_requests?: bool}  $input
     */
    public function updateForUser(User $user, array $input): PresenceUserPreference
    {
        $current = $this->preferences->getOrCreateForUser($user->id);

        $attributes = [];
        if (array_key_exists('availability', $input)) {
            $attributes['availability'] = $input['availability'];
        }
        if (array_key_exists('subtitle_mode', $input)) {
            $attributes['subtitle_mode'] = $input['subtitle_mode'];
        }
        if (array_key_exists('activity_message', $input)) {
            $attributes['activity_message'] = $input['activity_message'];
        }
        if (array_key_exists('show_avatar_in_connect_list', $input)) {
            $attributes['show_avatar_in_connect_list'] = $input['show_avatar_in_connect_list'];
        }
        if (array_key_exists('accept_chat_requests', $input)) {
            $attributes['accept_chat_requests'] = $input['accept_chat_requests'];
        }

        if ($attributes === []) {
            return $current;
        }

        return $this->preferences->upsertForUser($user->id, $attributes);
    }

    /**
     * @return array<string, mixed>
     */
    public function getPublicPresenceForUser(User $user): array
    {
        $preferences = $this->preferences->getOrCreateForUser($user->id);
        $since = now()->subSeconds(PresenceHeartbeatService::ACTIVE_TTL_SECONDS);
        $hasActiveSession = $this->tenantSessions->hasActiveSessionForUser($user->id, $since);
        $activeSession = $hasActiveSession
            ? $this->tenantSessions->findActiveSessionForUser($user->id, $since)
            : null;

        return array_merge(
            [
                'user_uuid' => $user->uuid,
            ],
            $this->presentation->serializePublicState(
                $user,
                $preferences,
                $hasActiveSession,
                $activeSession?->status_text,
            ),
        );
    }
}
