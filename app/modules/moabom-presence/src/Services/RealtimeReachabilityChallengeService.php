<?php

declare(strict_types=1);

namespace Modules\Moabom\Presence\Services;

use App\Extension\HookManager;
use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;

/**
 * 실제 private 채널 이벤트 수신 ACK만 FCM 온라인 판정 lease로 인정합니다.
 */
final class RealtimeReachabilityChallengeService
{
    private const CHALLENGE_TTL_SECONDS = 30;

    public function __construct(
        private readonly TenantPresenceSessionRepositoryInterface $sessions,
    ) {}

    /**
     * @return array{expires_at: string}
     */
    public function issue(User $user): array
    {
        $expiresAt = now()->addSeconds(self::CHALLENGE_TTL_SECONDS);
        $token = Crypt::encryptString((string) json_encode([
            'version' => 1,
            'user_id' => (int) $user->id,
            'expires_at' => $expiresAt->getTimestamp(),
            'nonce' => (string) Str::uuid(),
        ], JSON_THROW_ON_ERROR));

        HookManager::broadcast(
            "core.user.notifications.{$user->uuid}",
            'realtime.challenge',
            [
                'token' => $token,
                'expires_at' => $expiresAt->toIso8601String(),
            ],
        );

        return ['expires_at' => $expiresAt->toIso8601String()];
    }

    public function acknowledge(User $user, string $token): bool
    {
        try {
            $payload = json_decode(Crypt::decryptString($token), true, flags: JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return false;
        }

        if (! is_array($payload)
            || (int) ($payload['version'] ?? 0) !== 1
            || (int) ($payload['user_id'] ?? 0) !== (int) $user->id
            || (int) ($payload['expires_at'] ?? 0) < now()->getTimestamp()
            || ! is_string($payload['nonce'] ?? null)
        ) {
            return false;
        }

        $now = now();

        return $this->sessions->acknowledgeReachabilityForUser(
            (int) $user->id,
            $now->copy()->subSeconds(PresenceHeartbeatService::ACTIVE_TTL_SECONDS),
            $now->copy()->addSeconds(PresenceHeartbeatService::WS_REACHABILITY_TTL_SECONDS),
        );
    }
}
