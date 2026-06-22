import { describe, expect, it } from 'vitest';
import { MOA_HOME_EDGE, MOA_HOME_OVERLAY_EDGE } from '../../shell/moaShellLayoutConstants';
import { moaHomeShellCssVars } from './moaHomeShellCssVars';

describe('moaHomeShellCssVars', () => {
  it('moaShellLayoutConstants 와 동일한 px 값을 CSS 변수로 노출한다', () => {
    expect(moaHomeShellCssVars()).toEqual({
      '--moa-home-shell-edge': `${MOA_HOME_EDGE}px`,
      '--moa-home-shell-overlay-edge': `${MOA_HOME_OVERLAY_EDGE}px`,
    });
  });
});
