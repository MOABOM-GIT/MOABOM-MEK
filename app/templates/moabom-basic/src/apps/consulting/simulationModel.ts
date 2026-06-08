/**
 * 맞춤형 수익성 시뮬레이션 모델 (클라이언트 즉시 미리보기).
 *
 * 서버 권위 계산: modules/moabom-consulting/src/Services/ProfitabilitySimulationService.php 와
 * 1:1 동일한 로직. 의사가 태블릿에서 슬라이더를 움직이면 즉시 결과를 보여주되, 전자계약
 * 저장 시점에는 동일 입력으로 서버가 재계산한 값을 권위 데이터로 저장한다.
 *
 * 출처: 360 컨설팅.pptx(슬라이드 14~16) + 파트너십 서비스 계약 시나리오_v2.xlsx
 * 단위: 원(KRW), 비율(0~1).
 */

export interface SimulationInput {
  initialPatients: number;      // 관리 환자 수(초기)
  monthlyNewPatients: number;   // 월 처방 수(신규/월)
  staffCount: number;           // 배치 인력 수
  staffSalary: number;          // 인력 1인 월 급여
  equipmentPrice: number;       // 장비 대당 구매가(자체운영 capex)
  refurbishCost: number;        // 리퍼비시/관리비용(대당)
  adherencePassRate: number;    // 순응 통과율
  annualRetention: number;      // 연간 유지율
  years: number;                // 시뮬레이션 기간(년)
}

export interface YearlyRow {
  year: number;
  revenue: number;
  cost: number;
  ebit: number;
}

export interface ScenarioResult {
  yearly: YearlyRow[];
  cumulativeEbit: number[];
  breakevenMonth: number | null;
  total: { revenue: number; cost: number; ebit: number };
  avgMonthly: { revenue: number; cost: number; ebit: number };
}

export interface SimulationResult {
  self: ScenarioResult;
  smart: ScenarioResult;
}

/** PPT 슬라이드 14 기준 기본 가정값 (백엔드 config/moabom-consulting.php 와 동일). */
export const SIMULATION_DEFAULTS: SimulationInput = {
  initialPatients: 0,
  monthlyNewPatients: 15,
  staffCount: 1,
  staffSalary: 3_000_000,
  equipmentPrice: 900_000,
  refurbishCost: 80_000,
  adherencePassRate: 0.85,
  annualRetention: 0.65,
  years: 5,
};

const COEFFICIENTS = {
  self: {
    rentalRevenuePerPatient: 75_000, // 자체운영: 청구효율 낮음
    consumableCostPerPatient: 6_000,
    monthlyRent: 1_000_000,
  },
  smart: {
    rentalRevenuePerPatient: 95_000, // 360: 전문 청구팀 → 청구효율 높음
    serviceFeePerPatient: 38_000,    // MEK 통합 서비스비용
    monthlyRent: 1_000_000,
  },
} as const;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function summarize(monthly: { revenue: number; cost: number; ebit: number }[], years: number): ScenarioResult {
  const yearly: YearlyRow[] = [];
  for (let y = 0; y < years; y++) {
    let revenue = 0;
    let cost = 0;
    let ebit = 0;
    for (let mm = 0; mm < 12; mm++) {
      const idx = y * 12 + mm;
      revenue += monthly[idx].revenue;
      cost += monthly[idx].cost;
      ebit += monthly[idx].ebit;
    }
    yearly.push({ year: y + 1, revenue: Math.round(revenue), cost: Math.round(cost), ebit: Math.round(ebit) });
  }

  const cumulativeEbit: number[] = [];
  let running = 0;
  for (const row of yearly) {
    running += row.ebit;
    cumulativeEbit.push(Math.round(running));
  }

  let breakevenMonth: number | null = null;
  let run = 0;
  for (let i = 0; i < monthly.length; i++) {
    run += monthly[i].ebit;
    if (run >= 0) {
      breakevenMonth = i + 1;
      break;
    }
  }

  const totalRevenue = yearly.reduce((s, r) => s + r.revenue, 0);
  const totalCost = yearly.reduce((s, r) => s + r.cost, 0);
  const totalEbit = yearly.reduce((s, r) => s + r.ebit, 0);
  const n = monthly.length;

  return {
    yearly,
    cumulativeEbit,
    breakevenMonth,
    total: { revenue: Math.round(totalRevenue), cost: Math.round(totalCost), ebit: Math.round(totalEbit) },
    avgMonthly: {
      revenue: n > 0 ? Math.round(totalRevenue / n) : 0,
      cost: n > 0 ? Math.round(totalCost / n) : 0,
      ebit: n > 0 ? Math.round(totalEbit / n) : 0,
    },
  };
}

