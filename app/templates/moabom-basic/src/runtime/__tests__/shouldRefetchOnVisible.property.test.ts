// Feature: moabom-home-weather-effect, Property 8: 30-minute visible refetch gate
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { shouldRefetchOnVisible } from '../weather/shouldRefetchOnVisible';
import { WEATHER_VISIBLE_REFETCH_GATE_MS } from '../weather/constants';

/**
 * Property 8 — P-RefetchGate.
 *
 * `shouldRefetchOnVisible(lastFetchedAtMs, nowMs) === (nowMs - lastFetchedAtMs) > 30min`.
 * 30 분 경계 직전은 false, 직후는 true.
 *
 * Validates: Requirements 3.2.
 */
describe('Property 8 — P-RefetchGate (shouldRefetchOnVisible)', () => {
  it('경과 시간이 30분을 초과할 때만 true 를 반환한다', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2_000_000_000_000 }), // lastFetchedAtMs
        fc.integer({ min: 0, max: 2_000_000_000_000 }), // nowMs
        (lastFetchedAtMs, nowMs) => {
          const elapsed = nowMs - lastFetchedAtMs;
          const expected = elapsed > 0 && elapsed > WEATHER_VISIBLE_REFETCH_GATE_MS;
          return shouldRefetchOnVisible(lastFetchedAtMs, nowMs) === expected;
        },
      ),
      { numRuns: 300 },
    );
  });

  it('경계 직전(30분 - 1ms) 은 false', () => {
    const last = 1_000_000_000;
    expect(shouldRefetchOnVisible(last, last + WEATHER_VISIBLE_REFETCH_GATE_MS - 1)).toBe(false);
    expect(shouldRefetchOnVisible(last, last + WEATHER_VISIBLE_REFETCH_GATE_MS)).toBe(false);
  });

  it('경계 직후(30분 + 1ms) 는 true', () => {
    const last = 1_000_000_000;
    expect(shouldRefetchOnVisible(last, last + WEATHER_VISIBLE_REFETCH_GATE_MS + 1)).toBe(true);
  });

  it('동일 시각 · 미래 시각 입력은 false (방어적 계약)', () => {
    expect(shouldRefetchOnVisible(1000, 1000)).toBe(false);
    expect(shouldRefetchOnVisible(2000, 1000)).toBe(false);
  });

  it('유한하지 않은 입력은 false 를 반환한다', () => {
    expect(shouldRefetchOnVisible(Number.NaN, 1000)).toBe(false);
    expect(shouldRefetchOnVisible(1000, Number.POSITIVE_INFINITY)).toBe(false);
  });
});
