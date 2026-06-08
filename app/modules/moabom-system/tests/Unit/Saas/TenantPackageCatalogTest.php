<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Modules\Moabom\System\Saas\TenantPackageCatalog;
use Modules\Moabom\System\Tests\ModuleTestCase;

class TenantPackageCatalogTest extends ModuleTestCase
{
    public function test_hospital_default_package_ssot(): void
    {
        $catalog = new TenantPackageCatalog;
        $package = $catalog->get('hospital-default');

        $this->assertSame('hospital-default', $package->id);
        $this->assertSame('moabom-admin_basic', $package->activeAdminTemplate);
        $this->assertContains('moabom-admin_basic', $package->templates);
        $this->assertContains('moabom-system', $package->modules);
    }
}
