/**
 * 창 본문(`.moa-app-window-viewport`) 컨테이너 쿼리 SSOT.
 *
 * - TSX: Tailwind 컨테이너 변형 `@sm:` `@md:` `@lg:` `@xl:` (브라우저 `sm:` 아님)
 * - CSS: 동일 px 리터럴 — `01-tokens.css` / `28-app-window-breakpoints.css`
 *
 * 다열 레이아웃 붕괴·컴팩트 UI도 위 공통 티어만 사용한다 (앱별 `--moa-cq-*` 예외 금지).
 *
 * CSS `@container` 조건은 `var()` 가 무시될 수 있어 px 리터럴과 검증 스크립트로 맞춘다.
 */
export const MOA_APP_WINDOW_CQ = {
  xs: '480px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
} as const;

export type MoaAppWindowCqKey = keyof typeof MOA_APP_WINDOW_CQ;
