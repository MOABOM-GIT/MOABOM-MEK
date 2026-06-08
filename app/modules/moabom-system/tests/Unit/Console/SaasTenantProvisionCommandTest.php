<?php

namespace Modules\Moabom\System\Tests\Unit\Console;

use Modules\Moabom\System\Tests\ModuleTestCase;

class SaasTenantProvisionCommandTest extends ModuleTestCase
{
    public function test_requires_name_option(): void
    {
        $this->artisan('moabom:saas:tenant-provision', ['slug' => 'miso'])
            ->expectsOutputToContain('--name=')
            ->assertFailed();
    }

    public function test_rejects_invalid_slug(): void
    {
        $this->artisan('moabom:saas:tenant-provision', [
            'slug' => 'INVALID_SLUG',
            '--name' => '테스트',
        ])
            ->expectsOutputToContain('slug 형식')
            ->assertFailed();
    }
}
