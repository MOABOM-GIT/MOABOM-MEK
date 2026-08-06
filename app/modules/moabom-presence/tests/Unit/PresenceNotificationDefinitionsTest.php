<?php

declare(strict_types=1);

namespace Modules\Moabom\Presence\Tests\Unit;

use Modules\Moabom\Presence\Module;
use Modules\Moabom\Presence\Tests\ModuleTestCase;

final class PresenceNotificationDefinitionsTest extends ModuleTestCase
{
    public function test_friend_notifications_include_database_and_fcm_templates(): void
    {
        $definitions = collect((new Module)->getNotificationDefinitions())->keyBy('type');

        foreach (['friend_request', 'friend_accepted'] as $type) {
            $definition = $definitions->get($type);
            $this->assertIsArray($definition);
            $this->assertEqualsCanonicalizing(['database', 'fcm'], $definition['channels']);
            $this->assertEqualsCanonicalizing(
                ['database', 'fcm'],
                array_column($definition['templates'], 'channel'),
            );
        }
    }
}
