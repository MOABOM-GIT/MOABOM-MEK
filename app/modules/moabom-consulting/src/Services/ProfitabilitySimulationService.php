<?php

namespace Modules\Moabom\Consulting\Services;

/**
 * 맞춤형 수익성 시뮬레이션 계산기 (서버 권위, C5 패턴).
 *
 * 프론트 `templates/moabom-basic/src/apps/consulting/simulationModel.ts` 와 1:1 동일한
 * 모델을 구현한다. 클라이언트에서 즉시 미리보기를 계산하더라도, 계약(전자서명) 시점에
 * 저장되는 권위 있는 수치는 서버가 재계산한다.
 *
 * 모델 개요:
 *   - 환자 base 는 매월 (유지율^(1/12)) 로 이월 + 신규환자×순응통과율 만큼 가산.
 *   - 자체운영(self): 장비를 직접 구매(capex = 신규환자×장비단가) → 초기 대규모 적자.
 *   - 스마트케어360(smart): capex 0 + 통합 서비스비용(base×1인당 서비스비) + 높은 청구효율.
 */
class ProfitabilitySimulationService
{
    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    public function simulate(array $input): array
    {
        $config = (array) config('moabom-consulting.simulation', []);
        $defaults = (array) ($config['defaults'] ?? []);
        $coeff = (array) ($config['coefficients'] ?? []);

        $p = [
            'initial_patients' => $this->num($input, 'initial_patients', (float) ($defaults['initial_patients'] ?? 0)),
            'monthly_new_patients' => $this->num($input, 'monthly_new_patients', (float) ($defaults['monthly_new_patients'] ?? 15)),
            'staff_count' => $this->num($input, 'staff_count', (float) ($defaults['staff_count'] ?? 1)),
            'staff_salary' => $this->num($input, 'staff_salary', (float) ($defaults['staff_salary'] ?? 3_000_000)),
            'equipment_price' => $this->num($input, 'equipment_price', (float) ($defaults['equipment_price'] ?? 900_000)),
            'refurbish_cost' => $this->num($input, 'refurbish_cost', (float) ($defaults['refurbish_cost'] ?? 80_000)),
            'adherence_pass_rate' => $this->clamp01($this->num($input, 'adherence_pass_rate', (float) ($defaults['adherence_pass_rate'] ?? 0.85))),
            'annual_retention' => $this->clamp01($this->num($input, 'annual_retention', (float) ($defaults['annual_retention'] ?? 0.65))),
            'years' => (int) max(1, min(12, $this->num($input, 'years', (float) ($defaults['years'] ?? 5)))),
        ];

        $self = (array) ($coeff['self'] ?? []);
        $smart = (array) ($coeff['smart'] ?? []);

        $months = $p['years'] * 12;
        $monthlyRetention = $p['annual_retention'] ** (1 / 12);

        // 월별 환자 base (두 시나리오 공통 환자 동역학)
        $base = [];
        $current = $p['initial_patients'];
        $newPerMonth = $p['monthly_new_patients'];
        $adhered = $newPerMonth * $p['adherence_pass_rate'];
        for ($m = 0; $m < $months; $m++) {
            $current = $current * $monthlyRetention + $adhered;
            $base[$m] = $current;
        }

        $selfMonthly = [];
        $smartMonthly = [];
        $staffCostMonthly = $p['staff_count'] * $p['staff_salary'];

        for ($m = 0; $m < $months; $m++) {
            $patients = $base[$m];

            // --- 자체운영 ---
            $selfRevenue = $patients * (float) ($self['rental_revenue_per_patient'] ?? 75_000);
            $selfEquipmentCapex = $newPerMonth * $p['equipment_price'];
            $selfRefurbish = $patients * 0.02 * $p['refurbish_cost']; // 월 2% 환자분 리퍼비시/관리
            $selfConsumable = $patients * (float) ($self['consumable_cost_per_patient'] ?? 6_000);
            $selfCost = $staffCostMonthly
                + $selfEquipmentCapex
                + $selfRefurbish
                + $selfConsumable
                + (float) ($self['monthly_rent'] ?? 1_000_000);
            $selfMonthly[$m] = [
                'patients' => $patients,
                'revenue' => $selfRevenue,
                'cost' => $selfCost,
                'ebit' => $selfRevenue - $selfCost,
            ];

            // --- 스마트케어360 ---
            $smartRevenue = $patients * (float) ($smart['rental_revenue_per_patient'] ?? 95_000);
            $smartService = $patients * (float) ($smart['service_fee_per_patient'] ?? 38_000);
            $smartCost = $staffCostMonthly
                + $smartService
                + (float) ($smart['monthly_rent'] ?? 1_000_000);
            $smartMonthly[$m] = [
                'patients' => $patients,
                'revenue' => $smartRevenue,
                'cost' => $smartCost,
                'ebit' => $smartRevenue - $smartCost,
            ];
        }

        return [
            'input' => $p,
            'self' => $this->summarize($selfMonthly, $p['years']),
            'smart' => $this->summarize($smartMonthly, $p['years']),
        ];
    }

