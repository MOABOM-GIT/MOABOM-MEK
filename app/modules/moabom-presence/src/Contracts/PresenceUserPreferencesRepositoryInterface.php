<?php

namespace Modules\Moabom\Presence\Contracts;

use Illuminate\Support\Collection;
use Modules\Moabom\Presence\Models\PresenceUserPreference;

interface PresenceUserPreferencesRepositoryInterface
{
    public function findForUser(int $userId): ?PresenceUserPreference;

    /**
     * @param  list<int>  $userIds
     * @return Collection<int, PresenceUserPreference> keyed by user_id
     */
    public function findForUsers(array $userIds): Collection;

    public function upsertForUser(int $userId, array $attributes): PresenceUserPreference;

    public function getOrCreateForUser(int $userId): PresenceUserPreference;
}
