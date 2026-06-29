<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\Contracts;

use Plugins\Moabom\Fcm\DTO\FcmMessage;
use Plugins\Moabom\Fcm\DTO\FcmSendResult;

interface FcmClientInterface
{
    public function isConfigured(): bool;

    public function send(FcmMessage $message): FcmSendResult;
}
