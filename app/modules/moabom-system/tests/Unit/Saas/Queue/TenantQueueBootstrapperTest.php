<?php

declare(strict_types=1);

namespace Modules\Moabom\System\Tests\Unit\Saas\Queue;

use Illuminate\Contracts\Queue\Job;
use Illuminate\Queue\Events\JobProcessing;
use Mockery;
use Modules\Moabom\System\Saas\Queue\TenantQueueBootstrapper;
use Modules\Moabom\System\Saas\TenantContext;
use Modules\Moabom\System\Saas\TenantContextSwitcher;
use Modules\Moabom\System\Saas\TenantRecord;
use Tests\TestCase;

/**
 * C1 — 큐 잡 테넌트 전파/복원(글로벌 메커니즘) 단위 검증.
 */
class TenantQueueBootstrapperTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    private function bindContext(TenantContext $context): void
    {
        $this->app->instance(TenantContext::class, $context);
    }

    private function tenantRecord(string $slug): TenantRecord
    {
        return new TenantRecord(
            id: 1,
            slug: $slug,
            host: $slug.'.mek360.com',
            dbDatabase: 'moabom_'.$slug,
            gcsPrefix: 'tenants/'.$slug,
            packageId: 'hospital-default',
            status: 'active',
        );
    }

    private function jobProcessing(array $payload): JobProcessing
    {
        $job = Mockery::mock(Job::class);
        $job->shouldReceive('payload')->andReturn($payload);

        return new JobProcessing('database', $job);
    }

    public function test_payload_is_null_for_platform_context(): void
    {
        $context = new TenantContext();
        $context->setPlatform('mek360.com');
        $this->bindContext($context);

        $bootstrapper = new TenantQueueBootstrapper(Mockery::mock(TenantContextSwitcher::class));

        $this->assertSame(
            [TenantQueueBootstrapper::PAYLOAD_KEY => null],
            $bootstrapper->payload(),
        );
    }

    public function test_payload_carries_tenant_slug(): void
    {
        $context = new TenantContext();
        $context->setTenant($this->tenantRecord('miso'), 'miso.mek360.com');
        $this->bindContext($context);

        $bootstrapper = new TenantQueueBootstrapper(Mockery::mock(TenantContextSwitcher::class));

        $this->assertSame(
            [TenantQueueBootstrapper::PAYLOAD_KEY => 'miso'],
            $bootstrapper->payload(),
        );
    }

    public function test_worker_bootstraps_tenant_then_restores_platform(): void
    {
        $context = new TenantContext();
        $context->setPlatform('mek360.com');
        $this->bindContext($context);

        $runtime = Mockery::mock(TenantContextSwitcher::class);
        $runtime->shouldReceive('bootstrapTenantBySlug')->once()->with('miso')->andReturnTrue();
        $runtime->shouldReceive('restorePlatformContext')->once();

        $bootstrapper = new TenantQueueBootstrapper($runtime);

        $bootstrapper->onJobProcessing($this->jobProcessing([
            TenantQueueBootstrapper::PAYLOAD_KEY => 'miso',
        ]));
        $bootstrapper->onJobSettled(Mockery::mock());
    }

    public function test_missing_payload_key_does_not_touch_context(): void
    {
        $context = new TenantContext();
        $context->setPlatform('mek360.com');
        $this->bindContext($context);

        $runtime = Mockery::mock(TenantContextSwitcher::class);
        $runtime->shouldNotReceive('bootstrapTenantBySlug');
        $runtime->shouldNotReceive('restorePlatformContext');

        $bootstrapper = new TenantQueueBootstrapper($runtime);

        $bootstrapper->onJobProcessing($this->jobProcessing(['job' => 'SomeVendorJob']));
        $bootstrapper->onJobSettled(Mockery::mock());

        $this->assertTrue(true);
    }

    public function test_in_request_sync_dispatch_restores_previous_tenant(): void
    {
        // in-request: 현재 컨텍스트가 tenant(clinic). sync 잡이 miso 로 전환 후
        // 종료 시 platform 이 아니라 직전 tenant(clinic)로 복원해야 한다.
        $context = new TenantContext();
        $context->setTenant($this->tenantRecord('clinic'), 'clinic.mek360.com');
        $this->bindContext($context);

        $runtime = Mockery::mock(TenantContextSwitcher::class);
        $runtime->shouldReceive('bootstrapTenantBySlug')->once()->with('miso')->andReturnTrue();
        $runtime->shouldReceive('bootstrapTenantBySlug')->once()->with('clinic')->andReturnTrue();
        $runtime->shouldNotReceive('restorePlatformContext');

        $bootstrapper = new TenantQueueBootstrapper($runtime);

        $bootstrapper->onJobProcessing($this->jobProcessing([
            TenantQueueBootstrapper::PAYLOAD_KEY => 'miso',
        ]));
        $bootstrapper->onJobSettled(Mockery::mock());
    }
}
