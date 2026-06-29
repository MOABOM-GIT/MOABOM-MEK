<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\Services;

use Plugins\Moabom\Fcm\Contracts\FcmClientInterface;
use Plugins\Moabom\Fcm\DTO\FcmMessage;
use Plugins\Moabom\Fcm\DTO\FcmSendResult;

final class NullFcmClient implements FcmClientInterface
{
    public function isConfigured(): bool
    {
        return false;
    }

    public function send(FcmMessage $message): FcmSendResult
    {
        return FcmSendResult::disabled('fcm_not_configured');
    }
}
