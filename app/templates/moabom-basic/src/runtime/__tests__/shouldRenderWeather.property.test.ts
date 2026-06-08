// Feature: moabom-home-weather-effect, Property 1: shouldRender === AND of 4 inputs
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { shouldRender } from '../weather/shouldRender';

/**
 * Property 1 — P-Gate.
 *
 * `shouldRender({ effective, visibility, intersecting })` 는 네 입력의 단순 AND 합성과 정확히 동치이다:
 *   effective.weather && effective.animation && visibility === 'visible' && intersecting.
 *
 * Validates: Requirements 1.1, 1.2, 5.1, 5.2, 10.1.
 */
describe('Property 1 — P-Gate (shouldRender)', () => {
  it('네 입력 조합 전수에 대해 AND 합성과 정확히 일치한다', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.constantFrom('visible' as const, 'hidden' as const),
        fc.boolean(),
        (weather, animation, visibility, intersecting) => {
          const expected =
            weather && animation && visibility === 'visible' && intersecting;
          const actual = shouldRender({
            effective: { weather, animation },
            visibility,
            intersecting,
          });
          return actual === expected;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('네 요인 중 하나라도 false/hidden 이면 false 를 반환한다', () => {
    // 부분 속성 — 4 개의 약한 반례 케이스를 명시적으로 고정해 회귀 방지.
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.constantFrom('visible' as const, 'hidden' as const),
        fc.boolean(),
        (weather, animation, visibility, intersecting) => {
          const result = shouldRender({
            effective: { weather, animation },
            visibility,
            intersecting,
          });
          if (!weather) return result === false;
          if (!animation) return result === false;
          if (visibility !== 'visible') return result === false;
          if (!intersecting) return result === false;
          return result === true;
        },
      ),
      { numRuns: 200 },
    );
  });

  it('4 개 입력이 모두 활성(truthy · visible) 일 때만 true 를 반환한다', () => {
    expect(
      shouldRender({
        effective: { weather: true, animation: true },
        visibility: 'visible',
        intersecting: true,
      }),
    ).toBe(true);
  });
});
