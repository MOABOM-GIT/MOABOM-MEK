import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WeatherEffectEngine } from '../weather/WeatherEffectEngine';

/**
 * Req 5.4: 엔진은 `window.devicePixelRatio` 를 `WEATHER_DPR_CAP`(기본 1.5) 로 clamp 한다.
 */
describe('WeatherEffectEngine DPR clamp (Req 5.4)', () => {
  const originalDpr = globalThis.window?.devicePixelRatio;

  beforeEach(() => {
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 3,
    });
  });

  afterEach(() => {
    if (originalDpr !== undefined) {
      Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        value: originalDpr,
      });
    }
    vi.restoreAllMocks();
  });

  it('window.devicePixelRatio = 3 인 환경에서 엔진은 setTransform 을 dpr=1.5 로 호출한다', () => {
    const setTransformSpy = vi.fn();
    const fakeCanvas = {
      width: 100,
      height: 100,
      getContext: () => ({
        setTransform: setTransformSpy,
        clearRect: vi.fn(),
      } as unknown as CanvasRenderingContext2D),
    } as unknown as HTMLCanvasElement;

    new WeatherEffectEngine({ canvas: fakeCanvas });
    expect(setTransformSpy).toHaveBeenCalledWith(1.5, 0, 0, 1.5, 0, 0);
  });
});
