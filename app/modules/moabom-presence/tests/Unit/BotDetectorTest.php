<?php

namespace Modules\Moabom\Presence\Tests\Unit;

use Illuminate\Http\Request;
use Modules\Moabom\Presence\Services\BotDetector;
use PHPUnit\Framework\TestCase;

class BotDetectorTest extends TestCase
{
    public function test_detects_empty_user_agent_as_bot(): void
    {
        $detector = new BotDetector;
        $request = Request::create('/api/modules/moabom-presence/public/heartbeat', 'POST');

        $this->assertTrue($detector->isBot($request));
    }

    public function test_allows_regular_browser_user_agent(): void
    {
        $detector = new BotDetector;
        $request = Request::create('/api/modules/moabom-presence/public/heartbeat', 'POST', server: [
            'HTTP_USER_AGENT' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        ]);

        $this->assertFalse($detector->isBot($request));
    }
}
