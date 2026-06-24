<?php

namespace Modules\Moabom\Presence\Tests\Unit;

use Modules\Moabom\Presence\Enums\PresenceAvailability;
use Modules\Moabom\Presence\Enums\PresenceSubtitleMode;
use Modules\Moabom\Presence\Models\PresenceUserPreference;
use Modules\Moabom\Presence\Services\PresencePresentationService;
use PHPUnit\Framework\TestCase;

class PresencePresentationServiceTest extends TestCase
{
    public function test_resolve_connect_list_avatar_returns_url_when_enabled(): void
    {
        $service = new PresencePresentationService;
        $user = $this->createMock(\App\Models\User::class);
        $user->method('getAvatarUrl')->willReturn('https://example.com/a.jpg');
        $preferences = new PresenceUserPreference([
            'availability' => PresenceAvailability::Online,
            'subtitle_mode' => PresenceSubtitleMode::ProfileBio,
            'show_avatar_in_connect_list' => true,
        ]);

        $this->assertSame(
            'https://example.com/a.jpg',
            $service->resolveConnectListAvatar($user, $preferences),
        );
    }

    public function test_resolve_connect_list_avatar_returns_null_when_disabled(): void
    {
        $service = new PresencePresentationService;
        $user = $this->createMock(\App\Models\User::class);
        $user->method('getAvatarUrl')->willReturn('https://example.com/a.jpg');
        $preferences = new PresenceUserPreference([
            'availability' => PresenceAvailability::Online,
            'subtitle_mode' => PresenceSubtitleMode::ProfileBio,
            'show_avatar_in_connect_list' => false,
        ]);

        $this->assertNull($service->resolveConnectListAvatar($user, $preferences));
    }

    public function test_show_avatar_defaults_to_true_without_preferences(): void
    {
        $service = new PresencePresentationService;

        $this->assertTrue($service->showAvatarInConnectList(null));
    }

    public function test_accepts_chat_requests_defaults_to_true_without_preferences(): void
    {
        $service = new PresencePresentationService;

        $this->assertTrue($service->acceptsChatRequests(null));
    }

    public function test_accepts_chat_requests_returns_false_when_disabled(): void
    {
        $service = new PresencePresentationService;
        $preferences = new PresenceUserPreference([
            'availability' => PresenceAvailability::Online,
            'subtitle_mode' => PresenceSubtitleMode::ProfileBio,
            'accept_chat_requests' => false,
        ]);

        $this->assertFalse($service->acceptsChatRequests($preferences));
    }
}
