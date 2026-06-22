import type { CSSProperties } from 'react';
import { MOA_HOME_EDGE, MOA_HOME_OVERLAY_EDGE } from '../../shell/moaShellLayoutConstants';

/**
 * 홈 셸 루트(`.moa-home-root`)에 주입하는 레이아웃 CSS 변수.
 * `moaShellLayoutConstants.ts` 가 SSOT — `01-tokens.css` 에 동명 변수를 중복 정의하지 않는다.
 */
export function moaHomeShellCssVars(): CSSProperties {
  return {
    '--moa-home-shell-edge': `${MOA_HOME_EDGE}px`,
    '--moa-home-shell-overlay-edge': `${MOA_HOME_OVERLAY_EDGE}px`,
  } as CSSProperties;
}
