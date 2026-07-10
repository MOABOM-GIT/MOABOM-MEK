<?php

namespace Modules\Moabom\Presence\Tests\Unit;

use App\Models\User;
use Modules\Moabom\Presence\Models\TenantPresenceSession;
use Modules\Moabom\Presence\Services\PresencePresentationService;
use PHPUnit\Framework\TestCase;

final class PresencePresentationDisplayNameTest extends TestCase
{
    public function test_guest_display_name_is_empty_for_ui_locale(): void
    {
        $service = new PresencePresentationService;
        $session = new TenantPresenceSession([
            'user_id' => null,
            'display_name' => 'Guest',
            'is_authenticated' => false,
        ]);

        $this->assertSame('', $service->resolveConnectListDisplayName($session, null));
    }

    public function test_member_prefers_live_user_nickname(): void
    {
        $service = new PresencePresentationService;
        $session = new TenantPresenceSession([
            'user_id' => 1,
            'display_name' => 'stale',
            'is_authenticated' => true,
        ]);
        $user = new User;
        $user->nickname = '실시간닉';
        $user->name = '실명';

        $this->assertSame('실시간닉', $service->resolveConnectListDisplayName($session, $user));
    }
}
