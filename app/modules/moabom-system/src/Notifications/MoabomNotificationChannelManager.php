<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Notifications;

use Illuminate\Contracts\Bus\Dispatcher as Bus;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Notifications\ChannelManager;

/**
 * Moabom 정책 디스패처를 사용하는 Laravel 알림 채널 관리자입니다.
 */
final class MoabomNotificationChannelManager extends ChannelManager
{
    public function send($notifiables, $notification)
    {
        return (new MoabomNotificationDispatcher(
            $this,
            $this->container->make(Bus::class),
            $this->container->make(Dispatcher::class),
            $this->locale,
        ))->send($notifiables, $notification);
    }

    public function sendNow($notifiables, $notification, ?array $channels = null)
    {
        return (new MoabomNotificationDispatcher(
            $this,
            $this->container->make(Bus::class),
            $this->container->make(Dispatcher::class),
            $this->locale,
        ))->sendNow($notifiables, $notification, $channels);
    }
}