    /**
     * 월별 → 연별 집계 + 누적 EBIT + 손익분기 월.
     *
     * @param  array<int, array<string, float>>  $monthly
     * @return array<string, mixed>
     */
    private function summarize(array $monthly, int $years): array
    {
        $yearly = [];
        for ($y = 0; $y < $years; $y++) {
            $rev = 0.0;
            $cost = 0.0;
            $ebit = 0.0;
            for ($mm = 0; $mm < 12; $mm++) {
                $idx = $y * 12 + $mm;
                $rev += $monthly[$idx]['revenue'];
                $cost += $monthly[$idx]['cost'];
                $ebit += $monthly[$idx]['ebit'];
            }
            $yearly[] = [
                'year' => $y + 1,
                'revenue' => round($rev),
                'cost' => round($cost),
                'ebit' => round($ebit),
            ];
        }

        $cumulative = [];
        $running = 0.0;
        foreach ($yearly as $row) {
            $running += $row['ebit'];
            $cumulative[] = round($running);
        }

        // 손익분기 월(누적 EBIT 이 처음으로 0 이상이 되는 월) — capex 가 큰 자체운영은 null 가능.
        $breakevenMonth = null;
        $run = 0.0;
        foreach ($monthly as $i => $row) {
            $run += $row['ebit'];
            if ($run >= 0) {
                $breakevenMonth = $i + 1;
                break;
            }
        }

        $totalRevenue = array_sum(array_column($yearly, 'revenue'));
        $totalCost = array_sum(array_column($yearly, 'cost'));
        $totalEbit = array_sum(array_column($yearly, 'ebit'));
        $monthsCount = count($monthly);

        return [
            'yearly' => $yearly,
            'cumulative_ebit' => $cumulative,
            'breakeven_month' => $breakevenMonth,
            'total' => [
                'revenue' => round($totalRevenue),
                'cost' => round($totalCost),
                'ebit' => round($totalEbit),
            ],
            'avg_monthly' => [
                'revenue' => $monthsCount > 0 ? round($totalRevenue / $monthsCount) : 0,
                'cost' => $monthsCount > 0 ? round($totalCost / $monthsCount) : 0,
                'ebit' => $monthsCount > 0 ? round($totalEbit / $monthsCount) : 0,
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $source
     */
    private function num(array $source, string $key, float $default): float
    {
        $value = $source[$key] ?? null;
        if (is_int($value) || is_float($value)) {
            return is_finite((float) $value) ? (float) $value : $default;
        }
        if (is_string($value) && is_numeric($value)) {
            $float = (float) $value;

            return is_finite($float) ? $float : $default;
        }

        return $default;
    }

    private function clamp01(float $value): float
    {
        return max(0.0, min(1.0, $value));
    }
}
