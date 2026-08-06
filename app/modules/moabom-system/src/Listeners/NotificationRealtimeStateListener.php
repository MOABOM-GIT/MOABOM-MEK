<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Listeners;

use App\Contracts\Extension\HookListenerInterface;
use App\Extension\HookManager;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Str;

/**
 * 알림 DB 반영 뒤 정확한 unread 상태를 사용자 private 채널로 투영합니다.
 *
 * 코어 notification.received 이벤트는 이전 클라이언트 호환을 위해 유지하고,
 * 신규 클라이언트는 이 이벤트의 unread_count를 권위 값으로 사용합니다.
 */
final class NotificationRealtimeStateListener implements HookListenerInterface
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    public static function getSubscribedHooks(): array
    {
        return [
            'core.notification.after_channel_send' => [
                'method' => 'afterChannelSend',
                'priority' => 25,
            ],
            'core.notification.after_mark_read' => [
                'method' => 'afterMarkRead',
                'priority' => 25,
            ],
            'core.notification.after_mark_batch_read' => [
                'method' => 'afterMarkBatchRead',
                'priority' => 25,
            ],
            'core.notification.after_mark_all_read' => [
                'method' => 'afterMarkAllRead',
                'priority' => 25,
            ],
            'core.notification.after_delete' => [
                'method' => 'afterDelete',
                'priority' => 25,
            ],
            'core.notification.after_delete_all' => [
                'method' => 'afterDeleteAll',
                'priority' => 25,
            ],
        ];
    }

    public function handle(...$args): void {}

    public function afterChannelSend(string $channel, array $context): void
    {
        if ($channel !== 'database') {
            return;
        }

        $user = $context['notifiable'] ?? null;
        if (! $user instanceof User) {
            return;
        }

        $this->broadcastState($user, [
            'id' => $context['notification_id'] ?? null,
            'url' => $context['url'] ?? null,
            'subject' => $context['subject'] ?? null,
            'body' => $context['body'] ?? null,
            'type' => $context['notification_type'] ?? null,
            'data' => $context['data'] ?? null,
        ]);
    }

    public function afterMarkRead(DatabaseNotification $notification, User $user): void
    {
        $this->broadcastState($user, ['changed_id' => (string) $notification->id]);
    }

    /**
     * @param  list<string>  $ids
     */
    public function afterMarkBatchRead(User $user, array $ids): void
    {
        $this->broadcastState($user, ['changed_ids' => array_values($ids)]);
    }

    public function afterMarkAllRead(User $user): void
    {
        $this->broadcastState($user, ['all_read' => true]);
    }

    public function afterDelete(User $user, string $notificationId): void
    {
        $this->broadcastState($user, ['deleted_id' => $notificationId]);
    }

    public function afterDeleteAll(User $user): void
    {
        $this->broadcastState($user, ['all_deleted' => true]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function broadcastState(User $user, array $payload): void
    {
        $occurredAt = now();
        $eventId = is_string($payload['id'] ?? null) && $payload['id'] !== ''
            ? (string) $payload['id']
            : (string) Str::uuid();

        HookManager::broadcast(
            "core.user.notifications.{$user->uuid}",
            'notification.state',
            $payload + [
                'event_id' => $eventId,
                'domain' => 'notification',
                'revision' => (int) $occurredAt->format('Uv'),
                'occurred_at' => $occurredAt->toIso8601String(),
                'unread_count' => $this->notifications->getUnreadCount($user),
                'authoritative' => true,
            ],
        );
    }
}
