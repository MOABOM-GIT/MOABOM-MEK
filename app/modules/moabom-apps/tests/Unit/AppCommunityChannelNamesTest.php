<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use Modules\Moabom\Apps\Support\AppCommunityChannelNames;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class AppCommunityChannelNamesTest extends ModuleTestCase
{
    public function test_revision_channel_and_cache_key_are_stable(): void
    {
        $this->assertSame('moabom-app-community.99', AppCommunityChannelNames::revisionChannel(99));
        $this->assertSame('moabom-app-community:revision:99', AppCommunityChannelNames::revisionCacheKey(99));
    }
}
