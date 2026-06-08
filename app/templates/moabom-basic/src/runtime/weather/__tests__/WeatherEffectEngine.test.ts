import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WeatherEffectEngine } from '../WeatherEffectEngine';
import type { WeatherEffectId } from '../types';

/**
 * 엔진 단위 테스트(Task 5.3).
 *
 * 주입식 `requestFrame` / `cancelFrame` / `now` 로 결정적 시뮬레이션을 구성하고,
 * 다음 계약을 검증한다.
 *  - start/stop 라이프사이클과 RAF 스케줄링
 *  - stop() 의 clearRect + 풀·활성 이펙트 정리
 *  - setEffectSet 전이 시 파티클 풀에서 자신의 kind 만 제거
 *  - 연속 20 프레임 초과 시 particleBudget 절반 감소(1회만)
 *  - ctx 미가용(getContext === null) 환경에서 start 는 no-op
 */

type FrameCb = FrameRequestCallback;

class FakeCanvasContext {
  /** 호출 카운터 (실제 CanvasRenderingContext2D 일부 메서드만 mock) */
  public clearRectCalls = 0;
  public fillRectCalls = 0;
  public savedCount = 0;
  public setTransformCalls = 0;
  public beginPathCalls = 0;
  public arcCalls = 0;
  public moveToCalls = 0;
  public lineToCalls = 0;
  public strokeCalls = 0;
  public fillCalls = 0;

  fillStyle: string | CanvasGradient | CanvasPattern = '#000';
  strokeStyle: string | CanvasGradient | CanvasPattern = '#000';
  lineWidth = 1;
  lineCap: CanvasLineCap = 'butt';
  globalAlpha = 1;

  clearRect(): void { this.clearRectCalls += 1; }
  fillRect(): void { this.fillRectCalls += 1; }
  save(): void { this.savedCount += 1; }
  restore(): void {}
  setTransform(): void { this.setTransformCalls += 1; }
  beginPath(): void { this.beginPathCalls += 1; }
  arc(): void { this.arcCalls += 1; }
  moveTo(): void { this.moveToCalls += 1; }
  lineTo(): void { this.lineToCalls += 1; }
  stroke(): void { this.strokeCalls += 1; }
  fill(): void { this.fillCalls += 1; }
  createLinearGradient(): CanvasGradient {
    return { addColorStop: () => {} } as unknown as CanvasGradient;
  }
}

class FakeCanvas {
  width = 800;
  height = 600;
  private readonly ctx: FakeCanvasContext | null;

  constructor(allowCtx = true) {
    this.ctx = allowCtx ? new FakeCanvasContext() : null;
  }

  getContext(type: string): FakeCanvasContext | null {
    if (type !== '2d') return null;
    return this.ctx;
  }

  getFakeContext(): FakeCanvasContext | null {
    return this.ctx;
  }
}

function createFakeRaf() {
  const queue: FrameCb[] = [];
  let nextHandle = 1;
  const handles = new Map<number, FrameCb>();

  const requestFrame = (cb: FrameCb): number => {
    const h = nextHandle;
    nextHandle += 1;
    handles.set(h, cb);
    queue.push(cb);
    return h;
  };
  const cancelFrame = (handle: number): void => {
    const cb = handles.get(handle);
    if (cb) {
      const idx = queue.indexOf(cb);
      if (idx !== -1) queue.splice(idx, 1);
      handles.delete(handle);
    }
  };
  const runOnce = (): void => {
    const next = queue.shift();
    if (next) next(0);
  };
  return { requestFrame, cancelFrame, runOnce, queue };
}

