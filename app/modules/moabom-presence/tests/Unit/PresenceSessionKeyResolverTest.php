<?php

namespace Modules\Moabom\Presence\Tests\Unit;

use Illuminate\Http\Request;
use Illuminate\Session\ArraySessionHandler;
use Illuminate\Session\Store;
use Modules\Moabom\Presence\Support\PresenceSessionKeyResolver;
use PHPUnit\Framework\TestCase;

class PresenceSessionKeyResolverTest extends TestCase
{
    public function test_resolves_visitor_header_key(): void
    {
        $resolver = new PresenceSessionKeyResolver;
        $request = Request::create('/heartbeat', 'POST', server: [
            'HTTP_X_MOABOM_VISITOR_ID' => 'visitor-uuid-1',
        ]);

        $this->assertSame('visitor-uuid-1', $resolver->resolveVisitorId($request));
        $this->assertSame(
            $resolver->resolveSessionKeyFromVisitorId('visitor-uuid-1'),
            $resolver->resolve($request),
        );
    }

    public function test_resolves_legacy_client_header_key(): void
    {
        $resolver = new PresenceSessionKeyResolver;
        $request = Request::create('/heartbeat', 'POST', server: [
            'HTTP_X_MOABOM_PRESENCE_KEY' => 'client-uuid-1',
        ]);

        $this->assertSame('client-uuid-1', $resolver->resolveVisitorId($request));
        $this->assertSame(
            $resolver->resolveSessionKeyFromVisitorId('client-uuid-1'),
            $resolver->resolve($request),
        );
    }

    public function test_falls_back_to_laravel_session_id(): void
    {
        $resolver = new PresenceSessionKeyResolver;
        $request = Request::create('/heartbeat', 'POST');
        $request->setLaravelSession($this->makeSession('session-abc'));

        $this->assertSame('session:session-abc', $resolver->resolveVisitorId($request));
        $this->assertSame(
            hash('sha256', 'presence:visitor:session:session-abc'),
            $resolver->resolve($request),
        );
        $this->assertSame(
            hash('sha256', 'presence:session:session-abc'),
            $resolver->resolveFromLaravelSession($request),
        );
    }

    public function test_client_key_and_session_key_differ(): void
    {
        $resolver = new PresenceSessionKeyResolver;
        $request = Request::create('/heartbeat', 'POST', server: [
            'HTTP_X_MOABOM_PRESENCE_KEY' => 'client-uuid-1',
        ]);
        $request->setLaravelSession($this->makeSession('session-abc'));

        $this->assertNotSame(
            $resolver->resolve($request),
            $resolver->resolveFromLaravelSession($request),
        );
    }

    private function makeSession(string $id): Store
    {
        return new Store($id, new ArraySessionHandler(60));
    }
}
