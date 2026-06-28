<?php

declare(strict_types=1);

namespace Modules\Moabom\Apps\Tests\Unit;

use Modules\Moabom\Apps\Support\AppCommunityTenantScope;
use Modules\Moabom\Apps\Tests\ModuleTestCase;

class AppCommunityTenantScopeTest extends ModuleTestCase
{
    public function test_main_database_author_slugs_include_unknown_and_platform(): void
    {
        $this->assertTrue(AppCommunityTenantScope::isMainDatabaseAuthorSlug('unknown'));
        $this->assertTrue(AppCommunityTenantScope::isMainDatabaseAuthorSlug('platform'));
        $this->assertTrue(AppCommunityTenantScope::isMainDatabaseAuthorSlug('default'));
    }

    public function test_author_slug_for_write_returns_preview_scope_key(): void
    {
        $this->assertNotSame('', AppCommunityTenantScope::authorSlugForWrite());
    }
}
