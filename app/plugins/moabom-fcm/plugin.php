<?php

namespace Plugins\Moabom\Fcm;

use App\Extension\AbstractPlugin;

/**
 * Moabom FCM 플러그인 — HTTP v1 푸시 계약·클라이언트 골격.
 *
 * 채팅·알림 모듈은 `moabom.fcm.send` 액션 또는 FcmPushService 바인딩으로 후속 연동한다.
 */
class Plugin extends AbstractPlugin
{
    public function getMetadata(): array
    {
        return [
            'author' => 'Moabom',
            'license' => 'MIT',
            'keywords' => ['fcm', 'firebase', 'push', 'notification'],
        ];
    }
}
