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

        $tokens = array_values(array_filter(
            $message->deviceTokens,
            static fn (string $token): bool => $token !== '',
        ));

        if ($tokens === []) {
            return FcmSendResult::failed('missing_device_token');
        }

        try {
            $accessToken = $this->fetchAccessToken();
        } catch (Throwable $e) {
            return FcmSendResult::failed($e->getMessage());
        }

        $sent = 0;
        $failed = 0;
        $invalid = [];
        $lastMessageId = null;

        foreach ($tokens as $token) {
            $result = $this->sendOne($accessToken, $token, $message);
            if ($result['success']) {
                $sent++;
                $lastMessageId = $result['message_id'] ?? $lastMessageId;
            } else {
                $failed++;
                if (! empty($result['invalid'])) {
                    $invalid[] = $token;
                }
            }
        }

        if ($sent === 0) {
            return FcmSendResult::failed(
                $failed > 0 ? 'fcm_all_failed' : 'missing_device_token',
                $invalid,
                $failed,
            );
        }

        if ($failed > 0) {
            return FcmSendResult::partial($sent, $failed, $invalid, $lastMessageId);
        }

        return FcmSendResult::ok($lastMessageId ?? 'ok', $sent);
    }

    /**
     * @return array{success: bool, message_id?: string, invalid?: bool}
     */
    private function sendOne(string $accessToken, string $token, FcmMessage $message): array
    {
        try {
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

            $tag = trim((string) ($message->data['tag'] ?? ''));
            if ($tag !== '') {
                $collapseId = substr($tag, 0, 64);
                $payload['message']['android']['notification']['tag'] = $collapseId;
                $payload['message']['webpush']['notification']['tag'] = $collapseId;
                $payload['message']['apns']['headers']['apns-collapse-id'] = $collapseId;
                $payload['message']['apns']['payload']['aps']['thread-id'] = $collapseId;
            }

            $response = Http::timeout(8)
                ->withToken($accessToken)
                ->acceptJson()
                ->post(
                    sprintf('https://fcm.googleapis.com/v1/projects/%s/messages:send', $this->projectId),
                    $payload,
                );

            if ($response->successful()) {
                $messageId = (string) ($response->json('name') ?? '');

                return [
                    'success' => true,
                    'message_id' => $messageId !== '' ? $messageId : 'ok',
                ];
            }

            $errorCode = (string) ($response->json('error.status') ?? '');
            $errorMessage = strtolower((string) ($response->json('error.message') ?? ''));
            $invalid = in_array($errorCode, ['NOT_FOUND', 'INVALID_ARGUMENT'], true)
                || str_contains($errorMessage, 'unregistered')
                || str_contains($errorMessage, 'registration-token-not-registered');

            return ['success' => false, 'invalid' => $invalid];
        } catch (Throwable) {
            return ['success' => false, 'invalid' => false];
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
