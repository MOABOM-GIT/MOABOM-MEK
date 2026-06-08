<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Modules\Moabom\System\Saas\Deprovision\DestroyOptions;
use Modules\Moabom\System\Saas\Deprovision\PurgeOptions;
use Modules\Moabom\System\Saas\Deprovision\TenantDeprovisionGuard;
use Modules\Moabom\System\Saas\TenantRecord;
use Modules\Moabom\System\Tests\ModuleTestCase;

final class TenantDeprovisionGuardTest extends ModuleTestCase
{
    private TenantDeprovisionGuard $guard;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'moabom-system.saas.platform_hosts' => ['mek360.com', 'www.mek360.com'],
            'moabom-system.saas.deprovision.protected_slugs' => ['e2etest'],
        ]);

        $this->guard = new TenantDeprovisionGuard();
    }

    public function test_rejects_mismatched_confirm_slug(): void
    {
        $tenant = $this->tenant('freshent');

        $this->expectException(\InvalidArgumentException::class);
        $this->guard->assertPurgeAllowed($tenant, new PurgeOptions(confirmSlug: 'wrong'));
    }

    public function test_rejects_platform_host_destroy(): void
    {
        $tenant = new TenantRecord(
            id: 1,
            slug: 'platform',
            host: 'mek360.com',
            dbDatabase: 'moabom-db',
            gcsPrefix: '',
            packageId: 'hospital-default',
            status: 'active',
        );

        $this->expectException(\RuntimeException::class);
        $this->guard->assertDestroyAllowed($tenant, new DestroyOptions(
            confirmSlug: 'platform',
            confirmHost: 'mek360.com',
        ));
    }

    public function test_rejects_protected_slug(): void
    {
        $tenant = $this->tenant('e2etest');

        $this->expectException(\RuntimeException::class);
        $this->guard->assertPurgeAllowed($tenant, new PurgeOptions(confirmSlug: 'e2etest'));
    }

    public function test_rejects_purging_status(): void
    {
        $tenant = $this->tenant('freshent', status: 'purging');

        $this->expectException(\RuntimeException::class);
        $this->guard->assertPurgeAllowed($tenant, new PurgeOptions(confirmSlug: 'freshent'));
    }

    private function tenant(string $slug, string $status = 'active'): TenantRecord
    {
        return new TenantRecord(
            id: 1,
            slug: $slug,
            host: $slug.'.mek360.com',
            dbDatabase: 'hospital_'.$slug,
            gcsPrefix: 'tenants/'.$slug,
            packageId: 'hospital-default',
            status: $status,
        );
    }
}
