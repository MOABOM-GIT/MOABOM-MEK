<?php

namespace Modules\Moabom\Presence\Repositories;

use Illuminate\Support\Collection;
use Modules\Moabom\Presence\Contracts\PresenceUserPreferencesRepositoryInterface;
use Modules\Moabom\Presence\Enums\PresenceAvailability;
use Modules\Moabom\Presence\Enums\PresenceSubtitleMode;
use Modules\Moabom\Presence\Models\PresenceUserPreference;

class PresenceUserPreferencesRepository implements PresenceUserPreferencesRepositoryInterface
{
    public function findForUser(int $userId): ?PresenceUserPreference
    {
        return PresenceUserPreference::query()
            ->where('user_id', $userId)
            ->first();
    }

    public function findForUsers(array $userIds): Collection
    {
        if ($userIds === []) {
            return collect();
        }

        return PresenceUserPreference::query()
            ->whereIn('user_id', $userIds)
            ->get()
            ->keyBy('user_id');
    }

    public function upsertForUser(int $userId, array $attributes): PresenceUserPreference
    {
        return PresenceUserPreference::query()->updateOrCreate(
            ['user_id' => $userId],
            $attributes,
        );
    }

    public function getOrCreateForUser(int $userId): PresenceUserPreference
    {
        return PresenceUserPreference::query()->firstOrCreate(
            ['user_id' => $userId],
            [
                'availability' => PresenceAvailability::Online,
                'subtitle_mode' => PresenceSubtitleMode::ProfileBio,
                'activity_message' => null,
            ],
        );
    }
}
