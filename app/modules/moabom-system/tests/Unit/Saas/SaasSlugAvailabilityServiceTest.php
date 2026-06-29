<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Modules\Moabom\System\Saas\PlatformConnectionFactory;
use Modules\Moabom\System\Saas\SaasSlugAvailabilityService;
use Modules\Moabom\System\Tests\ModuleTestCase;

final class SaasSlugAvailabilityServiceTest extends ModuleTestCase
{
    private SaasSlugAvailabilityService $service;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'moabom-system.saas.base_domain' => 'mek360.com',
            'moabom-system.saas.platform_hosts' => ['mek360.com', 'www.mek360.com'],
            'moabom-system.saas.deprovision.protected_slugs' => ['smoke'],
        ]);

        $this->configurePlatformDatabase();
        $this->service = new SaasSlugAvailabilityService(new PlatformConnectionFactory());
    }

    public function test_available_slug_returns_true(): void
    {
        $result = $this->service->check('freshent');

        $this->assertTrue($result['available']);
        $this->assertSame('freshent.mek360.com', $result['host']);
        $this->assertNull($result['reason']);
        $this->assertSame([], $result['conflicts']);
    }

    public function test_reserved_system_slug_realtime_is_unavailable(): void
    {
        $result = $this->service->check('realtime');

        $this->assertFalse($result['available']);
        $this->assertContains('reserved:realtime', $result['conflicts']);
    }

    public function test_reserved_system_slug_apps_is_unavailable(): void
    {
        $result = $this->service->check('apps');

        $this->assertFalse($result['available']);
        $this->assertContains('reserved:apps', $result['conflicts']);
    }

    public function test_protected_system_slug_is_unavailable(): void
    {
        $result = $this->service->check('smoke');

        $this->assertFalse($result['available']);
        $this->assertContains('reserved:smoke', $result['conflicts']);
    }

    public function test_existing_tenant_slug_is_unavailable(): void
    {
        DB::connection('moabom_platform')->table('moabom_saas_tenants')->insert([
            'slug' => 'acme',
            'host' => 'acme.mek360.com',
            'display_name' => 'ACME',
            'db_database' => 'hospital_acme',
            'gcs_prefix' => 'tenants/acme',
            'package_id' => 'hospital-default',
            'status' => 'active',
            'app_url' => 'https://acme.mek360.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $result = $this->service->check('acme');

        $this->assertFalse($result['available']);
        $this->assertContains('tenant_exists', $result['conflicts']);
    }

    public function test_invalid_format_is_unavailable(): void
    {
        $result = $this->service->check('-bad-');

        $this->assertFalse($result['available']);
        $this->assertSame('invalid_format', $result['reason']);
    }

    private function configurePlatformDatabase(): void
    {
        config([
            'moabom-system.saas.platform_database' => 'moabom-platform',
            'database.connections.moabom_platform' => [
                'driver' => 'sqlite',
                'database' => ':memory:',
                'prefix' => '',
            ],
        ]);

        if (! Schema::connection('moabom_platform')->hasTable('moabom_saas_tenants')) {
            Schema::connection('moabom_platform')->create('moabom_saas_tenants', function ($table): void {
                $table->id();
                $table->string('slug', 63);
                $table->string('host', 255);
                $table->string('display_name', 200)->nullable();
                $table->string('db_database', 128);
                $table->string('gcs_prefix', 255)->default('');
                $table->string('package_id', 64)->default('hospital-default');
                $table->string('status', 32)->default('active');
                $table->string('app_url', 512)->nullable();
                $table->timestamps();
                $table->unique('slug');
            });
        }
    }
}
