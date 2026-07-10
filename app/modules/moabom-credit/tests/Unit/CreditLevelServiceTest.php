<?php

declare(strict_types=1);

namespace Modules\Moabom\Credit\Tests\Unit;

use Modules\Moabom\Credit\Services\CreditLevelService;
use Modules\Moabom\Credit\Services\CreditSettingsService;
use Modules\Moabom\Credit\Tests\ModuleTestCase;

require_once dirname(__DIR__).'/ModuleTestCase.php';

class CreditLevelServiceTest extends ModuleTestCase
{
    private CreditLevelService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = new CreditLevelService(app(CreditSettingsService::class));
    }

    public function test_resolve_boundaries_for_default_thresholds(): void
    {
        $this->assertSame(1, $this->service->resolve(0)['level']);
        $this->assertSame('iron', $this->service->resolve(0)['slug']);
        $this->assertSame(1, $this->service->resolve(99)['level']);
        $this->assertSame(2, $this->service->resolve(100)['level']);
        $this->assertSame('bronze', $this->service->resolve(100)['slug']);
        $this->assertSame(10, $this->service->resolve(50000)['level']);
        $this->assertSame(10, $this->service->resolve(50001)['level']);
        $this->assertSame(1.0, $this->service->resolve(50000)['progress_ratio']);
    }

    public function test_progress_ratio_between_thresholds(): void
    {
        $level = $this->service->resolve(200);
        $this->assertSame(2, $level['level']);
        $this->assertSame(100, $level['current_threshold']);
        $this->assertSame(300, $level['next_threshold']);
        $this->assertEqualsWithDelta(0.5, $level['progress_ratio'], 0.0001);
    }

    public function test_normalize_thresholds_forces_zero_and_nondecreasing(): void
    {
        $normalized = $this->service->normalizeThresholds([10, 50, 40, 700, 1500, 3000, 6000, 12000, 25000, 50000]);
        $this->assertSame(0, $normalized[0]);
        $this->assertSame(50, $normalized[1]);
        $this->assertSame(50, $normalized[2]);
        $this->assertCount(10, $normalized);
    }

    public function test_normalize_falls_back_when_short(): void
    {
        $normalized = $this->service->normalizeThresholds([0, 100]);
        $this->assertSame(CreditLevelService::DEFAULT_THRESHOLDS, $normalized);
    }
}
