<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\Exceptions;

use RuntimeException;

/**
 * FCM 의도적 생략 — NotificationDispatcher 가 failed 로 기록한다 (sent 오기록 방지).
 */
final class FcmSkippedException extends RuntimeException
{
}
