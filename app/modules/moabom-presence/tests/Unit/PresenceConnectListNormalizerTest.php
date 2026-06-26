<?php

namespace Modules\Moabom\Presence\Tests\Unit;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Modules\Moabom\Presence\Models\TenantPresenceSession;
use Modules\Moabom\Presence\Support\PresenceConnectListNormalizer;
use PHPUnit\Framework\TestCase;

class PresenceConnectListNormalizerTest extends TestCase
{
    public function test_dedupes_authenticated_users_by_user_id(): void
    {
        $sessions = new Collection([
            $this->makeSession('key-a', 10, now()->subSeconds(30)),
            $this->makeSession('key-b', 10, now()),
            $this->makeSession('key-guest', null, now()->subSeconds(10)),
        ]);

        $result = PresenceConnectListNormalizer::dedupe($sessions, 10);

        $this->assertCount(2, $result);
        $this->assertSame('key-b', $result->firstWhere('user_id', 10)?->session_key);
        $this->assertNotNull($result->firstWhere('user_id', null));
    }

    public function test_keeps_distinct_guest_sessions(): void
    {
        $sessions = new Collection([
            $this->makeSession('guest-1', null, now()->subSeconds(5)),
            $this->makeSession('guest-2', null, now()),
        ]);

        $result = PresenceConnectListNormalizer::dedupe($sessions, 10);

        $this->assertCount(2, $result);
    }

    public function test_respects_limit_after_dedupe(): void
    {
        $sessions = new Collection([
            $this->makeSession('user-1-a', 1, now()->subSeconds(20)),
            $this->makeSession('user-1-b', 1, now()),
            $this->makeSession('user-2', 2, now()->subSeconds(10)),
            $this->makeSession('guest', null, now()->subSeconds(30)),
        ]);

        $result = PresenceConnectListNormalizer::dedupe($sessions, 2);

        $this->assertCount(2, $result);
    }

    public function test_dedupes_guest_sessions_by_visitor_id(): void
    {
        $sessions = new Collection([
            $this->makeSession('legacy-key', null, now()->subSeconds(5), 'visitor-1'),
            $this->makeSession('new-key', null, now(), 'visitor-1'),
        ]);

        $result = PresenceConnectListNormalizer::dedupe($sessions, 10);

        $this->assertCount(1, $result);
        $this->assertSame('new-key', $result->first()?->session_key);
    }

    public function test_hides_guest_when_authenticated_visitor_id_exists(): void
    {
        $sessions = new Collection([
            $this->makeSession('guest-shadow', null, now(), 'visitor-1'),
            $this->makeSession('member-key', 10, now()->subSeconds(5), 'visitor-1'),
        ]);

        $result = PresenceConnectListNormalizer::dedupe($sessions, 10);

        $this->assertCount(1, $result);
        $this->assertSame(10, $result->first()?->user_id);
    }

    private function makeSession(
        string $sessionKey,
        ?int $userId,
        Carbon $lastSeenAt,
        ?string $visitorId = null,
    ): TenantPresenceSession {
        $session = new TenantPresenceSession;
        $session->forceFill([
            'session_key' => $sessionKey,
            'visitor_id' => $visitorId,
            'user_id' => $userId,
            'display_name' => $userId ? 'User '.$userId : '방문자',
            'is_authenticated' => $userId !== null,
            'last_seen_at' => $lastSeenAt,
        ]);

        return $session;
    }
}
