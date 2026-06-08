/**
 * animation Effective_Option_Value 를 Moabom_Shell_Root(`<html>`) DOM 속성으로 반영한다.
 *
 * `data-moa-animations` 속성을 `'on'` / `'off'` 로 설정하면, 전역 CSS 규칙
 * `html[data-moa-animations="off"] .moa-home-root ...` 가 매칭되어
 * `moabom-basic` 범위 내 모든 엘리먼트의 `animation-duration` / `transition-duration` 을
 * 유효 0초로 강제한다(Req 2.1, 2.2, 2.6).
 *
 * iframe 격리(Req 10.3): 본 함수는 `document.documentElement` 만을 변경하며
 * iframe 내부 `contentDocument` 는 건드리지 않는다 — `moabom-admin_basic` 을
 * iframe 으로 임베드해도 그 안의 DOM 에는 본 속성이 주입되지 않는다.
 *
 * @param enabled `true` 면 애니메이션 허용(`data-moa-animations="on"`),
 *                `false` 면 비활성(`data-moa-animations="off"`).
 */
export function applyMoabomAnimationRuntime(enabled: boolean): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!root) return;

  try {
    root.dataset.moaAnimations = enabled ? 'on' : 'off';
  } catch {
    // `dataset` 에 접근이 실패하는 매우 드문 환경(프로토타입 패치 등) 에서는
    // 애니메이션을 강제로 끄는 쪽이 안전하므로 무시한다.
  }
}
