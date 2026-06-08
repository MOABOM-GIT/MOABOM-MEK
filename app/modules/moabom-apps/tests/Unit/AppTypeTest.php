<?php

namespace Modules\Moabom\Apps\Tests\Unit;

use Modules\Moabom\Apps\Enums\AppType;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class AppTypeTest extends ModuleTestCase
{
    /**
     * 허용 값 목록이 기존 검증 규칙과 정확히 동일해야 한다(동작 보존).
     */
    public function test_values_match_existing_allowed_set(): void
    {
        $this->assertSame(['general', '3d', 'game', 'dataviz'], AppType::values());
    }
}
