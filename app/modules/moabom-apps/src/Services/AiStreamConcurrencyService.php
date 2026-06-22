<?php

namespace Modules\Moabom\Apps\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Modules\Moabom\Apps\Support\AiStreamGateResult;

class AiStreamConcurrencyService
{
    private const STATE_KEY = 'moabom:ai:stream:gate:v1';

    private const LOCK_KEY = 'moabom:ai:stream:gate:lock';

    public function requestAccess(int $userId, ?string $leaseToken = null, ?string $queueTicket = null): AiStreamGateResult
    {
        return $this->mutate(function (array &$state) use ($userId, $leaseToken, $queueTicket): AiStreamGateResult {
            $this->pruneExpired($state);

            if ($leaseToken !== null && $leaseToken !== '') {
                $slot = $state['slots'][$leaseToken] ?? null;
                if (is_array($slot) && (int) ($slot['user_id'] ?? 0) === $userId) {
                    return $this->readyResult($leaseToken, $state);
                }
            }

            if ($queueTicket !== null && $queueTicket !== '') {
                $ready = $state['ready'][$queueTicket] ?? null;
                if (is_array($ready)
                    && (int) ($ready['user_id'] ?? 0) === $userId
                    && isset($ready['lease_id'])
                ) {
                    $leaseId = (string) $ready['lease_id'];
                    unset($state['ready'][$queueTicket]);
                    $state['slots'][$leaseId] = [
                        'user_id' => $userId,
                        'expires_at' => $this->slotExpiresAt(),
                    ];

                    return $this->readyResult($leaseId, $state);
                }
            }

            foreach ($state['slots'] as $existingLease => $slot) {
                if ((int) ($slot['user_id'] ?? 0) === $userId) {
                    return $this->readyResult((string) $existingLease, $state);
                }
            }

            if ($this->activeCount($state) < $this->maxActive()) {
                $leaseId = (string) Str::uuid();
                $state['slots'][$leaseId] = [
                    'user_id' => $userId,
                    'expires_at' => $this->slotExpiresAt(),
                ];
                if ($queueTicket !== null && $queueTicket !== '') {
                    $this->removeTicketFromQueue($state, $queueTicket, $userId);
                }

                return $this->readyResult($leaseId, $state);
            }

            if ($queueTicket !== null && $queueTicket !== '') {
                $position = $this->queuePositionForTicket($state, $queueTicket, $userId);
                if ($position > 0) {
                    return $this->queuedResult($queueTicket, $position, $state);
                }
            }

            $existingTicket = $this->findTicketForUser($state, $userId);
            if ($existingTicket !== null) {
                $position = $this->queuePositionForTicket($state, $existingTicket, $userId);
                if ($position > 0) {
                    return $this->queuedResult($existingTicket, $position, $state);
                }
            }

            if (count($state['queue']) >= $this->maxQueue()) {
                return new AiStreamGateResult(
                    status: AiStreamGateResult::STATUS_DENIED,
                    reason: 'queue_full',
                    activeCount: $this->activeCount($state),
                    maxActive: $this->maxActive(),
                );
            }

            $ticketId = (string) Str::uuid();
            $state['queue'][] = [
                'ticket_id' => $ticketId,
                'user_id' => $userId,
                'created_at' => time(),
            ];

            return $this->queuedResult($ticketId, count($state['queue']), $state);
        });
    }

    public function getQueueStatus(int $userId, string $ticketId): ?AiStreamGateResult
    {
        return $this->mutate(function (array &$state) use ($userId, $ticketId): ?AiStreamGateResult {
            $this->pruneExpired($state);

            $ready = $state['ready'][$ticketId] ?? null;
            if (is_array($ready) && (int) ($ready['user_id'] ?? 0) === $userId) {
                return new AiStreamGateResult(
                    status: AiStreamGateResult::STATUS_READY,
                    leaseToken: (string) ($ready['lease_id'] ?? ''),
                    ticketId: $ticketId,
                    retryAfterSeconds: $this->retryAfterSeconds(),
                    activeCount: $this->activeCount($state),
                    maxActive: $this->maxActive(),
                );
            }

            $position = $this->queuePositionForTicket($state, $ticketId, $userId);
            if ($position > 0) {
                return $this->queuedResult($ticketId, $position, $state);
            }

            return null;
        });
    }

    public function cancelTicket(int $userId, string $ticketId): bool
    {
        return (bool) $this->mutate(function (array &$state) use ($userId, $ticketId): bool {
            $this->pruneExpired($state);

            if (isset($state['ready'][$ticketId]) && (int) ($state['ready'][$ticketId]['user_id'] ?? 0) === $userId) {
                unset($state['ready'][$ticketId]);

                return true;
            }

            return $this->removeTicketFromQueue($state, $ticketId, $userId);
        });
    }

