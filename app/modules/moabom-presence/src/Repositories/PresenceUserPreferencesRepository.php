<?php

namespace Modules\Moabom\Presence\Repositories;

use Illuminate\Support\Collection;
use Modules\Moabom\Presence\Contracts\PresenceUserPreferencesRepositoryInterface;
use Modules\Moabom\Presence\Enums\PresenceAvailability;
use Modules\Moabom\Presence\Enums\PresenceSubtitleMode;
use Modules\Moabom\Presence\Models\PresenceUserPreference;
use Modules\Moabom\Presence\Support\PresenceTenantSchema;

class PresenceUserPreferencesRepository implements PresenceUserPreferencesRepositoryInterface
{
    /** @var list<string> */
    private const WRITABLE_COLUMNS = [
        'availability',
        'subtitle_mode',
        'activity_message',
        'show_avatar_in_connect_list',
        'accept_chat_requests',
    ];

    public function __construct(
        private PresenceTenantSchema $tenantSchema,
    ) {}

    public function findForUser(int $userId): ?PresenceUserPreference
    {
        if (! $this->tenantSchema->hasTable(PresenceTenantSchema::TABLE_USER_PREFERENCES)) {
            return null;
        }

        return PresenceUserPreference::query()
            ->where('user_id', $userId)
            ->first();
    }

    public function findForUsers(array $userIds): Collection
    {
        if ($userIds === [] || ! $this->tenantSchema->hasTable(PresenceTenantSchema::TABLE_USER_PREFERENCES)) {
            return collect();
        }

        return PresenceUserPreference::query()
            ->whereIn('user_id', $userIds)
            ->get()
            ->keyBy('user_id');
    }

    public function upsertForUser(int $userId, array $attributes): PresenceUserPreference
    {
        if (! $this->tenantSchema->hasTable(PresenceTenantSchema::TABLE_USER_PREFERENCES)) {
            throw new \RuntimeException('moabom_presence_user_preferences schema is not ready');
        }

        $defaults = $this->defaultAttributes();
        $payload = $this->tenantSchema->pickWritableColumns(
            PresenceTenantSchema::TABLE_USER_PREFERENCES,
            array_merge($defaults, $attributes),
            self::WRITABLE_COLUMNS,
        );

        return PresenceUserPreference::query()->updateOrCreate(
            ['user_id' => $userId],
            $payload,
        );
    }

    public function getOrCreateForUser(int $userId): PresenceUserPreference
    {
        $existing = $this->findForUser($userId);
        if ($existing) {
            return $existing;
        }

        return $this->upsertForUser($userId, []);
    }

    /**
     * @return array<string, mixed>
     */
    private function defaultAttributes(): array
    {
        return [
            'availability' => PresenceAvailability::Online,
            'subtitle_mode' => PresenceSubtitleMode::Activity,
            'activity_message' => null,
            'show_avatar_in_connect_list' => true,
            'accept_chat_requests' => true,
        ];
    }
}
