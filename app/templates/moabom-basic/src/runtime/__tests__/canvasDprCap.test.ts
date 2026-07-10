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

  it('syncSurface 는 CSS×dpr 버퍼를 잡고 setTransform(dpr) 을 재적용한다', () => {
    const setTransformSpy = vi.fn();
    const fakeCanvas = {
      width: 100,
      height: 100,
      clientWidth: 100,
      clientHeight: 100,
      getContext: () => ({
        setTransform: setTransformSpy,
        clearRect: vi.fn(),
      } as unknown as CanvasRenderingContext2D),
    } as unknown as HTMLCanvasElement;

    const engine = new WeatherEffectEngine({ canvas: fakeCanvas });
    setTransformSpy.mockClear();

    engine.syncSurface(1920, 1080);
    // dpr=1.5 → 버퍼 2880×1620, 논리 뷰포트는 CSS 1920×1080 유지
    expect(fakeCanvas.width).toBe(2880);
    expect(fakeCanvas.height).toBe(1620);
    expect(setTransformSpy).toHaveBeenCalledWith(1.5, 0, 0, 1.5, 0, 0);
    expect(engine.getDprForTesting()).toBe(1.5);
  });

  it('syncSurface 후 논리 크기는 CSS px 와 같다 (비 굵기·밀도 보존)', () => {
    const fakeCanvas = {
      width: 100,
      height: 100,
      clientWidth: 100,
      clientHeight: 100,
      getContext: () => ({
        setTransform: vi.fn(),
        clearRect: vi.fn(),
      } as unknown as CanvasRenderingContext2D),
    } as unknown as HTMLCanvasElement;

    const engine = new WeatherEffectEngine({ canvas: fakeCanvas });
    engine.syncSurface(390, 844);
    // getLogical* = buffer / dpr → CSS 와 동일해야 파티클 size·lineWidth 가 화면 비율을 유지한다.
    expect(fakeCanvas.width / engine.getDprForTesting()).toBeCloseTo(390, 5);
    expect(fakeCanvas.height / engine.getDprForTesting()).toBeCloseTo(844, 5);
  });
});