    public function releaseLease(string $leaseToken): void
    {
        $this->mutate(function (array &$state) use ($leaseToken): null {
            $this->pruneExpired($state);
            unset($state['slots'][$leaseToken]);
            $this->promoteNextWaiting($state);

            return null;
        });
    }

    /**
     * @template T
     *
     * @param  callable(array<string, mixed>&): T  $callback
     * @return T
     */
    private function mutate(callable $callback): mixed
    {
        return Cache::lock(self::LOCK_KEY, 10)->block(10, function () use ($callback) {
            $state = $this->loadState();
            $result = $callback($state);
            $this->saveState($state);

            return $result;
        });
    }

    /**
     * @return array{slots: array<string, array{user_id: int, expires_at: int}>, queue: array<int, array{ticket_id: string, user_id: int, created_at: int}>, ready: array<string, array{user_id: int, lease_id: string, expires_at: int}>}
     */
    private function loadState(): array
    {
        $state = Cache::get(self::STATE_KEY);
        if (! is_array($state)) {
            return [
                'slots' => [],
                'queue' => [],
                'ready' => [],
            ];
        }

        return [
            'slots' => is_array($state['slots'] ?? null) ? $state['slots'] : [],
            'queue' => is_array($state['queue'] ?? null) ? array_values($state['queue']) : [],
            'ready' => is_array($state['ready'] ?? null) ? $state['ready'] : [],
        ];
    }

    /**
     * @param  array{slots: array<string, array{user_id: int, expires_at: int}>, queue: array<int, array{ticket_id: string, user_id: int, created_at: int}>, ready: array<string, array{user_id: int, lease_id: string, expires_at: int}>}  $state
     */
    private function saveState(array $state): void
    {
        Cache::put(self::STATE_KEY, $state, $this->stateTtlSeconds());
    }

    /**
     * @param  array{slots: array<string, array{user_id: int, expires_at: int}>, queue: array<int, array{ticket_id: string, user_id: int, created_at: int}>, ready: array<string, array{user_id: int, lease_id: string, expires_at: int}>}  $state
     */
    private function pruneExpired(array &$state): void
    {
        $now = time();

        foreach ($state['slots'] as $leaseId => $slot) {
            if ((int) ($slot['expires_at'] ?? 0) <= $now) {
                unset($state['slots'][$leaseId]);
            }
        }

        $state['queue'] = array_values(array_filter(
            $state['queue'],
            fn (array $ticket): bool => ($now - (int) ($ticket['created_at'] ?? 0)) <= $this->ticketTtlSeconds(),
        ));

        foreach ($state['ready'] as $ticketId => $ready) {
            if ((int) ($ready['expires_at'] ?? 0) <= $now) {
                unset($state['ready'][$ticketId]);
            }
        }
    }

    /**
     * @param  array{slots: array<string, array{user_id: int, expires_at: int}>, queue: array<int, array{ticket_id: string, user_id: int, created_at: int}>, ready: array<string, array{user_id: int, lease_id: string, expires_at: int}>}  $state
     */
    private function promoteNextWaiting(array &$state): void
    {
        if ($this->activeCount($state) >= $this->maxActive() || $state['queue'] === []) {
            return;
        }

        $next = array_shift($state['queue']);
        if (! is_array($next)) {
            return;
        }

        $ticketId = (string) ($next['ticket_id'] ?? '');
        if ($ticketId === '') {
            return;
        }

        $state['ready'][$ticketId] = [
            'user_id' => (int) ($next['user_id'] ?? 0),
            'lease_id' => (string) Str::uuid(),
            'expires_at' => time() + $this->readyGrantTtlSeconds(),
        ];
        $readyLease = (string) $state['ready'][$ticketId]['lease_id'];
        $state['slots'][$readyLease] = [
            'user_id' => (int) ($next['user_id'] ?? 0),
            'expires_at' => $this->slotExpiresAt(),
        ];
    }

    /**
     * @param  array{slots: array<string, array{user_id: int, expires_at: int}>, queue: array<int, array{ticket_id: string, user_id: int, created_at: int}>, ready: array<string, array{user_id: int, lease_id: string, expires_at: int}>}  $state
     */
    private function readyResult(string $leaseToken, array $state): AiStreamGateResult
    {
        return new AiStreamGateResult(
            status: AiStreamGateResult::STATUS_READY,
            leaseToken: $leaseToken,
            activeCount: $this->activeCount($state),
            maxActive: $this->maxActive(),
        );
    }

