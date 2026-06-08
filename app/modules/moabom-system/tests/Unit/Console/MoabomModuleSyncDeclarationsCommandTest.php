<?php

namespace Modules\Moabom\System\Tests\Unit\Console;

use Modules\Moabom\System\Console\Commands\MoabomModuleSyncDeclarationsCommand;
use Modules\Moabom\System\Providers\SystemServiceProvider;
use Modules\Moabom\System\Tests\ModuleTestCase;

class MoabomModuleSyncDeclarationsCommandTest extends ModuleTestCase
{
    public function test_command_is_registered(): void
    {
        $this->app->register(SystemServiceProvider::class);

        $this->assertSame(
            MoabomModuleSyncDeclarationsCommand::class,
            get_class($this->app->make(MoabomModuleSyncDeclarationsCommand::class)),
        );
    }
}
