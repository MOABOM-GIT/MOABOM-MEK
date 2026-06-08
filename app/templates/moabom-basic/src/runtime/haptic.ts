import { MoabomRuntime } from './MoabomRuntime';

/**
 * Web Vibration API 가 받는 패턴. 단일 ms 또는 (ms, pause, ms, ...) 배열.
 */
export type MoabomHapticPattern = number | number[];

/**
 * moabom-basic 템플릿의 햅틱 피드백 재생을 담당하는 **단일 진입점**.
 *
 * 동작(Req 4.1 ~ 4.4):
 * - `MoabomRuntime.getEffectiveOption('haptic') === false` 이면 no-op.
 * - `navigator.vibrate` 가 존재하지 않으면 no-op (iOS 계열 등 Vibration API 미지원 환경).
 * - 그 외에는 `navigator.vibrate(pattern)` 을 **정확히 1 회** 호출한다.
 * - `window.navigator.vibrate` 함수 자체를 교체·래핑하지 않는다(Req 4.3).
 * - 어떤 입력에 대해서도 예외를 던지지 않는다(호출부는 UI 피드백 경로에 있으므로
 *   복구 가능한 실패는 silently 흡수한다).
 */
export function vibrateMoabomHaptic(pattern: MoabomHapticPattern): void {
  try {
    if (MoabomRuntime.getEffectiveOption('haptic') === false) return;
  } catch {
    // 레지스트리 조회 실패 시에도 진동을 터뜨리지 않는 쪽이 안전
    return;
  }

  if (typeof navigator === 'undefined') return;
  const vibrate = (navigator as Navigator).vibrate;
  if (typeof vibrate !== 'function') return;

  try {
    /*
     * 반드시 navigator 를 `this` 로 두고 호출한다 — 함수 참조만 detach 해 호출하면 일부 브라우저에서 throw.
     * `vibrate.call` 의 TS 오버로드는 `Iterable<number>` 만 허용하므로 number 단일값도 1-length 배열로 포장한다.
     */
    const patternArray: number[] = typeof pattern === 'number' ? [pattern] : pattern;
    vibrate.call(navigator, patternArray);
  } catch {
    // 패턴 길이 제한 초과 · prototype 패치 실패 등은 조용히 무시(Req 4.4 no-op 계약 확장)
  }
}
