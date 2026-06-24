<?php

namespace Modules\Moabom\Presence\Tests\Unit;

use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Modules\Moabom\Presence\Contracts\PlatformPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Contracts\PresenceUserPreferencesRepositoryInterface;
use Modules\Moabom\Presence\Contracts\TenantPresenceSessionRepositoryInterface;
use Modules\Moabom\Presence\Models\PresenceUserPreference;
use Modules\Moabom\Presence\Models\TenantPresenceSession;
use Modules\Moabom\Presence\Services\BotDetector;
use Modules\Moabom\Presence\Services\PresenceHeartbeatService;
use Modules\Moabom\Presence\Services\PresencePresentationService;
use Modules\Moabom\Presence\Support\PresenceChannelNames;
use Modules\Moabom\Presence\Support\PresenceSessionKeyResolver;
use Modules\Moabom\System\Saas\TenantContext;
use PHPUnit\Framework\TestCase;

final class PresenceHeartbeatServiceTest extends TestCase
{
    public function test_bot_heartbeat_returns_domain_rejection(): void
    {
        $service = $this->makeService($this->makeTenantSessions(true));
        $request = Request::create('/heartbeat', 'POST');

        $result = $service->record($request, null);

        $this->assertSame(['accepted' => false, 'reason' => 'bot'], $result);
    }

    public function test_storage_not_ready_returns_domain_rejection(): void
    {
        $service = $this->makeService($this->makeTenantSessions(false));
        $request = Request::create('/heartbeat', 'POST', server: [
            'HTTP_USER_AGENT' => 'Mozilla/5.0',
        ]);

        $result = $service->record($request, null);

        $this->assertSame(['accepted' => false, 'reason' => 'tenant_storage_unavailable'], $result);
    }

    private function makeService(TenantPresenceSessionRepositoryInterface $tenantSessions): PresenceHeartbeatService
    {
        return new PresenceHeartbeatService(
            new BotDetector,
            new PresenceSessionKeyResolver,
            $tenantSessions,
            new class implements PlatformPresenceSessionRepositoryInterface {
                public function upsertHeartbeat(array $attributes): void
                {
                }

                public function deleteBySessionKeys(array $sessionKeys): int
                {
                    return 0;
                }

                public function pruneStale(\DateTimeInterface $before): int
                {
                    return 0;
                }

                public function countActive(\DateTimeInterface $since): int
                {
                    return 0;
                }
            },
            new PresenceChannelNames(new TenantContext),
            new class implements PresenceUserPreferencesRepositoryInterface {
                public function findForUser(int $userId): ?PresenceUserPreference
                {
                    return null;
                }

                public function findForUsers(array $userIds): Collection
                {
                    return new Collection;
                }

                public function upsertForUser(int $userId, array $attributes): PresenceUserPreference
                {
                    return new PresenceUserPreference;
                }

                public function getOrCreateForUser(int $userId): PresenceUserPreference
                {
                    return new PresenceUserPreference;
                }
            },
            new PresencePresentationService,
        );
    }

    private function makeTenantSessions(bool $writable): TenantPresenceSessionRepositoryInterface
    {
        return new class($writable) implements TenantPresenceSessionRepositoryInterface {
            public function __construct(private bool $writable)
            {
            }

            public function isHeartbeatWritable(): bool
            {
                return $this->writable;
            }

            public function upsertHeartbeat(array $attributes): TenantPresenceSession
            {
                throw new \RuntimeException('not expected');
            }

            public function deleteBySessionKeys(array $sessionKeys): int
            {
                return 0;
            }

            public function pruneStale(\DateTimeInterface $before): int
            {
                return 0;
            }

            public function countActive(\DateTimeInterface $since): int
            {
                return 0;
            }

            public function countConnectVisible(\DateTimeInterface $since): int
            {
                return 0;
            }

            public function hasActiveSessionForUser(int $userId, \DateTimeInterface $since): bool
            {
                return false;
            }

            public function findActiveSessionForUser(int $userId, \DateTimeInterface $since): ?TenantPresenceSession
            {
                return null;
            }

            public function listConnectVisible(\DateTimeInterface $since, int $limit = 100): Collection
            {
                return new Collection;
            }

            public function listActive(\DateTimeInterface $since, int $limit = 100): Collection
            {
                return new Collection;
            }
        };
    }
}
