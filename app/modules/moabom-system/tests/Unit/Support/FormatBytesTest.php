<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Support;

use Modules\Moabom\System\Support\FormatBytes;
use Modules\Moabom\System\Tests\ModuleTestCase;

final class FormatBytesTest extends ModuleTestCase
{
    public function test_formats_common_sizes(): void
    {
        $this->assertSame('0 B', FormatBytes::human(0));
        $this->assertSame('512 B', FormatBytes::human(512));
        $this->assertSame('1 KB', FormatBytes::human(1024));
        $this->assertSame('1 MB', FormatBytes::human(1024 * 1024));
    }
}