export function runSimulation(rawInput: Partial<SimulationInput>): SimulationResult {
  const input: SimulationInput = {
    initialPatients: Number(rawInput.initialPatients ?? SIMULATION_DEFAULTS.initialPatients) || 0,
    monthlyNewPatients: Number(rawInput.monthlyNewPatients ?? SIMULATION_DEFAULTS.monthlyNewPatients) || 0,
    staffCount: Number(rawInput.staffCount ?? SIMULATION_DEFAULTS.staffCount) || 0,
    staffSalary: Number(rawInput.staffSalary ?? SIMULATION_DEFAULTS.staffSalary) || 0,
    equipmentPrice: Number(rawInput.equipmentPrice ?? SIMULATION_DEFAULTS.equipmentPrice) || 0,
    refurbishCost: Number(rawInput.refurbishCost ?? SIMULATION_DEFAULTS.refurbishCost) || 0,
    adherencePassRate: clamp01(Number(rawInput.adherencePassRate ?? SIMULATION_DEFAULTS.adherencePassRate)),
    annualRetention: clamp01(Number(rawInput.annualRetention ?? SIMULATION_DEFAULTS.annualRetention)),
    years: Math.max(1, Math.min(12, Math.round(Number(rawInput.years ?? SIMULATION_DEFAULTS.years)))),
  };

  const months = input.years * 12;
  const monthlyRetention = Math.pow(input.annualRetention, 1 / 12);
  const adhered = input.monthlyNewPatients * input.adherencePassRate;

  const base: number[] = [];
  let current = input.initialPatients;
  for (let m = 0; m < months; m++) {
    current = current * monthlyRetention + adhered;
    base[m] = current;
  }

  const staffCostMonthly = input.staffCount * input.staffSalary;
  const selfMonthly: { revenue: number; cost: number; ebit: number }[] = [];
  const smartMonthly: { revenue: number; cost: number; ebit: number }[] = [];

  for (let m = 0; m < months; m++) {
    const patients = base[m];

    // 자체운영
    const selfRevenue = patients * COEFFICIENTS.self.rentalRevenuePerPatient;
    const selfEquipmentCapex = input.monthlyNewPatients * input.equipmentPrice;
    const selfRefurbish = patients * 0.02 * input.refurbishCost;
    const selfConsumable = patients * COEFFICIENTS.self.consumableCostPerPatient;
    const selfCost = staffCostMonthly + selfEquipmentCapex + selfRefurbish + selfConsumable + COEFFICIENTS.self.monthlyRent;
    selfMonthly.push({ revenue: selfRevenue, cost: selfCost, ebit: selfRevenue - selfCost });

    // 스마트케어360
    const smartRevenue = patients * COEFFICIENTS.smart.rentalRevenuePerPatient;
    const smartService = patients * COEFFICIENTS.smart.serviceFeePerPatient;
    const smartCost = staffCostMonthly + smartService + COEFFICIENTS.smart.monthlyRent;
    smartMonthly.push({ revenue: smartRevenue, cost: smartCost, ebit: smartRevenue - smartCost });
  }

  return {
    self: summarize(selfMonthly, input.years),
    smart: summarize(smartMonthly, input.years),
  };
}

/** SimulationInput → 서버 API snake_case 페이로드 */
export function toServerInput(input: SimulationInput): Record<string, number> {
  return {
    initial_patients: input.initialPatients,
    monthly_new_patients: input.monthlyNewPatients,
    staff_count: input.staffCount,
    staff_salary: input.staffSalary,
    equipment_price: input.equipmentPrice,
    refurbish_cost: input.refurbishCost,
    adherence_pass_rate: input.adherencePassRate,
    annual_retention: input.annualRetention,
    years: input.years,
  };
}

// 통화 포맷은 앱 공용 SDK 로 승격됨 — 기존 import 경로 호환을 위해 재노출한다.
export { formatKrwManwon } from '../_shared/format';