    /**
     * @param  array{slots: array<string, array{user_id: int, expires_at: int}>, queue: array<int, array{ticket_id: string, user_id: int, created_at: int}>, ready: array<string, array{user_id: int, lease_id: string, expires_at: int}>}  $state
     */
    private function queuedResult(string $ticketId, int $position, array $state): AiStreamGateResult
    {
        return new AiStreamGateResult(
            status: AiStreamGateResult::STATUS_QUEUED,
            ticketId: $ticketId,
            queuePosition: $position,
            estimatedWaitSeconds: $this->estimateWaitSeconds($position),
            retryAfterSeconds: $this->retryAfterSeconds(),
            activeCount: $this->activeCount($state),
            maxActive: $this->maxActive(),
        );
    }

    private function estimateWaitSeconds(int $position): int
    {
        if ($position <= 0) {
            return 0;
        }

        $maxActive = max(1, $this->maxActive());
        $avg = max(30, $this->avgGenerationSeconds());

        return (int) ceil(($position * $avg) / $maxActive);
    }

    /**
     * @param  array{slots: array<string, array{user_id: int, expires_at: int}>, queue: array<int, array{ticket_id: string, user_id: int, created_at: int}>, ready: array<string, array{user_id: int, lease_id: string, expires_at: int}>}  $state
     */
    private function activeCount(array $state): int
    {
        return count($state['slots']);
    }

    /**
     * @param  array{slots: array<string, array{user_id: int, expires_at: int}>, queue: array<int, array{ticket_id: string, user_id: int, created_at: int}>, ready: array<string, array{user_id: int, lease_id: string, expires_at: int}>}  $state
     */
    private function queuePositionForTicket(array $state, string $ticketId, int $userId): int
    {
        foreach ($state['queue'] as $index => $ticket) {
            if (($ticket['ticket_id'] ?? null) === $ticketId && (int) ($ticket['user_id'] ?? 0) === $userId) {
                return $index + 1;
            }
        }

        return 0;
    }

    /**
     * @param  array{slots: array<string, array{user_id: int, expires_at: int}>, queue: array<int, array{ticket_id: string, user_id: int, created_at: int}>, ready: array<string, array{user_id: int, lease_id: string, expires_at: int}>}  $state
     */
    private function findTicketForUser(array $state, int $userId): ?string
    {
        foreach ($state['queue'] as $ticket) {
            if ((int) ($ticket['user_id'] ?? 0) === $userId) {
                return (string) ($ticket['ticket_id'] ?? '');
            }
        }

        foreach ($state['ready'] as $ticketId => $ready) {
            if ((int) ($ready['user_id'] ?? 0) === $userId) {
                return (string) $ticketId;
            }
        }

        return null;
    }

    /**
     * @param  array{slots: array<string, array{user_id: int, expires_at: int}>, queue: array<int, array{ticket_id: string, user_id: int, created_at: int}>, ready: array<string, array{user_id: int, lease_id: string, expires_at: int}>}  $state
     */
    private function removeTicketFromQueue(array &$state, string $ticketId, int $userId): bool
    {
        $before = count($state['queue']);
        $state['queue'] = array_values(array_filter(
            $state['queue'],
            fn (array $ticket): bool => ! (($ticket['ticket_id'] ?? null) === $ticketId && (int) ($ticket['user_id'] ?? 0) === $userId),
        ));

        return count($state['queue']) < $before;
    }

    private function maxActive(): int
    {
        return max(1, (int) config('moabom-apps.ai.stream_concurrency.max_active', 24));
    }

    private function maxQueue(): int
    {
        return max(1, (int) config('moabom-apps.ai.stream_concurrency.max_queue', 100));
    }

    private function avgGenerationSeconds(): int
    {
        return max(30, (int) config('moabom-apps.ai.stream_concurrency.avg_generation_seconds', 90));
    }

    private function slotExpiresAt(): int
    {
        return time() + $this->slotTtlSeconds();
    }

    private function slotTtlSeconds(): int
    {
        return max(120, (int) config('moabom-apps.ai.stream_concurrency.slot_ttl_seconds', 660));
    }

    private function readyGrantTtlSeconds(): int
    {
        return max(30, (int) config('moabom-apps.ai.stream_concurrency.ready_grant_ttl_seconds', 120));
    }

    private function ticketTtlSeconds(): int
    {
        return max(60, (int) config('moabom-apps.ai.stream_concurrency.ticket_ttl_seconds', 900));
    }

    private function retryAfterSeconds(): int
    {
        return max(2, (int) config('moabom-apps.ai.stream_concurrency.retry_after_seconds', 5));
    }

    private function stateTtlSeconds(): int
    {
        return max($this->ticketTtlSeconds(), $this->slotTtlSeconds()) + 60;
    }
}
