/**
 * Feature: moabom-pwa-service-worker
 *
 * Property 3 (P-VersionMonotonic) — mtime 단조 증가 시 버전이 "더 새로움" 으로 판정.
 *
 * Validates: Requirements 4.3, 4.4, 10.4
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';

import { hashVersion, isNewer } from '../pureVersion';

describe('P3 P-VersionMonotonic', () => {
  it('동일 mtime 벡터 → 동일 버전(isNewer false), 적어도 하나 증가 → 서로 다른 버전(isNewer true)', () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.nat({ max: 2_000_000_000 }), { minLength: 1, maxLength: 10 })
          .chain(m1 =>
            fc
              .array(fc.nat({ max: 1_000_000 }), { minLength: m1.length, maxLength: m1.length })
              .map(deltas => ({ m1, deltas })),
          ),
        ({ m1, deltas }) => {
          // 동일 입력 → 동일 출력 (결정성, Req 4.3)
          expect(hashVersion(m1)).toBe(hashVersion([...m1]));
          expect(isNewer(hashVersion(m1), hashVersion([...m1]))).toBe(false);

          // 최소 한 원소는 엄격히 증가 — 무조건 +1 후 나머지는 deltas 적용
          const m2 = m1.map((v, i) => v + (deltas[i] ?? 0));
          // 증가 보장: 첫 원소를 확실히 +1
          m2[0] = (m1[0] ?? 0) + 1 + (deltas[0] ?? 0);

          // Req 4.4: 단조 증가 시 버전 값 변경
          expect(isNewer(hashVersion(m1), hashVersion(m2))).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('입력 순서가 달라도 같은 mtime 집합이면 동일 버전', () => {
    fc.assert(
      fc.property(
        fc.array(fc.nat({ max: 2_000_000_000 }), { minLength: 1, maxLength: 10 }),
        mtimes => {
          const shuffled = [...mtimes].reverse();
          expect(hashVersion(mtimes)).toBe(hashVersion(shuffled));
        },
      ),
      { numRuns: 50 },
    );
  });

  it('빈 입력은 `"0-0"` 고정 반환(Graceful Path)', () => {
    expect(hashVersion([])).toBe('0-0');
    expect(isNewer('0-0', '0-0')).toBe(false);
  });

  it('isNewer 는 문자열 불일치만으로 판정한다', () => {
    expect(isNewer('abc', 'abc')).toBe(false);
    expect(isNewer('abc', 'def')).toBe(true);
    expect(isNewer('0-0', 'abc-def')).toBe(true);
  });
});
