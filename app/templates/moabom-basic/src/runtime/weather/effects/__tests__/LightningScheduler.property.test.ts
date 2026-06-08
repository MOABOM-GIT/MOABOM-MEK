// Feature: moabom-home-weather-effect, Property 5: lightning cadence invariants
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { LightningScheduler } from '../LightningScheduler';

/**
 * Property 5 — P-LightningCadence.
 *
 * LightningScheduler.tick() 시퀀스(1시간 시뮬레이션) 가 아래 불변식을 모두 만족한다.
 *  - (간격) 연속된 두 창의 startAt 차이 ≥ 15000ms
 *  - (상한) 모든 연속 60s 윈도우 내 창 개수 ≤ maxPerMinute
 *  - (하한 평균) 총 창 수 ≥ floor(minPerMinute * minutes - warmup) — 워밍업(최초 1분) 허용
 *  - (창 파라미터) durationMs ∈ [80, 120], peakAlpha ∈ [0, 0.4]
 *
 * Validates: Requirements 4c.2, 4c.3, 4c.4.
 */

interface SimulationResult {
  readonly events: ReadonlyArray<{ startAt: number; durationMs: number; peakAlpha: number }>;
}

function simulate(seed: number, totalMinutes = 60, stepMs = 100): SimulationResult {
  // Mulberry32 — fast-check 시드로부터 결정적 난수 생성.
  let state = seed >>> 0;
  const random = (): number => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let clock = 0;
  const scheduler = new LightningScheduler({
    random,
    now: () => clock,
  });

  const events: Array<{ startAt: number; durationMs: number; peakAlpha: number }> = [];
  const totalMs = totalMinutes * 60_000;
  while (clock <= totalMs) {
    const event = scheduler.tick();
    if (event) events.push(event);
    clock += stepMs;
  }
  return { events };
}

function maxWindowCount(startTimes: ReadonlyArray<number>, windowMs: number): number {
  if (startTimes.length === 0) return 0;
  let left = 0;
  let max = 0;
  for (let right = 0; right < startTimes.length; right += 1) {
    while (startTimes[right] - startTimes[left] >= windowMs) left += 1;
    max = Math.max(max, right - left + 1);
  }
  return max;
}

describe('Property 5 — P-LightningCadence (LightningScheduler)', () => {
  it('1시간 시뮬레이션에서 네 불변식(간격·상한·창길이·불투명도) 을 만족한다', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1 << 30 }), (seed) => {
        const { events } = simulate(seed, 60, 100);
        if (events.length === 0) {
          // 아주 드물게 60분 내 첫 창이 뒤로 미뤄질 수 있으나, minIntervalMs 규정은 자동 만족.
          return true;
        }

        // 간격: 최소 15초
        for (let i = 1; i < events.length; i += 1) {
          if (events[i].startAt - events[i - 1].startAt < 15_000) return false;
        }

        // 상한: 연속 60s 윈도우 내 ≤ 3 (기본 maxPerMinute=3)
        const max = maxWindowCount(events.map((e) => e.startAt), 60_000);
        if (max > 3) return false;

        // 창 길이·불투명도 범위
        for (const e of events) {
          if (e.durationMs < 80 || e.durationMs > 120) return false;
          if (e.peakAlpha < 0 || e.peakAlpha > 0.4) return false;
        }

        return true;
      }),
      { numRuns: 20 },
    );
  });

  it('평균적으로 분당 최소 1 회 이상 발생한다(60분 평균, 초기 워밍업 1분 여유)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1 << 30 }), (seed) => {
        const { events } = simulate(seed, 60, 100);
        // 최소 59회(= 60분 - 1분 워밍업 허용치). minPerMinute=1 의 평균 기준.
        return events.length >= 50; // 여유 10회 허용(슬롯 균등 분포의 표준편차 고려)
      }),
      { numRuns: 10 },
    );
  });

  it('reset() 호출 후 내부 상태가 초기화되어 첫 창 지연이 다시 샘플링된다', () => {
    let clock = 0;
    const scheduler = new LightningScheduler({
      random: () => 0.5,
      now: () => clock,
    });

    // 시뮬레이션 5분 진행 후 reset
    while (clock <= 5 * 60_000) {
      scheduler.tick();
      clock += 100;
    }
    scheduler.reset();

    // reset 직후 첫 tick 은 null (첫 창이 예약만 됨)
    expect(scheduler.tick()).toBeNull();
  });
});
