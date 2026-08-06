<?php

namespace Modules\Moabom\Apps\Tests\Unit;

use Modules\Moabom\Apps\Enums\AppType;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class AppTypeTest extends ModuleTestCase
{
    public function test_values_include_html_paste_and_website_link(): void
    {
        $this->assertSame(
            ['general', 'html_paste', '3d', 'game', 'dataviz', 'website_link'],
            AppType::values()
        );
    }

    public function test_ai_generatable_values_exclude_paste_and_website_link(): void
    {
        $this->assertSame(
            ['general', '3d', 'game', 'dataviz'],
            AppType::aiGeneratableValues()
        );
    }

    public function test_ai_streamable_values_include_html_paste_exclude_website_link(): void
    {
        $this->assertSame(
            ['general', 'html_paste', '3d', 'game', 'dataviz'],
            AppType::aiStreamableValues()
        );
    }
}
