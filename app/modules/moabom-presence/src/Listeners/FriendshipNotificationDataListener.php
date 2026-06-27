<?php

namespace Modules\Moabom\Presence\Listeners;

use App\Contracts\Extension\HookListenerInterface;
use App\Models\User;
use Modules\Moabom\Presence\Models\Friendship;

/**
 * 친구 요청 알림 — notification_definitions extract_data 필터.
 */
final class FriendshipNotificationDataListener implements HookListenerInterface
{
    public static function getSubscribedHooks(): array
    {
        return [
            'moabom-presence.notification.extract_data' => [
                'method' => 'extractData',
                'priority' => 20,
                'type' => 'filter',
            ],
            'core.notification.filter_default_definitions' => [
                'method' => 'contributeDefaultDefinitions',
                'priority' => 20,
                'type' => 'filter',
            ],
        ];
    }

    public function handle(...$args): void {}

    /**
     * @param  array<int, array<string, mixed>>  $definitions
     * @return array<int, array<string, mixed>>
     */
    public function contributeDefaultDefinitions(array $definitions, array $context = []): array
    {
        /** @var \Modules\Moabom\Presence\Module|null $module */
        $module = app(\App\Extension\ModuleManager::class)->getModule('moabom-presence');
        if (! $module) {
            return $definitions;
        }

        $contributed = [];
        foreach ($module->getNotificationDefinitions() as $data) {
            $contributed[] = array_merge($data, [
                'extension_type' => 'module',
                'extension_identifier' => $module->getIdentifier(),
            ]);
        }

        return array_merge($definitions, $contributed);
    }

    /**
     * @param  array{notifiable: mixed, notifiables: mixed, data: array<string, mixed>, context: array<string, mixed>}  $default
     * @param  array<int, mixed>  $args
     * @return array{notifiable: null, notifiables: null, data: array<string, mixed>, context: array<string, mixed>}
     */
    public function extractData(array $default, string $type, array $args): array
    {
        if ($type === 'friend_request') {
            return $this->extractFriendRequestData($default, $args);
        }

        if ($type === 'friend_accepted') {
            return $this->extractFriendAcceptedData($default, $args);
        }

        if ($type === 'friend_removed') {
            return $this->extractFriendRemovedData($default, $args);
        }

        return $default;
    }

    /**
     * @param  array{notifiable: mixed, notifiables: mixed, data: array<string, mixed>, context: array<string, mixed>}  $default
     * @param  array<int, mixed>  $args
     * @return array{notifiable: null, notifiables: null, data: array<string, mixed>, context: array<string, mixed>}
     */
    private function extractFriendRequestData(array $default, array $args): array
    {
        $friendship = $args[0] ?? null;
        $requester = $args[1] ?? null;
        $addressee = $args[2] ?? null;

        if (! $friendship instanceof Friendship || ! $requester instanceof User || ! $addressee instanceof User) {
            return $default;
        }

        $requesterName = trim((string) ($requester->nickname ?: $requester->name));
        if ($requesterName === '') {
            $requesterName = 'User #'.$requester->id;
        }

        return [
            'notifiable' => null,
            'notifiables' => null,
            'data' => [
                'name' => '{recipient_name}',
                'app_name' => (string) config('app.name'),
                'requester_name' => $requesterName,
                'requester_uuid' => $requester->uuid,
                'site_url' => (string) config('app.url'),
            ],
            'context' => [
                'trigger_user_id' => $requester->id,
                'trigger_user' => $requester,
                'related_users' => [
                    'addressee' => $addressee,
                ],
            ],
        ];
    }

    /**
     * @param  array{notifiable: mixed, notifiables: mixed, data: array<string, mixed>, context: array<string, mixed>}  $default
     * @param  array<int, mixed>  $args
     * @return array{notifiable: null, notifiables: null, data: array<string, mixed>, context: array<string, mixed>}
     */
    private function extractFriendAcceptedData(array $default, array $args): array
    {
        $friendship = $args[0] ?? null;
        $requester = $args[1] ?? null;
        $addressee = $args[2] ?? null;

        if (! $friendship instanceof Friendship || ! $requester instanceof User || ! $addressee instanceof User) {
            return $default;
        }

        $accepterName = trim((string) ($addressee->nickname ?: $addressee->name));
        if ($accepterName === '') {
            $accepterName = 'User #'.$addressee->id;
        }

        return [
            'notifiable' => null,
            'notifiables' => null,
            'data' => [
                'name' => '{recipient_name}',
                'app_name' => (string) config('app.name'),
                'accepter_name' => $accepterName,
                'accepter_uuid' => $addressee->uuid,
                'site_url' => (string) config('app.url'),
            ],
            'context' => [
                'trigger_user_id' => $requester->id,
                'trigger_user' => $requester,
                'related_users' => [
                    'addressee' => $addressee,
                ],
            ],
        ];
    }

    /**
     * @param  array{notifiable: mixed, notifiables: mixed, data: array<string, mixed>, context: array<string, mixed>}  $default
     * @param  array<int, mixed>  $args
     * @return array{notifiable: null, notifiables: null, data: array<string, mixed>, context: array<string, mixed>}
     */
    private function extractFriendRemovedData(array $default, array $args): array
    {
        $viewer = $args[0] ?? null;
        $other = $args[1] ?? null;

        if (! $viewer instanceof User || ! $other instanceof User) {
            return $default;
        }

        $otherName = trim((string) ($other->nickname ?: $other->name));
        if ($otherName === '') {
            $otherName = 'User #'.$other->id;
        }

        return [
            'notifiable' => null,
            'notifiables' => null,
            'data' => [
                'name' => '{recipient_name}',
                'other_name' => $otherName,
                'other_uuid' => $other->uuid,
            ],
            'context' => [
                'trigger_user_id' => $viewer->id,
                'trigger_user' => $viewer,
                'related_users' => [
                    'other' => $other,
                ],
            ],
        ];
    }
}
