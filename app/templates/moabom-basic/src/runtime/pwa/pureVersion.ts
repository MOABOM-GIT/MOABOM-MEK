/**
 * PWA 버전 결정성 순수 레이어.
 *
 * 본 파일은 외부 I/O · `Date.now` 를 참조하지 않는다. 파일 mtime 벡터만을
 * 입력받아 결정적 16진수 버전 문자열을 산출하며, P3 P-VersionMonotonic
 * 속성(mtime 단조 증가 → 문자열 부등) 을 만족한다.
 *
 * Spec: `.kiro/specs/moabom-pwa-service-worker/` Req 4.3/4.4 · Design §4.2
 */

/**
 * FNV-1a (32-bit) — 순수 함수, 경량 · 결정적.
 *
 * 충돌 가능성은 있으나 본 용도(버전 비교) 는 `max(mtimes)` 접미를 함께
 * 사용해 단조성을 보장하므로 충돌이 발생해도 "더 새로움" 판정에는
 * 영향을 주지 않는다.
 */
function fnv1a32(bytes: string): number {
  // FNV offset basis 32-bit
  let hash = 0x811c9dc5 >>> 0;
  for (let i = 0; i < bytes.length; i++) {
    hash ^= bytes.charCodeAt(i);
    // 32-bit FNV prime = 16777619
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * 파일 mtime 벡터 → 결정적 버전 문자열.
 *
 * 포맷: `<max16>-<fnvHash8>` (예: `68199f8a-2d41c5b7`).
 * - `max16` : 전체 mtime 최대값의 16진수 표현(단조성 보장 핵심).
 * - `fnvHash8` : 정렬된 전체 mtime 의 FNV-1a 해시(충돌 감지용).
 *
 * 입력이 비면 `'0-0'` 고정 문자열을 반환한다(Design §8 Graceful Path).
 */
export function hashVersion(mtimes: readonly number[]): string {
  if (mtimes.length === 0) return '0-0';

  // 결정성: 입력 순서 의존 제거를 위해 정렬 후 해싱.
  const sorted = [...mtimes].sort((a, b) => a - b);
  const maxMtime = sorted[sorted.length - 1] ?? 0;
  const payload = sorted.join(',');
  const hash = fnv1a32(payload);

  const maxHex = maxMtime.toString(16);
  const hashHex = hash.toString(16).padStart(8, '0');
  return `${maxHex}-${hashHex}`;
}

/**
 * 두 버전 문자열의 선후 관계 판정(P3).
 *
 * `hashVersion` 의 포맷이 `max-hash` 이므로 문자열 부등만으로 "더 새로움"
 * 판정이 충분하다. 동일 입력이면 false(롤백 · 동일 상태 표시).
 */
export function isNewer(oldV: string, newV: string): boolean {
  return oldV !== newV;
}
