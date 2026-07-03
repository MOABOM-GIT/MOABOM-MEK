<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Modules\Moabom\Apps\Events\AppCommunityRevisionBroadcastEvent;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class AppCommunityRevisionBroadcastEventTest extends ModuleTestCase
{
    public function test_implements_should_broadcast_now_for_immediate_reverb_publish(): void
    {
        $event = new AppCommunityRevisionBroadcastEvent(
            channelName: 'moabom-app-community.9',
            generatedAppId: 9,
            revision: 3,
            reason: 'review_created',
        );

        $this->assertInstanceOf(ShouldBroadcastNow::class, $event);
        $this->assertSame('app_community.revision', $event->broadcastAs());
        $this->assertSame([
            'generated_app_id' => 9,
            'revision' => 3,
            'reason' => 'review_created',
        ], $event->broadcastWith());
    }
}
