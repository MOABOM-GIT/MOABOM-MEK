<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Notifications;

use App\Extension\HookManager;
use App\Notifications\NotificationDispatcher;
use Modules\Moabom\System\Services\NotificationDeliveryPolicy;

/**
 * G7 공통 디스패처 앞에서 사용자 채널 선택과 폭주 방지 정책을 적용합니다.
 */
final class MoabomNotificationDispatcher extends NotificationDispatcher
{
    protected function sendToNotifiable($notifiable, $id, $notification, $channel)
    {
        try {
            $result = app(NotificationDeliveryPolicy::class)->evaluate(
                $notifiable,
                $notification,
                (string) $channel,
            );

            if (! $result['allowed']) {
                HookManager::doAction(
                    'moabom.notification.delivery_skipped',
                    (string) $channel,
                    $result['context'],
                    $result['reason'],
                );

                return null;
            }
        } catch (\Throwable) {
            // 정책 계층 장애는 실제 알림 발송을 막지 않습니다.
        }

        return parent::sendToNotifiable($notifiable, $id, $notification, $channel);
    }
}
