<?php

namespace Plugins\Moabom\Fcm;

use App\Extension\AbstractPlugin;
use Plugins\Moabom\Fcm\Listeners\FcmNotificationChannelListener;

/**
 * Moabom FCM — Firebase Cloud Messaging HTTP v1 디바이스 푸시.
 *
 * GenericNotification `fcm` 채널·디바이스 토큰 API·PWA 연동을 제공한다.
 * 실시간(Reverb) 토스트와 독립적으로 사용자가 선택한 OS 시스템 알림을 전달한다.
 */
class Plugin extends AbstractPlugin
{
    public function getMetadata(): array
    {
        return [
            'author' => 'Moabom',
            'license' => 'MIT',
            'keywords' => ['fcm', 'firebase', 'push', 'notification', 'pwa'],
        ];
    }

    /**
     * @return array<int, class-string>
     */
    public function getHookListeners(): array
    {
        return [
            FcmNotificationChannelListener::class,
        ];
    }
}
