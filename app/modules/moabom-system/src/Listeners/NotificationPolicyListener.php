<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Listeners;

use App\Contracts\Extension\HookListenerInterface;
use App\Services\NotificationLogService;
use Modules\Moabom\System\Services\NotificationMaintenanceService;

final class NotificationPolicyListener implements HookListenerInterface
{
    public function __construct(
        private readonly NotificationLogService $logs,
        private readonly NotificationMaintenanceService $maintenance,
    ) {}

    public static function getSubscribedHooks(): array
    {
        return [
            'moabom.notification.delivery_skipped' => [
                'method' => 'logSkippedDelivery',
                'priority' => 15,
            ],
            'core.notification.after_channel_send' => [
                'method' => 'pruneDatabaseOverflow',
                'priority' => 30,
            ],
        ];
    }

    public function handle(...$args): void {}

    /**
     * @param  array<string, mixed>  $context
     */
    public function logSkippedDelivery(string $channel, array $context, ?string $reason): void
    {
        try {
            $this->logs->logSkipped([
                'channel' => $channel,
                'notification_type' => (string) ($context['notification_type'] ?? ''),
                'extension_type' => (string) ($context['extension_type'] ?? 'core'),
                'extension_identifier' => (string) ($context['extension_identifier'] ?? 'core'),
                'recipient_identifier' => (string) ($context['recipient_identifier'] ?? ''),
                'recipient_name' => $context['recipient_name'] ?? null,
                'recipient_user_id' => $context['recipient_user_id'] ?? null,
                'error_message' => $reason,
                'source' => 'notification_policy',
                'sent_at' => now(),
            ]);
        } catch (\Throwable) {
            // 운영 로그 실패가 알림 처리 흐름을 막지 않습니다.
        }
    }

    /**
     * @param  array<string, mixed>  $context
     */
    public function pruneDatabaseOverflow(string $channel, array $context): void
    {
        if ($channel !== 'database' || empty($context['recipient_user_id'])) {
            return;
        }

        try {
            $this->maintenance->pruneUserOverflow((int) $context['recipient_user_id']);
        } catch (\Throwable) {
            // 일일 정리 작업이 다시 수렴시키므로 발송 요청은 성공으로 유지합니다.
        }
    }
}