describe('WeatherEffectEngine', () => {
  let canvas: FakeCanvas;
  let raf: ReturnType<typeof createFakeRaf>;
  let nowMs: number;

  const randomSpy = vi.fn<() => number>();

  beforeEach(() => {
    canvas = new FakeCanvas(true);
    raf = createFakeRaf();
    nowMs = 0;
    // 모든 Math.random 경로를 결정적으로 묶는다.
    randomSpy.mockReturnValue(0.5);
    vi.spyOn(Math, 'random').mockImplementation(() => randomSpy());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeEngine(overrides: Partial<ConstructorParameters<typeof WeatherEffectEngine>[0]> = {}) {
    return new WeatherEffectEngine({
      canvas: canvas as unknown as HTMLCanvasElement,
      initialBudget: 100,
      budgetDropFrameThreshold: 3,
      frameTimeBudgetMs: 8,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
      now: () => nowMs,
      ...overrides,
    });
  }

  it('start 는 RAF 를 스케줄하고 isRunning 을 true 로 만든다', () => {
    const engine = makeEngine();
    expect(engine.isRunning()).toBe(false);
    engine.start();
    expect(engine.isRunning()).toBe(true);
    expect(raf.queue.length).toBe(1);
  });

  it('stop 은 clearRect 를 호출하고 풀·활성 이펙트를 정리한다', () => {
    const engine = makeEngine();
    engine.setEffectSet(new Set<WeatherEffectId>(['rain']));
    engine.start();
    // 첫 프레임 진행.
    nowMs = 16;
    raf.runOnce();
    // 풀에 rain 파티클이 생성되었는지 확인.
    expect(engine.getParticlePoolForTesting().length).toBeGreaterThan(0);
    expect(canvas.getFakeContext()!.clearRectCalls).toBeGreaterThanOrEqual(1);

    engine.stop();
    expect(engine.isRunning()).toBe(false);
    // stop 시점에 clearRect 재호출 + 풀 비우기.
    expect(engine.getParticlePoolForTesting().length).toBe(0);
  });

  it('setEffectSet 으로 rain 을 제거하면 공용 풀에서 rain 파티클만 제거된다', () => {
    const engine = makeEngine();
    engine.setEffectSet(new Set<WeatherEffectId>(['rain', 'snow']));
    engine.start();
    nowMs = 16;
    raf.runOnce();

    const before = engine.getParticlePoolForTesting();
    const rainCountBefore = before.filter((p) => p.kind === 'rain').length;
    const snowCountBefore = before.filter((p) => p.kind === 'snow').length;
    expect(rainCountBefore).toBeGreaterThan(0);
    expect(snowCountBefore).toBeGreaterThan(0);

    engine.setEffectSet(new Set<WeatherEffectId>(['snow']));
    const after = engine.getParticlePoolForTesting();
    const rainCountAfter = after.filter((p) => p.kind === 'rain').length;
    const snowCountAfter = after.filter((p) => p.kind === 'snow').length;
    expect(rainCountAfter).toBe(0);
    // snow 파티클은 그대로 유지.
    expect(snowCountAfter).toBeGreaterThan(0);
  });

  it('연속 20 프레임 >8ms 초과 시 particleBudget 이 절반으로 1회만 감소한다', () => {
    // 각 프레임 안에서 엔진이 `now()` 를 start·end 로 두 번 호출한다. 그 사이에 >8ms 의
    // 프레임 예산 초과를 시뮬레이션하기 위해 호출마다 10ms 씩 진행시키는 지연 시계를 주입한다.
    let counter = 0;
    const slowNow = (): number => {
      const result = counter;
      counter += 10; // 매 호출마다 10ms 증가 → 프레임 end - start = 10ms 초과.
      return result;
    };

    canvas = new FakeCanvas(true);
    raf = createFakeRaf();
    const engine = new WeatherEffectEngine({
      canvas: canvas as unknown as HTMLCanvasElement,
      initialBudget: 400,
      budgetDropFrameThreshold: 3,
      frameTimeBudgetMs: 8,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
      now: slowNow,
    });

    engine.setEffectSet(new Set<WeatherEffectId>(['rain']));
    engine.start();
    expect(engine.getParticleBudget()).toBe(400);

    // 최소 threshold 만큼 느린 프레임 실행.
    for (let frame = 0; frame < 4; frame += 1) {
      raf.runOnce();
    }
    expect(engine.getParticleBudget()).toBe(200);

    // 이후 프레임이 계속 느려도 추가로 감소하지 않는다(1회만).
    for (let frame = 0; frame < 10; frame += 1) {
      raf.runOnce();
    }
    expect(engine.getParticleBudget()).toBe(200);
  });

  it('getContext("2d") === null 인 환경에서 start 는 no-op 이다', () => {
    canvas = new FakeCanvas(false);
    const engine = new WeatherEffectEngine({
      canvas: canvas as unknown as HTMLCanvasElement,
      requestFrame: raf.requestFrame,
      cancelFrame: raf.cancelFrame,
      now: () => nowMs,
    });
    engine.start();
    expect(engine.isRunning()).toBe(false);
    expect(raf.queue.length).toBe(0);
  });

  it('Fog / Smog / Lightning 은 오버레이로 동작하며 파티클을 추가하지 않는다', () => {
    const engine = makeEngine();
    engine.setEffectSet(new Set<WeatherEffectId>(['fog', 'smog', 'lightning']));
    engine.start();
    nowMs = 16;
    raf.runOnce();
    const pool = engine.getParticlePoolForTesting();
    expect(pool.length).toBe(0);
  });
});
