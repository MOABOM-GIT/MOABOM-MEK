/**
 * 현재 브라우저 환경이 Web Vibration API 를 실효적으로 지원하는지 판정한다(Req 12.4).
 *
 * 판정 규칙(어느 하나라도 참이면 `false`):
 * - `navigator.vibrate` 가 함수가 아니다 → Vibration API 미지원.
 * - UA 가 iPhone / iPad / iPod 를 포함한다 → iOS 클래식.
 * - UA 에 `Macintosh` 가 포함되고 `document` 에 `'ontouchend' in document` 가 참이다
 *   → iPadOS 13+ (데스크톱 클래스 UA 로 보고하지만 터치를 지원).
 *
 * 순수 조회 함수이지만 `navigator` 전역에 의존하므로, 테스트에서는
 * `vi.stubGlobal('navigator', ...)` + `document.ontouchend` 제어로 결정성을 확보한다.
 *
 * UA 접근 중 예외가 발생하는 비정상 환경(스푸핑 확장, prototype 오버라이드 등) 에서도
 * 외곽 `try/catch` 로 방어적 `false` 를 반환한다 — "동작하지 않는 옵션" 을 노출하지 않는
 * 쪽이 안전한 기본값이다.
 *
 * @returns `true` = 햅틱 토글을 UI 에 노출해도 실효가 있음(Haptic_Supported_Environment).
 */
export function isHapticSupportedEnvironment(): boolean {
  try {
    const nav = typeof navigator === 'undefined' ? null : navigator;
    if (!nav) return false;

    // 1) Vibration API 자체가 없으면 즉시 false
    if (typeof (nav as Navigator).vibrate !== 'function') {
      return false;
    }

    // 2) UA 기반 iOS 판정
    const ua = typeof nav.userAgent === 'string' ? nav.userAgent : '';
    const isIOSClassic = /iPad|iPhone|iPod/.test(ua);
    // iPadOS 13+ 는 UA 에서 'Macintosh' 로 표기되지만 터치를 지원한다
    const isIPadOS13Plus =
      /Macintosh/.test(ua) &&
      typeof document !== 'undefined' &&
      'ontouchend' in document;

    if (isIOSClassic || isIPadOS13Plus) {
      return false;
    }

    return true;
  } catch {
    // UA 문자열 접근 중 예외가 발생해도 방어적으로 'Vibration API 존재' 만으로 결정
    try {
      return typeof navigator !== 'undefined' &&
        typeof (navigator as Navigator).vibrate === 'function';
    } catch {
      return false;
    }
  }
}


/**
 * 현재 브라우저 환경을 모바일로 판정한다.
 *
 * 판정 규칙(어느 하나라도 참이면 `true`):
 * - UA 에 `Android` · `iPhone` · `iPad` · `iPod` 중 하나가 포함된다.
 * - UA 에 `Macintosh` 가 포함되고 `document` 에 `'ontouchend' in document` 가 참(iPadOS 13+).
 *
 * UA 접근 중 예외가 발생하는 비정상 환경에서는 `false`(데스크톱으로 간주) 를 반환한다 —
 * `resolveParticleBudget` 가 이 결과를 토대로 예산을 결정할 때, 모바일 오탐으로 성능을
 * 더 낮추는 쪽보다는 데스크톱 기본 예산을 유지하는 쪽이 사용자 체감에 이롭다.
 */
export function isMobileUserAgent(): boolean {
  try {
    const nav = typeof navigator === 'undefined' ? null : navigator;
    if (!nav) return false;

    const ua = typeof nav.userAgent === 'string' ? nav.userAgent : '';
    if (/Android|iPhone|iPad|iPod/.test(ua)) {
      return true;
    }
    // iPadOS 13+ 는 Macintosh + 터치 이벤트로 식별한다.
    if (
      /Macintosh/.test(ua)
      && typeof document !== 'undefined'
      && 'ontouchend' in document
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * `resolveParticleBudget` 입력 — 환경 추정값과 데스크톱 기본 예산.
 *
 * `hardwareConcurrency` 가 `0` 이면 "미상" 으로 간주한다. 일부 환경에서 0 또는 undefined 를
 * 돌려주는 경우가 있으며, 이 때는 저사양으로 오판하지 않고 데스크톱 기본값을 유지한다.
 */
export interface ParticleBudgetEnv {
  isMobile: boolean;
  hardwareConcurrency: number;
  baseline?: number;
}

/**
 * 환경 기반 파티클 예산을 결정하는 **순수 함수**(Req 5.3).
 *
 * 불변식(Property 7 — P-ParticleBudget):
 *  - `result ≤ baseline`
 *  - `(isMobile || hardwareConcurrency ∈ [1, 4]) → result ≤ baseline * 0.5`
 *  - `(!isMobile && hardwareConcurrency > 4) → result === baseline`
 *  - `result ≥ 0`
 *
 * `hardwareConcurrency === 0` 은 "미상" 으로 간주해 데스크톱 기본값을 유지한다(모바일 UA 가 아니라면).
 */
export function resolveParticleBudget(env: ParticleBudgetEnv): number {
  const rawBaseline = env.baseline ?? 400;
  // baseline 이 비정상(음수·NaN·Infinity) 이면 기본 400 으로 보정하고 0 을 허용하지 않는다.
  const baseline = Number.isFinite(rawBaseline) && rawBaseline > 0 ? Math.floor(rawBaseline) : 400;

  const lowCore = env.hardwareConcurrency >= 1 && env.hardwareConcurrency <= 4;

  if (env.isMobile || lowCore) {
    return Math.floor(baseline * 0.5);
  }
  return baseline;
}
