<?php

namespace Modules\Moabom\Social\Auth\Tests\Unit;

use Modules\Moabom\Social\Auth\Support\SocialAuthAdminHostScope;
use Modules\Moabom\Social\Auth\Tests\ModuleTestCase;

class SocialAuthAdminHostScopeTest extends ModuleTestCase
{
    public function test_platform_scope_allows_credential_management(): void
    {
        $abilities = SocialAuthAdminHostScope::resolve(isSubTenantHost: false);

        $this->assertSame(SocialAuthAdminHostScope::SCOPE_PLATFORM, $abilities['host_scope']);
        $this->assertTrue($abilities['can_manage_credentials']);
        $this->assertFalse($abilities['readonly_sub_tenant']);
        $this->assertFalse($abilities['inherits_master_credentials']);
        $this->assertTrue($abilities['features']['manage_credentials']);
        $this->assertTrue($abilities['features']['toggle_use_master_defaults']);
        $this->assertFalse($abilities['features']['view_master_credentials']);
    }

    public function test_tenant_subdomain_scope_inherits_master_credentials(): void
    {
        $abilities = SocialAuthAdminHostScope::resolve(isSubTenantHost: true);

        $this->assertSame(SocialAuthAdminHostScope::SCOPE_TENANT_SUBDOMAIN, $abilities['host_scope']);
        $this->assertFalse($abilities['can_manage_credentials']);
        $this->assertTrue($abilities['readonly_sub_tenant']);
        $this->assertTrue($abilities['inherits_master_credentials']);
        $this->assertFalse($abilities['features']['manage_credentials']);
        $this->assertFalse($abilities['features']['toggle_use_master_defaults']);
        $this->assertTrue($abilities['features']['view_master_credentials']);
        $this->assertTrue($abilities['features']['toggle_provider_enabled']);
    }
}
