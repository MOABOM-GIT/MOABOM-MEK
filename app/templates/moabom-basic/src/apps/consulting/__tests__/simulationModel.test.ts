import { describe, expect, it } from 'vitest';
import {
  formatKrwManwon,
  runSimulation,
  SIMULATION_DEFAULTS,
} from '../simulationModel';

describe('runSimulation', () => {
  it('기본 시나리오: 자체운영은 1년차 적자, smart 는 매년 우위', () => {
    const r = runSimulation(SIMULATION_DEFAULTS);

    expect(r.self.yearly).toHaveLength(5);
    expect(r.smart.yearly).toHaveLength(5);

    // 자체운영은 장비 capex 로 1년차 대규모 적자
    expect(r.self.yearly[0].ebit).toBeLessThan(0);

    // smart 는 매년 자체운영보다 EBIT 우위 (핵심 셀링 포인트)
    for (let y = 0; y < 5; y++) {
      expect(r.smart.yearly[y].ebit).toBeGreaterThan(r.self.yearly[y].ebit);
    }

    // 누적 EBIT 도 smart 우위
    expect(r.smart.total.ebit).toBeGreaterThan(r.self.total.ebit);
  });

  it('입력 기간/신규환자 오버라이드 반영', () => {
    const r = runSimulation({ ...SIMULATION_DEFAULTS, years: 3, monthlyNewPatients: 30 });
    expect(r.self.yearly).toHaveLength(3);
    expect(r.smart.yearly).toHaveLength(3);
  });

  it('환자 수가 0/0 이면 양 시나리오 모두 고정비로 적자', () => {
    const r = runSimulation({ ...SIMULATION_DEFAULTS, initialPatients: 0, monthlyNewPatients: 0 });
    expect(r.smart.yearly[0].ebit).toBeLessThan(0);
  });
});

describe('formatKrwManwon', () => {
  it('억/만원 표기', () => {
    expect(formatKrwManwon(127_880_000)).toBe('1억 2,788만원');
    expect(formatKrwManwon(-19_880_000)).toBe('-1,988만원');
    expect(formatKrwManwon(0)).toBe('0원');
  });
});
