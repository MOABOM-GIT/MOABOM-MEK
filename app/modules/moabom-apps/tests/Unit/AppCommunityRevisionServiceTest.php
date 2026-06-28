<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Modules\Moabom\Apps\Events\AppCommunityRevisionBroadcastEvent;
use Modules\Moabom\Apps\Services\AppCommunityRevisionService;
use Modules\Moabom\Apps\Support\AppCommunityChannelNames;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class AppCommunityRevisionServiceTest extends ModuleTestCase
{
    public function test_bump_increments_cache_and_broadcasts_when_reverb_configured(): void
    {
        config([
            'broadcasting.default' => 'reverb',
            'broadcasting.connections.reverb' => [
                'options' => ['host' => 'reverb.example.test'],
            ],
        ]);

        Event::fake([AppCommunityRevisionBroadcastEvent::class]);
        Cache::forget(AppCommunityChannelNames::revisionCacheKey(42));

        $service = $this->app->make(AppCommunityRevisionService::class);
        $revision = $service->bump(42, 'admin_status_hidden');

        $this->assertSame(1, $revision);
        $this->assertSame(1, $service->current(42));

        Event::assertDispatched(AppCommunityRevisionBroadcastEvent::class, function (AppCommunityRevisionBroadcastEvent $event): bool {
            return $event->channelName === 'moabom-app-community.42'
                && $event->generatedAppId === 42
                && $event->revision === 1
                && $event->reason === 'admin_status_hidden';
        });
    }

    public function test_bump_skips_broadcast_when_driver_null(): void
    {
        config(['broadcasting.default' => 'null']);
        Cache::forget(AppCommunityChannelNames::revisionCacheKey(7));

        Event::fake([AppCommunityRevisionBroadcastEvent::class]);

        $service = $this->app->make(AppCommunityRevisionService::class);
        $this->assertSame(1, $service->bump(7, 'review_created'));

        Event::assertNotDispatched(AppCommunityRevisionBroadcastEvent::class);
    }
}
