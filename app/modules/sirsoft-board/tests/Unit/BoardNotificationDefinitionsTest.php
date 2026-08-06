<?php

declare(strict_types=1);

namespace Modules\Sirsoft\Board\Tests\Unit;

use Modules\Sirsoft\Board\Module;
use Modules\Sirsoft\Board\Tests\ModuleTestCase;

final class BoardNotificationDefinitionsTest extends ModuleTestCase
{
    public function test_reply_notifications_include_fcm_without_expanding_new_comment(): void
    {
        $definitions = collect((new Module)->getNotificationDefinitions())->keyBy('type');

        foreach (['reply_comment', 'post_reply'] as $type) {
            $definition = $definitions->get($type);
            $this->assertIsArray($definition);
            $this->assertContains('fcm', $definition['channels']);
            $this->assertContains('fcm', array_column($definition['templates'], 'channel'));
        }

        $this->assertNotContains('fcm', $definitions->get('new_comment')['channels']);
    }
}
