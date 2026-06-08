// Feature: moabom-home-weather-effect, Property 7: environment-driven particle budget invariants
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { resolveParticleBudget } from '../env';

/**
 * Property 7 — P-ParticleBudget.
 *
 * resolveParticleBudget 의 반환값이 다음 네 불변식을 동시에 만족한다:
 *   1. result ≤ baseline
 *   2. (isMobile === true || hardwareConcurrency ∈ [1, 4]) → result ≤ baseline * 0.5
 *   3. (isMobile === false && hardwareConcurrency > 4) → result === baseline
 *   4. result ≥ 0
 *
 * Validates: Requirements 5.3.
 */
describe('Property 7 — P-ParticleBudget (resolveParticleBudget)', () => {
  it('네 불변식을 모든 환경 조합에서 동시에 만족한다', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.integer({ min: 0, max: 64 }),
        fc.integer({ min: 1, max: 2000 }),
        (isMobile, hardwareConcurrency, baseline) => {
          const result = resolveParticleBudget({ isMobile, hardwareConcurrency, baseline });

          const lowCore = hardwareConcurrency >= 1 && hardwareConcurrency <= 4;
          const halfFloor = Math.floor(baseline * 0.5);

          const invariant1 = result <= baseline;
          const invariant2 = isMobile || lowCore ? result <= halfFloor : true;
          const invariant3 = !isMobile && hardwareConcurrency > 4 ? result === baseline : true;
          const invariant4 = result >= 0;

          return invariant1 && invariant2 && invariant3 && invariant4;
        },
      ),
      { numRuns: 400 },
    );
  });

  it('hardwareConcurrency === 0 (미상) 은 저사양 오탐으로 취급하지 않는다', () => {
    const result = resolveParticleBudget({ isMobile: false, hardwareConcurrency: 0, baseline: 400 });
    expect(result).toBe(400);
  });

  it('baseline 미지정 시 기본 400 을 사용한다', () => {
    expect(resolveParticleBudget({ isMobile: false, hardwareConcurrency: 8 })).toBe(400);
    expect(resolveParticleBudget({ isMobile: true, hardwareConcurrency: 8 })).toBe(200);
  });

  it('baseline 이 비정상(NaN · Infinity · 0 · 음수) 이면 기본 400 으로 보정한다', () => {
    expect(resolveParticleBudget({ isMobile: false, hardwareConcurrency: 8, baseline: Number.NaN })).toBe(400);
    expect(resolveParticleBudget({ isMobile: false, hardwareConcurrency: 8, baseline: Number.POSITIVE_INFINITY })).toBe(400);
    expect(resolveParticleBudget({ isMobile: false, hardwareConcurrency: 8, baseline: 0 })).toBe(400);
    expect(resolveParticleBudget({ isMobile: false, hardwareConcurrency: 8, baseline: -100 })).toBe(400);
  });
});
