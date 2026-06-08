<?php

namespace Modules\Moabom\Consulting\Tests\Unit;

use Modules\Moabom\Consulting\Services\ProfitabilitySimulationService;
use Modules\Moabom\Consulting\Tests\ModuleTestCase;

class ProfitabilitySimulationServiceTest extends ModuleTestCase
{
    private function service(): ProfitabilitySimulationService
    {
        return $this->app->make(ProfitabilitySimulationService::class);
    }

    public function test_default_scenario_tells_the_sales_story(): void
    {
        $result = $this->service()->simulate([]);

        $this->assertArrayHasKey('self', $result);
        $this->assertArrayHasKey('smart', $result);

        $selfYearly = $result['self']['yearly'];
        $smartYearly = $result['smart']['yearly'];
        $this->assertCount(5, $selfYearly);
        $this->assertCount(5, $smartYearly);

        // 자체운영은 장비 capex 로 1년차 대규모 적자.
        $this->assertLessThan(0, $selfYearly[0]['ebit']);

        // 스마트케어360 은 매년 자체운영보다 영업이익이 높다(핵심 셀링 포인트).
        for ($y = 0; $y < 5; $y++) {
            $this->assertGreaterThan(
                $selfYearly[$y]['ebit'],
                $smartYearly[$y]['ebit'],
                "Year ".($y + 1)." smart EBIT should exceed self EBIT",
            );
        }

        // 5개년 누적 EBIT 도 스마트케어360 이 우위.
        $this->assertGreaterThan(
            $result['self']['total']['ebit'],
            $result['smart']['total']['ebit'],
        );
    }

    public function test_input_overrides_are_respected(): void
    {
        $result = $this->service()->simulate([
            'monthly_new_patients' => 30,
            'years' => 3,
        ]);

        $this->assertCount(3, $result['self']['yearly']);
        $this->assertSame(30.0, $result['input']['monthly_new_patients']);
    }
}
