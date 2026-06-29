<?php

declare(strict_types=1);

namespace Plugins\Moabom\Fcm\Services;

use Illuminate\Support\Facades\Http;
use Plugins\Moabom\Fcm\Contracts\FcmClientInterface;
use Plugins\Moabom\Fcm\DTO\FcmMessage;
use Plugins\Moabom\Fcm\DTO\FcmSendResult;
use RuntimeException;
use Throwable;

/**
 * Firebase Cloud Messaging HTTP v1 — 서비스 계정 JSON 이 있을 때만 활성.
 */
final class GoogleFcmV1Client implements FcmClientInterface
{
    private ?array $serviceAccount = null;

    public function __construct(
        private readonly ?string $projectId,
        private readonly ?string $serviceAccountJson,
    ) {}

    public function isConfigured(): bool
    {
        return is_string($this->projectId) && $this->projectId !== ''
            && $this->parseServiceAccount() !== null;
    }

    public function send(FcmMessage $message): FcmSendResult
    {
        if (! $this->isConfigured()) {
            return FcmSendResult::disabled('fcm_not_configured');
        }

        $token = $message->primaryToken();
        if ($token === null || $token === '') {
            return FcmSendResult::failed('missing_device_token');
        }

        try {
            $accessToken = $this->fetchAccessToken();
            $payload = [
                'message' => [
                    'token' => $token,
                ],
            ];

            if ($message->title !== null || $message->body !== null) {
                $payload['message']['notification'] = array_filter([
                    'title' => $message->title,
                    'body' => $message->body,
                ], static fn (?string $v): bool => $v !== null && $v !== '');
            }

            if ($message->data !== []) {
                $payload['message']['data'] = $message->data;
            }

            $response = Http::timeout(8)
                ->withToken($accessToken)
                ->acceptJson()
                ->post(
                    sprintf('https://fcm.googleapis.com/v1/projects/%s/messages:send', $this->projectId),
                    $payload,
                );

            if (! $response->successful()) {
                return FcmSendResult::failed('fcm_http_'.$response->status());
            }

            $messageId = (string) ($response->json('name') ?? '');

            return FcmSendResult::ok($messageId !== '' ? $messageId : 'ok');
        } catch (Throwable $e) {
            return FcmSendResult::failed($e->getMessage());
        }
    }

    private function fetchAccessToken(): string
    {
        $account = $this->parseServiceAccount();
        if ($account === null) {
            throw new RuntimeException('fcm_service_account_invalid');
        }

        $now = time();
        $header = $this->base64UrlEncode(json_encode(['alg' => 'RS256', 'typ' => 'JWT'], JSON_THROW_ON_ERROR));
        $claims = $this->base64UrlEncode(json_encode([
            'iss' => $account['client_email'],
            'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
            'aud' => 'https://oauth2.googleapis.com/token',
            'iat' => $now,
            'exp' => $now + 3600,
        ], JSON_THROW_ON_ERROR));

        $unsigned = $header.'.'.$claims;
        $signature = '';
        $privateKey = openssl_pkey_get_private((string) $account['private_key']);
        if ($privateKey === false) {
            throw new RuntimeException('fcm_private_key_invalid');
        }

        if (! openssl_sign($unsigned, $signature, $privateKey, OPENSSL_ALGO_SHA256)) {
            throw new RuntimeException('fcm_jwt_sign_failed');
        }

        $jwt = $unsigned.'.'.$this->base64UrlEncode($signature);
        $response = Http::asForm()
            ->timeout(8)
            ->post('https://oauth2.googleapis.com/token', [
                'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                'assertion' => $jwt,
            ]);

        if (! $response->successful()) {
            throw new RuntimeException('fcm_oauth_failed');
        }

        $accessToken = (string) ($response->json('access_token') ?? '');
        if ($accessToken === '') {
            throw new RuntimeException('fcm_oauth_empty_token');
        }

        return $accessToken;
    }

    /**
     * @return array{client_email: string, private_key: string}|null
     */
    private function parseServiceAccount(): ?array
    {
        if ($this->serviceAccount !== null) {
            return $this->serviceAccount;
        }

        $raw = trim((string) $this->serviceAccountJson);
        if ($raw === '') {
            return null;
        }

        try {
            /** @var array<string, mixed> $decoded */
            $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (Throwable) {
            return null;
        }

        $email = $decoded['client_email'] ?? null;
        $key = $decoded['private_key'] ?? null;
        if (! is_string($email) || ! is_string($key) || $email === '' || $key === '') {
            return null;
        }

        $this->serviceAccount = [
            'client_email' => $email,
            'private_key' => $key,
        ];

        return $this->serviceAccount;
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
