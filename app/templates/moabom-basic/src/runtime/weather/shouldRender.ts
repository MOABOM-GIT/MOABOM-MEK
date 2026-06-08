import type { EffectiveSystemOptions } from '../types';

/**
 * `shouldRender` 의 입력 — RAF 루프 활성/비활성을 결정짓는 네 요인.
 */
export interface ShouldRenderState {
  /**
   * 상위 스펙(`moabom-system-options-runtime-apply`) 의 해석된 옵션 중 본 스펙이 의존하는 두 필드.
   * `Pick` 으로 축소해 "weather · animation 만 관찰한다" 는 계약을 타입 레벨에서 명시한다.
   */
  effective: Pick<EffectiveSystemOptions, 'weather' | 'animation'>;
  /** 현재 탭 가시성(`document.visibilityState`). */
  visibility: 'visible' | 'hidden';
  /** 캔버스가 뷰포트와 교차 중인지(IntersectionObserver 결과). */
  intersecting: boolean;
}

/**
 * Weather_Render_Loop 를 활성화해야 하는지 결정하는 **순수 함수**.
 *
 * 네 입력의 단순 AND 합성(Req 1.1 · 1.2 · 5.1 · 5.2):
 * `effective.weather && effective.animation && visibility === 'visible' && intersecting`.
 *
 * Property 1(P-Gate) 의 테스트 대상이며, React · DOM 의존이 없어 fast-check 로 전 공간을 탐색할 수 있다.
 */
export function shouldRender(state: ShouldRenderState): boolean {
  return (
    state.effective.weather === true
    && state.effective.animation === true
    && state.visibility === 'visible'
    && state.intersecting === true
  );
}
