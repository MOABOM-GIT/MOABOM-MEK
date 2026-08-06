<?php

namespace Modules\Moabom\Smart\Chat\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * create-app AI 게이트와 분리된 스마트챗 전용 동시성 슬롯.
 * 큐 없이 deny — 다른 앱 스트림을 굶기지 않도록 별도 Redis 키 사용.
 */
class SmartChatStreamConcurrencyService
{
    private const STATE_KEY = 'moabom:smart-chat:stream:gate:v1';

    private const LOCK_KEY = 'moabom:smart-chat:stream:gate:lock';

    /**
     * @return array{ok: bool, lease_token?: string, reason?: string}
     */
    public function acquire(int $userId): array
    {
        $lock = Cache::lock(self::LOCK_KEY, 5);
        if (! $lock->get()) {
            return ['ok' => false, 'reason' => 'busy'];
        }

        try {
            $state = $this->loadState();
            $this->prune($state);

            foreach ($state['slots'] as $lease => $slot) {
                if ((int) ($slot['user_id'] ?? 0) === $userId) {
                    $state['slots'][$lease]['expires_at'] = $this->expiresAt();
                    $this->saveState($state);

                    return ['ok' => true, 'lease_token' => (string) $lease];
                }
            }

            if (count($state['slots']) >= $this->maxActive()) {
                return ['ok' => false, 'reason' => 'capacity'];
            }

            $lease = (string) Str::uuid();
            $state['slots'][$lease] = [
                'user_id' => $userId,
                'expires_at' => $this->expiresAt(),
            ];
            $this->saveState($state);

            return ['ok' => true, 'lease_token' => $lease];
        } finally {
            $lock->release();
        }
    }

    public function release(string $leaseToken): void
    {
        if ($leaseToken === '') {
            return;
        }

        $lock = Cache::lock(self::LOCK_KEY, 5);
        if (! $lock->get()) {
            return;
        }

        try {
            $state = $this->loadState();
            unset($state['slots'][$leaseToken]);
            $this->saveState($state);
        } finally {
            $lock->release();
        }
    }

    /**
     * @return array{slots: array<string, array{user_id: int, expires_at: int}>}
     */
    private function loadState(): array
    {
        $raw = Cache::get(self::STATE_KEY);
        if (! is_array($raw) || ! isset($raw['slots']) || ! is_array($raw['slots'])) {
            return ['slots' => []];
        }

        return ['slots' => $raw['slots']];
    }

    /**
     * @param  array{slots: array<string, array{user_id: int, expires_at: int}>}  $state
     */
    private function saveState(array $state): void
    {
        Cache::put(self::STATE_KEY, $state, $this->slotTtl() + 60);
    }

    /**
     * @param  array{slots: array<string, array{user_id: int, expires_at: int}>}  $state
     */
    private function prune(array &$state): void
    {
        $now = time();
        foreach ($state['slots'] as $lease => $slot) {
            if ((int) ($slot['expires_at'] ?? 0) < $now) {
                unset($state['slots'][$lease]);
            }
        }
    }

    private function maxActive(): int
    {
        return max(1, (int) config('moabom-smart-chat.stream_concurrency.max_active', 16));
    }

    private function slotTtl(): int
    {
        return max(30, (int) config('moabom-smart-chat.stream_concurrency.slot_ttl_seconds', 180));
    }

    private function expiresAt(): int
    {
        return time() + $this->slotTtl();
    }
}
