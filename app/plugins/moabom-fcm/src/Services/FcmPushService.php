<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\Services;

use App\Models\User;
use Plugins\Moabom\Fcm\Contracts\FcmClientInterface;
use Plugins\Moabom\Fcm\DTO\FcmMessage;
use Plugins\Moabom\Fcm\DTO\FcmSendResult;

final class FcmPushService
{
    public function __construct(
        private readonly FcmClientInterface $client,
        private readonly FcmDeviceTokenService $tokens,
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

        $result = $this->client->send($message);
        if ($result->invalidTokens !== []) {
            $this->tokens->deleteTokens($result->invalidTokens);
        }

        return $result;
    }

    /**
     * @param  array<string, string>  $data
     */
    public function sendToUser(User $user, ?string $title, ?string $body, array $data = []): FcmSendResult
    {
        $deviceTokens = $this->tokens->tokensForUser($user)
            ->map(static fn ($row) => (string) $row->token)
            ->filter(static fn (string $token) => $token !== '')
            ->values()
            ->all();

        if ($deviceTokens === []) {
            return FcmSendResult::failed('no_device_tokens');
        }

        return $this->send(new FcmMessage(
            deviceTokens: $deviceTokens,
            title: $title,
            body: $body,
            data: $data,
        ));
    }
}
