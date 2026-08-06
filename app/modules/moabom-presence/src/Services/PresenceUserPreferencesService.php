<?php

namespace Modules\Moabom\Presence\Services;

use App\Extension\HookManager;
use App\Models\User;
use Illuminate\Support\Str;
use Modules\Moabom\Presence\Contracts\PresenceUserPreferencesRepositoryInterface;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Models\PresenceUserPreference;
use Modules\Moabom\Presence\Support\PresenceChannelNames;

final class PresenceUserPreferencesService
{
    public function __construct(
        private PresenceUserPreferencesRepositoryInterface $preferences,
        private TenantPresenceSessionRepositoryInterface $tenantSessions,
        private PresencePresentationService $presentation,
        private PresenceRevisionService $revisionService,
        private PresenceChannelNames $channelNames,
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

        $updated = $this->preferences->upsertForUser($user->id, $attributes);
        if ($updated->wasRecentlyCreated || $updated->wasChanged(array_keys($attributes))) {
            $revision = $this->revisionService->bump('preference');
            HookManager::broadcast(
                $this->channelNames->tenantOnlineChannel(),
                'presence.member.updated',
                [
                    'event_id' => (string) Str::uuid(),
                    'domain' => 'presence.member',
                    'revision' => $revision,
                    'occurred_at' => now()->toIso8601String(),
                    'user_uuid' => $user->uuid,
                    'display_name' => (string) ($user->nickname ?: $user->name),
                    'avatar' => $this->presentation->resolveConnectListAvatar($user, $updated),
                ] + $this->presentation->serializePublicState($user, $updated, true),
            );
        }

        return $updated;
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
