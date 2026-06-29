<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\Services;

use Plugins\Moabom\Fcm\Contracts\FcmClientInterface;
use Plugins\Moabom\Fcm\DTO\FcmMessage;
use Plugins\Moabom\Fcm\DTO\FcmSendResult;

final class FcmPushService
{
    public function __construct(
        private readonly FcmClientInterface $client,
    ) {}

    public function isEnabled(): bool
    {
        return (bool) config('moabom-fcm.enabled', false) && $this->client->isConfigured();
    }

    public function send(FcmMessage $message): FcmSendResult
    {
        if (! (bool) config('moabom-fcm.enabled', false)) {
            return FcmSendResult::disabled('fcm_disabled');
        }

        return $this->client->send($message);
    }
}
